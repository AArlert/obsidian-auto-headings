/**
 * 模板数据模型：序号样式 / 层级格式 / 白名单条目 / 模板对象与其默认值、各字段的规范化收口。
 *
 * 只含**纯数据与规范化**，不含任何编号 / 剥离逻辑——渲染见 `render.ts`、剥离见 `strip.ts`、
 * 白名单命中见 `whitelist.ts`、引擎编排见 `numbering.ts`（它同时是对外 barrel，外部仍从
 * `./numbering` 导入本文件全部导出）。
 */

/** 序号样式枚举（见 spec.md §3.6）。 */
export type NumeralStyle =
	| "arabic"
	| "cjk"
	| "circled"
	| "lower-alpha"
	| "upper-alpha"
	| "lower-roman"
	| "upper-roman";

/** 起始编号层级的默认值：H2（即默认 H1 不编号、作为标题/分节）。 */
export const DEFAULT_TOP_LEVEL = 2;

/** 结束编号层级的默认值：H6（即默认无下界，最深的 H6 仍参与编号）。 */
export const DEFAULT_BOTTOM_LEVEL = 6;

/** 起始编号数字的默认值：1（首个编号标题从 1 起，=历史行为）。 */
export const DEFAULT_START_INDEX = 1;

/**
 * 规范化「起始编号数字」`startIndex`：非负整数——负数夹到 0、上限夹到 9999、小数四舍五入，
 * 非数字 / 缺失（含旧模板）回退默认 1。
 * 含义：**仅首段**（`topLevel` 对应段）的编号从该值起（设 0 得 `0.1.1`），更深层级仍从 1 起。
 * 实现为渲染期偏移（见 `render.ts` 的 `buildPrefix`）：计数器内部恒为 1 起，
 * 0 仍是「跳级缺失」哨兵，互不干扰。
 */
export function normalizeStartIndex(value: unknown): number {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n)) {
		return DEFAULT_START_INDEX;
	}
	return Math.min(9999, Math.max(0, n));
}

/**
 * 「祖先序号渲染」策略：继承前级时，前缀里的**祖先段**（比当前级浅的各段）以何种样式呈现。
 *
 * - `self`（默认，向后兼容历史行为）：每个祖先段套用**它自己级别**的 `numeral` 样式。
 *   适合「提纲惯例」——H3=字母、H4=带圈时 H4 得 `1.a.①`（祖先保留各自字形）。
 * - `arabic`：所有祖先段一律渲染为**阿拉伯数字**，仅当前级（末段）套用其自身样式。
 *   适合「中文书惯例」——H2=中文、H3=阿拉伯时得 `一`（H2 标题行）/ `1.1`（H3，祖先转阿拉伯）。
 *
 * 注意：仅影响**祖先段**；当前级（末段）始终套用本级 `numeral`。两种惯例方向相反、无法靠单一
 * 固定模型兼得，故做成每模板可选（见 spec.md §3.6）。
 */
export type AncestorNumeral = "self" | "arabic";

/** 「祖先序号渲染」默认值：`self`（=历史行为，祖先各自套用自身样式）。 */
export const DEFAULT_ANCESTOR_NUMERAL: AncestorNumeral = "self";

/** 规范化「祖先序号渲染」：非法/缺失（含旧模板）回退默认 `self`。 */
export function normalizeAncestorNumeral(value: unknown): AncestorNumeral {
	return value === "arabic" ? "arabic" : "self";
}

/**
 * 规范化「起始编号层级」`topLevel`：夹到合法范围 [1, 6]，非数字回退默认 H2。
 * 含义：比 `topLevel` 浅的标题完全不编号、不改写；它及更深的标题正常编号，并以它为序号第一段。
 */
export function normalizeTopLevel(value: unknown): number {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n)) {
		return DEFAULT_TOP_LEVEL;
	}
	return Math.min(6, Math.max(1, n));
}

/**
 * 规范化「结束编号层级」`bottomLevel`：夹到合法范围 [1, 6]，非数字回退默认 H6（无下界）。
 * 含义：比 `bottomLevel` 更深的标题不编号、不输出前缀（与浅于 `topLevel` 的标题对称处理，
 * 仍作为重置边界推进计数器并剥除残留旧前缀）。配合 `topLevel` 即可只编号 H2–H4 这样的区间。
 *
 * 注意：本函数不强制 `bottomLevel >= topLevel`——二者各自独立夹取，区间为空（bottom < top）时
 * 不会有任何层级被编号，属退化但无害情形（GUI 下拉会避免用户配出此状态）。
 */
