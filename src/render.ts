/**
 * 序号渲染与前缀拼装（引擎四职之一，见 `numbering.ts` 顶部说明）。
 *
 * - 各序号样式的渲染器（arabic / cjk / circled / 字母 / 罗马）与统一入口 {@link renderNumeral}。
 * - 按模板与计数器状态拼装完整编号前缀的 {@link buildPrefix}（末尾追加 Word Joiner 标记）。
 * - 设置面板实时预览用的 {@link previewLevel}。
 */

import { HeadingCounter } from "./count";
import { WORD_JOINER } from "./strip";
import {
	getLevelFormat,
	normalizeAncestorNumeral,
	normalizeBottomLevel,
	normalizeSkipFill,
	normalizeStartIndex,
	normalizeTopLevel,
	type NumeralStyle,
	type Template,
} from "./template";

/** CJK 数字基本字符（0–9）。 */
const CJK_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
/** 四位段内的位权单位（个、十、百、千）。 */
const CJK_SMALL_UNITS = ["", "十", "百", "千"];
/** 大节单位（个、万、亿、兆）；每节四位。 */
const CJK_BIG_UNITS = ["", "万", "亿", "兆"];

/** 将 1–9999 的整数转换为中文数字（不含大节单位）。 */
function cjkSection(n: number): string {
	let out = "";
	let pendingZero = false;
	let pos = 0;
	while (n > 0) {
		const d = n % 10;
		if (d === 0) {
			// 仅当已有更高位输出时，才记一个待补的「零」（多个连续零只补一次）。
			if (out !== "") {
				pendingZero = true;
			}
		} else {
			if (pendingZero) {
				out = CJK_DIGITS[0] + out;
				pendingZero = false;
			}
			out = CJK_DIGITS[d] + CJK_SMALL_UNITS[pos] + out;
		}
		n = Math.floor(n / 10);
		pos++;
	}
	return out;
}

/**
 * 将一个正整数渲染为中文数字（简体习惯）。
 * 处理大节单位（万/亿/兆）与节间补零；并将开头的「一十…」规范为「十…」（如 10→十、15→十五）。
 */
function toCJK(value: number): string {
	if (value <= 0) {
		return CJK_DIGITS[0];
	}
	// 拆为每四位一节，sections[0] 为最低节。
	const sections: number[] = [];
	let rest = value;
	while (rest > 0) {
		sections.push(rest % 10000);
		rest = Math.floor(rest / 10000);
	}
	let out = "";
	for (let i = sections.length - 1; i >= 0; i--) {
		const sec = sections[i];
		if (sec === 0) {
			// 空节：若后续仍有非零节，补一个「零」（去重）。
			if (out !== "" && !out.endsWith(CJK_DIGITS[0])) {
				out += CJK_DIGITS[0];
			}
			continue;
		}
		// 非最高节且本节不足千（首位为零）时，节间需补「零」。
		if (out !== "" && sec < 1000 && !out.endsWith(CJK_DIGITS[0])) {
			out += CJK_DIGITS[0];
		}
		out += cjkSection(sec) + CJK_BIG_UNITS[i];
	}
	// 去除因空的最低节而多补的尾随「零」（如 10000 → 一万，而非 一万零）。
	while (out.endsWith(CJK_DIGITS[0])) {
		out = out.slice(0, -1);
	}
	// 规范化：开头的「一十」习惯写作「十」（10→十、11→十一、19→十九）。
	if (out.startsWith("一十")) {
		out = out.slice(1);
	}
	return out;
}

/** 带圈数字的各区段起点（Unicode），用于 1–50 的渲染。 */
const CIRCLED_RANGES: { start: number; from: number; to: number }[] = [
	{ start: 0x2460, from: 1, to: 20 }, // ①–⑳
	{ start: 0x3251, from: 21, to: 35 }, // ㉑–㉟
	{ start: 0x32b1, from: 36, to: 50 }, // ㊱–㊿
];

/** 将 1–50 的整数渲染为带圈数字；超出范围回退为 `(n)`。 */
function toCircled(value: number): string {
	for (const r of CIRCLED_RANGES) {
		if (value >= r.from && value <= r.to) {
			return String.fromCodePoint(r.start + (value - r.from));
		}
	}
	return `(${value})`;
}

/**
 * 将正整数渲染为双射 26 进制字母序列（a, b, …, z, aa, ab, …）。
 * `base` 为字母表起点的码位（小写 'a' 或大写 'A'）。
 */
