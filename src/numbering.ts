/**
 * 标题编号引擎——**编排核心 + 对外 barrel**。
 *
 * 引擎按职责拆为五个模块，本文件把它们的全部导出**原样转发**（外部一律从 `./numbering` 导入，
 * 拆分对调用方透明）：
 *
 * | 模块           | 职责                                                       |
 * |----------------|------------------------------------------------------------|
 * | `template.ts`  | 模板数据模型：类型 / 默认值 / 各字段规范化                  |
 * | `count.ts`     | 计数器状态机 {@link HeadingCounter}（纯阿拉伯整数）          |
 * | `render.ts`    | 序号渲染器 + 前缀拼装 `buildPrefix` / 面板预览 `previewLevel` |
 * | `strip.ts`     | 三个剥离器（WJ 边界 / 清除全样式 / 清理外来）+ `WORD_JOINER` |
 * | `whitelist.ts` | 白名单归一化 / 命中判定 / 面板预览分析                       |
 * | 本文件         | 编排：{@link numberHeadings} / {@link renumberContent}       |
 */

import { Heading, FENCE_RE, parseHeadings } from "./parser";
import { HeadingCounter } from "./count";
import { buildPrefix } from "./render";
import { stripHeadingPrefix, stripPrefix, WORD_JOINER, type StripAffixOptions } from "./strip";
import {
	DEFAULT_TEMPLATE,
	normalizeBottomLevel,
	normalizeSkipFill,
	normalizeTopLevel,
	type Template,
} from "./template";
import { computeWhitelistExemptionDetail } from "./whitelist";

export * from "./template";
export * from "./count";
export * from "./render";
export * from "./strip";
export * from "./whitelist";

/** 重新编号后的单个标题。 */
export interface NumberedHeading {
	/** 标题级别 1–6。 */
	level: number;
	/** 已剥离编号前缀的纯标题文本。 */
	text: string;
	/** 计算出的编号前缀；为 `null` 表示不写前缀（低于起始编号层级、或命中白名单）。 */
	prefix: string | null;
	/** 标题所在行下标（0 起）。 */
	lineIndex: number;
	/** 重新编号后的完整行内容，如 `## 1.1 标题`。 */
	numberedLine: string;
}

/** {@link numberHeadings} / {@link renumberContent} 的可选项。 */
export interface NumberOptions extends StripAffixOptions {
	/**
	 * 判断某标题是否命中白名单。命中者不写前缀、不占计数器槽位（不累加、不归零、不跳号）。
	 *
	 * **缺省**（不传该回调）时，{@link numberHeadings} 会依据 `template.whitelist` **自动**计算豁免集合
	 * （含 exact/partial/subtree 三种匹配与「取豁免范围最大者」的并集，见 {@link computeWhitelistExemptions}）。
	 * 显式传入该回调则**覆盖**模板白名单（用于单元测试注入或自定义判定）。
	 */
	isWhitelisted?: (heading: Heading) => boolean;
}

/**
 * 对一组标题应用模板与计数器，计算每个标题的编号前缀。
 *
 * 规则：
 * - **插件永不改写标题层级**（不再有错位 H1 降级）。
 * - 每个非白名单标题都推进计数器（`bump` 本级、归零更深级），即便它低于 `topLevel`——
 *   故超出编号范围的标题（如默认下的 H1）仍是「重置边界」：其后更深标题重新从 1 起。
 * - 仅对 `level >= topLevel` 的标题输出序号前缀并剥离旧前缀；更浅的标题原样保留、不剥离
 *   （避免把「2024 年度总结」这类标题误当前缀剥掉）。
 * - 白名单命中者完全透明：不计数、不归零、不写前缀，但仍剥离其已有编号（豁免即去号）。
 *   **例外（决策 D1，见 spec.md §3.7 / testplan D9/D10）**：**子树**豁免块视为独立结构（如附录），
 *   块结束后计数器**整体重置**——其后的编号重新开始；`exact` / `partial` 单标题豁免不触发重置。
 */
