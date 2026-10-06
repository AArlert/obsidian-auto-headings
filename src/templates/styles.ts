/**
 * 模板「样式」的快照、历史与快速套用预设（M16，spec §3.24 / testplan S20–S22）。纯函数，node 可测。
 *
 * **样式** = 模板里决定「编号长什么样」的字段（各级格式、起止层级、起始数字、跳级策略、祖先序号渲染）；
 * 不含名称与白名单——恢复历史样式不应冲掉用户精心维护的白名单。
 */
import {
	DEFAULT_TEMPLATE,
	normalizeBottomLevel,
	normalizeTopLevel,
	previewLevel,
	stripWordJoiners,
	type LevelFormat,
	type Template,
} from "../numbering";
import { LEVEL_KEYS } from "./schema";

/** 模板的样式部分。 */
export type TemplateStyle = Pick<
	Template,
	"levels" | "topLevel" | "bottomLevel" | "startIndex" | "skipFill" | "ancestorNumeral"
>;

/** 一份历史快照：保存时刻 + 样式。 */
export interface TemplateSnapshot {
	at: number;
	style: TemplateStyle;
}

/** 每个模板最多保留的快照份数。 */
export const MAX_SNAPSHOTS = 8;

/** 深拷贝取出模板的样式。 */
export function styleOf(template: Template): TemplateStyle {
	return structuredClone({
		levels: template.levels,
		topLevel: template.topLevel,
		bottomLevel: template.bottomLevel,
		startIndex: template.startIndex,
		skipFill: template.skipFill,
		ancestorNumeral: template.ancestorNumeral,
	});
}

/** 把样式（深拷贝）套到模板上，名称与白名单不动。 */
export function applyStyle(template: Template, style: TemplateStyle): void {
	Object.assign(template, structuredClone(style));
}

/** 两份样式是否逐字段相等。 */
export function stylesEqual(a: TemplateStyle, b: TemplateStyle): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 把一份样式记进历史（最新在前）：与已有某份相同则把那份提到最前（刷新时间）而非重复入列，
 * 超出 {@link MAX_SNAPSHOTS} 的最旧者丢弃。返回新数组，不改入参。
 */
export function pushSnapshot(
	list: readonly TemplateSnapshot[],
	style: TemplateStyle,
	at: number,
): TemplateSnapshot[] {
	const rest = list.filter((s) => !stylesEqual(s.style, style));
	return [{ at, style: structuredClone(style) }, ...rest].slice(0, MAX_SNAPSHOTS);
}

/** 从 data.json 读出的历史表做防御性清洗：丢弃形状不对的条目，缺省为空表。 */
export function sanitizeHistory(raw: unknown): Record<string, TemplateSnapshot[]> {
	const out: Record<string, TemplateSnapshot[]> = {};
	if (!raw || typeof raw !== "object") {
		return out;
	}
	for (const [name, list] of Object.entries(raw as Record<string, unknown>)) {
		if (!Array.isArray(list)) {
			continue;
		}
		const ok = list.filter(
			(s): s is TemplateSnapshot =>
				!!s &&
				typeof s === "object" &&
				typeof (s as TemplateSnapshot).at === "number" &&
				typeof (s as TemplateSnapshot).style === "object" &&
				(s as TemplateSnapshot).style !== null &&
				typeof (s as TemplateSnapshot).style.levels === "object",
		);
		if (ok.length > 0) {
			out[name] = ok.slice(0, MAX_SNAPSHOTS);
		}
	}
	return out;
}

/**
 * 样式的一行摘要（如「1 / 1.1 / 1.1.1」）：从起始层级起取至多 3 级、各级第一个编号，供菜单与历史列表区分样式。
 * 一级都不编号时返回空串。
 */
export function summarizeStyle(style: TemplateStyle): string {
	const tpl: Template = { ...DEFAULT_TEMPLATE, ...structuredClone(style) };
	const top = normalizeTopLevel(tpl.topLevel);
	const bottom = normalizeBottomLevel(tpl.bottomLevel);
	const parts: string[] = [];
	for (let l = top; l <= Math.min(bottom, top + 2); l++) {
		const first = previewLevel(tpl, l, 1)[0];
		if (first !== undefined) {
			parts.push(stripWordJoiners(first).trim() || "·");
		}
	}
	return parts.join(" / ");
}