function toAlpha(value: number, base: number): string {
	if (value <= 0) {
		return String(value);
	}
	let n = value;
	let out = "";
	while (n > 0) {
		n -= 1; // 双射：无「零位」，故每位先减一。
		out = String.fromCharCode(base + (n % 26)) + out;
		n = Math.floor(n / 26);
	}
	return out;
}

/** 罗马数字值-字母对照表（减法规则，降序排列）。 */
const ROMAN_MAP: readonly [number, string][] = [
	[1000, "m"],
	[900, "cm"],
	[500, "d"],
	[400, "cd"],
	[100, "c"],
	[90, "xc"],
	[50, "l"],
	[40, "xl"],
	[10, "x"],
	[9, "ix"],
	[5, "v"],
	[4, "iv"],
	[1, "i"],
];

/** 将正整数渲染为罗马数字；`uppercase` 为 true 时输出大写。超出范围（<1）回退为阿拉伯。 */
function toRoman(value: number, uppercase: boolean): string {
	if (value < 1) {
		return String(value);
	}
	let n = value;
	let out = "";
	for (const [v, s] of ROMAN_MAP) {
		while (n >= v) {
			out += s;
			n -= v;
		}
	}
	return uppercase ? out.toUpperCase() : out;
}

/**
 * 将一个纯阿拉伯整数渲染为指定序号样式的字符串。
 * 支持 `arabic` / `cjk` / `circled` / `lower-alpha` / `upper-alpha` /
 * `lower-roman` / `upper-roman`（见 spec.md §3.6）。
 */
export function renderNumeral(style: NumeralStyle, value: number): string {
	switch (style) {
		case "arabic":
			return String(value);
		case "cjk":
			return toCJK(value);
		case "circled":
			return toCircled(value);
		case "lower-alpha":
			return toAlpha(value, 0x61); // 'a'
		case "upper-alpha":
			return toAlpha(value, 0x41); // 'A'
		case "lower-roman":
			return toRoman(value, false);
		case "upper-roman":
			return toRoman(value, true);
	}
}

/**
 * 依据模板与当前计数器状态，为某级标题拼装编号前缀。
 *
 * 序号段从模板的 `topLevel` 起算（而非固定 H2）：如 `topLevel=H1` 时 H2 前缀为 `1.1`、
 * `topLevel=H3` 时 H4 前缀为 `1.1`（只取 H3–H4 两段）。仅应对 `level >= topLevel` 调用。
 *
 * - 继承前级 = 开：`WJ + prefix + 各级序号（以 numberSeparator 拼接，每级各自套用其样式）+ suffix + titleSeparator + WJ`。
 * - 继承前级 = 关：`WJ + prefix + 本级序号 + suffix + titleSeparator + WJ`。
 *
 * **首尾各追加一个 {@link WORD_JOINER}（U+2060）哨兵**（0.7.20「双哨兵」）：末尾 WJ 是精确结束标记
 * （常规剥离剥到它之后）；**首部 WJ 是「此处确有插件前缀」的结构性证据**——当用户编辑后缀导致末尾
 * WJ 连同后缀被一起删掉（`一、⁠标题` → `一标题`，孤儿序号落入正文）时，首哨兵仍在，`stripPrefix`
 * 据此启用**有界剥离**把残缺前缀剥净，避免「一、⁠一标题」这类序号重复（见 spec §2.5 / testplan E14–E17）。
 * 两个 WJ 导出 / 复制均不可见，且 backlink 锚点归一两侧同口径剥 WJ（见 `backlinks.ts`），不影响链接。
 */
