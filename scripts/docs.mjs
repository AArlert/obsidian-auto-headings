/**
 * 文档维护脚本：每个开发周期收尾时跑一次，把「机械整理」与「一致性校验」从 Agent 手里接过来。
 *
 * 用法：
 *   node scripts/docs.mjs             # 归档 log.md 旧块 + testplan 摘要 + 全部守卫
 *   node scripts/docs.mjs --handover  # 接手模式（只读）：版本 + log 最新块 + 近期周期索引 + testplan 待办
 *   node scripts/docs.mjs --keep 5    # 改变 log.md 保留的最新周期块数（默认 3）
 *   node scripts/docs.mjs --check     # 只检查不改动（pre-commit / CI 用）：守卫不过即非零退出
 *
 * 做五件事：
 * 1. **归档 log.md**：只在 log.md 保留最新 N 个「带日期的周期块」，更旧的整体移入
 *    doc/log-archive.md（倒序，新的在上）。标题含日期 YYYY-MM-DD 的 `## ` 块是周期块；
 *    无日期的 `## ` 块是常青块，永远留在 log.md。--check 下超限即失败。
 * 2. **testplan 摘要**：只统计 doc/testplan/ 下的场景组文件（字母开头；数字开头的说明 / 已知 bug /
 *    UVM 章不计入），按状态计数并列出所有**非 ✅** 行（场景 ID + 文件:行号）。**只读不改**。
 * 3. **索引守卫**：doc/spec.md ↔ doc/spec/、doc/testplan.md ↔ doc/testplan/ 双向比对（漏登记 /
 *    索引指向不存在的文件）；分节文件名的节号须与其 H1 标题一致且全目录唯一——同一节只能有一个
 *    文件，单一来源由脚本保证。
 * 4. **链接守卫**：文档里的相对链接与锚点都须能解析（锚点按 GitHub 渲染口径算 slug）。
 *    log-archive.md 是历史原文，不校验。
 * 5. **目录树守卫**：doc/spec/4-架构设计.md「目录结构约定」块列出的 .ts/.mjs 与磁盘**双向比对**，
 *    漂移即报错——新增 / 拆分源码文件必须回填目录树。
 *
 * 设计原则：纯机械、可重复跑（幂等）。Agent 先在 log.md 顶部写完本周期新块、改完 testplan，
 * 再跑本脚本把旧块挪走——所以「写」与「挪」解耦，互不干扰。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve, relative } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docDir = join(root, "doc");
const LOG = join(docDir, "log.md");
const ARCHIVE = join(docDir, "log-archive.md");
const TESTPLAN_DIR = join(docDir, "testplan");
const TREE_DOC = join(docDir, "spec", "4-架构设计.md");
/** 顶层索引 ↔ 分节目录。 */
const INDEXES = [
	{ index: join(docDir, "spec.md"), dir: join(docDir, "spec") },
	{ index: join(docDir, "testplan.md"), dir: TESTPLAN_DIR },
];

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const handover = args.includes("--handover");
const keepIdx = args.indexOf("--keep");
const KEEP = keepIdx >= 0 ? Number(args[keepIdx + 1]) : 3;
if (!Number.isInteger(KEEP) || KEEP < 1) {
	console.error(`--keep 须为 ≥1 的整数，收到：${args[keepIdx + 1]}`);
	process.exit(1);
}
/** handover 列出的近期周期标题条数（log.md + log-archive.md 合计）。 */
const RECENT = 8;

const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const MARKERS = ["✅", "❌", "⚠️", "🔲"];

// ───────────────────────── Markdown 小工具 ─────────────────────────

/** 逐行标注是否处于围栏代码块内（``` / ~~~，可带引用前缀；围栏行本身也算在内）。 */
function fenceMask(lines) {
	const mask = new Array(lines.length).fill(false);
	let open = null;
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(/^(?:\s*>)*\s*(`{3,}|~{3,})(.*)$/);
		if (open) {
			mask[i] = true;
			if (m && m[1][0] === open[0] && m[1].length >= open.length && !m[2].trim()) open = null;
		} else if (m) {
			mask[i] = true;
			open = m[1];
		}
	}
	return mask;
}

/** 标题行的渲染文本：去掉行内代码反引号、链接只留文字、去强调符号。 */
function headingText(raw) {
	let t = raw
		.replace(/^#{1,6}\s+/, "")
		.replace(/\s+#+\s*$/, "")
		.trim();
	t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
	t = t.replace(/(`+)([\s\S]*?)\1/g, (_, __, code) => code.trim());
	t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
	t = t.replace(/(^|[^\w*])\*([^*]+)\*(?!\w)/g, "$1$2");
	return t.replace(/~~([^~]+)~~/g, "$1");
}

