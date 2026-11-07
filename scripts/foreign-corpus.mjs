/**
 * 手写编号判定的语料基准（spec §3.10「按置信度分级」，testplan J29–J34）：用插件**当前源码**的整篇判定把一个库的
 * 标题过一遍，对照 1.3.1 的单标题正则，看各档多少条、迁移守卫会拦几篇。调判定规则前后各跑一次，按数字定门槛。
 *
 * 用法：`node scripts/foreign-corpus.mjs <库路径> [报告路径]`（只读，不改库）。终端只打统计；给了报告路径时
 * 另写一份带全部样例的 Markdown——样例含库里的标题原文，**放 `doc/research/`（不入库）**，别写进仓库别处。
 *
 * **对答案**：`--expect <答案.json>`（同样放 `doc/research/`）按各入口逐项比对，有不符就非零退出——数字变了不等于
 * 变好了，要看该认的认没认、不该认的有没有误认。答案格式：
 *
 * ```json
 * {
 *   "notes": { "Blog/某篇.md": { "guard": true, "virtualHidden": true } },
 *   "headings": { "Blog/某篇.md :: 2024 总结": "unsure" }
 * }
 * ```
 *
 * `notes` 里写的字段才比（`guard` = 写入模式迁移守卫会拦，`virtualHidden` = 仅显示模式不叠编号、弹提示）；
 * `headings` 的键是「路径 :: 标题文字」，值为 `sure` / `unsure` / `none`（不是候选）。守卫或仅显示命中、却没写进
 * `notes` 的笔记另列为「未标注」，供人工补答案。
 */
import { build } from "esbuild";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, relative, sep } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const expectAt = args.indexOf("--expect");
const expectPath = expectAt >= 0 ? args.splice(expectAt, 2)[1] : undefined;
const [vault, report] = args;
if (!vault || (expectAt >= 0 && !expectPath)) {
	console.error(
		"用法：node scripts/foreign-corpus.mjs <库路径> [报告路径] [--expect <答案.json>]",
	);
	process.exit(1);
}

// 现场把插件源码里要用的纯函数打成一个临时模块（与插件实际跑的是同一份代码）。
const src = (p) => JSON.stringify(join(root, "src", p).split(sep).join("/"));
const outfile = join(tmpdir(), `ah-foreign-corpus-${process.pid}.mjs`);
await build({
	stdin: {
		contents: [
			`export { assessForeignNumbering } from ${src("foreignassess")};`,
			`export { hasUnclaimedForeignNumbering, isMostlyForeignNumbered } from ${src("cleanup")};`,
			`export { parseHeadings } from ${src("parser")};`,
			`export { hasPluginPrefix, stripForeignNumbering } from ${src("strip")};`,
		].join("\n"),
		resolveDir: root,
		loader: "ts",
	},
	bundle: true,
	platform: "node",
	format: "esm",
	external: ["obsidian"],
	outfile,
	logLevel: "warning",
});
const m = await import(pathToFileURL(outfile).href);
rmSync(outfile, { force: true });

const files = [];
const walk = (dir) => {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (e.name.startsWith(".")) continue;
		const p = join(dir, e.name);
		if (e.isDirectory()) walk(p);
		else if (e.name.endsWith(".md")) {
			files.push({
				path: relative(vault, p).split(sep).join("/"),
				content: readFileSync(p, "utf8"),
			});
		}
	}
};
walk(vault);