export function buildPrefix(template: Template, level: number, counter: HeadingCounter): string {
	const fmt = getLevelFormat(template, level);
	if (!fmt) {
		throw new RangeError(`无法为级别 ${level} 拼装前缀（仅支持 H1–H6）`);
	}
	const top = normalizeTopLevel(template.topLevel);
	// 起始编号数字（M8 批次 1）：仅对首段（topLevel 对应段）做渲染期偏移；startIndex=1 时偏移
	// 为 0（=历史行为）。计数器内部恒为 1 起，0 仍是「跳级缺失」哨兵，偏移不作用于占位段。
	const startOffset = normalizeStartIndex(template.startIndex) - 1;

	let numberStr: string;
	if (fmt.inherit) {
		// 仅取 topLevel..level 的计数段（counter.sequence 返回 c1..cLevel）。
		const seq = counter.sequence(level).slice(top - 1);
		const skipFill = normalizeSkipFill(template.skipFill);
		const ancestorNumeral = normalizeAncestorNumeral(template.ancestorNumeral);
		const lastIndex = seq.length - 1; // 末段下标 = 当前级；其余为祖先段。
		const parts: string[] = [];
		seq.forEach((value, i) => {
			// 标题层级跳跃（如 H3 → H5）时，缺失的中间级别计数器值为 0、从未实例化。
			// 此处按用户选择的占位策略处理（见 template.ts 的 SkipFill）：
			// - drop：不补位，丢弃该段（段数 = 实际存在的层级数）。
			// - fill：以 placeholder 字面量补位（如 `0` → `1.1.0.1`），段数 = 标题深度。
			// 无论补不补，该级计数器本身仍保持 0，直到真正出现该级标题才从 1 累加——
			// 因此后续首个真实的该级标题不被借号（如 H3→H5 在前，随后首个真实 H4 仍为 `…1`）。
			if (value === 0) {
				// none 模式下跳级标题已在 numberHeadings 走「不编号」分支、不会到这里；
				// 防御性兜底（如面板预览等直调路径）按 drop 处理，省略该段。
				if (skipFill.mode !== "fill") {
					return;
				}
				parts.push(skipFill.placeholder);
				return;
			}
			// 正常段：seq[i] 对应级别 top + i。
			// - 末段（当前级）：始终套用本级 numeral 样式。
			// - 祖先段：按「祖先序号渲染」策略——`self` 用各祖先自身样式（历史行为），
			//   `arabic` 一律阿拉伯（中文书惯例：H2 标题 `一`、H3 子节 `1.1`）。
			const segLevel = top + i;
			const segFmt = getLevelFormat(template, segLevel) ?? fmt;
			const style = i < lastIndex && ancestorNumeral === "arabic" ? "arabic" : segFmt.numeral;
			// 首段（i===0 即 topLevel 段）加起始编号偏移；深层段保持 1 起。
			parts.push(renderNumeral(style, i === 0 ? value + startOffset : value));
		});
		numberStr = parts.join(fmt.numberSeparator);
	} else {
		// 继承前级=关：仅当本级恰为 topLevel（=首段）时加偏移，更深层级不偏移。
		numberStr = renderNumeral(
			fmt.numeral,
			counter.current(level) + (level === top ? startOffset : 0),
		);
	}

	// 顺序：WJ 哨兵 + 前缀 + 完整序号 + 后缀 + 标题间隔符 + WJ 哨兵
	// （如「第」+「1」+「章」+「 」→「⁠第1章 ⁠」，首尾各一个不可见 WJ）。
	return WORD_JOINER + fmt.prefix + numberStr + fmt.suffix + fmt.titleSeparator + WORD_JOINER;
}

/**
 * 为设置 GUI 生成某级的实时预览前缀序列（如 H3 → `["1.1.1 ", "1.1.2 ", "1.1.3 "]`）。
 *
 * 模拟一个所有父级均为 1 的计数器状态，并让本级依次取 1、2、3，套用模板格式拼装前缀。
 * 仅用于面板展示，不影响真实编号。
 *
 * **返回前缀的原样字符串、不 trim 任何空白**——这样预览能**如实**反映「标题间隔符」里用户敲入的
 * 内容（含尾随空格）：间隔符填 `" "` 预览得 `1 标题`、填 `". "` 得 `1. 标题`。此前会 `trim` 末尾
 * 空白，导致预览把 `" "`/`". "` 显示成 `1标题`/`1.标题`，让用户误以为「敲的空格没被识别 / `. ` 被吃成
 * `.`」（实际编号写入一直是正确的，仅预览失真）。
 */
export function previewLevel(template: Template, level: number, count = 3): string[] {
	const top = normalizeTopLevel(template.topLevel);
	const bottom = normalizeBottomLevel(template.bottomLevel);
	// 低于起始编号层级、高于结束编号层级或越界：不编号，无预览。
	if (level < top || level > bottom || level < 1 || level > 6) {
		return [];
	}
	const counter = new HeadingCounter();
	// 从起始层级到本级先全部置 1。
	for (let l = top; l <= level; l++) {
		counter.bump(l);
	}
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		if (i > 0) {
			counter.bump(level); // 本级递增，得到同级的下一个序号。
		}
		out.push(buildPrefix(template, level, counter));
	}
	return out;
}
