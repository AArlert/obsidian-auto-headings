/**
 * 虚拟编号模式的纯逻辑（M14，见 spec.md §3.22）：算「每个标题该显示什么编号」与「该文件该做什么」。
 *
 * 不依赖 Obsidian / CodeMirror / DOM，node 环境可直接单测（`tests/dev_tests/virtual.test.ts`）。
 * 编辑视图的 CM6 扩展与阅读视图的 post-processor（周期 2）都只消费这里的输出，
 * 与写入模式共用同一个编号引擎 {@link numberHeadings}——模板、白名单、`<!-- skip -->`、层级范围语义完全一致。
 */

import {
	numberHeadings,
	stripWordJoiners,
	WORD_JOINER,
	type NumberOptions,
	type Template,
} from "../numbering";
import { parseHeadings } from "../parser";
import type { NumberingMode } from "../pathrules";

/** 某个标题的虚拟编号显示信息。列号都是**行内**偏移（0 起，UTF-16 码元）。 */
export interface VirtualHeadingLabel {
	/** 标题所在行下标（0 起）。 */
	lineIndex: number;
	/** 标题级别 1–6（阅读视图用它核对 DOM 元素，防止分屏编辑时段落信息滞后错位）。 */
	level: number;
	/** 去掉编号前缀后的纯标题文本（阅读视图拿不到行号时，按文本兜底匹配）。 */
	text: string;
	/** 标题文本在行内的起始列（`#` 与其后空白之后）——编号 widget 放在这里。 */
	textStart: number;
	/**
	 * 要显示的编号（去掉 WJ 哨兵，含后缀与标题间隔符，如 `"1.1 "`）；`null` 表示该标题不编号
	 * （白名单、`<!-- skip -->`、超出层级范围）。
	 */
	label: string | null;
	/**
	 * 文件里残留的插件前缀区间 `[from, to)`（行内列）：渲染时盖住它，并把编号显示为「残留」样式，
	 * 提示用户文件里还留着旧编号（spec §3.22「残留前缀」）。无残留时缺省。
	 */
	staleRange?: { from: number; to: number };
}

/**
 * 计算一篇笔记全部标题的虚拟编号。
 *
 * 残留判定只认**以 WJ 开头**的标题（与 `clearPluginNumberingContent` 同一口径）：区间从标题文本起点
 * 到编号引擎剥出的纯标题文本之前。标题中间的 WJ（如指向写入文件标题的链接）不算残留。
 *
 * @param content 笔记全文。
 * @param template 该文件生效的模板。
 * @param options 编号选项（通常传全模板前后缀并集，提高残缺前缀的识别率）。
 */
export function computeVirtualNumbers(
	content: string,
	template: Template,
	options: NumberOptions = {},
): VirtualHeadingLabel[] {
	const headings = parseHeadings(content);
	const numbered = numberHeadings(headings, template, options);
	return numbered.map((n, i) => {
		const heading = headings[i];
		const textStart = heading.raw.length - heading.rawText.length;
		const result: VirtualHeadingLabel = {
			lineIndex: n.lineIndex,
			level: n.level,
			text: n.text,
			textStart,
			label: n.prefix === null ? null : stripWordJoiners(n.prefix),
		};
		if (heading.rawText.startsWith(WORD_JOINER)) {
			// 编号引擎剥出的纯文本必是 rawText（去行尾空白后）的后缀；前面那截就是残留前缀。
			const trimmed = heading.rawText.replace(/\s+$/, "");
			const end = trimmed.length - n.text.length;
			if (end > 0 && trimmed.slice(end) === n.text) {
				result.staleRange = { from: textStart, to: textStart + end };
			}
		}
		return result;
	});
}

/** {@link resolveNumberingAction} 的输入：某文件此刻的全部开关状态。 */
export interface NumberingGateInput {
	/** 插件已「固化编号并交还所有权」（retired）。 */
	retired: boolean;
	/** 清除全库编号进行中。 */
	clearing: boolean;
	/** frontmatter 单文件开关：`true` / `false` / 缺省 `null`。 */
	fileSwitch: boolean | null;
	/** 全局自动编号开关。 */
	autoNumber: boolean;
	/** 路径规则解析出的模式；`null` = 无规则或「不编号」。 */
	mode: NumberingMode | null;
	/** 有效规则引用的模板是否存在。 */
	hasTemplate: boolean;
}

/**
 * 自动路径下某文件该做什么（spec §3.22「门控与写入模式完全一致」）：
 * `"write"` 写入编号，`"virtual"` 只显示，`null` 什么都不做。
 *
 * 判定顺序与 main.ts 的 `shouldAutoTrigger` 一致：retired → 清库中 → frontmatter → 全局开关；
 * 过闸后再看模式与模板。frontmatter `true` 强制放行（即便全局开关关），但压不过「不编号」规则
 * （此时 `mode` 为 `null`，没有可用模板）。
 */
export function resolveNumberingAction(input: NumberingGateInput): NumberingMode | null {
	if (input.retired || input.clearing) {
		return null;
	}
	if (input.fileSwitch === false) {
		return null;
	}
	if (input.fileSwitch !== true && !input.autoNumber) {
		return null;
	}
	if (input.mode === null || !input.hasTemplate) {
		return null;
	}
	return input.mode;
}