let headings = 0;
let oldHits = 0;
let oldGuardFiles = 0;
let newGuardFiles = 0;
let virtualHiddenFiles = 0;
const rows = { sure: [], unsure: [], dropped: [] };
/** 每篇笔记各入口的实际结果与每个标题的实际档位，供 `--expect` 对答案。 */
const actualNotes = new Map();
const actualHeadings = new Map();
for (const f of files) {
	const hs = m.parseHeadings(f.content);
	headings += hs.length;
	const assessed = new Map(m.assessForeignNumbering(f.content).map((a) => [a.lineIndex, a]));
	let oldAny = false;
	for (const h of hs) {
		if (m.hasPluginPrefix(h.rawText)) continue;
		// 1.3.1 口径：单标题正则剥得掉东西就算外来编号。
		const old = m.stripForeignNumbering(h.rawText) !== h.rawText.replace(/\s+$/, "");
		const a = assessed.get(h.lineIndex);
		if (old) {
			oldHits++;
			oldAny = true;
		}
		actualHeadings.set(`${f.path} :: ${h.text}`, a ? a.tier : "none");
		const line = `${f.path}　${"#".repeat(h.level)} ${h.text}`;
		if (a) rows[a.tier].push(line);
		else if (old) rows.dropped.push(line);
	}
	// 迁移守卫只对「插件从未接触过」的文件生效；旧口径近似为「无插件前缀 + 任一标题命中」。
	const claimed = hs.some((h) => m.hasPluginPrefix(h.rawText));
	if (!claimed && oldAny) oldGuardFiles++;
	const guard = m.hasUnclaimedForeignNumbering(f.content);
	const virtualHidden = m.isMostlyForeignNumbered(f.content);
	if (guard) newGuardFiles++;
	if (virtualHidden) virtualHiddenFiles++;
	actualNotes.set(f.path, { guard, virtualHidden });
}

const summary = [
	`笔记 ${files.length} 篇，标题 ${headings} 个`,
	`1.3.1 单标题正则命中：${oldHits} 个；写入模式下守卫会拦 ${oldGuardFiles} 篇`,
	`新判定：确定 ${rows.sure.length} / 存疑 ${rows.unsure.length} / 旧命中但现在不算 ${rows.dropped.length}`,
	`新判定下守卫会拦 ${newGuardFiles} 篇；仅显示模式会因过半不显示 ${virtualHiddenFiles} 篇`,
];
console.log(summary.join("\n"));

if (report) {
	const section = (title, list) => [
		`## ${title}（${list.length}）`,
		"",
		...list.map((l) => `- ${l}`),
		"",
	];
	writeFileSync(
		report,
		[
			"# 手写编号判定语料报告",
			"",
			...summary.map((s) => `- ${s}`),
			"",
			...section("确定", rows.sure),
			...section("存疑", rows.unsure),
			...section("旧命中、现在不算", rows.dropped),
		].join("\n"),
	);
	console.log(`报告：${report}`);
}

if (expectPath) {
	const expected = JSON.parse(readFileSync(expectPath, "utf8"));
	const wrong = [];
	for (const [path, want] of Object.entries(expected.notes ?? {})) {
		const got = actualNotes.get(path);
		if (!got) {
			wrong.push(`笔记不存在：${path}`);
			continue;
		}
		for (const key of ["guard", "virtualHidden"]) {
			if (key in want && want[key] !== got[key]) {
				wrong.push(`${path} · ${key} 应为 ${want[key]}，实际 ${got[key]}`);
			}
		}
	}
	for (const [key, want] of Object.entries(expected.headings ?? {})) {
		const got = actualHeadings.get(key);
		if (got === undefined) wrong.push(`标题不存在：${key}`);
		else if (got !== want) wrong.push(`${key} · 应为 ${want}，实际 ${got}`);
	}
	const unlisted = [...actualNotes]
		.filter(([path, r]) => (r.guard || r.virtualHidden) && !(path in (expected.notes ?? {})))
		.map(([path, r]) => `${path} · guard=${r.guard} virtualHidden=${r.virtualHidden}`);
	console.log(`
对答案：${wrong.length ? `${wrong.length} 处不符` : "全部相符"}`);
	for (const w of wrong) console.log(`  ✗ ${w}`);
	if (unlisted.length) {
		console.log(`未标注（守卫或仅显示命中、答案里没写，${unlisted.length} 篇）：`);
		for (const u of unlisted) console.log(`  ? ${u}`);
	}
	if (wrong.length) process.exitCode = 1;
}
