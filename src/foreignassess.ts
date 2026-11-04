/**
 * 手写 / 外来编号的**整篇判定**：给每个不带插件前缀的标题定档「确定 / 存疑」（spec §3.10「按置信度
 * 分级」，testplan J29–J34 / H23 / V80）。预览框、两个清理命令、迁移守卫、仅显示模式**只调这一个函数**。
 *
 * 单个标题只看形状永远分不清 `a 备注` 与 `C 语言`、`1 红米` 与 `2024 总结`，所以形状之外再找整篇证据：
 *
 * - **形状**（{@link matchForeignPrefix}）：强（`第三章` / `（一）` / `①` / `一、` / `1.` / `1)` / `IV、` / `C. 语言`，
 *   单独即确定）、中（`1 概述` / `一 概述` / `A. Introduction` / 多段号，单独为存疑）、弱（字母或罗马后只跟空格，
 *   单独不算）。
 * - **成串**：同一父标题下、同一读法，序号元组从全 0 / 1 起（或以父标题编号开头、末段为 0 / 1），每步某一位
 *   加 1 或 2、其后各位归 0 / 1，至少 2 个 → 整串确定；中间夹着的不相干标题跳过不断串。
 * - **上下级对得上**：多段号去掉末段等于父标题的编号、末段为 0 / 1 → 父子都确定（`1 红米` / `1.1 工艺`）。
 * - **值 = 同级序位**：中形状的单段序号，值等于它在同级里的位置 → 确定（`1 红米` 是第 1 个；`2024 总结` 不是）。
 *   字母只跟空格（弱形状）不用这条——`A 股`、`C 语言` 恰好对得上位置的太多。
 * - **否决**：数字后跟量词 / 单位（`30 秒版`、`6 个 master`、`2027 年`）不用「值 = 序位」猜；成串剥后同级
 *   重名（`A 计划` / `B 计划`）整串作废。量词只挡单个孤立标题的猜测，不挡成串与上下级——单字量词常是普通词
 *   的开头（`2 分析`、`1 项目背景`、`3 部署方案`），而从 1 起连续递增本身已是够硬的证据。
 *
 * 序号值用 {@link renderNumeral} 渲染 1–99 反查（成串只需小值，且与渲染端天然一致），不另写反向解析器；
 * `vim`、`CLI` 这类拼不出 99 以内罗马数字的词查不到值，自然进不了串。
 */

import { parseHeadings } from "./parser";
import { renderNumeral } from "./render";
import { hasPluginPrefix, matchForeignPrefix, type ForeignPrefixMatch } from "./strip";
import type { NumeralStyle } from "./template";

/** 档位：`sure` 可自动处理（直接剥 / 守卫拦），`unsure` 只列出、交给用户勾选。 */
export type ForeignTier = "sure" | "unsure";

/** {@link assessForeignNumbering} 的单条结果。 */
export interface ForeignAssessment {
	/** 标题所在行号（0 起）。 */
	lineIndex: number;
	/** 标题级别（`#` 的数量）。 */
	level: number;
	/** 档位。 */
	tier: ForeignTier;
	/** 剥掉手写编号后的标题文本（不含 `#`，去行尾空白）。 */
	stripped: string;
}

/** 一种读法：每段的样式 + 值（`c` 可读作 lower-alpha 3 或 lower-roman 100，后者超出反查表故只剩前者）。 */
interface Reading {
	sig: string;
	values: number[];
}

interface Candidate {
	lineIndex: number;
	level: number;
	parent: number;
	group: string;
	pos: number;
	match: ForeignPrefixMatch;
	stripped: string;
	kind: "strong" | "medium" | "weak";
	measure: boolean;
	readings: Reading[];
	sure: boolean;
}

/** 反查表覆盖的样式（阿拉伯数字直接 `Number()`）。 */
const LOOKUP_STYLES: NumeralStyle[] = [
	"cjk",
	"circled",
	"lower-alpha",
	"upper-alpha",
	"lower-roman",
	"upper-roman",
];

/** 反查上限：成串从 0 / 1 起、相邻差 ≤ 2，99 以内足够；多了反而让 `CLI`（151）这类词有值可配。 */
const LOOKUP_MAX = 99;

let lookup: Map<string, { style: NumeralStyle; value: number }[]> | null = null;

