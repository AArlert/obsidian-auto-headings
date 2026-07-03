/**
 * 文档维护脚本：每个开发周期收尾时跑一次，把「机械整理」从 Agent 手里接过来省 token。
 *
 * 用法：
 *   node scripts/docs.mjs             # 归档 log.md 旧块 + 滚动 status.jsonl + testplan 摘要 + 守卫校验
 *   node scripts/docs.mjs --handover  # 接手模式（只读）：打印 status 首行 + log 最新块 + testplan 待办
 *   node scripts/docs.mjs --keep 5    # 改变 log.md 保留的最新周期块数（默认 3）
 *   node scripts/docs.mjs --check     # 只检查不改动（pre-commit / CI 用）：全部守卫，超限即非零退出
 *
 * 做五件事：
 * 1. **归档 log.md**：只在 log.md 保留最新 N 个「带日期的周期块」，更旧的整体移入
 *    doc/log-archive.md（倒序，新的在上）。区分两类 `## ` 块：
 *      - 「周期块」= 标题含日期 YYYY-MM-DD → 受归档管控；
 *      - 「常青块」= 强制规则 / 目录结构约定 / 安装说明等无日期块 → 永远留在 log.md。
 * 2. **滚动 status.jsonl**：首行总览之外只保留最新 N 条周期概括（默认 12），更旧的滚入
 *    doc/status-archive.jsonl（倒序）。--check 下超限即失败——防止索引重新膨胀。
 * 3. **testplan 摘要**：只统计 §2「场景清单」区间的真值表（§0 图例、§3 已知 bug、§4 UVM
 *    覆盖表不计入，避免把说明行误报成场景），按状态计数并列出所有**非 ✅** 行（场景 ID + 行号），
 *    让 Agent 读这份摘要而非整读全文。**只读不改**，零信息损失。
 * 4. **校验 status.jsonl**：全部行须为合法 JSON（首行 type=status），超长概括给出警告。
 * 5. **目录树守卫**：把 log.md「目录结构约定」块里列出的 .ts/.mjs 文件与磁盘实际文件**双向比对**
 *    （磁盘漏登记 / 文档列了不存在的），漂移即报错——常青块不再烂掉。
 *
 * 设计原则：纯机械、可重复跑（幂等）。Agent 先在 log.md 顶部写完本周期新块、改完 testplan，
 * 再跑本脚本把旧块挪走——所以「写」与「挪」解耦，互不干扰。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docDir = join(root, "doc");
const LOG = join(docDir, "log.md");
const ARCHIVE = join(docDir, "log-archive.md");
const TESTPLAN = join(docDir, "testplan.md");
const STATUS = join(docDir, "status.jsonl");
const STATUS_ARCHIVE = join(docDir, "status-archive.jsonl");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const handover = args.includes("--handover");
const keepIdx = args.indexOf("--keep");
const KEEP = keepIdx >= 0 ? Number(args[keepIdx + 1]) : 3;
if (!Number.isInteger(KEEP) || KEEP < 1) {
	console.error(`--keep 须为 ≥1 的整数，收到：${args[keepIdx + 1]}`);
	process.exit(1);
}
/** status.jsonl 首行之外保留的周期概括行数；更旧的滚入 status-archive.jsonl。 */
const STATUS_KEEP = 12;

const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const MARKERS = ["✅", "❌", "⚠️", "🔲"];

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

	// 拆分常青块：在第一个周期块「之前」的（强制规则）留顶部，其余（目录结构/安装）沉到底部参考区。
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
		"> 需要某次改动的来龙去脉时再来翻。当前活跃日志见 [`log.md`](./log.md)。\n";
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

/** 读 status.jsonl 的非空行；不存在返回 null。 */
function readStatusLines() {
	if (!existsSync(STATUS)) return null;
	return readFileSync(STATUS, "utf8")
		.split("\n")
		.filter((l) => l.trim());
}