/** 一个快速套用预设：在当前样式上覆盖各级格式（及可选的起始层级 / 祖先序号渲染）。 */
export interface StylePreset {
	id: "decimal" | "chapter" | "official" | "legal" | "outline";
	levels: Record<(typeof LEVEL_KEYS)[number], LevelFormat>;
	topLevel?: number;
	ancestorNumeral?: Template["ancestorNumeral"];
}

const fmt = (p: Partial<LevelFormat>): LevelFormat => ({
	prefix: "",
	numeral: "arabic",
	suffix: "",
	numberSeparator: ".",
	titleSeparator: " ",
	inherit: false,
	...p,
});

/** 常见编号体系（S20）。顺序即菜单顺序。 */
export const STYLE_PRESETS: readonly StylePreset[] = [
	{
		id: "decimal",
		topLevel: 2,
		ancestorNumeral: "self",
		levels: {
			h1: fmt({ inherit: true }),
			h2: fmt({ inherit: true }),
			h3: fmt({ inherit: true }),
			h4: fmt({ inherit: true }),
			h5: fmt({ inherit: true }),
			h6: fmt({ inherit: true }),
		},
	},
	{
		id: "chapter",
		topLevel: 1,
		levels: {
			h1: fmt({ prefix: "第", numeral: "cjk", suffix: "章" }),
			h2: fmt({ prefix: "第", numeral: "cjk", suffix: "节" }),
			h3: fmt({ numeral: "cjk", suffix: "、", titleSeparator: "" }),
			h4: fmt({ prefix: "（", numeral: "cjk", suffix: "）", titleSeparator: "" }),
			h5: fmt({ suffix: ".", titleSeparator: " " }),
			h6: fmt({ prefix: "（", suffix: "）", titleSeparator: "" }),
		},
	},
	{
		id: "official",
		topLevel: 1,
		levels: {
			h1: fmt({ numeral: "cjk", suffix: "、", titleSeparator: "" }),
			h2: fmt({ prefix: "（", numeral: "cjk", suffix: "）", titleSeparator: "" }),
			h3: fmt({ suffix: ".", titleSeparator: "" }),
			h4: fmt({ prefix: "（", suffix: "）", titleSeparator: "" }),
			h5: fmt({ numeral: "circled", titleSeparator: "" }),
			h6: fmt({ numeral: "lower-alpha", suffix: ")", titleSeparator: " " }),
		},
	},
	{
		id: "legal",
		topLevel: 1,
		levels: {
			h1: fmt({ prefix: "第", numeral: "cjk", suffix: "编" }),
			h2: fmt({ prefix: "第", numeral: "cjk", suffix: "章" }),
			h3: fmt({ prefix: "第", numeral: "cjk", suffix: "节" }),
			h4: fmt({ prefix: "第", numeral: "cjk", suffix: "条" }),
			h5: fmt({ prefix: "（", numeral: "cjk", suffix: "）", titleSeparator: "" }),
			h6: fmt({ prefix: "（", suffix: "）", titleSeparator: "" }),
		},
	},
	{
		id: "outline",
		topLevel: 1,
		levels: {
			h1: fmt({ numeral: "upper-roman", suffix: "." }),
			h2: fmt({ numeral: "upper-alpha", suffix: "." }),
			h3: fmt({ suffix: "." }),
			h4: fmt({ numeral: "lower-alpha", suffix: ")" }),
			h5: fmt({ numeral: "lower-roman", suffix: ")" }),
			h6: fmt({ numeral: "circled", titleSeparator: " " }),
		},
	},
];

/** 把预设套到模板上（不动白名单 / 名称 / 其他样式字段）。 */
export function applyPreset(template: Template, preset: StylePreset): void {
	template.levels = structuredClone(preset.levels);
	if (preset.topLevel !== undefined) {
		template.topLevel = preset.topLevel;
	}
	if (preset.ancestorNumeral !== undefined) {
		template.ancestorNumeral = preset.ancestorNumeral;
	}
}