/** 一个序号段的所有读法（样式 + 值）；读不出值返回空数组。 */
function segmentReadings(token: string): { style: NumeralStyle; value: number }[] {
	if (/^\d+$/.test(token)) {
		return [{ style: "arabic", value: Number(token) }];
	}
	if (!lookup) {
		lookup = new Map([
			["〇", [{ style: "cjk", value: 0 }]],
			["零", [{ style: "cjk", value: 0 }]],
		]);
		for (const style of LOOKUP_STYLES) {
			for (let n = 1; n <= LOOKUP_MAX; n++) {
				const key = renderNumeral(style, n);
				lookup.set(key, [...(lookup.get(key) ?? []), { style, value: n }]);
			}
		}
	}
	return lookup.get(token) ?? [];
}

/** 各段读法的笛卡尔积（段数 ≤ 6、每段至多两种读法，组合数有界）。 */
function readingsOf(segments: readonly string[]): Reading[] {
	let acc: { styles: string[]; values: number[] }[] = [{ styles: [], values: [] }];
	for (const seg of segments) {
		const options = segmentReadings(seg);
		if (options.length === 0) {
			return [];
		}
		acc = acc.flatMap((a) =>
			options.map((o) => ({
				styles: [...a.styles, o.style],
				values: [...a.values, o.value],
			})),
		);
	}
	return acc.map((a) => ({ sig: a.styles.join(","), values: a.values }));
}

const CIRCLED_RE = /^[①-⑳㉑-㉟㊱-㊿]$/;
const DIGIT_RE = /^(?:\d+|[〇零一二三四五六七八九十百千万亿兆]+)$/;
const CLOSE_BRACKET_RE = /[)）\]】〕》〉]/;

/**
 * 数字后紧跟的量词 / 单位：`30 秒版`、`6 个 master`、`2027 年第一季度`、`4 位加法器`、`100 题`——是数量，不是
 * 编号（主力库实测「数字 + 空格」开头的标题几乎全是这类）。封闭短表，不像拉丁词表那样永远列不全。只用于
 * 否决「值 = 序位」的猜测（见文件头）。
 */
const MEASURE_RE =
	/^(?:个|位|名|种|类|项|条|点|件|次|回|遍|步|层|级|号|年|月|日|天|周|小时|分钟|分|秒|岁|元|块|米|倍|成|万|亿|千|百|题|道|页|格|行|字|张|本|篇|部|套|份|组|节|句|段|%)/;

function shapeKind(m: ForeignPrefixMatch, rest: string, hasValue: boolean): Candidate["kind"] {
	if (m.latinWord) {
		return "weak";
	}
	// 字母 / 罗马 + 冒号是标签（`Q：…`、`ID：…`、`CDC：…`），读不出值的字母词（`ID`、`CDC`）也不可能是强编号。
	if (!DIGIT_RE.test(m.segments[0]) && !CIRCLED_RE.test(m.segments[0])) {
		if (/^[:：]/.test(m.trail) || !hasValue) {
			return "weak";
		}
	}
	if (m.di || m.unit || (m.open && CLOSE_BRACKET_RE.test(m.trail))) {
		return "strong";
	}
	if (m.segments.length === 1 && CIRCLED_RE.test(m.segments[0])) {
		return "strong";
	}
	if (m.segments.length === 1 && /^\S/.test(m.trail)) {
		if (DIGIT_RE.test(m.segments[0])) {
			return "strong";
		}
		// 字母 / 罗马 + 标点：中文标点或右括号（`IV、`、`A)`）是明确的编号写法；英文句点要看后面——后跟拉丁
		// 字母多半是缩写（`C. elegans`、`J. Smith`），后跟中文等（`C. 语言`）才是编号。
		if (/^[、，。．；)）]/.test(m.trail) || !/^[A-Za-z]/.test(rest)) {
			return "strong";
		}
	}
	return "medium";
}

function sameValues(a: readonly number[], b: readonly number[]): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** `next` 是否紧接 `prev`：某一位加 1 或 2、之前各位相同、之后各位归 0 / 1。 */
function follows(prev: readonly number[], next: readonly number[]): boolean {
	if (prev.length !== next.length) {
		return false;
	}
	for (let i = 0; i < next.length; i++) {
		if (next[i] !== prev[i]) {
			return (
				next[i] > prev[i] &&
				next[i] <= prev[i] + 2 &&
				next.slice(i + 1).every((v) => v <= 1)
			);
		}
	}
	return false;
}

/**
 * 整篇判定：对每个**不带插件前缀**、开头像手写编号的标题给出档位与剥离结果。弱形状（`vim 配置`）没成串、
 * 连字符词（`K-means`）、剥完为空的「标题本身就是编号」（`# 第一章`，见 `isNumberOnlyHeading`）不在结果里。
 *
 * @param content Markdown 全文。
 * @returns 按行号升序的判定结果。
 */
