/**
 * 前缀剥离器家族（引擎四职之一，见 `numbering.ts` 顶部说明）。三个剥离器语义**刻意不同**：
 *
 * - {@link stripPrefix}（常规重排）：**纯 Word Joiner 边界**——只剥插件自己写的（带 WJ）前缀，
 *   无 WJ 一律视为正文（方案 A，0.6.6，见 spec.md §2.4）。
 * - {@link stripPrefixBroad}（「清除编号」命令）：全样式正则、独立于模板与 WJ，把一切像编号的都抹掉。
 * - {@link stripForeignNumbering}（「清理非本插件编号」命令）：覆盖更多手写惯例，但只作用于
 *   **不含 WJ** 的标题（含 WJ = 本插件写的，由命令层跳过）。
 */

import type { Heading } from "./parser";
import { getLevelFormat, normalizeTopLevel, type NumeralStyle, type Template } from "./template";

/**
 * Word Joiner（U+2060）：零宽不换行字符，在导出 / 复制时不可见。
 *
 * `render.ts` 的 `buildPrefix` 在每个前缀末尾追加该字符作为**精确结束标记**，无歧义地区分「前缀」
 * 与「正文」：`1 ⁠标题` 中 WJ 不可见。**方案 A（0.6.6）起，WJ 是 {@link stripPrefix} 唯一的剥离
 * 依据**——含 WJ 才剥、剥到标记之后；不含 WJ 一律视为正文。彻底消除「2024 年度总结」首次被吃等
 * 历史歧义（见 spec §2.4）。「清除编号」命令的 {@link stripPrefixBroad} 仍用全样式正则（独立于 WJ）
 * 处理手写 / 历史前缀。
 */
export const WORD_JOINER = "⁠";

/**
 * 剥离时**额外**纳入的前 / 后缀候选字面量集合（方案 A，见 {@link affixAlternation}）。
 * `numbering.ts` 的 `NumberOptions` 扩展本接口；白名单命中判定（`whitelist.ts`）也复用它。
 */
export interface StripAffixOptions {
	/**
	 * 「前缀」候选字面量集合。典型用法：main.ts 传入「所有模板各级在用的 prefix 并集」，
	 * 使某模板把前缀从 `第` 改走、或在多模板间切换后，旧前缀仍能被剥净。
	 * 剥离总会自动并入「当前级别值」与「空串」，故此项只需给跨模板 / 历史的额外值；缺省为空。
	 */
	strippablePrefixes?: readonly string[];
	/** 「后缀」候选字面量集合（语义同 {@link strippablePrefixes}）。 */
	strippableSuffixes?: readonly string[];
}

/** 把字符串中的正则元字符转义，使其可作为字面量拼入正则。 */
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 「标题间隔符」的容差字符类：常见分隔标点 **+ 空白**（空格、Tab、`.`、`、`、`-`、`)` 等）。
 *
 * **方案 A（0.6.6）后仅供 {@link stripPrefixBroad}（「清除编号」命令）使用**——它独立于 WJ、用全样式
 * 正则尽力清掉手写 / 历史前缀，故仍需一个容差的「序号→标题」分隔字符集合。常规剥离 {@link stripPrefix}
 * 已不再用正则（改为纯 WJ 边界），不再依赖本类。
 *
 * **安全边界**：本类**仅含标点与空白**，不含可能属于标题正文的字母 / 数字 / 一般汉字；且要求**至少一个**
 * 分隔字符（`+`）。「清除编号」是用户主动操作，其对「以序号 + 分隔符起头」标题的误伤已被接受（spec §3.10）。
 */
const TITLE_SEPARATOR_CLASS = "[ \\t.,;:、，。．·：；)）】」』>\\]-]";

/**
 * 「序号间隔符」（父子序号段之间，如 `1.1` 的 `.`）的容差字符类：在 {@link TITLE_SEPARATOR_CLASS}
 * 基础上**刻意排除空格 / Tab**（空格几乎总是「序号→标题」的标题间隔符，而非段间分隔符）。
 *
 * **方案 A（0.6.6）后仅供 {@link stripPrefixBroad} 使用**（同 {@link TITLE_SEPARATOR_CLASS}）。
 */
const NUMBER_SEPARATOR_CLASS = "[.,;:、，。．·：；)）】」』>\\]-]";

