/**
 * 标题链接建议的重放基准（testplan Q64，spec §3.23「按主力库重放数据再收紧」）：把一个库的正文用插件**当前源码**里的触发函数
 * 逐字重放一遍（像重新打一遍），统计会弹几次框。调触发规则前后各跑一次，看数字怎么变，不凭感觉调。
 *
 * 用法：`node scripts/suggest-replay.mjs <库路径>`（只读，不改库）。打印：
 * - 每千字弹几次（同一个词打下去框一直开着只算一次）；
 * - 加「不选就记住」后至多几次（假设每次都没选，每篇每个查询只弹一次，Q63）；
 * - 召回：库里真实写下的标题链接 `[[笔记#标题]]`，在原笔记里打出那个标题的文字时能否弹出它；
 * - 最常弹的词。
 *
 * 近似：跳过 frontmatter 与围栏代码块；逐字符模拟，中文输入法一次上屏整个词时实际次数略低；链接只认 wikilink。
 */
import { build } from "esbuild";
import { readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, relative, sep } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vault = process.argv[2];
if (!vault) {
	console.error("用法：node scripts/suggest-replay.mjs <库路径>");
	process.exit(1);
}

// 现场把插件源码里要用的纯函数打成一个临时模块（与插件实际跑的是同一份代码）。
const src = (p) => JSON.stringify(join(root, "src", p).split(sep).join("/"));
const outfile = join(tmpdir(), `ah-suggest-replay-${process.pid}.mjs`);
await build({
	stdin: {
		contents: [
			`export { HeadingIndex } from ${src("headingindex")};`,
			`export { HeadingLinkCounts, resolveLinkedHeadingKeys } from ${src("headinglinks")};`,
			`export { extractTriggerToken, isBlockedContext, resolveTriggerQuery, hasShortWordSignal } from ${src("headingtrigger")};`,
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
				basename: e.name.slice(0, -3),
				content: readFileSync(p, "utf8"),
			});
		}
	}
};
walk(vault);

const index = new m.HeadingIndex();
index.loadInitial(files);
const byBase = new Map();
for (const f of files) {
	const k = f.basename.toLowerCase();
	if (!byBase.has(k)) byBase.set(k, f.path);
}
const links = new m.HeadingLinkCounts();
const realLinks = [];
const LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
for (const f of files) {
	const raw = [...f.content.matchAll(LINK_RE)].map((x) => x[1]);
	const resolve = (lp) =>
		lp === "" ? f.path : (byBase.get(lp.split("/").pop().toLowerCase()) ?? null);
	const entriesOf = (p) => index.entriesOf(p);
	links.setSource(f.path, m.resolveLinkedHeadingKeys(raw, resolve, entriesOf));
	for (const r of raw) {
		const h = r.indexOf("#");
		const dest = h < 0 ? null : resolve(r.slice(0, h));
		const key = dest ? m.resolveLinkedHeadingKeys([r], resolve, entriesOf)[0] : undefined;
		const target = key ? index.entriesOf(dest).find((e) => e.matchKey === key) : undefined;
		if (target) realLinks.push({ src: f.path, target });
	}
}

// 与 headingsuggest.ts onTrigger 同一套判定
const hitAt = (before, path, self) => {
	const ex = m.extractTriggerToken(before);
	if (!ex || m.isBlockedContext(before, ex.start)) return null;
	const hit = m.resolveTriggerQuery(ex.token, ex.start, {
		hasAnyPrefixMatch: (q) => index.hasAnyPrefixMatch(q, self),
		hasExactMatch: (q) => index.hasExactMatch(q, self),
		isRelevant: (q) =>
			m.hasShortWordSignal(
				index.exactMatchPaths(q, self),
				links.count(q),
				links.linksFrom(path, q),
				path,
			),
	});
	return hit ? hit.query : null;
};

let typed = 0;
let pops = 0;
let popsOnce = 0;
const words = new Map();
for (const f of files) {
	const seen = new Set();
	const lines = f.content.split("\n");
	let inFm = lines[0] === "---";
	let inCode = false;
	lines.forEach((line, li) => {
		if (inFm) {
			if (li > 0 && line === "---") inFm = false;
			return;
		}
		if (/^\s*(```|~~~)/.test(line)) {
			inCode = !inCode;
			return;
		}
		if (inCode) return;
		const self = { path: f.path, lineIndex: li };
		let prev = null;
		let pos = 0;
		// 「不选就记住」照 DismissMemory：框开着时出现过的查询，关框时一起记下；记下的查询不再触发。
		let episode = [];
		const closeEpisode = () => {
			for (const q of episode) seen.add(q);
			episode = [];
		};
		for (const ch of line) {
			pos += ch.length;
			typed++;
			const now = hitAt(line.slice(0, pos), f.path, self);
			if (now && !prev) {
				pops++;
				words.set(now, (words.get(now) ?? 0) + 1);
			}
			prev = now;
			const remembered = now && !seen.has(now) ? now : null;
			if (remembered && episode.length === 0) popsOnce++;
			if (remembered) episode.push(remembered);
			else closeEpisode();
		}
		closeEpisode();
	});
}

let recalled = 0;
let eligible = 0;
for (const { src: from, target } of realLinks) {
	if (index.isGenericKey(target.matchKey)) continue;
	eligible++;
	const text = target.displayText;
	const self = { path: from, lineIndex: -1 };
	let pos = 0;
	for (const ch of text) {
		pos += ch.length;
		const q = hitAt(text.slice(0, pos), from, self);
		if (q && target.matchKey.includes(q)) {
			recalled++;
			break;
		}
	}
}

const perK = (n) => ((n / typed) * 1000).toFixed(2);
console.log(`${files.length} 篇笔记，${index.size} 个标题进索引，重放 ${typed} 字`);
console.log(
	`每千字弹 ${perK(pops)} 次（共 ${pops}）；加「不选就记住」后至多 ${perK(popsOnce)} 次（${popsOnce}）`,
);
console.log(
	`召回：${recalled}/${eligible} = ${((recalled / Math.max(1, eligible)) * 100).toFixed(1)}%（真实标题链接 ${realLinks.length} 个，套话目标不计）`,
);
console.log(
	"最常弹：" +
		[...words.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 30)
			.map(([k, v]) => `${k}×${v}`)
			.join("  "),
);
