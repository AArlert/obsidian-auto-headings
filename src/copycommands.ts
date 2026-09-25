/**
 * 「复制编号大纲」「复制当前小节链接」两条命令的纯逻辑（R 组，见 spec.md §A.11 竞品核验登记的
 * 两条借鉴命令）。
 *
 * 不依赖 Obsidian 运行时，node 环境可直接单测（`tests/dev_tests/copycommands.test.ts`）；
 * 命令接线（剪贴板写入、Notice、命令可用性判定）在 main.ts。两种编号模式的文本口径不同：
 * - 写入模式：编号已经在标题文字里，`Heading.rawText` 剥 WJ 就是「标题所见文本」。
 * - 仅显示模式（M14）：文件字节里没有编号，调用方需另算 {@link VirtualHeadingLabel}
 *   （`main.ts` 的 `virtualNumberingFor`）传入，按行号拼回「虚拟编号 + 纯标题」。
 */

import { displayAnchor } from "./backlinks";
import { parseHeadings, type Heading } from "./parser";
import { stripPrefix, stripWordJoiners } from "./strip";
import type { VirtualHeadingLabel } from "./virtual/compute";

/** {@link buildNumberedOutline} 的返回值。 */
export interface NumberedOutlineResult {
	/** 大纲文本，每个标题一行、用 `\n` 连接；没有可用标题（或全部标题去空白后为空）时为空字符串。 */
	text: string;
	/** 输出的标题行数，供 Notice 提示「复制了几个标题」（不等同于 `parseHeadings` 的标题总数——空标题被跳过）。 */
	count: number;
}

/**
 * 把一篇笔记的全部标题拼成一份缩进大纲文本，供「复制编号大纲」命令写入剪贴板（R1–R3）。
 *
 * @param content 笔记全文——写入模式下含插件写入的编号；仅显示模式下是原始未编号文字。
 * @param labels 该文件的虚拟编号（`main.ts` 的 `virtualNumberingFor` 的结果）。写入模式、
 *   或该文件根本不编号（不满足虚拟编号门控）时传 `null`——此时统一走「标题所见文本」口径。
 *   非 `null` 时按 {@link VirtualHeadingLabel.lineIndex} 匹配每个标题，取「虚拟编号 + 纯标题」；
 *   若某个标题在 `labels` 里找不到对应项（如调用方误传了与 `content` 不一致的 labels），
 *   该行单独退回「标题所见文本」兜底，不影响其它行、也不整体报错。
 *
 * 缩进按标题级别相对全文最浅级别计算——最浅级别不缩进，每深一级两个空格，与 Obsidian 内置大纲
 * 面板的视觉层级一致；最浅级别取全部结构标题（含围栏/注释外的空标题）的最小级别，与某一行
 * 是否最终被跳过无关。标题文本去空白后为空（如标题只有编号没有文字）的行整体跳过、不计入 `count`。
 */
export function buildNumberedOutline(
	content: string,
	labels: readonly VirtualHeadingLabel[] | null,
): NumberedOutlineResult {
	const headings = parseHeadings(content);
	if (headings.length === 0) {
		return { text: "", count: 0 };
	}
	// 用 reduce 而非 Math.min(...array)：避免极长文件（数千标题）时展开参数逼近调用栈上限。
	const minLevel = headings.reduce((min, h) => Math.min(min, h.level), headings[0].level);
	const labelByLine = labels ? new Map(labels.map((l) => [l.lineIndex, l])) : null;

	const lines: string[] = [];
	for (const h of headings) {
		const label = labelByLine?.get(h.lineIndex);
		const raw = label ? (label.label ?? "") + label.text : stripWordJoiners(h.rawText);
		const text = raw.trim();
		if (!text) {
			continue; // 去空白后为空：不占大纲一行，也不计数。
		}
		lines.push("  ".repeat(h.level - minLevel) + text);
	}
	return { text: lines.join("\n"), count: lines.length };
}

/**
 * 找出 `line`（0 起）所在的小节标题：{@link parseHeadings} 结果里行号 `<= line` 的最后一个标题。
 * 供「复制当前小节链接」命令判断可用性与取链接目标——光标在第一个标题之前、或文件根本没有
 * 标题时返回 `null`（R5：此时命令应从命令面板消失）。
 */
export function sectionHeadingAt(content: string, line: number): Heading | null {
	const headings = parseHeadings(content);
	let found: Heading | null = null;
	for (const h of headings) {
		if (h.lineIndex > line) {
			break; // parseHeadings 按行号升序返回，后续标题必然更晚，可提前结束。
		}
		found = h;
	}
	return found;
}

/** {@link sectionLinkParts} 的返回值：拼装 Obsidian 内部链接所需的两个部件。 */
export interface SectionLinkParts {
	/**
	 * 链接锚点（写在 `#` 之后）。**保留 WJ**——写入模式的标题字节含 WJ，锚点若剥掉 WJ 就与
	 * 标题字节不一致、Obsidian 解析不到；口径与 `headingindex.ts` 的 `buildEntriesForFile`
	 * （标题链接建议的索引条目）完全一致，确保两个功能对同一标题生成兼容的链接。
	 */
	anchor: string;
	/** 链接显示别名：剥掉编号前缀后的纯标题。标题剥完为空（如标题只有编号）时为 `undefined`，
	 * 不强行塞一个空字符串别名——留给 `generateMarkdownLink` 走它自己的默认别名规则。 */
	alias: string | undefined;
}

/**
 * 由一个已解析的标题算出生成内部链接所需的锚点与别名，供「复制当前小节链接」命令（R4）传给
 * `app.fileManager.generateMarkdownLink`。
 */
export function sectionLinkParts(heading: Heading): SectionLinkParts {
	const anchor = displayAnchor(heading.text);
	const alias = stripPrefix(heading.rawText)
		.replace(/^[ \t]+/, "")
		.replace(/\s+$/, "");
	return { anchor, alias: alias || undefined };
}
