/**
 * M6 全样式并集剥离器：清除编号，独立于任何模板（见 spec.md §3.10）。
 *
 * 对外暴露 {@link clearNumberingContent}，用于：
 * - 「清除当前文件编号」命令（main.ts）：对 Editor 内容调用后以单一事务写回。
 * - 「清除全库编号」按钮（SettingsTab.ts）：对每个 .md 文件读取 → 清除 → 写回。
 *
 * 另暴露只读探测 {@link hasUnclaimedForeignNumbering}，供 main.ts 自动路径在写入前判断是否为
 * 「插件从未接触过 + 疑似外来编号」的迁移场景（testplan J10）；以及 {@link previewForeignNumberingCleanup}，
 * 供迁移守卫 Notice 点击后的清理预览确认框计算「现状 → 清理后」逐条对照（testplan J14）。
 */

import { parseHeadings } from "./parser";
import {
	cleanDemotedResidue,
	stripForeignNumbering,
	stripPrefixBroad,
	WORD_JOINER,
} from "./numbering";

/** {@link clearNumberingContent} 的可选项。 */
export interface CleanupOptions {
	/** 已知前缀候选（含空串；由 main.ts 传入全模板前缀并集，提高对历史前缀的识别率）。 */
	strippablePrefixes?: readonly string[];
	/** 已知后缀候选（同上）。 */
	strippableSuffixes?: readonly string[];
}

/**
 * 剥离内容中**所有标题**（代码块外）的编号前缀，返回无编号的裸标题文本。
 *
 * 使用**全样式并集**剥离器（arabic ∪ cjk ∪ circled ∪ lower-alpha ∪ upper-alpha），独立于任何
 * 模板——不管历史编号是用哪个模板、哪种序号样式写入的，都尽力剥净。仅剥一层（「2024 折中」）。
 *
 * **已知风险（spec §3.10 / §2.3 预期取舍）**：若标题文本恰以序号样字（含字母）开头紧跟分隔符
 * （如用户手写的 `## 1.1 标题`、`## a) 备注`），全样式剥离器可能将其误当作插件前缀剥掉。
 * 这是「清除编号」命令固有的权衡——与 {@link stripPrefix} 的既有风险同源。
 *
 * @param content 待清除的 Markdown 文件全文。
 * @param options 可选的前后缀候选（传入全模板前后缀并集可提高识别率）。
 * @returns 剥除编号前缀后的文件全文；若无任何标题则原样返回。
 */
export function clearNumberingContent(content: string, options: CleanupOptions = {}): string {
	const headings = parseHeadings(content);
	const prefixes = options.strippablePrefixes ?? [];
	const suffixes = options.strippableSuffixes ?? [];

	const lines = content.split("\n");
	const headingLines = new Set<number>();
	for (const h of headings) {
		const hashes = "#".repeat(h.level);
		const text = stripPrefixBroad(h.rawText, prefixes, suffixes);
		lines[h.lineIndex] = `${hashes} ${text}`;
		headingLines.add(h.lineIndex);
	}
	// 与 renumberContent 的 ③ 一致：也清掉「降级为正文」的行里残留的 WJ 哨兵 + 编号——否则用户降级
	// 标题后跑「清除编号」会留下 `⁠①） 三` 之类垃圾。清除是全样式独立于模板，故用 stripPrefixBroad。
	// 与自动路径不同，清除命令**注释块与围栏内一并清**：注释里的 WJ 残留在阅读视图不可见、用户肉眼
	// 永远找不到，若挺过「清除全库编号」就直接违背标记契约「永远可退出 / 精确剥净」的承诺。
	cleanDemotedResidue(
		lines,
		headingLines,
		(paragraph) => stripPrefixBroad(paragraph, prefixes, suffixes),
		{ comments: true, fences: true },
	);
	return lines.join("\n");
}

/**
 * 剥离内容中**外来 / 手写**（**非本插件写入**）的标题编号前缀，返回清理后的全文（0.6.6，spec §3.10）。
 *
 * 与 {@link clearNumberingContent} 的区别：本函数**只动「不含 Word Joiner」的标题**——含 WJ 的是本插件
 * 自己写的编号，**原样保留不动**；不含 WJ 的标题用 {@link stripForeignNumbering}（覆盖括号 / `第` / 章节
 * 量词等更多手写惯例）剥一层外来编号。用于「我有一批手写 / 导入的编号，想清掉好让插件接管」的场景
 * （方案 A 下插件不会自动吸收无 WJ 的手写编号，故提供此主动清理命令）。
 *
 * **已知风险**：同 {@link stripForeignNumbering}（以序号样字开头紧跟分隔符的真实标题可能被误剥）。属
 * 用户主动一次性操作，已接受（spec §3.10）。
 *
 * @param content 待清理的 Markdown 文件全文。
 * @returns 剥除外来编号前缀后的全文；无标题则原样返回。
 */
