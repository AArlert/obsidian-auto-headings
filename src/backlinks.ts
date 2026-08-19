/**
 * Backlink 同步（M7，1.0 发布前置，见 spec.md §3.12）。
 *
 * 编号 / 清除 / 清理外来编号都会**改写标题文本**（加 / 改 / 去前缀），这会使指向旧标题锚点的内部链接
 * `[[file#旧标题]]` / `[说明](file.md#旧标题)` 断链。本模块提供**纯函数核心**：算「旧→新」改名表、
 * 在引用文件内重写链接锚点。
 * 与 Obsidian 运行时耦合的部分（`metadataCache.getBacklinksForFile` 反查 + `vault.process` 写回）在
 * `main.ts` 的 `syncBacklinks`；本模块刻意保持无依赖、可纯单测。
 *
 * 设计要点（参考 Header Enhancer 的 `backlinks.ts`，并做稳，见 spec.md §3.12）：
 * - **逐行配对**：编号逐行就地改写、不重排行，故旧 / 新文档按 `lineIndex` 配对即得「旧→新」，无需模糊匹配。
 * - **锚点归一 {@link linkAnchor}**：两侧同口径，使既有链接含不含 WJ 都能匹配；写出的新链接保留 WJ，
 *   与 Obsidian 实际标题锚点逐字节一致。
 * - **重复锚点保守不改**：同名标题多处时锚点歧义，剔出改名表，避免错改。
 */

import { WORD_JOINER } from "./numbering";
import { parseHeadings } from "./parser";
import { scanSkipRegions } from "./scan";

/** 一条「旧锚点 → 新锚点」改名（均为 {@link linkAnchor} 归一后的形式）。 */
export interface HeadingRename {
	/** 旧锚点（归一后），= 既有链接 `[[file#from]]` 里 `#` 之后那段的归一形式。 */
	from: string;
	/** 新锚点（归一后），写入新链接 `[[file#to]]`。 */
	to: string;
}

/**
 * 标题快照：Backlink 同步的「上次同步点」基线（testplan M14，见 spec.md §3.12）。
 * `level` 用于结构比对（增删标题 / 改层级即视为结构变化），`text` 用于锚点计算。
 */
export interface HeadingSnapshot {
	level: number;
	text: string;
}

/** 取一份内容的标题快照（供 {@link computeSnapshotRenames} 作下次比对的基线）。 */
export function snapshotHeadings(content: string): HeadingSnapshot[] {
	return parseHeadings(content).map((h) => ({ level: h.level, text: h.text }));
}

/** 匹配 wikilink / 嵌入：捕获可选的 `!`（嵌入）与内部 `path#sub|alias`。 */
const WIKILINK_RE = /(!?)\[\[([^\]\n]+?)\]\]/g;

interface OffsetRange {
	/** 含头、不含尾的源码偏移。 */
	start: number;
	end: number;
}

interface MarkdownDestination {
	/** destination 在外层 `(...)` 内容里的含头偏移。angle-bracket 形式不含 `<`。 */
	start: number;
	/** destination 在外层 `(...)` 内容里的不含尾偏移。angle-bracket 形式不含 `>`。 */
	end: number;
	value: string;
}