/**
 * 把一组前缀 / 后缀字面量拼成「能匹配其中任一者」的正则片段（按长度降序，使较长字面量优先匹配）。
 *
 * 方案 A（见 doc/testplan.md B2/B3）：剥离前后缀时不死扣当前模板值，而是接受一个**候选集合**——
 * 至少含「当前级别值」与「空串」，并可由 {@link StripAffixOptions} 注入「全模板在用的前后缀并集」。于是：
 * - **空串恒在候选里** → 之前在「无前缀」时编的号（如 `1 标题`），即便现在模板已配了前缀（`第`），
 *   也能被识别剥掉，再叠正确的新前缀，不会得到 `第1 1 标题`（B2/B3 的「空→非空」方向）。
 * - **并集含旧值** → 把某模板前缀从 `第` 改成别的、而别处仍在用 `第` 时，旧 `第…` 前缀也能剥净
 *   （「非空→另一值」方向，靠 main.ts 传入并集覆盖）。
 *
 * 误伤面被限定在「用户实际配过的字面量集合」内，可控且可测（不像任意容差那样吞掉真实标题）。
 */
function affixAlternation(values: readonly string[]): string {
	const uniq = Array.from(new Set(values)).sort((a, b) => b.length - a.length);
	return `(?:${uniq.map(escapeRegExp).join("|")})`;
}

/** 某序号样式可能出现的字符类片段，用于剥离已有前缀。 */
function numeralTokenPattern(style: NumeralStyle): string {
	switch (style) {
		case "arabic":
			return "\\d+";
		case "cjk":
			return "[〇零一二三四五六七八九十百千万亿兆]+";
		case "circled":
			return "[\\u2460-\\u2473\\u3251-\\u325F\\u32B1-\\u32BF]";
		case "lower-alpha":
			return "[a-z]+";
		case "upper-alpha":
			return "[A-Z]+";
		case "lower-roman":
			return "[ivxlcdm]+";
		case "upper-roman":
			return "[IVXLCDM]+";
	}
}

/** 序号样式的固定枚举顺序，供构造 union token 时稳定遍历。 */
const ALL_NUMERAL_STYLES: NumeralStyle[] = [
	"arabic",
	"cjk",
	"circled",
	"lower-alpha",
	"upper-alpha",
	"lower-roman",
	"upper-roman",
];

/**
 * 依据模板与级别，为「首哨兵在、尾哨兵被毁」的残缺前缀构造**有界剥离**正则（0.7.20「双哨兵」）。
 *
 * 仅在 {@link stripPrefix} 已确认**首部 WJ 哨兵存在**（= 此处确有插件前缀的结构性证据）时调用，故可以
 * 安全地用样式正则去消费残缺前缀——不再是「猜正文像不像编号」（方案 A 禁止的），而是「已知有前缀、把它
 * 剥净」。消费一段：`可选前缀字面量 + 该级用到的序号样式 token（多段以 numberSeparator 拼接）+ 可选后缀
 * 字面量 + 可选标题间隔符`。匹配不上（重度损坏）则原样返回，交由上层 ① 兜底 / 方案 A 保留。
 */
function boundedStripDamagedPrefix(
	s: string,
	level: number,
	template: Template,
	options: StripAffixOptions,
): string {
	const fmt = getLevelFormat(template, level);
	if (!fmt) {
		return s;
	}
	const top = normalizeTopLevel(template.topLevel);
	// 收集 top..level 各段实际可能用到的序号样式（inherit 时祖先段样式各异），并入 arabic 兜底
	//（祖先序号渲染策略可能把祖先段强制为 arabic，见 render.ts）。
	const styles = new Set<NumeralStyle>(["arabic"]);
	for (let l = Math.min(top, level); l <= level; l++) {
		const f = getLevelFormat(template, l);
		if (f) {
			styles.add(f.numeral);
		}
	}
	const tokenAlt = `(?:${Array.from(styles).map(numeralTokenPattern).join("|")})`;
	const numSep = escapeRegExp(fmt.numberSeparator);
	const numPart = numSep ? `${tokenAlt}(?:${numSep}${tokenAlt})*` : `${tokenAlt}(?:${tokenAlt})*`;
	const prefixAlt = affixAlternation([...(options.strippablePrefixes ?? []), fmt.prefix, ""]);
	const suffixAlt = affixAlternation([...(options.strippableSuffixes ?? []), fmt.suffix, ""]);
	// 标题间隔符可能已被部分删除，故整体可选。
	const titleSep = fmt.titleSeparator ? `(?:${escapeRegExp(fmt.titleSeparator)})?` : "";
	const pattern = new RegExp(`^${prefixAlt}${numPart}${suffixAlt}${titleSep}`);
	return s.replace(pattern, "");
}