export function assessForeignNumbering(content: string): ForeignAssessment[] {
	const headings = parseHeadings(content);
	const stack: number[] = [];
	const positions = new Map<string, number>();
	const byHeading = new Map<number, Candidate>();
	headings.forEach((h, i) => {
		while (stack.length > 0 && headings[stack[stack.length - 1]].level >= h.level) {
			stack.pop();
		}
		const parent = stack.length > 0 ? stack[stack.length - 1] : -1;
		stack.push(i);
		const group = `${parent}:${h.level}`;
		const pos = (positions.get(group) ?? 0) + 1;
		positions.set(group, pos);

		if (hasPluginPrefix(h.rawText)) {
			return;
		}
		const match = matchForeignPrefix(h.rawText);
		const stripped = match ? h.rawText.slice(match.prefix.length).replace(/\s+$/, "") : "";
		// 连字符词（`K-means`）与剥完为空的纯编号标题不当候选。
		if (!match || match.prefix.endsWith("-") || stripped.trim() === "") {
			return;
		}
		const readings = readingsOf(match.segments);
		const kind = shapeKind(match, stripped, readings.length > 0);
		const measure =
			kind === "medium" &&
			match.segments.length === 1 &&
			DIGIT_RE.test(match.segments[0]) &&
			/^\s+$/.test(match.trail) &&
			MEASURE_RE.test(stripped);
		byHeading.set(i, {
			lineIndex: h.lineIndex,
			level: h.level,
			parent,
			group,
			pos,
			match,
			stripped,
			kind,
			measure,
			readings,
			sure: kind === "strong",
		});
	});

	const eligible = [...byHeading.values()].filter((c) => c.readings.length > 0);
	const parentHas = (c: Candidate, lead: readonly number[]): Candidate | null => {
		const p = byHeading.get(c.parent);
		return lead.length > 0 && p && p.readings.some((r) => sameValues(r.values, lead))
			? p
			: null;
	};

	// 上下级对得上 + 值 = 同级序位。
	for (const c of eligible) {
		for (const r of c.readings) {
			const last = r.values[r.values.length - 1];
			const p = r.values.length > 1 && last <= 1 ? parentHas(c, r.values.slice(0, -1)) : null;
			if (p) {
				c.sure = true;
				p.sure = true;
			}
			if (
				c.kind === "medium" &&
				!c.measure &&
				r.values.length === 1 &&
				(last === c.pos || (last === 0 && c.pos === 1))
			) {
				c.sure = true;
			}
		}
	}

	// 成串：按「同一父标题下的同级」分组，每种读法各走一遍贪心链。
	const groups = new Map<string, Candidate[]>();
	for (const c of eligible) {
		groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
	}
	for (const members of groups.values()) {
		const sigs = new Set(members.flatMap((c) => c.readings.map((r) => r.sig)));
		for (const sig of sigs) {
			let chain: { c: Candidate; v: number[] }[] = [];
			const settle = (): void => {
				const rests = chain.map((x) => x.c.stripped.trim());
				// 字母只跟空格的串，剥后各条都以同一个字起头（`A 档 — …` / `B 档 — …`、`A 计划` / `B 计划`）：
				// 字母是在修饰后面那个词，不是编号。
				const qualifier =
					chain.some((x) => x.c.kind === "weak") &&
					new Set(rests.map((r) => [...r][0])).size === 1;
				if (chain.length >= 2 && new Set(rests).size === chain.length && !qualifier) {
					chain.forEach((x) => (x.c.sure = true));
				}
			};
			for (const c of members) {
				const r = c.readings.find((x) => x.sig === sig);
				if (!r) {
					continue;
				}
				const v = r.values;
				const canStart =
					v.every((x) => x <= 1) ||
					(v[v.length - 1] <= 1 && parentHas(c, v.slice(0, -1)) !== null);
				const last = chain[chain.length - 1];
				if (last && follows(last.v, v)) {
					chain.push({ c, v });
				} else if (canStart) {
					settle();
					chain = [{ c, v }];
				}
			}
			settle();
		}
	}

	const out: ForeignAssessment[] = [];
	for (const c of byHeading.values()) {
		if (c.sure || c.kind !== "weak") {
			out.push({
				lineIndex: c.lineIndex,
				level: c.level,
				tier: c.sure ? "sure" : "unsure",
				stripped: c.stripped,
			});
		}
	}
	return out.sort((a, b) => a.lineIndex - b.lineIndex);
}