export function clearForeignNumberingContent(content: string): string {
	const headings = parseHeadings(content);
	if (headings.length === 0) {
		return content;
	}
	const lines = content.split("\n");
	for (const h of headings) {
		// 含 WJ = 本插件写的编号 → 不动（「非本插件」语义）。
		if (h.rawText.includes(WORD_JOINER)) {
			continue;
		}
		const hashes = "#".repeat(h.level);
		const text = stripForeignNumbering(h.rawText);
		lines[h.lineIndex] = `${hashes} ${text}`;
	}
	return lines.join("\n");
}

/**
 * 只读探测：本文件是否「插件从未接触过」且含疑似外来编号（迁移守卫，testplan J10）。
 *
 * 用于自动路径（`scheduleRenumber`/`renumberOnOpen`/`renumberActiveFile`）写入前的门控——方案A下
 * 自动路径只认 WJ，会把 `## 1 红米` 当纯正文、在前面再叠一层自己的编号，写成 `## 1 1 红米`，观感
 * 上与 bug 无异。命中时调用方应跳过本次自动写入，引导用户先跑「清理非本插件的标题编号」
 * （{@link clearForeignNumberingContent}）。**手动命令不查此函数**——用户显式触发的操作永远按既定
 * 语义执行。
 *
 * 判定条件**两者都满足**才为 true：
 * - 全文完全不含 {@link WORD_JOINER}（插件从未给这份内容写过编号，避免把「已被本插件接管、只是新增
 *   了一个以数字起头的标题」误判为迁移场景，见 spec §3.10 相邻讨论）；
 * - 至少一个标题被 {@link stripForeignNumbering} 判定为「像外来编号」（剥离结果与原文不同）。
 *
 * **已知风险**：与 {@link stripForeignNumbering} 共享同一误伤面（如 `## API 设计`）——但落在这里
 * 代价是「跳过写入 + 提示」而非「内容被吃」，比清理命令本身更安全，故接受。
 *
 * **1.0.15 修**（testplan J12）：比较基准必须先去掉行尾空白。{@link stripForeignNumbering} 末尾带一道
 * `\s+$` 归一化，于是 `## 标题 `（用户刚在标题末尾敲了个空格、全文一个编号都没有）会因为
 * 「剥离结果 ≠ 原文」被判成外来编号——该文件的自动编号被整个拦下，还弹一句「请先清理非本插件的
 * 标题编号」的误导提示。守卫只该对**真的剥掉了编号**的情形生效，不该对空白归一化生效。
 */
export function hasUnclaimedForeignNumbering(content: string): boolean {
	if (content.includes(WORD_JOINER)) {
		return false;
	}
	const headings = parseHeadings(content);
	return headings.some((h) => stripForeignNumbering(h.rawText) !== h.rawText.replace(/\s+$/, ""));
}

/** {@link previewForeignNumberingCleanup} 单条对照项：某标题清理前后的完整行文本。 */
export interface ForeignNumberingPreviewItem {
	/** 清理前的完整标题行（`#` 组 + 原始文本）。 */
	before: string;
	/** {@link stripForeignNumbering} 处理后的完整标题行。 */
	after: string;
}

/**
 * 预览 {@link clearForeignNumberingContent} 会实际改动哪些标题（迁移守卫 Notice 点击后的清理预览
 * 确认框用，testplan J14）：只收录**真的会被剥掉编号**的标题——
 * - 含 WJ（本插件自己写的编号）跳过，与 {@link clearForeignNumberingContent} 同一「非本插件」语义；
 * - 剥离结果与原文本无实质差异（仅行尾空白被 {@link stripForeignNumbering} 的归一化步骤吃掉，
 *   同 {@link hasUnclaimedForeignNumbering} J12 修复的比较口径）的也跳过，避免预览列表里出现
 *   「看起来什么都没变」的对照，误导用户以为会有改动。
 *
 * 与 {@link clearForeignNumberingContent} 共享同一剥离逻辑 {@link stripForeignNumbering}，保证
 * 预览与「确认清理」后的实际结果逐条一致——绝不能出现预览说改 A、实际却改了 B 的落差，这正是本
 * 对话框存在的意义：清理命令带与守卫同源的误伤面（如 `## API 设计`），无预览的一键执行等于吃
 * 用户内容。
 *
 * @param content 待预览的文件全文（通常取自实时编辑器 `editor.getValue()`）。
 * @returns 会被改动的标题「现状 → 清理后」对照列表，按标题在文中出现的顺序排列；无改动返回空数组。
 */
export function previewForeignNumberingCleanup(content: string): ForeignNumberingPreviewItem[] {
	const headings = parseHeadings(content);
	const items: ForeignNumberingPreviewItem[] = [];
	for (const h of headings) {
		if (h.rawText.includes(WORD_JOINER)) {
			continue;
		}
		const stripped = stripForeignNumbering(h.rawText);
		if (stripped === h.rawText.replace(/\s+$/, "")) {
			continue;
		}
		const hashes = "#".repeat(h.level);
		items.push({ before: `${hashes} ${h.rawText}`, after: `${hashes} ${stripped}` });
	}
	return items;
}