/**
 * 剥离标题文本中由本插件写入的编号前缀（**方案 A，0.6.6：Word Joiner 边界** + **0.7.20 双哨兵自愈**）。
 *
 * `buildPrefix` 写出的前缀**首尾各带一个 Word Joiner 哨兵**（`⁠前缀内容⁠`）。剥离规则：
 * - **首字符即 WJ（首哨兵在）**：
 *   - 还能找到**第二个 WJ**（尾哨兵在）→ 精确剥到第二个 WJ 之后（O(n)、无正则、常规路径）。
 *   - 找不到第二个 WJ（**尾哨兵连同后缀被用户删掉**）→ 首哨兵作证据，对其后内容启用
 *     {@link boundedStripDamagedPrefix} 有界剥离，把残缺前缀（如 `一` / `一、`）剥净——**根治
 *     「删后缀致序号重复」bug**（`一、⁠标题` 删成 `一标题` → 下轮愈合回 `标题`，见 testplan E14–E17）。
 * - **含 WJ 但不在首位**（0.6.4 起的旧**单**哨兵格式，或首哨兵被删、尾哨兵尚在）→ 剥到第一个 WJ 之后，
 *   与旧行为一致（向后兼容）。
 * - **完全不含 WJ** → 整段视为**纯用户文本、原样返回**（方案 A）。用户写的 `## 2024 年度总结` 首次触发
 *   也不会把 `2024` 当前缀吃掉。**首尾哨兵均被毁**的极端情形（要连行首附近的首哨兵也删掉，很罕见）不
 *   自愈——此时与真实用户文本已无从区分，强行猜测会重蹈方案 A 要根治的 E5 误伤，故保留现状、由用户主动
 *   用「清除编号」命令处理（见 spec §2.5 的取舍说明）。
 *
 * `boundedStripDamagedPrefix` 需要模板信息，故 `level` / `template` / `options` 现参与损坏路径的剥离；
 * 常规路径（双哨兵完好）仍与模板无关。缺省 level/template（纯单测直调）时损坏路径退化为仅剥首哨兵。
 */
export function stripPrefix(
	text: string,
	level?: number,
	template?: Template,
	options: StripAffixOptions = {},
): string {
	const first = text.indexOf(WORD_JOINER);
	if (first < 0) {
		return text; // 方案 A：无 WJ → 纯正文。
	}
	if (first === 0) {
		const second = text.indexOf(WORD_JOINER, 1);
		if (second >= 0) {
			return text.slice(second + 1); // 双哨兵完好：剥到尾哨兵之后。
		}
		// 尾哨兵被毁，首哨兵作证据 → 有界剥离残缺前缀。
		const rest = text.slice(1);
		if (level !== undefined && template) {
			return boundedStripDamagedPrefix(rest, level, template, options);
		}
		return rest;
	}
	// 旧单哨兵格式 / 首哨兵被删而尾哨兵在：剥到第一个 WJ 之后。
	return text.slice(first + 1);
}

/**
 * 剥离一个已解析标题的编号前缀，并去除结果的行尾空白。
 *
 * 关键点：对 {@link Heading.rawText}（**保留行尾空白**）而非已 trim 的 {@link Heading.text}
 * 调用 {@link stripPrefix}。这样在用户于**空行**上直接转标题、行变为 `### 1.1 `（末尾即标题
 * 间隔符的空格）的情形下，`1.1 ` 仍带着间隔符空格、能被前缀正则干净命中并剥成空；而 `# 三`
 * 这类「本身是序号字样、末尾无空格」的真实标题则因缺少间隔符不被误剥。剥离后再 trim 掉
 * 可能残留的行尾空白，与解析器对 {@link Heading.text} 的处理保持一致。
 */
export function stripHeadingPrefix(
	heading: Heading,
	level: number,
	template: Template,
	options: StripAffixOptions = {},
): string {
	return stripPrefix(heading.rawText, level, template, options)
		.replace(/^[ \t]+/, "")
		.replace(/\s+$/, "");
}

/**
 * 全样式宽松前缀剥离——用于 M6「清除编号」命令（见 `cleanup.ts`）。
 *
 * 与 {@link stripPrefix} 相比更激进：**末段也纳入字母样式**（lower-alpha / upper-alpha），
 * 不依赖任何模板参数（不查 `template.levels[*].numeral` 是否在用字母）。仅剥一层
 * （「2024 折中」，同 {@link stripPrefix}）。
 *
 * **已知风险（spec §3.10 / §2.3 预期取舍）：** 以序号样字（含字母）开头紧跟分隔符的标题
 * 可能被误剥——如 `a) 概述` → `概述` ✓，但 `API 设计` → `设计` ⚠️。
 * 「清除编号」是用户主动操作，此风险已被接受。与调高 topLevel 时的 C3 修复不同——后者
 * 走模板感知的 {@link stripHeadingPrefix}，仅当模板实际使用字母时才剥字母前缀，误伤面更小。
 *
 * @param rawText 标题的原始文本（含行尾空白，见 {@link Heading.rawText}）
 * @param knownPrefixes 已知前缀候选（含空串；由 main.ts 传入全模板前缀并集）
 * @param knownSuffixes 已知后缀候选（同上）
 */