/** 去 Obsidian 在标题链接里**不允许**的字符 `[ ] # | ^`、折叠内部空白、trim（WJ 不在 `\s` 内，不受影响）。 */
function stripIllegal(s: string): string {
	return s
		.replace(/[[\]#|^]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * 归一为**匹配用**锚点：先剥 Word Joiner（插件写入的不可见标记，见 {@link WORD_JOINER}）再 {@link stripIllegal}。
 *
 * 用于改名表的 `from` 键与引用链接的 subpath **比较**：既有链接可能含 / 不含 WJ（取决于创建时机），
 * 两侧都剥 WJ 后即可稳定匹配。**仅用于判定，不写入文件。**
 */
export function linkAnchor(text: string): string {
	return stripIllegal(text.split(WORD_JOINER).join(""));
}

/**
 * 归一为**写入用**锚点（改名表的 `to`，即真正写进链接 `[[file#to]]` 的文本）：与 {@link linkAnchor} 同，
 * 但**保留 WJ**。
 *
 * 关键修复（实测）：编号写入的标题含不可见 WJ（如 `## 1 ⁠标题`），Obsidian 的标题锚点解析按字节比对、
 * **不剥 WJ**，故剥了 WJ 的链接（`[[file#1 标题]]`）解析不到含 WJ 的标题、显示为断链。保留 WJ 的链接
 * （`[[file#1 ⁠标题]]`）与真实标题字节一致 → 必然解析得到（裸标题无 WJ 时本函数与 {@link linkAnchor} 等价）。
 */
export function displayAnchor(text: string): string {
	return stripIllegal(text);
}

/**
 * 从「旧 → 新」标题文本配对序列构建改名表（{@link computeHeadingRenames} 与
 * {@link computeSnapshotRenames} 的共用核心）。
 *
 * 仅收录**锚点实际变化**（`from !== to`、且两端非空）的配对；**重复的旧锚点**（同名标题出现多处）
 * 视为歧义，整体剔除（保守不改，避免错改到同名的另一处）。
 */
function buildRenames(pairs: Array<{ oldText: string; newText: string }>): HeadingRename[] {
	// 统计旧锚点出现次数：>1 者歧义，剔除。
	const oldAnchorCount = new Map<string, number>();
	for (const p of pairs) {
		const a = linkAnchor(p.oldText);
		if (a) oldAnchorCount.set(a, (oldAnchorCount.get(a) ?? 0) + 1);
	}

	const renames: HeadingRename[] = [];
	const seen = new Set<string>();
	for (const p of pairs) {
		const from = linkAnchor(p.oldText); // 匹配既有链接：剥 WJ。
		const toKey = linkAnchor(p.newText); // 变化判定 / 空判定：剥 WJ 后比较（仅 WJ 差异不算变化）。
		const to = displayAnchor(p.newText); // 真正写入链接：**保留 WJ**，确保新链接能解析到含 WJ 的标题。
		if (!from || !toKey || from === toKey) continue;
		if ((oldAnchorCount.get(from) ?? 0) > 1) continue; // 歧义：同名标题多处，保守不改。
		if (seen.has(from)) continue;
		seen.add(from);
		renames.push({ from, to });
	}
	return renames;
}

/**
 * 计算「旧文档 → 新文档」的标题锚点改名表（纯函数，见 spec.md §3.12 流程①）。
 *
 * 编号永不增删行，故按 `lineIndex` 配对旧 / 新标题即可。歧义剔除等规则见 {@link buildRenames}。
 */
export function computeHeadingRenames(oldContent: string, newContent: string): HeadingRename[] {
	const oldHeadings = parseHeadings(oldContent);
	const newByLine = new Map(parseHeadings(newContent).map((h) => [h.lineIndex, h]));
	const pairs: Array<{ oldText: string; newText: string }> = [];
	for (const h of oldHeadings) {
		const nh = newByLine.get(h.lineIndex);
		if (!nh) continue; // 该行不再是标题（编号流程下不会发生，防御）。
		pairs.push({ oldText: h.text, newText: nh.text });
	}
	return buildRenames(pairs);
}

/**
 * 从「上次同步点快照」计算改名表（testplan **M14**：捕获用户对标题**正文**的改名，见 spec.md §3.12）。
 *
 * 与 {@link computeHeadingRenames} 的差别：基线不是「本次编号前」而是**上次同步点**（上次插件写回 /
 * 文件打开时），故用户在两次触发之间做的纯文本改名（编号不变、`编号前 === 编号后`）也能被看见。
 * 因基线与现内容之间用户可能增删了正文行，**按标题顺序**（而非行号）配对；仅当**结构一致**
 * （标题数量与逐个层级完全相同）才配对，否则返回 `null`——调用方回退到「编号前 → 编号后」口径
 * （增删标题 / 改层级的当轮只同步编号侧改名，文本改名保守放弃，避免错配）。
 */
export function computeSnapshotRenames(
	oldSnapshot: HeadingSnapshot[],
	newContent: string,
): HeadingRename[] | null {
	const newHeadings = parseHeadings(newContent);
	if (newHeadings.length !== oldSnapshot.length) return null;
	for (let i = 0; i < newHeadings.length; i++) {
		if (newHeadings[i].level !== oldSnapshot[i].level) return null;
	}
	return buildRenames(
		oldSnapshot.map((h, i) => ({ oldText: h.text, newText: newHeadings[i].text })),
	);
}

/** 判断 wikilink 的**路径段**是否指向目标文件（按 basename 命中，容 `folder/`、`.md` 后缀）。 */
function pathMatchesTarget(pathPart: string, targetBasename: string, isSameFile: boolean): boolean {
	if (pathPart === "") {
		// `[[#锚点]]`：同文件内链，仅当源文件即目标文件时命中。
		return isSameFile;
	}
	const last = pathPart.split("/").pop() ?? pathPart;
	const base = last.replace(/\.md$/i, "");
	return base === targetBasename;
}

/** 某字符前连续反斜线为奇数时，该字符被 Markdown 转义。 */
function isEscapedAt(content: string, index: number): boolean {
	let slashes = 0;
	for (let i = index - 1; i >= 0 && content[i] === "\\"; i--) {
		slashes++;
	}
	return slashes % 2 === 1;
}

/**
 * 行级 `[`→`]` 配对表（key = open `[` 偏移，value = 配对 `]` 偏移）。
 *
 * 与逐候选扫描同语义：支持 label 内嵌套 `[]`、反斜杠转义跳过下一字符、**不跨行**（行尾清栈）。
 * 但一次线性扫描给出整行所有配对，主循环查表 O(1)——避免「单行大量未闭合 `[` 时每个候选都
 * 重扫到行尾」的 O(L²) 退化（PR #8 审核修复，见 testplan M27）。
 */
function buildBracketPairs(content: string): Map<number, number> {
	const pairs = new Map<number, number>();
	const stack: number[] = [];
	for (let i = 0; i < content.length; i++) {
		const ch = content[i];
		if (ch === "\n" || ch === "\r") {
			stack.length = 0; // 不跨行：行尾清栈。
			continue;
		}
		if (ch === "\\") {
			const next = content[i + 1];
			// 转义跳过下一字符；行尾反斜杠不吞换行（否则会漏掉换行清栈）。
			if (next !== "\n" && next !== "\r") i++;
			continue;
		}
		if (ch === "[") {
			stack.push(i);
		} else if (ch === "]") {
			const open = stack.pop();
			if (open !== undefined) pairs.set(open, i);
		}
	}
	return pairs;
}

/** 行级 `(` 配对扫描的栈元素：`(` 位置 + 「从该 `(` 起 depth===1」时的状态机（与逐候选扫描同语义）。 */
interface ParenStackEntry {
	pos: number;
	seenDestination: boolean;
	inAngleDestination: boolean;
	inTitleQuote: '"' | "'" | null;
	afterDestination: boolean;
}

/**
 * 行级 `(`→`)` 配对表（key = open `(` 偏移，value = 配对 `)` 偏移）。
 *
 * 与逐候选扫描同语义：裸 destination 内平衡括号、`<...>` destination、可选引号 title、转义跳过、
 * 不跨行（行尾清栈）。状态机只跑在栈顶（= 该 `(` 视角的 depth===1），弹栈后父级状态恢复，
 * 与对每个 `(` 独立扫描的结果一致；一次线性扫描给整行所有 `(` 算好配对，主循环查表 O(1)。
 */
function buildParenPairs(content: string): Map<number, number> {
	const pairs = new Map<number, number>();
	const stack: ParenStackEntry[] = [];
	for (let i = 0; i < content.length; i++) {
		const ch = content[i];
		if (ch === "\n" || ch === "\r") {
			stack.length = 0;
			continue;
		}
		if (ch === "\\") {
			const next = content[i + 1];
			if (next !== "\n" && next !== "\r") i++;
			continue;
		}
		const top = stack[stack.length - 1];
		if (top) {
			if (top.inTitleQuote) {
				if (ch === top.inTitleQuote) top.inTitleQuote = null;
				continue;
			}
			if (top.inAngleDestination) {
				if (ch === ">") {
					top.inAngleDestination = false;
					top.afterDestination = true;
				}
				continue;
			}
			if (!top.seenDestination) {
				if (/\s/.test(ch)) continue;
				if (ch === "<") {
					top.seenDestination = true;
					top.inAngleDestination = true;
					continue;
				}
				top.seenDestination = true;
			} else if (!top.afterDestination && /\s/.test(ch)) {
				top.afterDestination = true;
				continue;
			} else if (top.afterDestination) {
				if (/\s/.test(ch)) continue;
				if (ch === '"' || ch === "'") {
					top.inTitleQuote = ch;
					continue;
				}
			}
		}
		if (ch === "(") {
			stack.push({
				pos: i,
				seenDestination: false,
				inAngleDestination: false,
				inTitleQuote: null,
				afterDestination: false,
			});
		} else if (ch === ")") {
			const open = stack.pop();
			if (open !== undefined) pairs.set(open.pos, i);
		}
	}
	return pairs;
}

/**
 * 从 Markdown inline link 的 `(...)` 内部取 destination，保留外层空白 / angle brackets / title。
 * 裸 destination 截止到第一个未转义空白；`<...>` 形式允许路径内空白。
 */
function parseMarkdownDestination(inner: string): MarkdownDestination | null {
	let start = 0;
	while (start < inner.length && /\s/.test(inner[start])) start++;
	if (start >= inner.length) return null;

	if (inner[start] === "<") {
		for (let i = start + 1; i < inner.length; i++) {
			if (inner[i] === ">" && !isEscapedAt(inner, i)) {
				return { start: start + 1, end: i, value: inner.slice(start + 1, i) };
			}
		}
		return null;
	}

	let end = start;
	while (end < inner.length) {
		if (/\s/.test(inner[end]) && !isEscapedAt(inner, end)) break;
		if (inner[end] === "\\" && end + 1 < inner.length) {
			end += 2;
			continue;
		}
		end++;
	}
	return end > start ? { start, end, value: inner.slice(start, end) } : null;
}

/** `decodeURIComponent` 的保守包装：坏 `%` 编码不应中断整次编号 / 链接同步。 */
function decodeUrlComponent(value: string): string | null {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

/** Markdown destination 的路径匹配：拒绝外部 scheme / protocol-relative URL，并解码 URL 路径。 */
function markdownPathMatchesTarget(
	pathPart: string,
	targetBasename: string,
	isSameFile: boolean,
): boolean {
	if (pathPart === "") return isSameFile;
	if (/^[a-z][a-z\d+.-]*:/i.test(pathPart) || pathPart.startsWith("//")) return false;
	const decoded = decodeUrlComponent(pathPart);
	if (decoded === null) return false;
	if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith("//")) return false;
	return pathMatchesTarget(decoded, targetBasename, false);
}

/** 把写入用标题锚点编码为 Markdown destination 的 fragment。 */
function markdownFragment(anchor: string): string {
	return encodeURIComponent(anchor).replace(
		/[!'()*]/g,
		(ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

/** 复用标题解析器的块级扫描口径，换算 fenced code block 的源码偏移范围。 */
function fencedCodeRanges(content: string): OffsetRange[] {
	const lines = content.split("\n");
	const states = scanSkipRegions(lines);
	const ranges: OffsetRange[] = [];
	let offset = 0;
	let rangeStart: number | null = null;
	for (let i = 0; i < lines.length; i++) {
		if (states[i].inFence) {
			rangeStart ??= offset;
		} else if (rangeStart !== null) {
			ranges.push({ start: rangeStart, end: offset });
			rangeStart = null;
		}
		offset += lines[i].length + (i < lines.length - 1 ? 1 : 0);
	}
	if (rangeStart !== null) ranges.push({ start: rangeStart, end: content.length });
	return ranges;
}

/**
 * 在 fenced code 之外找单行 inline code span；**未闭合反引号不构成排除区**——此时该行后续
 * 形似链接的文本仍会被改写（CommonMark 中未闭合 code span 延伸到行尾、Obsidian 渲染为代码）。
 * 属刻意取舍：反引号游程 tokenizer 的成本与收益不成比例，失败方向是「改了渲染为代码的文本」
 * 而非误编号（PR #8 审核修复，见 testplan M27）。
 */
function inlineCodeRanges(content: string, fences: OffsetRange[]): OffsetRange[] {
	const ranges: OffsetRange[] = [];
	let fenceIndex = 0;
	let i = 0;
	while (i < content.length) {
		while (fences[fenceIndex] && fences[fenceIndex].end <= i) fenceIndex++;
		const fence = fences[fenceIndex];
		if (fence && fence.start <= i) {
			i = fence.end;
			continue;
		}
		if (content[i] !== "`" || isEscapedAt(content, i)) {
			i++;
			continue;
		}
		let runEnd = i + 1;
		while (content[runEnd] === "`") runEnd++;
		const runLength = runEnd - i;
		let close = runEnd;
		let matchedEnd = -1;
		while (close < content.length && content[close] !== "\n" && content[close] !== "\r") {
			if (content[close] !== "`") {
				close++;
				continue;
			}
			let closeEnd = close + 1;
			while (content[closeEnd] === "`") closeEnd++;
			if (closeEnd - close === runLength) {
				matchedEnd = closeEnd;
				break;
			}
			close = closeEnd;
		}
		if (matchedEnd >= 0) {
			ranges.push({ start: i, end: matchedEnd });
			i = matchedEnd;
		} else {
			i = runEnd;
		}
	}
	return ranges;
}

/**
 * `%%…%%` 与 `<!--…-->` 注释的字符区间，与 scan.ts 的注释状态机同语义：`%%` 优先、未闭合
 * 延伸到文件尾、**围栏内注释状态冻结**（扫描跳过 fence 区间且不改变状态）。注释里的链接按
 * 原文本保留；注释在同一行结束后，同行后续链接照常改写（PR #8 审核修复，见 testplan M27）。
 */
function commentRanges(content: string, fences: OffsetRange[]): OffsetRange[] {
	const ranges: OffsetRange[] = [];
	let state: "none" | "obsidian" | "html" = "none";
	let start = -1;
	let fenceIndex = 0;
	for (let i = 0; i < content.length; i++) {
		while (fences[fenceIndex] && fences[fenceIndex].end <= i) fenceIndex++;
		const fence = fences[fenceIndex];
		if (fence && fence.start <= i) {
			i = fence.end; // 围栏内注释状态冻结：跳过区间、状态不变。
			continue;
		}
		if (state === "none") {
			if (content.startsWith("%%", i)) {
				state = "obsidian";
				start = i;
				i += 1;
			} else if (content.startsWith("<!--", i)) {
				state = "html";
				start = i;
				i += 3;
			}
		} else if (state === "obsidian") {
			if (content.startsWith("%%", i)) {
				ranges.push({ start, end: i + 2 });
				state = "none";
				start = -1;
				i += 1;
			}
		} else if (content.startsWith("-->", i)) {
			ranges.push({ start, end: i + 3 });
			state = "none";
			start = -1;
			i += 2;
		}
	}
	if (state !== "none") ranges.push({ start, end: content.length });
	return ranges;
}

/** Markdown 链接解析只在正文运行，代码区 / 注释区按原文本保留。 */
function markdownCodeRanges(content: string): OffsetRange[] {
	const fences = fencedCodeRanges(content);
	return [
		...fences,
		...commentRanges(content, fences),
		...inlineCodeRanges(content, fences),
	].sort((a, b) => a.start - b.start);
}

/** 对一条 Markdown destination 计算新值；不安全 / 不命中时返回 null。 */
function rewriteMarkdownDestination(
	destination: string,
	targetBasename: string,
	isSameFile: boolean,
	renames: Map<string, string>,
): string | null {
	const hashIdx = destination.indexOf("#");
	if (hashIdx < 0) return null;
	const pathPart = destination.slice(0, hashIdx);
	const rawSubpath = destination.slice(hashIdx + 1);
	const subpath = decodeUrlComponent(rawSubpath);
	if (subpath === null || subpath.startsWith("^") || subpath.includes("#")) return null;
	if (!markdownPathMatchesTarget(pathPart, targetBasename, isSameFile)) return null;
	const to = renames.get(linkAnchor(subpath));
	if (to === undefined) return null;
	return `${pathPart}#${markdownFragment(to)}`;
}

/**
 * 扫描 Markdown inline link / image（`[label](destination)` / `![alt](destination)`），仅替换
 * destination 的标题 fragment。label、路径、angle brackets、可选 title 与 `!` 均原字节保留。
 */
function rewriteMarkdownBacklinks(
	content: string,
	targetBasename: string,
	isSameFile: boolean,
	renames: Map<string, string>,
): { content: string; count: number } {
	const excluded = markdownCodeRanges(content);
	/** 行级配对表：主循环查表 O(1)，避免未闭合括号长行上的 O(L²) 退化（见 testplan M27）。 */
	const bracketPairs = buildBracketPairs(content);
	const parenPairs = buildParenPairs(content);
	const chunks: string[] = [];
	let cursor = 0;
	let count = 0;
	let excludedIndex = 0;
	let i = 0;
	while (i < content.length) {
		while (excluded[excludedIndex] && excluded[excludedIndex].end <= i) excludedIndex++;
		const blocked = excluded[excludedIndex];
		if (blocked && blocked.start <= i) {
			i = blocked.end;
			continue;
		}

		const syntaxStart = i;
		const openBracket = content[i] === "!" && content[i + 1] === "[" ? i + 1 : i;
		if (content[openBracket] !== "[") {
			i++;
			continue;
		}
		if (isEscapedAt(content, syntaxStart) || isEscapedAt(content, openBracket)) {
			i = openBracket + 1;
			continue;
		}
		// `[[…]]` 是 wikilink（已由 WIKILINK_RE 先行处理）：整段跳过，避免把
		// `[[a]](text)` 形态的括号段当 Markdown 链接二次改写、计数重复（见 testplan M27）。
		if (content[openBracket + 1] === "[") {
			const close = content.indexOf("]]", openBracket + 2);
			i = close >= 0 ? close + 2 : openBracket + 1; // 未闭合 wikilink 按普通文本推进。
			continue;
		}
		const closeBracket = bracketPairs.get(openBracket) ?? -1;
		const openParen = closeBracket >= 0 ? closeBracket + 1 : -1;
		if (openParen < 0 || content[openParen] !== "(") {
			i = openBracket + 1;
			continue;
		}
		const closeParen = parenPairs.get(openParen) ?? -1;
		if (closeParen < 0) {
			i = openBracket + 1;
			continue;
		}

		const innerStart = openParen + 1;
		const parsed = parseMarkdownDestination(content.slice(innerStart, closeParen));
		if (parsed) {
			const replacement = rewriteMarkdownDestination(
				parsed.value,
				targetBasename,
				isSameFile,
				renames,
			);
			if (replacement !== null) {
				const destinationStart = innerStart + parsed.start;
				const destinationEnd = innerStart + parsed.end;
				chunks.push(content.slice(cursor, destinationStart), replacement);
				cursor = destinationEnd;
				count++;
			}
		}
		i = closeParen + 1;
	}

	if (count === 0) return { content, count: 0 };
	chunks.push(content.slice(cursor));
	return { content: chunks.join(""), count };
}

/**
 * 在一个引用文件的内容里，重写指向目标文件、且 subpath 落在改名表里的 wikilink / Markdown
 * inline link（纯函数，见 spec.md §3.12 流程③）。
 *
 * wikilink 扫描全部 `[[…]]` / `![[…]]`，对每个链接解析 `path#subpath|alias`：
 * - 路径段 basename 须命中目标文件（`[[#锚点]]` 仅当 `isSameFile`）；
 * - subpath 须存在、非块引用（不以 `^` 起头）、单段（不含二级 `#`，多级锚点保守跳过）；
 * - subpath 经 {@link linkAnchor} 归一后须在 `renames` 中；命中则替换为新锚点，**保留 `|别名` 与 `!` 嵌入前缀**。
 *
 * Markdown inline link / image 另走小型扫描器：支持嵌套 label、平衡括号与 `<destination>`，只替换
 * destination 的 fragment 并 URL 编码新锚点；label、路径、可选 title 与 `!` 原字节保留。外部 URL、
 * 转义语法、块 / 多级 fragment、坏 URL 编码、行内代码、fenced code 与 `%%…%%` / `<!--…-->`
 * 注释区均保守跳过；`[[…]]` wikilink 整段跳过、其后的括号段按字面文本保留。
 *
 * @returns 重写后的内容与命中改写的链接数。
 */
export function rewriteBacklinksInContent(
	content: string,
	targetBasename: string,
	isSameFile: boolean,
	renames: Map<string, string>,
): { content: string; count: number } {
	let count = 0;
	const wikiOut = content.replace(WIKILINK_RE, (whole, bang: string, inner: string) => {
		const pipeIdx = inner.indexOf("|");
		const linkPart = pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner;
		const alias = pipeIdx >= 0 ? inner.slice(pipeIdx) : ""; // 含前导 `|`
		const hashIdx = linkPart.indexOf("#");
		if (hashIdx < 0) return whole; // 无 subpath，非标题链接。
		const pathPart = linkPart.slice(0, hashIdx);
		const subpath = linkPart.slice(hashIdx + 1);
		if (subpath.startsWith("^")) return whole; // 块引用，跳过。
		if (subpath.includes("#")) return whole; // 多级锚点，保守跳过。
		if (!pathMatchesTarget(pathPart, targetBasename, isSameFile)) return whole;
		const to = renames.get(linkAnchor(subpath));
		if (to === undefined) return whole;
		count++;
		return `${bang}[[${pathPart}#${to}${alias}]]`;
	});
	const markdown = rewriteMarkdownBacklinks(wikiOut, targetBasename, isSameFile, renames);
	return { content: markdown.content, count: count + markdown.count };
}
