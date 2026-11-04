/**
 * 手写编号判定的语料基准（spec §3.10「按置信度分级」，testplan J29–J34）：用插件**当前源码**的整篇判定把一个库的
 * 标题过一遍，对照 1.3.1 的单标题正则，看各档多少条、迁移守卫会拦几篇。调判定规则前后各跑一次，按数字定门槛。
 *
 * 用法：`node scripts/foreign-corpus.mjs <库路径> [报告路径]`（只读，不改库）。终端只打统计；给了报告路径时
 * 另写一份带全部样例的 Markdown——样例含库里的标题原文，**放 `doc/research/`（不入库）**，别写进仓库别处。
 */
import { build } from "esbuild";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, relative, sep } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [vault, report] = process.argv.slice(2);
if (!vault) {
	console.error("用法：node scripts/foreign-corpus.mjs <库路径> [报告路径]");
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
		const line = `${f.path}　${"#".repeat(h.level)} ${h.text}`;
		if (a) rows[a.tier].push(line);
		else if (old) rows.dropped.push(line);
	}
	// 迁移守卫只对「插件从未接触过」的文件生效；旧口径近似为「无插件前缀 + 任一标题命中」。
	const claimed = hs.some((h) => m.hasPluginPrefix(h.rawText));
	if (!claimed && oldAny) oldGuardFiles++;
	if (m.hasUnclaimedForeignNumbering(f.content)) newGuardFiles++;
	if (m.isMostlyForeignNumbered(f.content)) virtualHiddenFiles++;
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
