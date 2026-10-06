/**
 * 模板卡片与模板编辑弹窗的**纯视图逻辑**（1.2.2 视觉更新，见 spec Roadmap M15）：不碰 DOM、不碰
 * Obsidian API，便于单测。渲染层在 `tabs/TemplatesTab.ts`、`tabs/TemplateEditorModal.ts`、
 * `tabs/EditPanel.ts`、`tabs/TemplatePreview.ts`。
 */
import {
	computeWhitelistExemptions,
	type LevelFormat,
	normalizeBottomLevel,
	normalizeInheritDepth,
	normalizeTopLevel,
	numberHeadings,
	type NumberOptions,
	previewLevel,
	stripWordJoiners,
	type Template,
} from "../numbering";
import { hasSkipMarker, parseHeadings } from "../parser";
import { resolvePathRule, ruleMode, type PathRule } from "../pathrules";

// ───────────────────────── 上级编号合并列（testplan L37）─────────────────────────

/** 「上级编号」下拉的取值：不带 / 全部 / 继承 k 级。 */
export type InheritChoice = "none" | "all" | number;

/**
 * 由级别格式读出「上级编号」下拉的当前值。`inheritDepth` 越界时按 {@link normalizeInheritDepth}
 * 收窄（与引擎同一口径），收窄后为 `null` 视作「全部」。
 *
 * @param level 本级标题层级 1–6；继承级数上限为 `level - 1`。
 */
export function inheritChoiceOf(fmt: LevelFormat, level: number): InheritChoice {
	if (!fmt.inherit) {
		return "none";
	}
	const depth = normalizeInheritDepth(fmt.inheritDepth, level - 1);
	return depth === null ? "all" : depth;
}

/**
 * 把「上级编号」下拉的选择写回级别格式的两个字段（数据格式不变：仍是 `inherit` + `inheritDepth`）。
 * 选「不带」时保留原 `inheritDepth`，好让用户切回来时恢复之前的级数。
 */
export function applyInheritChoice(fmt: LevelFormat, choice: InheritChoice, level: number): void {
	if (choice === "none") {
		fmt.inherit = false;
		return;
	}
	fmt.inherit = true;
	fmt.inheritDepth = choice === "all" ? null : normalizeInheritDepth(choice, level - 1);
}

/** 本级「上级编号」下拉可选的继承级数（1 … level−1）。 */
export function inheritDepthOptions(level: number): number[] {
	const out: number[] = [];
	for (let d = 1; d < level; d++) {
		out.push(d);
	}
	return out;
}

// ───────────────────────── 空格可视化（testplan L38）─────────────────────────

/** 未聚焦时代替空格显示的可见符号。 */
export const VISIBLE_SPACE = "␣";

/** 输入框未聚焦时的显示值：空格换成「␣」，让「标题间隔符是一个空格」看得见。 */
export function showSpaces(value: string): string {
	return value.replace(/ /g, VISIBLE_SPACE);
}

// ───────────────────────── 模板卡片（testplan L34）─────────────────────────

/** 卡片上一行效果预览：级别 + 编号（已去 WJ）+ 相对缩进档位。 */
export interface CardPreviewLine {
	level: number;
	label: string;
	/** 相对起始层级的缩进档位（0 起）。 */
	indent: number;
}

/**
 * 卡片三行效果预览：取编号范围内从起始层级起的前三级，每级第一个序号（如「一、」「1.1 」「1.1.1 」）。
 * 范围不足三级时有几级给几级。
 */
export function cardPreviewLines(template: Template, max = 3): CardPreviewLine[] {
	const top = normalizeTopLevel(template.topLevel);
	const bottom = normalizeBottomLevel(template.bottomLevel);
	const out: CardPreviewLine[] = [];
	for (let level = top; level <= bottom && out.length < max; level++) {
		const [first] = previewLevel(template, level, 1);
		if (first !== undefined) {
			out.push({ level, label: stripWordJoiners(first), indent: level - top });
		}
	}
	return out;
}

// ───────────────────────── 底部预览（testplan L40）─────────────────────────