export function numberHeadings(
	headings: Heading[],
	template: Template,
	options: NumberOptions = {},
): NumberedHeading[] {
	const counter = new HeadingCounter();
	// 白名单判定：显式回调优先（用于单测注入 / 自定义，无子树信息 → 不触发 D1 重置）；否则由模板
	// 白名单自动计算豁免集合（含三种匹配方式与子树范围与子树块成员）。无白名单时恒不豁免。
	let isWhitelisted: (heading: Heading) => boolean;
	let isSubtreeMember: (heading: Heading) => boolean = () => false;
	if (options.isWhitelisted) {
		isWhitelisted = options.isWhitelisted;
	} else if (template.whitelist.length > 0) {
		const detail = computeWhitelistExemptionDetail(headings, template, options);
		isWhitelisted = (heading) => detail.exempt.has(heading);
		isSubtreeMember = (heading) => detail.subtreeMembers.has(heading);
	} else {
		isWhitelisted = () => false;
	}
	const top = normalizeTopLevel(template.topLevel);
	const bottom = normalizeBottomLevel(template.bottomLevel);
	const skipNone = normalizeSkipFill(template.skipFill).mode === "none";

	// D1：刚走出一个子树豁免块时置位；下一个参与计数的标题先整体重置计数器再 bump。
	let pendingSubtreeReset = false;

	// 把标题剥成裸行（不写前缀，仅剥旧前缀）：**循环剥离到定点**（而非单次）修复 U1/C6 bug——
	// 标题文本含多层「数字+空格」时单次剥离只去一层、每次触发侵蚀一层（非幂等）；循环到不再变化
	// 保证单次触发即到定点、此后稳定。WJ 快速路径由 stripPrefix 内部处理（见 WORD_JOINER 注释）。
	// 供「超出编号区间」与「skipFill=none 跳级」两个分支共用。
	const bareHeading = (heading: Heading): NumberedHeading => {
		let current = heading.rawText;
		let prev: string;
		do {
			prev = current;
			current = stripPrefix(current, heading.level, template, options);
		} while (current !== prev);
		const text = current.replace(/^[ \t]+/, "").replace(/\s+$/, "");
		return {
			level: heading.level,
			text,
			prefix: null,
			lineIndex: heading.lineIndex,
			numberedLine: `${"#".repeat(heading.level)} ${text}`,
		};
	};

	return headings.map((heading) => {
		const level = heading.level;
		const hashes = "#".repeat(level);

		// 白名单命中：完全透明（不计数、不归零），但剥离其已有编号。
		// 子树块成员额外置位「块后重置」（决策 D1）；exact/partial 豁免不置位、也不清位
		//（夹在子树块与下一个编号标题之间的单标题豁免不打断重置语义）。
		if (isWhitelisted(heading)) {
			if (isSubtreeMember(heading)) {
				pendingSubtreeReset = true;
			}
			const text = stripHeadingPrefix(heading, level, template, options);
			return {
				level,
				text,
				prefix: null,
				lineIndex: heading.lineIndex,
				numberedLine: `${hashes} ${text}`,
			};
		}

		// D1：子树豁免块结束 → 计数器整体重置，其后编号重新开始（如附录之后的新章节）。
		if (pendingSubtreeReset) {
			counter.reset();
			pendingSubtreeReset = false;
		}

		// 推进计数器（即便低于 topLevel，也作为重置边界）。
		counter.bump(level);

		// 低于起始编号层级 **或** 高于结束编号层级：不编号，但剥除可能残留的旧编号前缀
		// （C3 修复 + bottomLevel 对称处理，见 testplan §C3）。例如把结束层级从 H6 收窄到 H4 后，
		// 文件里遗留的 H5/H6 旧前缀须被剥净，否则会被当成正文、左侧再叠新前缀。
		if (level < top || level > bottom) {
			return bareHeading(heading);
		}

		// skipFill=none（0.7.15，testplan F7–F9）：**跳级**出现的标题（top 与本级之间有缺失段）
		// 完全不编号、保持原样（仅剥旧前缀）。计数器已在上方推进，仍作重置边界；正常嵌套
		// （无缺失段）的同级标题照常编号——按**上下文**判定，面向「H5/H6 当样式性小标题」的用法。
		if (
			skipNone &&
			level > top &&
			counter
				.sequence(level)
				.slice(top - 1, -1)
				.includes(0)
		) {
			return bareHeading(heading);
		}

		const text = stripHeadingPrefix(heading, level, template, options);
		const prefix = buildPrefix(template, level, counter);
		return {
			level,
			text,
			prefix,
			lineIndex: heading.lineIndex,
			numberedLine: `${hashes} ${prefix}${text}`,
		};
	});
}

