/**
 * Backlink 同步（M7，1.0 发布前置，见 spec.md §3.12）。
 *
 * 编号 / 清除 / 清理外来编号都会**改写标题文本**（加 / 改 / 去前缀），这会使指向旧标题锚点的内部链接
 * `[[file#旧标题]]` 断链。本模块提供**纯函数核心**：算「旧→新」改名表、在引用文件内重写链接锚点。
 * 与 Obsidian 运行时耦合的部分（`metadataCache.getBacklinksForFile` 反查 + `vault.process` 写回）在
 * `main.ts` 的 `syncBacklinks`；本模块刻意保持无依赖、可纯单测。
 *
 * 设计要点（参考 Header Enhancer 的 `backlinks.ts`，并做稳，见 spec.md §3.12）：
 * - **逐行配对**：编号逐行就地改写、不重排行，故旧 / 新文档按 `lineIndex` 配对即得「旧→新」，无需模糊匹配。
 * - **锚点归一 {@link linkAnchor}**：两侧同口径，使既有链接含不含 WJ 都能匹配；写出的新链接剥 WJ、干净可读。
 * - **重复锚点保守不改**：同名标题多处时锚点歧义，剔出改名表，避免错改。
 */

import { WORD_JOINER } from "./numbering";
import { parseHeadings } from "./parser";

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

/**
 * 在一个引用文件的内容里，重写指向目标文件、且 subpath 落在改名表里的标题链接（纯函数，见 spec.md §3.12 流程③）。
 *
 * 扫描全部 `[[…]]` / `![[…]]`，对每个链接解析 `path#subpath|alias`：
 * - 路径段 basename 须命中目标文件（`[[#锚点]]` 仅当 `isSameFile`）；
 * - subpath 须存在、非块引用（不以 `^` 起头）、单段（不含二级 `#`，多级锚点保守跳过）；
 * - subpath 经 {@link linkAnchor} 归一后须在 `renames` 中；命中则替换为新锚点，**保留 `|别名` 与 `!` 嵌入前缀**。
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
	const out = content.replace(WIKILINK_RE, (whole, bang: string, inner: string) => {
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
	return { content: out, count };
}