/** 预览里一行标题的呈现信息。 */
export interface PreviewLine {
	level: number;
	/** 编号（已去 WJ）；`null` 表示该标题不编号。 */
	label: string | null;
	/** 去掉编号前缀后的标题文本。 */
	text: string;
	/** 不编号的原因标签：白名单命中 / 行尾 skip 标记 / 范围内却没编上（跳级保持原样等）。 */
	tag: "whitelist" | "skip" | "unnumbered" | null;
	/** 是否在模板编号范围 [起始, 结束] 内（范围外的标题浅色、无标签）。 */
	inRange: boolean;
	/** 相对起始层级的缩进档位（范围外的浅层标题为 0）。 */
	indent: number;
}

/**
 * 按模板渲染一篇笔记的全部标题，供模板编辑弹窗底部预览（当前笔记 / 示例）。与编辑器里的编号
 * 同一引擎（{@link numberHeadings}），所以白名单、跳级、起始编号数字等效果一致。
 */
export function buildPreviewLines(
	content: string,
	template: Template,
	options: NumberOptions = {},
): PreviewLine[] {
	const headings = parseHeadings(content);
	const numbered = numberHeadings(headings, template, options);
	const exempt = computeWhitelistExemptions(headings, template, options);
	const top = normalizeTopLevel(template.topLevel);
	const bottom = normalizeBottomLevel(template.bottomLevel);
	return numbered.map((n, i) => {
		const heading = headings[i];
		const inRange = n.level >= top && n.level <= bottom;
		let tag: PreviewLine["tag"] = null;
		if (n.prefix === null && inRange) {
			if (exempt.has(heading)) {
				tag = "whitelist";
			} else if (hasSkipMarker(heading.rawText)) {
				tag = "skip";
			} else {
				tag = "unnumbered";
			}
		}
		return {
			level: n.level,
			label: n.prefix === null ? null : stripWordJoiners(n.prefix),
			text: n.text.replace(/\s*<!--\s*skip\s*-->\s*$/i, ""),
			tag,
			inRange,
			indent: Math.max(0, n.level - top),
		};
	});
}

/** 「示例」预览用的样例笔记：一个 H1 文档标题 + 覆盖 H2–H6 的嵌套标题（标题词随界面语言）。 */
export function sampleNoteContent(words: readonly string[]): string {
	// words: [文档标题, 概述, 背景, 动机, 细节, 补充, 方法, 结论]
	const [doc, overview, background, motivation, detail, extra, method, conclusion] = words;
	return [
		`# ${doc}`,
		`## ${overview}`,
		`### ${background}`,
		`### ${motivation}`,
		`#### ${detail}`,
		`##### ${extra}`,
		`###### ${extra}`,
		`## ${method}`,
		`## ${conclusion}`,
	].join("\n");
}

// ───────────────────────── 影响说明（testplan L41）─────────────────────────

/** 某模板的使用情况。 */
export interface TemplateUsage {
	/** 引用该模板的路径规则条数。 */
	rules: number;
	/** 实际解析到这些规则的笔记数（被更具体规则抢走的不算）。 */
	notes: number;
	/** 其中「写入文件」模式的笔记数。 */
	writeNotes: number;
}

/**
 * 统计模板的影响范围：按每篇笔记**实际解析出**的规则（{@link resolvePathRule}，与编号判定同一口径）
 * 计数，而不是按路径模式粗略命中——否则被更具体规则抢走的笔记会被重复算进来。
 */
export function summarizeTemplateUsage(
	rules: readonly PathRule[],
	notePaths: readonly string[],
	templateName: string,
): TemplateUsage {
	const usage: TemplateUsage = {
		rules: rules.filter((r) => r.template === templateName).length,
		notes: 0,
		writeNotes: 0,
	};
	if (usage.rules === 0) {
		return usage;
	}
	const list = [...rules];
	for (const path of notePaths) {
		const rule = resolvePathRule(list, path);
		if (rule?.template === templateName) {
			usage.notes++;
			if (ruleMode(rule) === "write") {
				usage.writeNotes++;
			}
		}
	}
	return usage;
}