/**
 * 解析整篇文档、重新编号编号范围内（`>= topLevel`）的标题，并返回重写后的完整内容。
 *
 * 处理流程：
 * 1. 解析标题（围栏代码块内的 `#` 行由解析器忽略）。
 * 2. 按 {@link numberHeadings} 计算各标题的前缀（**不改写任何标题层级**）。
 * 3. 仅替换被识别为标题的行，其余行（含代码块、正文）原样保留。
 * 4. ③ 降级残留清理：清掉「原是标题、被用户删光 `#` 变成正文」的行里残留的 WJ 哨兵 + 编号。
 *
 * 真正写回编辑器的事务化操作在 main.ts。
 */
export function renumberContent(
	content: string,
	template: Template = DEFAULT_TEMPLATE,
	options: NumberOptions = {},
): string {
	const headings = parseHeadings(content);
	const numbered = numberHeadings(headings, template, options);

	const lines = content.split("\n");
	const headingLines = new Set<number>();
	for (const h of numbered) {
		lines[h.lineIndex] = h.numberedLine;
		headingLines.add(h.lineIndex);
	}

	// ③ 降级残留清理：剥离用模板感知的 stripPrefix（双哨兵完好→剥到尾哨兵；尾哨兵被毁→按 topLevel
	// 有界剥离）。
	const top = normalizeTopLevel(template.topLevel);
	cleanDemotedResidue(lines, headingLines, (paragraph) =>
		stripPrefix(paragraph, top, template, options),
	);
	return lines.join("\n");
}

/**
 * ③ 降级残留清理（0.7.20，共享 helper）：**就地**清掉「原是标题、被用户删光 `#` 降级为正文」的行里
 * 残留的 WJ 哨兵 + 编号（如 `⁠一、⁠标题`）。被 {@link renumberContent}（模板感知剥离）与
 * `clearNumberingContent`（全样式并集剥离）共用——一致地保证任何「整理文档」的操作都不留插件残留。
 *
 * 识别极稳、误伤面极小：**非围栏代码块内、非标题行、且内容去前导空白后以 WJ 哨兵起头**的行才处理
 * ——WJ 是插件独有的不可见标记，正文几乎不可能自带。保留原行前导空白。
 *
 * @param lines 已按行切分的全文（会被就地修改）。
 * @param headingLines 本轮识别为标题的行下标集合（这些行不参与清理）。
 * @param strip 对「以 WJ 起头的残留正文」剥离前缀的函数（调用方按其语义注入模板感知 / 全样式剥离器）。
 */
export function cleanDemotedResidue(
	lines: string[],
	headingLines: Set<number>,
	strip: (paragraph: string) => string,
): void {
	let inFence = false;
	let fenceChar = "";
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(FENCE_RE);
		if (fence) {
			const char = fence[1][0];
			if (!inFence) {
				inFence = true;
				fenceChar = char;
			} else if (char === fenceChar) {
				inFence = false;
				fenceChar = "";
			}
			continue;
		}
		if (inFence || headingLines.has(i)) {
			continue;
		}
		const trimmed = line.replace(/^[ \t]+/, "");
		if (trimmed.startsWith(WORD_JOINER)) {
			const lead = line.slice(0, line.length - trimmed.length);
			lines[i] = lead + strip(trimmed);
		}
	}
}