export function normalizeBottomLevel(value: unknown): number {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n)) {
		return DEFAULT_BOTTOM_LEVEL;
	}
	return Math.min(6, Math.max(1, n));
}

/**
 * 跳级（如 H3 → H5，中间缺 H4）时，缺失中间层级的占位策略（由用户在设置中选择）。
 * - `drop`：**不补位**——丢弃该段，序号段数等于实际存在的层级数（H5 跟在 H3 后呈现为三段、与 H4 同形）。
 * - `fill`：**补位**——以 `placeholder` 字面量填充缺失段，使段数等于标题深度；
 *   `placeholder` 由用户自填（如 `0` 得 `1.1.0.1`、`1` 得 `1.1.1.1`、任意字符如 `-` 得 `1.1.-.1`）。
 * - `none`：**不编号**（0.7.15，M8）——跳级出现的标题**完全不编号、保持原样**（仅剥旧前缀），
 *   仍推进计数器作重置边界。面向「H5/H6 当样式性小标题」的用法：正常嵌套时照编、跳级时不编
 *   （按**上下文**判定，白名单按文本、bottomLevel 按固定层级，均覆盖不了此情形）。
 *   判定与写出在 `numbering.ts` 的 numberHeadings（testplan F7–F9）。
 */
export type SkipFill = { mode: "drop" } | { mode: "fill"; placeholder: string } | { mode: "none" };

/** 默认占位策略：补 `0`（与历史默认行为一致）。 */
export const DEFAULT_SKIP_FILL: SkipFill = { mode: "fill", placeholder: "0" };

/**
 * 收口占位字符：**仅允许数字**。
 *
 * 原因：剥离并集**恒含** arabic 的 `\d+`（见 `strip.ts`），故纯数字占位无论之后改成什么、或切到
 * `drop`，旧前缀都能被干净剥离、不会重复叠加；而 `-`、`*` 等非数字占位在策略变更后会失配残留。
 * 这里把非数字字符滤除，空则回退 `0`。
 */
export function sanitizePlaceholder(raw: string): string {
	const digits = (raw ?? "").replace(/\D/g, "");
	return digits.length > 0 ? digits : "0";
}

/**
 * 规范化占位策略：`fill` 模式下占位文本收口为纯数字（见 {@link sanitizePlaceholder}），为空回退 `0`。
 * 用于从持久化数据 / 选项读入后做一次防御性收口。
 */
export function normalizeSkipFill(skipFill: SkipFill | undefined): SkipFill {
	if (!skipFill) {
		return DEFAULT_SKIP_FILL;
	}
	if (skipFill.mode === "drop") {
		return { mode: "drop" };
	}
	if (skipFill.mode === "none") {
		return { mode: "none" };
	}
	return { mode: "fill", placeholder: sanitizePlaceholder(skipFill.placeholder) };
}

/** 单个标题级别（H2–H6）的显示格式。 */
export interface LevelFormat {
	/** 序号前的自定义文本，可为空（如「第」）。 */
	prefix: string;
	/** 本级计数器的呈现形式。 */
	numeral: NumeralStyle;
	/**
	 * 完整序号之后、标题间隔符之前的自定义文本，可为空（如「章」「节」）。
	 * 与 {@link prefix} 配合可实现「第1章」式编号：`prefix`=第、`suffix`=章。
	 * 作用于本级**完整序号**（含继承的父级序号），即 `第1.1章` 而非 `第1章.1章`。
	 */
	suffix: string;
	/** 拼接各级父子序号的符号（如 `.` 得 `1.1`）。 */
	numberSeparator: string;
	/** 完整序号与标题文本之间的文本（如空格、`、`、`. `）。 */
	titleSeparator: string;
	/** 是否拼接父级序号，默认开启；关闭后仅呈现本级序号。 */
	inherit: boolean;
}

/**
 * 白名单条目：由**词语** `text` 与**匹配方式** `match` 组成。
 * - `exact`（全部匹配）：归一化后与条目完全相等，仅豁免该标题自身。
 * - `partial`（部分匹配）：归一化后包含条目子串，仅豁免该标题自身。
 * - `subtree`（子树匹配）：归一化后与条目完全相等的标题为根，连同其整棵子树一并豁免。
 *
 * 命中判定与子树范围计算见 `whitelist.ts` 的 `computeWhitelistExemptions`（Milestone 4）。
 */
export interface WhitelistEntry {
	text: string;
	match: "exact" | "partial" | "subtree";
}