export function stripPrefixBroad(
	rawText: string,
	knownPrefixes: readonly string[] = [],
	knownSuffixes: readonly string[] = [],
): string {
	// WJ 快速路径：buildPrefix 写入 WJ（0.6.4 起单哨兵、0.7.20 起首尾双哨兵），此路径生效；旧格式由
	// 下方正则路径兼容。
	const wjIdx = rawText.indexOf(WORD_JOINER);
	if (wjIdx === 0) {
		// 双哨兵：首字符即 WJ。尾哨兵在 → 剥到**第二个** WJ 之后（整段前缀清净）；尾哨兵被毁 →
		// 去掉首哨兵后**落入下方全样式正则**剥残缺前缀（不能只去首哨兵留下 `①） 三`）。
		const second = rawText.indexOf(WORD_JOINER, 1);
		if (second >= 0) {
			return rawText.slice(second + 1).replace(/\s+$/, "");
		}
		rawText = rawText.slice(1);
	} else if (wjIdx > 0) {
		return rawText.slice(wjIdx + 1).replace(/\s+$/, "");
	}
	const allToken = `(?:${ALL_NUMERAL_STYLES.map(numeralTokenPattern).join("|")})`;
	const sep = `${NUMBER_SEPARATOR_CLASS}+`;
	const numberPattern = `(?:${allToken}${sep})*${allToken}`;
	const prefixAlt = affixAlternation([...knownPrefixes, ""]);
	const suffixAlt = affixAlternation([...knownSuffixes, ""]);
	const titleSep = `${TITLE_SEPARATOR_CLASS}+`;
	const pattern = new RegExp(`^${prefixAlt}${numberPattern}${suffixAlt}${titleSep}`);
	return rawText.replace(pattern, "").replace(/\s+$/, "");
}

/**
 * 剥离一段标题文本里**外来 / 手写**的编号前缀——用于 0.6.6「清理非本插件的标题编号」命令
 * （见 `cleanup.ts` 与 spec §3.10）。**调用方须保证传入的是不含 WJ 的标题**（含 WJ = 本插件写的，
 * 由命令层跳过、不动）。
 *
 * 比 {@link stripPrefixBroad} 覆盖**更多手写惯例**，独立于任何模板：
 * - 全部序号样式（arabic / cjk / circled / 字母 / 罗马）+ 多段（`1.2.3`）；
 * - 可选 `第`、可选成对括号（`(1)` / `（一）` / `[1]` / `【1】` / `〔1〕` / `《1》`）；
 * - 可选中文量词单位（`第3章` / `一节` / `2条`…）；
 * - 之后须跟分隔标点 / 空白（{@link TITLE_SEPARATOR_CLASS}），故「纯数字无分隔」的真实标题（`100`）不被误剥。
 *
 * **已知风险（与「清除编号」同源、属预期，spec §3.10）：** 以序号样字（含字母）开头紧跟分隔符的真实
 * 标题可能被误剥（`API 设计` → `设计`、`2024 总结` → `总结`）。本命令是**用户主动**的一次性清理，已接受。
 */
export function stripForeignNumbering(rawText: string): string {
	const allToken = `(?:${ALL_NUMERAL_STYLES.map(numeralTokenPattern).join("|")})`;
	const sep = `${NUMBER_SEPARATOR_CLASS}+`;
	const numberPattern = `(?:${allToken}${sep})*${allToken}`;
	const cjkPrefix = "(?:第)?";
	const open = "[(（\\[【〔《〈]?";
	const cjkUnit = "(?:[章节條条讲講篇部回卷课課])?";
	// 序号之后**必须**跟「成对右括号 或 分隔标点 / 空白」中的至少一个（故纯数字无分隔的真实标题
	// 如 `100`、`三` 不被误剥）。右括号兼作分隔（`（一）背景` 中 `）` 即边界，无需空格）。
	const trail = `(?:[)）\\]】〕》〉]|${TITLE_SEPARATOR_CLASS})+`;
	const pattern = new RegExp(`^${cjkPrefix}${open}${numberPattern}${cjkUnit}${trail}`);
	return rawText.replace(pattern, "").replace(/\s+$/, "");
}