/** 滚动 status.jsonl：首行之外只留最新 STATUS_KEEP 条，更旧的滚入 status-archive.jsonl。 */
function rollStatus() {
	const lines = readStatusLines();
	if (!lines || lines.length === 0) {
		console.log(`[status] 无 ${STATUS}，跳过滚动。`);
		return;
	}
	const [head, ...rest] = lines;
	if (rest.length <= STATUS_KEEP) {
		console.log(`[status] 周期概括 ${rest.length} 行，≤ 保留数 ${STATUS_KEEP}，无需滚动。`);
		return;
	}
	if (checkOnly) {
		console.error(
			`[status] --check 失败：status.jsonl 有 ${rest.length} 行周期概括，超过保留数 ${STATUS_KEEP}。` +
				`请先跑 \`npm run docs\` 滚动归档，再重新提交。`,
		);
		process.exitCode = 1;
		return;
	}
	const keep = rest.slice(0, STATUS_KEEP);
	const toArchive = rest.slice(STATUS_KEEP);
	// 归档保持倒序：新滚出的行叠在既有归档之前。
	const existing = existsSync(STATUS_ARCHIVE)
		? readFileSync(STATUS_ARCHIVE, "utf8")
				.split("\n")
				.filter((l) => l.trim())
		: [];
	writeFileSync(STATUS_ARCHIVE, [...toArchive, ...existing].join("\n") + "\n");
	writeFileSync(STATUS, [head, ...keep].join("\n") + "\n");
	console.log(
		`[status] 滚动 ${toArchive.length} 行 → status-archive.jsonl；status.jsonl 保留首行 + 最新 ${keep.length} 行。`,
	);
}

/**
 * 取 testplan「## 2. 场景清单」区间的行（含行号偏移）。
 * 只在该区间统计真值表——§0 图例 / §3 已知 bug / §4 UVM 覆盖表里的 ✅/❌ 是说明或另类登记，
 * 不是场景行，计入会产生误报（曾把 §0.1 读者表的「❌ = 已知 bug…」当成一条待修场景）。
 */
function scenarioSlice(lines) {
	let start = -1;
	let end = lines.length;
	for (let i = 0; i < lines.length; i++) {
		if (start < 0 && /^## 2\./.test(lines[i])) {
			start = i;
			continue;
		}
		if (start >= 0 && /^## /.test(lines[i])) {
			end = i;
			break;
		}
	}
	if (start < 0) {
		console.warn(`[testplan] ⚠ 未找到「## 2.」场景清单标题，退回整读全文统计。`);
		return { offset: 0, lines };
	}
	return { offset: start, lines: lines.slice(start, end) };
}

function reportTestplan() {
	if (!existsSync(TESTPLAN)) {
		console.log(`[testplan] 无 ${TESTPLAN}，跳过。`);
		return;
	}
	const all = readFileSync(TESTPLAN, "utf8").split("\n");
	const { offset, lines } = scenarioSlice(all);
	const counts = Object.fromEntries(MARKERS.map((m) => [m, 0]));
	const outstanding = [];
	lines.forEach((line, i) => {
		if (!line.startsWith("|")) return;
		const cells = line.split("|").map((c) => c.trim());
		const last =
			cells[cells.length - 1] === "" ? cells[cells.length - 2] : cells[cells.length - 1];
		if (!last) return;
		const marker = MARKERS.find((m) => last.startsWith(m));
		if (!marker) return;
		// 场景行的首格是 ID（如 A1 / **L25**）；表头、分隔行、说明行都不计。
		const id = (cells[1] || "").replace(/\*/g, "");
		if (!/^[A-Za-z][\w-]*\d/.test(id)) return;
		counts[marker]++;
		if (marker !== "✅") {
			outstanding.push(`  L${offset + i + 1} ${marker} ${id}`);
		}
	});
	const total = Object.values(counts).reduce((a, b) => a + b, 0);
	console.log(
		`[testplan] §2 场景 ${total} 条：` +
			MARKERS.map((m) => `${m}${counts[m]}`).join(" / ") +
			"（§3 已知 bug / §4 UVM 覆盖表另行登记，不计入）",
	);
	if (outstanding.length) {
		console.log(
			`[testplan] 待办（非 ✅，共 ${outstanding.length}）——读这里即可，不必整读 testplan：`,
		);
		console.log(outstanding.join("\n"));
	}
}

/** status.jsonl 每行概括的软上限（字符）：超过即警告——细节应下沉 log.md，这里只留一句话。 */
const STATUS_LINE_SOFT_LIMIT = 200;