/** GitHub（github-slugger）口径：小写 → 删掉字母/记号/数字/连接符/空格/连字符以外的字符 → 空格变 `-`。 */
function slug(text) {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
		.replace(/ /g, "-");
}

/** 文件的全部标题（围栏外），slug 已按 GitHub 规则去重（重名依次加 -1、-2）。 */
function headings(md) {
	const lines = md.split("\n");
	const mask = fenceMask(lines);
	const seen = new Map();
	const out = [];
	lines.forEach((line, i) => {
		if (mask[i]) return;
		const m = line.match(/^(#{1,6})\s+\S/);
		if (!m) return;
		const text = headingText(line);
		const base = slug(text);
		let s = base;
		if (seen.has(base)) {
			let n = seen.get(base);
			do s = `${base}-${++n}`;
			while (seen.has(s));
			seen.set(base, n);
		}
		if (!seen.has(s)) seen.set(s, 0);
		out.push({ line: i, level: m[1].length, text, slug: s });
	});
	return out;
}

/** 一行里的 Markdown 链接目标（跳过行内代码）。只认 `[..](target)`，target 不含空白。 */
function linkTargets(line) {
	return line
		.split(/(`+[^`]*?`+)/)
		.filter((_, idx) => idx % 2 === 0)
		.flatMap((part) => [...part.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]));
}

// ───────────────────────── 1. 归档 log.md ─────────────────────────

/**
 * 把 markdown 按 `## ` 顶层标题切块。返回 { preamble, sections:[{heading, text}] }。
 * preamble = 第一个 `## ` 之前的全部内容（标题 + 导语）。
 * 每个 section.text 含其 `## ` 标题行及到下一个 `## ` 前的全部正文。
 */
function splitSections(md) {
	const lines = md.split("\n");
	const starts = [];
	for (let i = 0; i < lines.length; i++) {
		if (/^## /.test(lines[i])) starts.push(i);
	}
	if (starts.length === 0) return { preamble: md, sections: [] };
	const preamble = lines.slice(0, starts[0]).join("\n");
	const sections = starts.map((s, idx) => {
		const end = idx + 1 < starts.length ? starts[idx + 1] : lines.length;
		return { heading: lines[s], text: lines.slice(s, end).join("\n"), start: s };
	});
	return { preamble, sections };
}

/** 去掉块首尾的空行与孤立 `---` 分隔线，便于用统一分隔符重新拼接。 */
function trimBlock(text) {
	return text
		.trim()
		.replace(/\n*\s*---\s*$/, "")
		.trim();
}

function archiveLog() {
	if (!existsSync(LOG)) {
		console.error(`找不到 ${LOG}`);
		process.exit(1);
	}
	const { preamble, sections } = splitSections(readFileSync(LOG, "utf8"));

	const dated = sections.filter((sec) => DATE_RE.test(sec.heading));
	const keep = dated.slice(0, KEEP);
	const toArchive = dated.slice(KEEP);

	if (toArchive.length === 0) {
		console.log(`[log] 周期块共 ${dated.length} 个，≤ 保留数 ${KEEP}，无需归档。`);
		return;
	}
	if (checkOnly) {
		// 钩子守卫：log.md 超过保留数即视为「忘了归档」，以非零退出拦下提交。
		console.error(
			`[log] --check 失败：log.md 有 ${dated.length} 个周期块，超过保留数 ${KEEP}。` +
				`请先跑 \`npm run docs\` 归档旧块，再重新提交。`,
		);
		process.exitCode = 1;
		return;
	}

	// 常青块：在第一个周期块「之前」的留顶部，之后的沉到底部参考区。
	const topPinned = [];
	const bottomPinned = [];
	let seenDated = false;
	for (const sec of sections) {
		if (DATE_RE.test(sec.heading)) {
			seenDated = true;
			continue;
		}
		if (seenDated) bottomPinned.push(sec);
		else topPinned.push(sec);
	}

	const SEP = "\n\n---\n\n";
	const newLog =
		preamble
			.trim()
			.replace(/\n*\s*---\s*$/, "")
			.trim() +
		SEP +
		[
			...topPinned.map((s) => trimBlock(s.text)),
			...keep.map((s) => trimBlock(s.text)),
			...bottomPinned.map((s) => trimBlock(s.text)),
		].join(SEP) +
		"\n";
	writeFileSync(LOG, newLog);

	// 归档文件：新归档块倒序在上，叠在既有归档之前。
	const archiveHeader =
		"# obsidian-auto-headings 开发日志归档（log-archive）\n\n" +
		"> 本文件是 `log.md` 滚动出去的**历史周期块**（倒序，新的在上）。平时不必读；\n" +
		"> 需要某次改动的来龙去脉时再来翻。当前活跃日志见 [`log.md`](./log.md)。\n" +
		">\n" +
		"> 2026-09-26 起 spec / testplan 拆成「顶层索引 + 分节文件」：此前条目里的 `spec.md#锚点`、\n" +
		"> `testplan.md` 行号指当时的单文件，请按 § 号 / 场景 ID 查 `doc/spec.md`、`doc/testplan.md` 索引。\n";
	const archivedBlocks = toArchive.map((s) => trimBlock(s.text)).join(SEP);
	let existing = "";
	if (existsSync(ARCHIVE)) {
		const raw = readFileSync(ARCHIVE, "utf8");
		// 剥掉旧归档文件的 preamble（到第一个 `## ` 为止），只取历史块拼回。
		const sp = splitSections(raw);
		existing = sp.sections.map((s) => trimBlock(s.text)).join(SEP);
	}
	const newArchive =
		archiveHeader + "\n---\n\n" + archivedBlocks + (existing ? SEP + existing : "") + "\n";
	writeFileSync(ARCHIVE, newArchive);

	console.log(
		`[log] 归档 ${toArchive.length} 个旧周期块 → log-archive.md；log.md 保留最新 ${keep.length} 块` +
			`（+ ${topPinned.length + bottomPinned.length} 个常青块）。`,
	);
}

// ───────────────────────── 2. testplan 摘要 ─────────────────────────

/**
 * 场景组文件：doc/testplan/ 下以大写字母开头的文件（`A-基础编号.md` …）。
 * 数字开头的是使用说明 / 核心理念 / 已知 bug / UVM 章——其中的 ✅/❌ 是说明或另类登记，
 * 不是场景行，计入会产生误报（曾把图例表的「❌ = 已知 bug…」当成一条待修场景）。
 */
function scenarioFiles() {
	if (!existsSync(TESTPLAN_DIR)) return [];
	return readdirSync(TESTPLAN_DIR)
		.filter((f) => /^[A-Z]-.*\.md$/.test(f))
		.sort();
}

function reportTestplan() {
	const files = scenarioFiles();
	if (files.length === 0) {
		console.log(`[testplan] ${TESTPLAN_DIR} 下无场景组文件，跳过。`);
		return;
	}
	const counts = Object.fromEntries(MARKERS.map((m) => [m, 0]));
	const outstanding = [];
	for (const f of files) {
		readFileSync(join(TESTPLAN_DIR, f), "utf8")
			.split("\n")
			.forEach((line, i) => {
				if (!line.startsWith("|")) return;
				const cells = line.split("|").map((c) => c.trim());
				const last =
					cells[cells.length - 1] === ""
						? cells[cells.length - 2]
						: cells[cells.length - 1];
				if (!last) return;
				const marker = MARKERS.find((m) => last.startsWith(m));
				if (!marker) return;
				// 场景行的首格是 ID（如 A1 / **L25**）；表头、分隔行、说明行都不计。
				const id = (cells[1] || "").replace(/\*/g, "");
				if (!/^[A-Za-z][\w-]*\d/.test(id)) return;
				counts[marker]++;
				if (marker !== "✅") outstanding.push(`  ${marker} ${id}  testplan/${f}:${i + 1}`);
			});
	}
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	console.log(
		`[testplan] 场景 ${total} 条（${files.length} 个场景组文件）：` +
			MARKERS.map((m) => `${m}${counts[m]}`).join(" / ") +
			"（已知 bug / UVM 覆盖表另行登记，不计入）",
	);
	if (outstanding.length) {
		console.log(
			`[testplan] 待办（非 ✅，共 ${outstanding.length}）——读这里即可，不必逐个打开场景组文件：`,
		);
		console.log(outstanding.join("\n"));
	}
}

// ───────────────────────── 3. 索引守卫 ─────────────────────────

/** 节号：「3.22 …」「1. 背景」→ 数字节号；「附录 A — …」→ A；「A.11 …」「E. 解析边界」→ 字母节号。 */
function sectionId(text) {
	const m =
		text.match(/^(\d+(?:\.\d+)*)\.?\s/) ||
		text.match(/^附录 ([A-Z])\b/) ||
		text.match(/^([A-Z](?:\.\d+)*)\.?\s/);
	return m ? m[1] : null;
}

function checkIndexes() {
	for (const { index, dir } of INDEXES) {
		const name = relative(docDir, index);
		if (!existsSync(index) || !existsSync(dir)) {
			console.error(`[index] 缺少 ${name} 或其分节目录 ${relative(docDir, dir)}/`);
			process.exitCode = 1;
			continue;
		}
		const sub = relative(docDir, dir);
		const linked = new Set(
			readFileSync(index, "utf8")
				.split("\n")
				.flatMap(linkTargets)
				.map((t) => decodeURI(t.split("#")[0]))
				.filter((p) => p.startsWith(`./${sub}/`) && p.endsWith(".md"))
				.map((p) => p.slice(sub.length + 3)),
		);
		const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
		const missing = files.filter((f) => !linked.has(f));
		const phantom = [...linked].filter((f) => !files.includes(f));
		const problems = [];
		if (missing.length) problems.push(`索引漏登记：${missing.join("、")}`);
		if (phantom.length) problems.push(`索引指向不存在的文件：${phantom.join("、")}`);
		// 节号 = 文件名 `-` 前的部分，须与该文件第一个标题的节号一致，且目录内唯一。
		const owner = new Map();
		for (const f of files) {
			const id = f.slice(0, f.indexOf("-"));
			const first = headings(readFileSync(join(dir, f), "utf8"))[0];
			const headId = first ? sectionId(first.text) : null;
			if (headId !== id)
				problems.push(`${f}：文件名节号「${id}」与标题节号「${headId}」不一致`);
			if (owner.has(id)) problems.push(`节号「${id}」同时出现在 ${owner.get(id)} 与 ${f}`);
			else owner.set(id, f);
		}
		if (problems.length) {
			problems.forEach((p) => console.error(`[index] ${name}：${p}`));
			process.exitCode = 1;
		} else {
			console.log(
				`[index] ${name} ↔ ${sub}/ 一致（${files.length} 个分节文件，节号唯一）。`,
			);
		}
	}
}

// ───────────────────────── 4. 链接守卫 ─────────────────────────

/** 需要校验链接的 Markdown：doc/（历史归档与本地调研除外）、仓库根、.claude/、tests/。 */
function markdownFiles() {
	const out = [];
	const SKIP = new Set(["node_modules", ".git", "release", "research"]);
	const walk = (dir) => {
		for (const ent of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, ent.name);
			if (ent.isDirectory()) {
				if (!SKIP.has(ent.name)) walk(p);
			} else if (ent.name.endsWith(".md") && p !== ARCHIVE) out.push(p);
		}
	};
	for (const f of readdirSync(root)) if (f.endsWith(".md")) out.push(join(root, f));
	for (const d of ["doc", ".claude", "tests"]) if (existsSync(join(root, d))) walk(join(root, d));
	return out;
}

function checkLinks() {
	const slugCache = new Map();
	const slugsOf = (abs) => {
		if (!slugCache.has(abs))
			slugCache.set(abs, new Set(headings(readFileSync(abs, "utf8")).map((h) => h.slug)));
		return slugCache.get(abs);
	};
	const broken = [];
	const files = markdownFiles();
	for (const abs of files) {
		const lines = readFileSync(abs, "utf8").split("\n");
		const mask = fenceMask(lines);
		lines.forEach((line, i) => {
			if (mask[i]) return;
			for (const t of linkTargets(line)) {
				if (/^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith("<")) continue;
				const [p, a] = t.split("#");
				const target = p ? resolve(dirname(abs), decodeURI(p)) : abs;
				const where = `${relative(root, abs)}:${i + 1}`;
				if (!existsSync(target)) broken.push(`${where} 文件不存在 → ${t}`);
				else if (a && target.endsWith(".md") && statSync(target).isFile()) {
					if (!slugsOf(target).has(decodeURIComponent(a)))
						broken.push(`${where} 锚点不存在 → ${t}`);
				}
			}
		});
	}
	if (broken.length) {
		broken.forEach((b) => console.error(`[links] ${b}`));
		console.error(
			`[links] 共 ${broken.length} 处失效链接（锚点按 GitHub 口径：小写、去标点、空格变 -）。`,
		);
		process.exitCode = 1;
	} else {
		console.log(`[links] ${files.length} 个 Markdown 文件的相对链接与锚点全部可解析。`);
	}
}

// ───────────────────────── 5. 目录树守卫 ─────────────────────────

/** 递归收集目录下的 .ts/.mjs 文件名（basename），跳过与源码无关的目录。 */
function collectDiskFiles(dir, out) {
	const SKIP = new Set(["node_modules", "tests", "release", "publish", "doc", ".git"]);
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		if (ent.isDirectory()) {
			if (!SKIP.has(ent.name)) collectDiskFiles(join(dir, ent.name), out);
		} else if (/\.(ts|mjs)$/.test(ent.name)) {
			out.add(ent.name);
		}
	}
	return out;
}

/**
 * 目录树守卫：架构设计节里「目录结构约定」块 vs 磁盘实际 .ts/.mjs 文件双向比对。
 * 目录树最容易烂——新增 / 拆分源码文件忘了回填，接手 Agent 就会被过期地图误导。
 */
function checkTree() {
	const name = relative(root, TREE_DOC);
	if (!existsSync(TREE_DOC)) {
		console.error(`[tree] 找不到 ${name}，无法校验目录结构约定。`);
		process.exitCode = 1;
		return;
	}
	const lines = readFileSync(TREE_DOC, "utf8").split("\n");
	const start = lines.findIndex((l) => /^## .*目录结构/.test(l));
	if (start < 0) {
		console.error(`[tree] ${name} 未找到「## 目录结构约定」一节。`);
		process.exitCode = 1;
		return;
	}
	let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
	if (end < 0) end = lines.length;
	const text = lines.slice(start, end).join("\n");
	const docSet = new Set(
		[...text.matchAll(/[\w.-]+\.(?:ts|mjs)\b/g)].map((m) =>
			m[0].slice(m[0].lastIndexOf("/") + 1),
		),
	);
	const diskSet = collectDiskFiles(root, new Set());
	const missing = [...diskSet].filter((f) => !docSet.has(f)).sort();
	const phantom = [...docSet].filter((f) => !diskSet.has(f)).sort();
	if (missing.length === 0 && phantom.length === 0) {
		console.log(`[tree] 目录结构约定与磁盘一致（${diskSet.size} 个 .ts/.mjs）。`);
		return;
	}
	if (missing.length) console.error(`[tree] 磁盘有但目录树漏登记：${missing.join("、")}`);
	if (phantom.length) console.error(`[tree] 目录树列了但磁盘不存在：${phantom.join("、")}`);
	console.error(`[tree] 请修缮 ${name}「目录结构约定」后重试。`);
	process.exitCode = 1;
}

// ───────────────────────── 接手模式 ─────────────────────────

/** 接手模式（只读）：一条命令打印接手所需的全部信息。 */
function printHandover() {
	const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8").trimStart());
	console.log(`══ 当前版本 ══`);
	console.log(
		`  ${manifest.version}（manifest.json；只在发版时 bump，此后未发版的改动见下方 log）`,
	);

	const dated = [];
	if (existsSync(LOG)) dated.push(...splitSections(readFileSync(LOG, "utf8")).sections);
	if (existsSync(ARCHIVE) && dated.filter((s) => DATE_RE.test(s.heading)).length < RECENT)
		dated.push(...splitSections(readFileSync(ARCHIVE, "utf8")).sections);
	const cycles = dated.filter((s) => DATE_RE.test(s.heading));
	if (cycles.length) {
		console.log(`\n══ 最新周期块（log.md）══`);
		console.log(trimBlock(cycles[0].text));
		console.log(`\n══ 近期周期索引（新 → 旧）══`);
		cycles.slice(0, RECENT).forEach((s) => console.log(`  ${s.heading.replace(/^##\s+/, "")}`));
	}

	console.log(`\n══ testplan 待办 ══`);
	reportTestplan();
	console.log(
		`\n══ 深入指引 ══\n` +
			`  规格 → doc/spec.md 索引 → doc/spec/<节号>-*.md（一节一文件，可整读）\n` +
			`  测试计划 → doc/testplan.md 索引 → doc/testplan/<组>-*.md\n` +
			`  更早周期 → doc/log-archive.md（按需 grep，勿整读）\n` +
			`  流程 → .claude/skills/dev-cycle/SKILL.md`,
	);
}

if (handover) {
	printHandover();
} else {
	archiveLog();
	// --check 是钩子 / CI 的安静守卫模式：只跑守卫，不刷 testplan 摘要
	//（摘要是给 Agent 手动看的，跑 `npm run docs` 才打印）。
	if (!checkOnly) reportTestplan();
	checkIndexes();
	checkLinks();
	checkTree();
}