/**
 * 默认模板预填充的白名单词表（Milestone 4，见 spec.md §3.7）：覆盖常见的结构性 / 非内容标题，
 * 中英各一组，默认均为「全部匹配」（最不具破坏性，只豁免恰好同名的那一行）。
 * 因匹配大小写不敏感，`References` ≡ `references`。用户可在编辑面板中增删、或改为部分 / 子树。
 *
 * 用函数返回**新数组**，避免被 {@link DEFAULT_TEMPLATE} 与其拷贝共享同一引用而被意外改动。
 */
export function DEFAULT_WHITELIST(): WhitelistEntry[] {
	const words = [
		// 目录          附录         附图       附表
		"目录",
		"Contents",
		"附录",
		"Appendix",
		"附图",
		"Figures",
		"附表",
		"Tables",
		// 参考文献      致谢                摘要        索引
		"参考文献",
		"References",
		"致谢",
		"Acknowledgements",
		"摘要",
		"Abstract",
		"索引",
		"Index",
	];
	return words.map((text) => ({ text, match: "exact" }));
}

/** 一个具名模板：为 H1–H6 各级定义显示格式，并附带白名单、跳级占位策略与起始编号层级。 */
export interface Template {
	name: string;
	levels: {
		h1: LevelFormat;
		h2: LevelFormat;
		h3: LevelFormat;
		h4: LevelFormat;
		h5: LevelFormat;
		h6: LevelFormat;
	};
	whitelist: WhitelistEntry[];
	/**
	 * 跳级（如 H3 → H5）时缺失中间层级的占位策略（见 {@link SkipFill}）。
	 * **由各模板自行决定**：补不补、补什么（`0`/`1`/任意字符）随模板配置；默认补 `0`。
	 */
	skipFill: SkipFill;
	/**
	 * 起始编号层级（1–6，默认 H2，见 {@link normalizeTopLevel}）。
	 * 比它浅的标题完全不编号、不被改写；它及更深的标题正常编号，并以它为序号第一段。
	 * **由各模板自行决定**（默认模板 = 全局默认）。
	 */
	topLevel: number;
	/**
	 * 结束编号层级（1–6，默认 H6，见 {@link normalizeBottomLevel}）。
	 * 比它更深的标题不编号、不输出前缀（与浅于 `topLevel` 的标题对称）。配合 `topLevel`
	 * 即可只编号「H2–H4」这样的区间。默认 H6 = 无下界（历史行为）。**由各模板自行决定**。
	 */
	bottomLevel: number;
	/**
	 * 起始编号数字（非负整数，默认 1，见 {@link normalizeStartIndex}）。
	 * 仅首段（`topLevel` 对应段）从该值起：设 0 得 `0.1.1`，更深层级仍从 1 起。
	 * **由各模板自行决定**（M8 批次 1）。
	 */
	startIndex: number;
	/**
	 * 「祖先序号渲染」策略（见 {@link AncestorNumeral}）：继承前级时祖先段的样式。
	 * 默认 `self`（祖先各自套用自身样式，=历史行为）；`arabic` 则祖先一律阿拉伯。
	 * **由各模板自行决定**。
	 */
	ancestorNumeral: AncestorNumeral;
}

/** 默认模板：纯阿拉伯多级点分（`1` / `1.1` / `1.1.1` …），见 spec.md 默认 `default.json`。 */
export const DEFAULT_TEMPLATE: Template = {
	name: "默认",
	levels: {
		h1: {
			prefix: "",
			numeral: "arabic",
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		},
		h2: {
			prefix: "",
			numeral: "arabic",
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		},
		h3: {
			prefix: "",
			numeral: "arabic",
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		},
		h4: {
			prefix: "",
			numeral: "arabic",
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		},
		h5: {
			prefix: "",
			numeral: "arabic",
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		},
		h6: {
			prefix: "",
			numeral: "arabic",
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		},
	},
	whitelist: DEFAULT_WHITELIST(),
	skipFill: DEFAULT_SKIP_FILL,
	topLevel: DEFAULT_TOP_LEVEL,
	bottomLevel: DEFAULT_BOTTOM_LEVEL,
	startIndex: DEFAULT_START_INDEX,
	ancestorNumeral: DEFAULT_ANCESTOR_NUMERAL,
};

/** 取模板中对应级别的格式；级别不在 1–6 时返回 undefined。 */
export function getLevelFormat(template: Template, level: number): LevelFormat | undefined {
	switch (level) {
		case 1:
			return template.levels.h1;
		case 2:
			return template.levels.h2;
		case 3:
			return template.levels.h3;
		case 4:
			return template.levels.h4;
		case 5:
			return template.levels.h5;
		case 6:
			return template.levels.h6;
		default:
			return undefined;
	}
}