function checkStatus() {
	const lines = readStatusLines();
	if (!lines) {
		console.log(`[status] 无 ${STATUS}，跳过。`);
		return;
	}
	const fat = [];
	let bad = false;
	lines.forEach((line, i) => {
		try {
			const obj = JSON.parse(line);
			if (i === 0 && obj.type !== "status") throw new Error('首行 type !== "status"');
			if (i > 0 && obj.type !== "log") throw new Error('type !== "log"');
			if ((obj.summary ?? "").length > STATUS_LINE_SOFT_LIMIT) fat.push(i + 1);
		} catch (e) {
			console.error(`[status] 第 ${i + 1} 行不是合法的状态 JSON：${e.message}`);
			process.exitCode = 1;
			bad = true;
		}
	});
	if (fat.length) {
		console.warn(
			`[status] ⚠ 第 ${fat.join(", ")} 行 summary 超过 ${STATUS_LINE_SOFT_LIMIT} 字——` +
				`status.jsonl 只留一句话概括，细节请下沉 log.md（不拦提交，请顺手压缩）。`,
		);
	}
	if (!bad) console.log(`[status] ${lines.length} 行全部合法。`);
}

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
 * 目录树守卫：log.md「目录结构约定」块 vs 磁盘实际 .ts/.mjs 文件双向比对。
 * 常青块最容易烂——新增/拆分源码文件忘了回填目录树，接手 Agent 就会被过期地图误导。
 */
function checkTree() {
	if (!existsSync(LOG)) return;
	const { sections } = splitSections(readFileSync(LOG, "utf8"));
	const treeSec = sections.find((s) => s.heading.includes("目录结构"));
	if (!treeSec) {
		console.warn(`[tree] ⚠ log.md 未找到「目录结构」常青块，跳过守卫。`);
		return;
	}
	const docSet = new Set(
		[...treeSec.text.matchAll(/[\w.-]+\.(?:ts|mjs)\b/g)].map((m) => {
			const p = m[0];
			return p.slice(p.lastIndexOf("/") + 1);
		}),
	);
	const diskSet = collectDiskFiles(root, new Set());
	const missing = [...diskSet].filter((f) => !docSet.has(f)).sort();
	const phantom = [...docSet].filter((f) => !diskSet.has(f)).sort();
	if (missing.length === 0 && phantom.length === 0) {
		console.log(`[tree] 目录结构约定与磁盘一致（${diskSet.size} 个 .ts/.mjs）。`);
		return;
	}
	if (missing.length) {
		console.error(`[tree] 磁盘有但目录树漏登记：${missing.join("、")}`);
	}
	if (phantom.length) {
		console.error(`[tree] 目录树列了但磁盘不存在：${phantom.join("、")}`);
	}
	console.error(`[tree] 请修缮 log.md「目录结构约定」块后重试（守卫防常青块漂移）。`);
	process.exitCode = 1;
}

/** 接手模式（只读）：一条命令打印接手所需的全部信息，代替手动读三个文件。 */
function printHandover() {
	const lines = readStatusLines();
	if (lines && lines.length) {
		try {
			const s = JSON.parse(lines[0]);
			console.log(`══ 当前总览（status.jsonl 首行）══`);
			console.log(`  版本 ${s.version} · ${s.milestone ?? ""}`);
			console.log(`  现状：${s.summary}`);
			console.log(`  下一步：${s.next ?? "（见 log.md 最新块）"}`);
		} catch {
			console.log(lines[0]);
		}
	}
	if (existsSync(LOG)) {
		const { sections } = splitSections(readFileSync(LOG, "utf8"));
		const latest = sections.find((s) => DATE_RE.test(s.heading));
		if (latest) {
			console.log(`\n══ 最新周期块（log.md）══`);
			console.log(trimBlock(latest.text));
		}
	}
	console.log(`\n══ testplan 待办 ══`);
	reportTestplan();
	console.log(
		`\n══ 深入指引 ══\n` +
			`  规格 → doc/spec.md（先 grep -n '^## ' 取节行号再截读）\n` +
			`  更早周期 → doc/log-archive.md / doc/status-archive.jsonl（按需 grep，勿整读）\n` +
			`  流程规则 → 根 CLAUDE.md §3/§4 + log.md 顶部「强制规则」块`,
	);
}

if (handover) {
	printHandover();
} else {
	archiveLog();
	rollStatus();
	// --check 是钩子/CI 的安静守卫模式：只跑守卫 + 校验，不刷 testplan 摘要
	//（摘要是给 Agent 手动看的，跑 `npm run docs` 才打印）。
	if (!checkOnly) reportTestplan();
	checkStatus();
	checkTree();
}
