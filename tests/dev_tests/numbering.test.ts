import { describe, expect, it } from "vitest";
import { parseHeadings, type Heading } from "../../src/parser";
import {
	DEFAULT_BOTTOM_LEVEL,
	DEFAULT_SKIP_FILL,
	DEFAULT_START_INDEX,
	DEFAULT_TEMPLATE,
	DEFAULT_TOP_LEVEL,
	HeadingCounter,
	WORD_JOINER,
	buildPrefix,
	normalizeBottomLevel,
	normalizeStartIndex,
	numberHeadings,
	previewLevel,
	renderNumeral,
	renumberContent,
	stripPrefix,
	type SkipFill,
	type Template,
} from "../../src/numbering";

describe("HeadingCounter", () => {
	it("同级标题依次累加", () => {
		const c = new HeadingCounter();
		c.bump(2);
		expect(c.current(2)).toBe(1);
		c.bump(2);
		expect(c.current(2)).toBe(2);
	});

	it("推进父级时将更深级别归零", () => {
		const c = new HeadingCounter();
		c.bump(2); // c2=1
		c.bump(3); // c3=1
		c.bump(3); // c3=2
		expect(c.sequence(3)).toEqual([0, 1, 2]); // [c1, c2, c3]
		c.bump(2); // c2=2, c3 归零
		expect(c.current(3)).toBe(0);
		expect(c.sequence(2)).toEqual([0, 2]); // [c1, c2]
	});

	it("sequence 返回 H1 到指定级别的计数序列", () => {
		const c = new HeadingCounter();
		c.bump(2);
		c.bump(3);
		c.bump(4);
		expect(c.sequence(4)).toEqual([0, 1, 1, 1]); // [c1, c2, c3, c4]
	});

	it("H1 也参与计数：bump(1) 累加并归零更深级别", () => {
		const c = new HeadingCounter();
		c.bump(1); // c1=1
		c.bump(2); // c2=1
		expect(c.sequence(2)).toEqual([1, 1]);
		c.bump(1); // c1=2，c2 归零
		expect(c.current(2)).toBe(0);
		expect(c.sequence(1)).toEqual([2]);
	});

	it("reset 清空全部计数器", () => {
		const c = new HeadingCounter();
		c.bump(2);
		c.bump(3);
		c.reset();
		expect(c.sequence(6)).toEqual([0, 0, 0, 0, 0, 0]);
	});

	it("拒绝越界级别（仅 1–6 合法）", () => {
		const c = new HeadingCounter();
		expect(() => c.bump(0)).toThrow();
		expect(() => c.bump(7)).toThrow();
	});
});

describe("renderNumeral", () => {
	it("渲染阿拉伯数字", () => {
		expect(renderNumeral("arabic", 1)).toBe("1");
		expect(renderNumeral("arabic", 42)).toBe("42");
	});

	it("渲染中文数字（含十位规范化与大节单位）", () => {
		expect(renderNumeral("cjk", 1)).toBe("一");
		expect(renderNumeral("cjk", 10)).toBe("十");
		expect(renderNumeral("cjk", 11)).toBe("十一");
		expect(renderNumeral("cjk", 20)).toBe("二十");
		expect(renderNumeral("cjk", 105)).toBe("一百零五");
		expect(renderNumeral("cjk", 110)).toBe("一百一十");
		expect(renderNumeral("cjk", 1024)).toBe("一千零二十四");
		expect(renderNumeral("cjk", 10000)).toBe("一万");
		expect(renderNumeral("cjk", 10005)).toBe("一万零五");
	});

	it("渲染带圈数字（含跨区段与超界回退）", () => {
		expect(renderNumeral("circled", 1)).toBe("①");
		expect(renderNumeral("circled", 20)).toBe("⑳");
		expect(renderNumeral("circled", 21)).toBe("㉑");
		expect(renderNumeral("circled", 50)).toBe("㊿");
		expect(renderNumeral("circled", 51)).toBe("(51)");
	});

	it("渲染双射 26 进制字母序列", () => {
		expect(renderNumeral("lower-alpha", 1)).toBe("a");
		expect(renderNumeral("lower-alpha", 26)).toBe("z");
		expect(renderNumeral("lower-alpha", 27)).toBe("aa");
		expect(renderNumeral("lower-alpha", 28)).toBe("ab");
		expect(renderNumeral("upper-alpha", 1)).toBe("A");
		expect(renderNumeral("upper-alpha", 52)).toBe("AZ");
	});

	it("G8：渲染小写罗马数字（减法规则）", () => {
		expect(renderNumeral("lower-roman", 1)).toBe("i");
		expect(renderNumeral("lower-roman", 4)).toBe("iv");
		expect(renderNumeral("lower-roman", 5)).toBe("v");
		expect(renderNumeral("lower-roman", 9)).toBe("ix");
		expect(renderNumeral("lower-roman", 10)).toBe("x");
		expect(renderNumeral("lower-roman", 14)).toBe("xiv");
		expect(renderNumeral("lower-roman", 40)).toBe("xl");
		expect(renderNumeral("lower-roman", 44)).toBe("xliv");
		expect(renderNumeral("lower-roman", 50)).toBe("l");
		expect(renderNumeral("lower-roman", 90)).toBe("xc");
		expect(renderNumeral("lower-roman", 100)).toBe("c");
		expect(renderNumeral("lower-roman", 399)).toBe("cccxcix");
		expect(renderNumeral("lower-roman", 400)).toBe("cd");
		expect(renderNumeral("lower-roman", 500)).toBe("d");
		expect(renderNumeral("lower-roman", 900)).toBe("cm");
		expect(renderNumeral("lower-roman", 1000)).toBe("m");
		expect(renderNumeral("lower-roman", 1994)).toBe("mcmxciv");
		expect(renderNumeral("lower-roman", 2024)).toBe("mmxxiv");
	});

	it("G9：渲染大写罗马数字", () => {
		expect(renderNumeral("upper-roman", 1)).toBe("I");
		expect(renderNumeral("upper-roman", 4)).toBe("IV");
		expect(renderNumeral("upper-roman", 14)).toBe("XIV");
		expect(renderNumeral("upper-roman", 1994)).toBe("MCMXCIV");
		expect(renderNumeral("upper-roman", 2024)).toBe("MMXXIV");
	});
});

describe("previewLevel 如实保留标题间隔符（含尾随空格，回归 bug）", () => {
	function withSep(sep: string): Template {
		return {
			...DEFAULT_TEMPLATE,
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h2: { ...DEFAULT_TEMPLATE.levels.h2, titleSeparator: sep },
			},
		};
	}

	it("间隔符为空格：预览保留尾随空格（不再被 trim 成「1」）", () => {
		// 此前 previewLevel 会 trim 末尾空白，使预览把「 」显示成「1」，让用户误以为空格没生效。
		// 0.6.4 起 buildPrefix 末尾追加 WJ（不可见），故预览串含 WJ。
		expect(previewLevel(withSep(" "), 2)).toEqual([
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
			`${WORD_JOINER}3 ${WORD_JOINER}`,
		]);
	});

	it("间隔符为「. 」：预览保留点+空格（不再被 trim 成「1.」）", () => {
		expect(previewLevel(withSep(". "), 2)).toEqual([
			`${WORD_JOINER}1. ${WORD_JOINER}`,
			`${WORD_JOINER}2. ${WORD_JOINER}`,
			`${WORD_JOINER}3. ${WORD_JOINER}`,
		]);
	});

	it("间隔符无尾随空白（如「、」）：原样呈现", () => {
		expect(previewLevel(withSep("、"), 2)).toEqual([
			`${WORD_JOINER}1、${WORD_JOINER}`,
			`${WORD_JOINER}2、${WORD_JOINER}`,
			`${WORD_JOINER}3、${WORD_JOINER}`,
		]);
	});
});

describe("buildPrefix（默认模板）", () => {
	it("继承前级时跨级以序号间隔符拼接", () => {
		const c = new HeadingCounter();
		c.bump(2);
		expect(buildPrefix(DEFAULT_TEMPLATE, 2, c)).toBe(`${WORD_JOINER}1 ${WORD_JOINER}`);
		c.bump(3);
		expect(buildPrefix(DEFAULT_TEMPLATE, 3, c)).toBe(`${WORD_JOINER}1.1 ${WORD_JOINER}`);
		c.bump(4);
		expect(buildPrefix(DEFAULT_TEMPLATE, 4, c)).toBe(`${WORD_JOINER}1.1.1 ${WORD_JOINER}`);
	});

	it("关闭继承前级时仅呈现本级序号", () => {
		const template: Template = {
			...DEFAULT_TEMPLATE,
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h3: {
					prefix: "",
					numeral: "arabic",
					suffix: "",
					numberSeparator: ".",
					titleSeparator: ") ",
					inherit: false,
				},
			},
		};
		const c = new HeadingCounter();
		c.bump(2);
		c.bump(3);
		c.bump(3);
		expect(buildPrefix(template, 3, c)).toBe(`${WORD_JOINER}2) ${WORD_JOINER}`);
	});

	it("应用前缀与标题间隔符字段", () => {
		const template: Template = {
			...DEFAULT_TEMPLATE,
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h2: {
					prefix: "第",
					numeral: "arabic",
					suffix: "",
					numberSeparator: ".",
					titleSeparator: "章 ",
					inherit: true,
				},
			},
		};
		const c = new HeadingCounter();
		c.bump(2);
		expect(buildPrefix(template, 2, c)).toBe(`${WORD_JOINER}第1章 ${WORD_JOINER}`);
	});

	it("后缀字段：前缀 + 序号 + 后缀 + 标题间隔符（「第1章」式）", () => {
		const template: Template = {
			...DEFAULT_TEMPLATE,
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h2: {
					prefix: "第",
					numeral: "arabic",
					suffix: "章",
					numberSeparator: ".",
					titleSeparator: " ",
					inherit: true,
				},
			},
		};
		const c = new HeadingCounter();
		c.bump(2);
		expect(buildPrefix(template, 2, c)).toBe(`${WORD_JOINER}第1章 ${WORD_JOINER}`);
		// 后缀作用于完整序号：继承父级时为「第1.1章」而非把后缀塞进每段。
		c.bump(3);
		expect(buildPrefix(template, 3, c)).toBe(`${WORD_JOINER}1.1 ${WORD_JOINER}`); // H3 沿用默认（无前后缀）
		const prefixed = buildPrefix(template, 2, c) + "标题";
		expect(prefixed).toBe(`${WORD_JOINER}第1章 ${WORD_JOINER}标题`);
		// 带前后缀的前缀（含 WJ）也能被干净剥离（WJ 快速路径，幂等）。
		expect(stripPrefix(prefixed, 2, template)).toBe("标题");
	});
});

describe("stripPrefix（默认模板，方案A：纯 WJ 边界）", () => {
	it("含 WJ 标记：精确剥到标记之后（单级与多级）", () => {
		expect(stripPrefix(`1 ${WORD_JOINER}标题`, 2, DEFAULT_TEMPLATE)).toBe("标题");
		expect(stripPrefix(`1.2.3 ${WORD_JOINER}标题`, 4, DEFAULT_TEMPLATE)).toBe("标题");
	});

	it("不含 WJ：视为纯用户文本，原样返回（不再正则猜前缀）", () => {
		// 方案A：无 WJ 标记 = 用户文本，哪怕长得像编号也不剥（消除 `2024 总结` 被吃的歧义）。
		expect(stripPrefix("1 标题", 2, DEFAULT_TEMPLATE)).toBe("1 标题");
		expect(stripPrefix("1.2.3 标题", 4, DEFAULT_TEMPLATE)).toBe("1.2.3 标题");
	});

	it("双哨兵完好：剥到第二个 WJ 之后（0.7.20）", () => {
		expect(stripPrefix(`${WORD_JOINER}1 ${WORD_JOINER}标题`, 2, DEFAULT_TEMPLATE)).toBe("标题");
		expect(stripPrefix(`${WORD_JOINER}1.2.3 ${WORD_JOINER}标题`, 4, DEFAULT_TEMPLATE)).toBe(
			"标题",
		);
	});

	it("尾哨兵被毁、首哨兵幸存：有界剥离残缺前缀（自愈 E14/E15）", () => {
		const cjk = structuredClone(DEFAULT_TEMPLATE);
		for (const k of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
			cjk.levels[k].numeral = "cjk";
			cjk.levels[k].suffix = "、";
			cjk.levels[k].titleSeparator = "";
		}
		// 删后缀 + 尾哨兵：`⁠一标题2`（首哨兵在）→ 有界剥掉 `一` → `标题2`。
		expect(stripPrefix(`${WORD_JOINER}一标题2`, 2, cjk)).toBe("标题2");
		// 仅删尾哨兵、后缀在：`⁠一、标题2` → 剥掉 `一、` → `标题2`。
		expect(stripPrefix(`${WORD_JOINER}一、标题2`, 2, cjk)).toBe("标题2");
	});

	it("旧单哨兵格式向后兼容：WJ 不在首位仍剥到该 WJ 之后", () => {
		// 0.6.4–0.7.19 写入的单哨兵前缀（WJ 在前缀末尾、非首位）仍被正确识别。
		expect(stripPrefix(`1 ${WORD_JOINER}标题`, 2, DEFAULT_TEMPLATE)).toBe("标题");
	});

	it("无前缀时原样返回", () => {
		expect(stripPrefix("没有编号的标题", 2, DEFAULT_TEMPLATE)).toBe("没有编号的标题");
	});

	it("重复运行 buildPrefix→stripPrefix 能干净还原", () => {
		const c = new HeadingCounter();
		c.bump(2);
		c.bump(3);
		const prefixed = buildPrefix(DEFAULT_TEMPLATE, 3, c) + "标题";
		expect(stripPrefix(prefixed, 3, DEFAULT_TEMPLATE)).toBe("标题");
	});
});

describe("非 arabic 序号样式（回归：H3+ 继承前缀曾因父级 arabic 漏配而反复重写）", () => {
	const STYLES = ["cjk", "circled", "lower-alpha", "upper-alpha"] as const;

	/** 构造各级同样式、继承前级、点分、空格分隔的模板。 */
	function templateWith(numeral: (typeof STYLES)[number]): Template {
		const lvl = {
			prefix: "",
			numeral,
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		};
		return {
			name: "t",
			levels: {
				h1: { ...lvl },
				h2: { ...lvl },
				h3: { ...lvl },
				h4: { ...lvl },
				h5: { ...lvl },
				h6: { ...lvl },
			},
			whitelist: [],
			skipFill: DEFAULT_SKIP_FILL,
			topLevel: DEFAULT_TOP_LEVEL,
		};
	}

	for (const numeral of STYLES) {
		it(`buildPrefix→stripPrefix 在 H3/H4 对 ${numeral} 能干净还原`, () => {
			const tpl = templateWith(numeral);
			const c = new HeadingCounter();
			c.bump(2); // c2=1
			c.bump(3); // c3=1（父级与本级均套用 numeral）
			expect(stripPrefix(buildPrefix(tpl, 3, c) + "标题", 3, tpl)).toBe("标题");
			c.bump(4); // c4=1
			expect(stripPrefix(buildPrefix(tpl, 4, c) + "标题", 4, tpl)).toBe("标题");
		});
	}

	it("cjk 模板连续两次编号结果一致（不累加前缀）", () => {
		const tpl = templateWith("cjk");
		const content = ["# 文档", "## 章", "### 节", "#### 子节"].join("\n");
		const once = renumberContent(content, tpl);
		const twice = renumberContent(once, tpl);
		expect(twice).toBe(once);
		// 父级各自套用其级别样式（此处各级均 cjk），而非一律阿拉伯。
		expect(once).toContain(`### ${WORD_JOINER}一.一 ${WORD_JOINER}节`);
		expect(once).toContain(`#### ${WORD_JOINER}一.一.一 ${WORD_JOINER}子节`);
	});
});

describe("父级序号套用各自级别样式（Bug 1：继承前级时父级不再一律 arabic）", () => {
	/** H2 arabic / H3 lower-alpha / H4 circled / H5 upper-alpha，均继承前级、点分、空格。 */
	function mixedTemplate(): Template {
		const mk = (numeral: Template["levels"]["h2"]["numeral"]): Template["levels"]["h2"] => ({
			prefix: "",
			numeral,
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		});
		return {
			name: "mixed",
			levels: {
				h1: mk("arabic"),
				h2: mk("arabic"),
				h3: mk("lower-alpha"),
				h4: mk("circled"),
				h5: mk("upper-alpha"),
				h6: mk("arabic"),
			},
			whitelist: [],
			skipFill: DEFAULT_SKIP_FILL,
			topLevel: DEFAULT_TOP_LEVEL,
		};
	}

	it("H3/H4/H5 的前缀让父级以各自样式呈现", () => {
		const tpl = mixedTemplate();
		const c = new HeadingCounter();
		c.bump(2); // H2=1
		expect(buildPrefix(tpl, 2, c)).toBe(`${WORD_JOINER}1 ${WORD_JOINER}`);
		c.bump(3); // H3=1 → 父级 arabic「1」+ 本级 alpha「a」
		expect(buildPrefix(tpl, 3, c)).toBe(`${WORD_JOINER}1.a ${WORD_JOINER}`);
		c.bump(4); // H4=1 → 「1」「a」「①」
		expect(buildPrefix(tpl, 4, c)).toBe(`${WORD_JOINER}1.a.① ${WORD_JOINER}`);
		c.bump(5); // H5=1 → 「1」「a」「①」「A」
		expect(buildPrefix(tpl, 5, c)).toBe(`${WORD_JOINER}1.a.①.A ${WORD_JOINER}`);
	});

	it("buildPrefix→stripPrefix 在混合样式下能干净还原（含跨级路径）", () => {
		const tpl = mixedTemplate();
		const c = new HeadingCounter();
		c.bump(2);
		c.bump(3);
		c.bump(4);
		c.bump(5);
		const prefixed = buildPrefix(tpl, 5, c) + "标题";
		expect(prefixed).toBe(`${WORD_JOINER}1.a.①.A ${WORD_JOINER}标题`);
		expect(stripPrefix(prefixed, 5, tpl)).toBe("标题");
	});

	it("混合样式整文编号幂等（连续两次结果一致）", () => {
		const tpl = mixedTemplate();
		const content = ["# 文档", "## 章", "### 节", "#### 子节", "##### 细目"].join("\n");
		const once = renumberContent(content, tpl);
		const twice = renumberContent(once, tpl);
		expect(twice).toBe(once);
		expect(once).toContain(`### ${WORD_JOINER}1.a ${WORD_JOINER}节`);
		expect(once).toContain(`#### ${WORD_JOINER}1.a.① ${WORD_JOINER}子节`);
		expect(once).toContain(`##### ${WORD_JOINER}1.a.①.A ${WORD_JOINER}细目`);
	});
});

describe("祖先序号渲染 ancestorNumeral（self 各自样式 / arabic 统一阿拉伯）", () => {
	/** 构造 H2/H3/H4 三级模板，可指定各级样式、是否继承、后缀，以及祖先渲染策略。 */
	function mk(
		h2: NumeralStyle,
		h3: NumeralStyle,
		h4: NumeralStyle,
		ancestorNumeral: "self" | "arabic",
		opts: { h4Inherit?: boolean; h4Suffix?: string } = {},
	): Template {
		const base = (numeral: NumeralStyle, inherit = true, suffix = "") => ({
			prefix: "",
			numeral,
			suffix,
			numberSeparator: ".",
			titleSeparator: " ",
			inherit,
		});
		return {
			...DEFAULT_TEMPLATE,
			ancestorNumeral,
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h2: base(h2),
				h3: base(h3),
				h4: base(h4, opts.h4Inherit ?? true, opts.h4Suffix ?? ""),
			},
		};
	}
	const doc = "## 章\n### 节\n#### 目";

	it("self（默认）：祖先各自套用自身样式（H2=中文/H3=阿拉伯 → 一.1）", () => {
		expect(renumberContent(doc, mk("cjk", "arabic", "arabic", "self"))).toBe(
			[
				`## ${WORD_JOINER}一 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}一.1 ${WORD_JOINER}节`,
				`#### ${WORD_JOINER}一.1.1 ${WORD_JOINER}目`,
			].join("\n"),
		);
	});

	it("arabic：祖先统一阿拉伯，末段仍套本级样式（中文书：一 / 1.1 / 1.1.1）", () => {
		expect(renumberContent(doc, mk("cjk", "arabic", "arabic", "arabic"))).toBe(
			[
				`## ${WORD_JOINER}一 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}目`,
			].join("\n"),
		);
	});

	it("arabic：末段非阿拉伯仍保留本级样式（H2=中文/H4=带圈 → 1.1.①）", () => {
		expect(renumberContent(doc, mk("arabic", "lower-alpha", "circled", "arabic"))).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.a ${WORD_JOINER}节`,
				`#### ${WORD_JOINER}1.1.① ${WORD_JOINER}目`,
			].join("\n"),
		);
	});

	it("arabic + H4 继承：得 1.1.a)（用户「带路径」变体）", () => {
		expect(
			renumberContent(doc, mk("cjk", "arabic", "lower-alpha", "arabic", { h4Suffix: ")" })),
		).toBe(
			[
				`## ${WORD_JOINER}一 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`#### ${WORD_JOINER}1.1.a) ${WORD_JOINER}目`,
			].join("\n"),
		);
	});

	it("H4 不继承：得独立 a)，与祖先策略无关（用户「独立」变体）", () => {
		for (const anc of ["self", "arabic"] as const) {
			expect(
				renumberContent(
					doc,
					mk("cjk", "arabic", "lower-alpha", anc, { h4Inherit: false, h4Suffix: ")" }),
				),
			).toContain(`#### ${WORD_JOINER}a) ${WORD_JOINER}目`);
		}
	});

	it("切到 arabic 后，旧的 self 前缀（一.1）能被干净改写为 1.1（不叠加、幂等）", () => {
		const self = renumberContent(doc, mk("cjk", "arabic", "arabic", "self"));
		expect(self).toContain(`### ${WORD_JOINER}一.1 ${WORD_JOINER}节`);
		// 用 arabic 模板重排：旧 cjk 祖先段被剥离并改写为阿拉伯。
		const arabic = renumberContent(self, mk("cjk", "arabic", "arabic", "arabic"));
		expect(arabic).toContain(`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`);
		// 幂等：再跑一次不变。
		expect(renumberContent(arabic, mk("cjk", "arabic", "arabic", "arabic"))).toBe(arabic);
	});
});

describe("模板样式变更后不重复叠加前缀（Bug 2：改默认模板后出现重复编号）", () => {
	function uniform(numeral: Template["levels"]["h2"]["numeral"]): Template {
		const lvl: Template["levels"]["h2"] = {
			prefix: "",
			numeral,
			suffix: "",
			numberSeparator: ".",
			titleSeparator: " ",
			inherit: true,
		};
		return {
			name: "t",
			levels: { h1: lvl, h2: lvl, h3: lvl, h4: lvl, h5: lvl, h6: lvl },
			whitelist: [],
			skipFill: DEFAULT_SKIP_FILL,
			topLevel: DEFAULT_TOP_LEVEL,
		};
	}

	/** 在 uniform 模板基础上把某一级换成另一种样式。 */
	function withLevel(
		base: Template,
		key: keyof Template["levels"],
		numeral: Template["levels"]["h2"]["numeral"],
	): Template {
		return {
			...base,
			levels: { ...base.levels, [key]: { ...base.levels[key], numeral } },
		};
	}

	it("某级样式从带圈改为阿拉伯后，旧带圈前缀被剥离而非叠加", () => {
		// 旧模板 H4 = circled，H6 也 = circled（对应用户场景：带圈样式仍在模板中存在）。
		const oldTpl = withLevel(withLevel(uniform("arabic"), "h4", "circled"), "h6", "circled");
		const content = ["# 文档", "## 章", "### 节", "#### 子节"].join("\n");
		const formatted = renumberContent(content, oldTpl);
		expect(formatted).toContain(`#### ${WORD_JOINER}1.1.① ${WORD_JOINER}子节`);

		// 新模板把 H4 改成 arabic，但 circled 仍被 H6 使用 → 并集仍含 circled，旧前缀可被剥离。
		const newTpl = withLevel(oldTpl, "h4", "arabic");
		const renum = renumberContent(formatted, newTpl);
		// 不应出现「1.1.1 1.1.① 子节」这种叠加；旧前缀被剥离，仅留新前缀。
		expect(renum).toContain(`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}子节`);
		expect(renum).not.toContain("①");
	});

	it("方案A：含 WJ 精确剥到标记之后、其后正文全保留；无 WJ 一律不剥", () => {
		// 方案A：WJ 是唯一边界。`1.1.1 ⁠1.1.① 少见多怪` 只剥到 WJ 之后 → 保留 `1.1.① 少见多怪`
		//（哪怕后面又长得像编号）。这正是「2024 折中」的根治：插件只认自己写的（带 WJ）前缀。
		const newTpl = withLevel(uniform("arabic"), "h6", "circled");
		expect(stripPrefix(`1.1.1 ${WORD_JOINER}1.1.① 少见多怪`, 4, newTpl)).toBe("1.1.① 少见多怪");
		// 无 WJ → 整段视为正文，原样保留（不再正则剥多段）。
		expect(stripPrefix("1.1.1 少见多怪", 4, newTpl)).toBe("1.1.1 少见多怪");
	});

	it("末段 token 仅含模板在用的字母样式：纯阿拉伯模板不误伤以英文词开头的标题", () => {
		const tpl = uniform("arabic");
		// 纯阿拉伯模板的末段 token 不含字母类，故「API 设计」「TODO 列表」安全。
		expect(stripPrefix("API 设计", 2, tpl)).toBe("API 设计");
		expect(stripPrefix("TODO 列表", 3, tpl)).toBe("TODO 列表");
	});

	it("某级中文改回阿拉伯后（模板再无 cjk）旧 cjk 前缀仍被剥离，不叠加（用户报告：1.2.1 1.二.1）", () => {
		// 旧模板：H3 = 中文，其余阿拉伯；格式化后 H4 前缀形如「1.二.1」（父级 H3 以中文呈现）。
		const oldTpl = withLevel(uniform("arabic"), "h3", "cjk");
		const content = ["# 文档", "## 章", "### 前节", "### 后节", "#### 子节"].join("\n");
		const formatted = renumberContent(content, oldTpl);
		expect(formatted).toContain(`#### ${WORD_JOINER}1.二.1 ${WORD_JOINER}子节`);

		// 新模板：H3 改回阿拉伯 → 模板里已无任何 cjk 级；旧「二」必须仍能被剥离、不被叠加。
		const newTpl = uniform("arabic");
		const renum = renumberContent(formatted, newTpl);
		expect(renum).toContain(`#### ${WORD_JOINER}1.2.1 ${WORD_JOINER}子节`);
		expect(renum).not.toContain("1.二"); // 不应残留旧中文序号段
		expect(renum).not.toContain("1.2.1 1."); // 不应出现「新前缀 + 旧前缀」叠加
		// 再跑一次保持幂等。
		expect(renumberContent(renum, newTpl)).toBe(renum);
	});

	it("方案A：带 WJ 的旧 cjk 前缀剥到 WJ 之后；无 WJ 的 cjk 串视为正文保留", () => {
		const newTpl = uniform("arabic"); // 模板里没有任何 cjk 级
		// 插件写出的旧前缀恒带 WJ → 即便模板已无 cjk，仍按 WJ 精确剥离。
		expect(stripPrefix(`1.二.1 ${WORD_JOINER}小节`, 4, newTpl)).toBe("小节");
		// 无 WJ 的「1.二.1 …」是用户文本（或 0.6.4 前历史，现无线上用户）→ 不剥。
		expect(stripPrefix("1.二.1 小节", 4, newTpl)).toBe("1.二.1 小节");
	});

	it("内层放宽到全样式不误伤多段英文：纯阿拉伯模板下「a.b.c 记法」不被剥", () => {
		const tpl = uniform("arabic");
		// 父段虽放宽到全样式，但末段「c」非 arabic/cjk/带圈、字母样式也未启用 → 整体不命中。
		expect(stripPrefix("a.b.c 记法", 4, tpl)).toBe("a.b.c 记法");
	});
});

describe("numberHeadings", () => {
	function headingsOf(content: string): Heading[] {
		return parseHeadings(content);
	}

	it("默认起始层级 H2：H1 不写前缀（低于起始层级）", () => {
		const result = numberHeadings(headingsOf("# 文档标题\n## 第一章"), DEFAULT_TEMPLATE);
		expect(result[0].prefix).toBeNull();
		expect(result[1].prefix).toBe(`${WORD_JOINER}1 ${WORD_JOINER}`);
	});

	it("对 H2–H6 完整编号", () => {
		const content = ["# 标题", "## 章", "### 节", "### 节", "## 章"].join("\n");
		const result = numberHeadings(headingsOf(content), DEFAULT_TEMPLATE);
		expect(result.map((h) => h.prefix)).toEqual([
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			`${WORD_JOINER}1.1 ${WORD_JOINER}`,
			`${WORD_JOINER}1.2 ${WORD_JOINER}`,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
		]);
	});

	it("剥离已有(带 WJ)前缀后重新编号（幂等）", () => {
		const content = [
			"# 标题",
			`## ${WORD_JOINER}9 ${WORD_JOINER}旧编号`,
			`### ${WORD_JOINER}7.3 ${WORD_JOINER}旧编号`,
		].join("\n");
		const result = numberHeadings(headingsOf(content), DEFAULT_TEMPLATE);
		expect(result[1].numberedLine).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}旧编号`);
		expect(result[2].numberedLine).toBe(`### ${WORD_JOINER}1.1 ${WORD_JOINER}旧编号`);
	});

	it("方案A：无 WJ 的手写数字前缀被视为正文，不再吸收（叠加在其上）", () => {
		// 旧行为会把 `9 ` 当编号吸收；方案A 把无 WJ 文本一律当正文 → 叠加（与 2024 年度总结同理）。
		const content = ["# 标题", "## 9 旧编号"].join("\n");
		const result = numberHeadings(headingsOf(content), DEFAULT_TEMPLATE);
		expect(result[1].numberedLine).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}9 旧编号`);
	});

	it("白名单标题不写前缀且不占计数器槽位（不跳号）", () => {
		const content = ["# 标题", "## 章", "## 参考文献", "## 章"].join("\n");
		const isWhitelisted = (h: Heading) => h.text.trim() === "参考文献";
		const result = numberHeadings(headingsOf(content), DEFAULT_TEMPLATE, { isWhitelisted });
		expect(result.map((h) => h.prefix)).toEqual([
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			null,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
		]);
	});

	it("白名单子标题在父级未变时正常编号、不跳号", () => {
		// 对应 README 3.5 示例：H3 白名单不占槽位，其后 H3 仍从 1 起。
		const content = ["# 标题", "## 章", "### 白名单节", "### 正常节"].join("\n");
		const isWhitelisted = (h: Heading) => h.text === "白名单节";
		const result = numberHeadings(headingsOf(content), DEFAULT_TEMPLATE, { isWhitelisted });
		expect(result.map((h) => h.prefix)).toEqual([
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			null,
			`${WORD_JOINER}1.1 ${WORD_JOINER}`,
		]);
	});
});

describe("多个 H1 与起始编号层级 topLevel", () => {
	/** 在默认模板基础上替换 topLevel。 */
	function withTopLevel(topLevel: number): Template {
		return { ...DEFAULT_TEMPLATE, topLevel };
	}

	it("默认 topLevel=H2：插件不改写 # 层级，多个 H1 原样保留、均不编号", () => {
		const content = ["# 第一篇", "## A", "# 第二篇", "## B"].join("\n");
		const result = renumberContent(content);
		// H1 行完全不动；H2 各自编号（见下条会验证 B 重置为 1）。
		expect(result.split("\n")[0]).toBe("# 第一篇");
		expect(result.split("\n")[2]).toBe("# 第二篇");
	});

	it("超出编号范围的 H1 是重置边界：第二篇的 H2 重新从 1 起", () => {
		const content = ["# 第一篇", "## A", "## B", "# 第二篇", "## C"].join("\n");
		const expected = [
			`# 第一篇`,
			`## ${WORD_JOINER}1 ${WORD_JOINER}A`,
			`## ${WORD_JOINER}2 ${WORD_JOINER}B`,
			`# 第二篇`,
			`## ${WORD_JOINER}1 ${WORD_JOINER}C`,
		].join("\n");
		expect(renumberContent(content)).toBe(expected);
	});

	it("topLevel=H1：所有 H1 都编号，其下 H2 各自重置", () => {
		const content = ["# 甲", "## A", "## B", "# 乙", "## C"].join("\n");
		const expected = [
			`# ${WORD_JOINER}1 ${WORD_JOINER}甲`,
			`## ${WORD_JOINER}1.1 ${WORD_JOINER}A`,
			`## ${WORD_JOINER}1.2 ${WORD_JOINER}B`,
			`# ${WORD_JOINER}2 ${WORD_JOINER}乙`,
			`## ${WORD_JOINER}2.1 ${WORD_JOINER}C`,
		].join("\n");
		expect(renumberContent(content, withTopLevel(1))).toBe(expected);
	});

	it("topLevel=H1：H1 不写前缀的标题（无 H2）也逐个编号", () => {
		const content = ["# 一", "# 二", "# 三"].join("\n");
		const expected = [
			`# ${WORD_JOINER}1 ${WORD_JOINER}一`,
			`# ${WORD_JOINER}2 ${WORD_JOINER}二`,
			`# ${WORD_JOINER}3 ${WORD_JOINER}三`,
		].join("\n");
		expect(renumberContent(content, withTopLevel(1))).toBe(expected);
	});

	it("topLevel=H3：H1/H2 不编号且原样保留，H3 起以 H3 为第一段", () => {
		const content = ["# 文档", "## 章", "### 甲", "### 乙", "## 章二", "### 丙"].join("\n");
		const expected = [
			`# 文档`,
			`## 章`,
			`### ${WORD_JOINER}1 ${WORD_JOINER}甲`,
			`### ${WORD_JOINER}2 ${WORD_JOINER}乙`,
			`## 章二`,
			`### ${WORD_JOINER}1 ${WORD_JOINER}丙`,
		].join("\n");
		expect(renumberContent(content, withTopLevel(3))).toBe(expected);
	});

	it("方案A：低于 topLevel 的「2024 总结」不再被剥（无 WJ = 正文，根治旧 C3 误伤）", () => {
		// 0.6.0 C3 修复曾对 level<top 也剥前缀，因无法区分「插件写的 1 」与「用户写的 2024 」而误伤；
		// 方案A 改为纯 WJ 边界：`# 2024 总结` 无 WJ → 视为正文、原样保留（这正是用户要的）。
		const content = ["# 2024 总结", "## 正文"].join("\n");
		const result = renumberContent(content);
		expect(result.split("\n")[0]).toBe("# 2024 总结");
	});
});

describe("renumberContent", () => {
	it("仅改写标题行，正文与代码块原样保留", () => {
		const content = ["# 文档", "正文一", "## 章", "```", "# 代码注释", "```", "### 节"].join(
			"\n",
		);
		const expected = [
			"# 文档",
			"正文一",
			`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
			"```",
			"# 代码注释",
			"```",
			`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
		].join("\n");
		expect(renumberContent(content)).toBe(expected);
	});

	it("无 H2 及以上标题时内容保持不变", () => {
		const content = ["# 仅有文档标题", "正文"].join("\n");
		expect(renumberContent(content)).toBe(content);
	});

	it("处理标题层级跳跃（H2 → H4）", () => {
		const content = ["## 章", "#### 跳级"].join("\n");
		const result = renumberContent(content);
		// H4 直接出现：缺失的 H3（c3=0）如实以「0」呈现，使 H4 保有三段、与其深度一致，
		// 故为 1.0.1 而非把 H4 当 H3 的 1.1（缺失祖先以 0 显式占位）。
		expect(result).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`#### ${WORD_JOINER}1.0.1 ${WORD_JOINER}跳级`,
			].join("\n"),
		);
	});

	it("H3 后直接跟 H5：H5 保有四段而非被当作 H4（缺失 H4 以 0 占位）", () => {
		const content = ["## 章", "### 节", "##### 细目甲", "##### 细目乙"].join("\n");
		const result = renumberContent(content);
		expect(result).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`##### ${WORD_JOINER}1.1.0.1 ${WORD_JOINER}细目甲`,
				`##### ${WORD_JOINER}1.1.0.2 ${WORD_JOINER}细目乙`,
			].join("\n"),
		);
	});

	it("跳级 H5 在前、随后真实 H4 仍从 1 开始（0 占位不借号）", () => {
		const content = ["## 章", "### 节", "##### 细目", "#### 子节"].join("\n");
		const result = renumberContent(content);
		// 跳级的 H5 把缺失 H4 以 0 占位呈现，但 c4 仍为 0；首个真实 H4 才把 c4 累加到 1，
		// 故为 1.1.1（而非被借号成 1.1.2）。
		expect(result).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`##### ${WORD_JOINER}1.1.0.1 ${WORD_JOINER}细目`,
				`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}子节`,
			].join("\n"),
		);
	});

	it("默认即使用内置默认模板", () => {
		expect(renumberContent("## 章")).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
	});
});

describe("空标题（在空行上直接转标题）不重复叠加编号（回归 bug）", () => {
	// 复现：用户在**空行**用快捷键直接转成 H3，Obsidian 写入 `### `（带尾随空格）。
	// 插件首轮编号得 `### 1.1 `（末尾即标题间隔符空格）；该尾随空格被解析器 trim 后，
	// 若按 trim 的 text（`1.1`）剥离会剥不掉→被当正文→左侧再叠新前缀，得 `### 1.1 1.1`。
	// 修复：剥离改用保留尾随空格的 rawText（`1.1 `），既能干净剥成空、又不误伤真实序号标题。
	it("空 H3 反复编号保持幂等（不出现 1.1 1.1）", () => {
		const c1 = renumberContent("# 标题\n## 节\n### \n");
		expect(c1).toBe(
			`# 标题\n## ${WORD_JOINER}1 ${WORD_JOINER}节\n### ${WORD_JOINER}1.1 ${WORD_JOINER}\n`,
		);
		// 多轮幂等：第二、三轮都不再变化、不叠加。
		const c2 = renumberContent(c1);
		expect(c2).toBe(c1);
		expect(renumberContent(c2)).toBe(c1);
	});

	it("方案A：带 WJ 的残留再编号稳定，不复生 `1.1 1.1`", () => {
		// 插件写出的前缀恒带 WJ；带 WJ 的 `### 1.1 ⁠` 再触发按 WJ 精确剥到空、稳定（不叠加）。
		expect(
			renumberContent(
				`## ${WORD_JOINER}1 ${WORD_JOINER}节\n### ${WORD_JOINER}1.1 ${WORD_JOINER}`,
			),
		).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}节\n### ${WORD_JOINER}1.1 ${WORD_JOINER}`);
	});

	it("「# 三」这类本身是序号字样的真实标题不被误剥（topLevel=H1）", () => {
		// 方案A：`三` 无 WJ → 纯正文 → 仅在左侧加前缀。
		const tpl: Template = { ...DEFAULT_TEMPLATE, topLevel: 1 };
		expect(renumberContent("# 一\n# 二\n# 三", tpl)).toBe(
			`# ${WORD_JOINER}1 ${WORD_JOINER}一\n# ${WORD_JOINER}2 ${WORD_JOINER}二\n# ${WORD_JOINER}3 ${WORD_JOINER}三`,
		);
	});
});

describe("改分隔符后再触发不叠加（回归 testplan B1/B4/B5）", () => {
	/** 构造 H2/H3 同格式模板，可指定序号样式、序号间隔符、标题间隔符。 */
	function mk(opts: {
		numeral?: NumeralStyle;
		numberSeparator?: string;
		titleSeparator?: string;
	}): Template {
		const lvl = {
			prefix: "",
			numeral: opts.numeral ?? "arabic",
			suffix: "",
			numberSeparator: opts.numberSeparator ?? ".",
			titleSeparator: opts.titleSeparator ?? " ",
			inherit: true,
		};
		return {
			...DEFAULT_TEMPLATE,
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h2: { ...lvl },
				h3: { ...lvl },
			},
		};
	}

	it("B1：cjk 标题间隔符 空格→『、』，旧前缀『一 ⁠』被剥、不叠成『一、一、标题』", () => {
		const once = renumberContent("## 标题", mk({ numeral: "cjk", titleSeparator: " " }));
		expect(once).toBe(`## ${WORD_JOINER}一 ${WORD_JOINER}标题`);
		const after = mk({ numeral: "cjk", titleSeparator: "、" });
		expect(renumberContent(once, after)).toBe(`## ${WORD_JOINER}一、${WORD_JOINER}标题`);
		// 幂等：再触发不变。
		expect(renumberContent(renumberContent(once, after), after)).toBe(
			`## ${WORD_JOINER}一、${WORD_JOINER}标题`,
		);
	});

	it("B5：标题间隔符 『. 』→空格，不叠成『1 1. 标题』", () => {
		const once = renumberContent("## 标题", mk({ titleSeparator: ". " }));
		expect(once).toBe(`## ${WORD_JOINER}1. ${WORD_JOINER}标题`);
		const after = mk({ titleSeparator: " " });
		expect(renumberContent(once, after)).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}标题`);
		expect(renumberContent(renumberContent(once, after), after)).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}标题`,
		);
	});

	it("B4：序号间隔符 『.』→『-』，父子段不叠成『1-1 1.1 子』", () => {
		const once = renumberContent("## 父\n### 子", mk({ numberSeparator: "." }));
		expect(once).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}父\n### ${WORD_JOINER}1.1 ${WORD_JOINER}子`,
		);
		const after = mk({ numberSeparator: "-" });
		expect(renumberContent(once, after)).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}父\n### ${WORD_JOINER}1-1 ${WORD_JOINER}子`,
		);
		expect(renumberContent(renumberContent(once, after), after)).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}父\n### ${WORD_JOINER}1-1 ${WORD_JOINER}子`,
		);
	});

	it("安全性：标题间隔符容差不误伤『# 三』这类无间隔符的真实标题", () => {
		// 标题文本「三」恰是 cjk 序号字样，但末尾无分隔符 → 不命中前缀正则 → 文本「三」保留，
		// 仅在其左侧加前缀「一 ⁠」，得「一 ⁠三」（不会把「三」当旧前缀吃掉）。
		const cjkAll = mk({ numeral: "cjk" });
		const tpl: Template = {
			...cjkAll,
			topLevel: 1,
			levels: { ...cjkAll.levels, h1: { ...cjkAll.levels.h2 } },
		};
		expect(renumberContent("# 三", tpl)).toBe(`# ${WORD_JOINER}一 ${WORD_JOINER}三`);
	});

	it("安全性：不以序号起头的标题完全不受容差影响", () => {
		// 「API 设计」既不以数字也不以中文数字起头 → 前缀正则起手即失配 → 原样保留。
		expect(renumberContent("## API 设计", mk({ titleSeparator: "、" }))).toBe(
			`## ${WORD_JOINER}1、${WORD_JOINER}API 设计`,
		);
		expect(
			renumberContent(
				renumberContent("## API 设计", mk({ titleSeparator: "、" })),
				mk({ titleSeparator: "、" }),
			),
		).toBe(`## ${WORD_JOINER}1、${WORD_JOINER}API 设计`);
	});
});

describe("改前缀/后缀后再触发不叠加（方案 A，回归 testplan B2/B3）", () => {
	/** 在默认模板（arabic/`.`/空格）基础上，给 H2/H3 设定前缀与后缀。 */
	function mk(prefix: string, suffix: string): Template {
		const lvl = (base: Template["levels"]["h2"]) => ({ ...base, prefix, suffix });
		return {
			...DEFAULT_TEMPLATE,
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h2: lvl(DEFAULT_TEMPLATE.levels.h2),
				h3: lvl(DEFAULT_TEMPLATE.levels.h3),
			},
		};
	}

	it("B2：前缀 空→『第』，旧『1 ⁠标题』被剥、不叠成『第1 1 ⁠标题』", () => {
		const once = renumberContent("## 标题", mk("", ""));
		expect(once).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}标题`);
		// 改前缀为「第」后再触发：WJ 快速路径精确剥净，只留正确新前缀。
		const after = mk("第", "");
		expect(renumberContent(once, after)).toBe(`## ${WORD_JOINER}第1 ${WORD_JOINER}标题`);
		expect(renumberContent(renumberContent(once, after), after)).toBe(
			`## ${WORD_JOINER}第1 ${WORD_JOINER}标题`,
		);
	});

	it("B3：后缀 空→『章』，不叠成『1章 1 ⁠标题』", () => {
		const once = renumberContent("## 标题", mk("", ""));
		expect(once).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}标题`);
		const after = mk("", "章");
		expect(renumberContent(once, after)).toBe(`## ${WORD_JOINER}1章 ${WORD_JOINER}标题`);
		expect(renumberContent(renumberContent(once, after), after)).toBe(
			`## ${WORD_JOINER}1章 ${WORD_JOINER}标题`,
		);
	});

	it("「第…章」式整套：父子段都不叠加、幂等", () => {
		const tpl = mk("第", "章");
		const once = renumberContent("## 父\n### 子", tpl);
		expect(once).toBe(
			`## ${WORD_JOINER}第1章 ${WORD_JOINER}父\n### ${WORD_JOINER}第1.1章 ${WORD_JOINER}子`,
		);
		expect(renumberContent(once, tpl)).toBe(once);
		// 从「第…章」改回无前后缀：WJ 快速路径剥净，再加新前缀。
		const bare = mk("", "");
		const opts = { strippablePrefixes: ["第", ""], strippableSuffixes: ["章", ""] };
		expect(renumberContent(once, bare, opts)).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}父\n### ${WORD_JOINER}1.1 ${WORD_JOINER}子`,
		);
	});

	it("反向 非空→空（『第』→空）：靠注入并集剥净，不叠成『1 第1 ⁠标题』", () => {
		const withPrefix = renumberContent("## 标题", mk("第", ""));
		expect(withPrefix).toBe(`## ${WORD_JOINER}第1 ${WORD_JOINER}标题`);
		// WJ 快速路径精确剥净，再加新前缀。
		const opts = { strippablePrefixes: ["第", ""] };
		expect(renumberContent(withPrefix, mk("", ""), opts)).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}标题`,
		);
	});

	it("安全性：前缀候选只在其后紧跟序号时才成前缀，不吞普通标题正文", () => {
		// 标题以「第」起头但其后非序号（「印象」）→ 不构成前缀 → 正文完整保留，仅在左侧加新前缀。
		expect(renumberContent("## 第一印象", mk("第", ""))).toBe(
			`## ${WORD_JOINER}第1 ${WORD_JOINER}第一印象`,
		);
		// 不以「第」也不以序号起头 → 完全不受并集候选影响。
		expect(renumberContent("## API 设计", mk("第", ""))).toBe(
			`## ${WORD_JOINER}第1 ${WORD_JOINER}API 设计`,
		);
	});
});

describe("方案A：正文起头数字不被吃（WJ 边界根治「2024 年度总结」，testplan E5/P1）", () => {
	it("首次把以数字起头的标题编号：`2024` 完整保留（不再被吃）", () => {
		// 方案A 头号目标：`## 2024 总结` 无 WJ → `2024 总结` 整体是正文 → 仅左侧加前缀。
		expect(renumberContent("## 2024 总结")).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}2024 总结`);
		// 反复触发幂等（WJ 精确定界）。
		const once = renumberContent("## 2024 总结");
		expect(renumberContent(once)).toBe(once);
	});

	it("整年/年度总结类标题，连续触发稳定保留", () => {
		const content = ["# 2024 年度总结", "## 概述", "## 2023 对比"].join("\n");
		const once = renumberContent(content);
		expect(once).toBe(
			[
				"# 2024 年度总结", // H1 < topLevel：不编号、原样
				`## ${WORD_JOINER}1 ${WORD_JOINER}概述`,
				`## ${WORD_JOINER}2 ${WORD_JOINER}2023 对比`, // 2023 完整保留
			].join("\n"),
		);
		expect(renumberContent(once)).toBe(once);
	});

	it("父子级同理：`### 2024 子` 的 2024 完整保留", () => {
		const once = renumberContent("## 父\n### 2024 子");
		expect(once).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}父\n### ${WORD_JOINER}1.1 ${WORD_JOINER}2024 子`,
		);
		expect(renumberContent(once)).toBe(once);
	});

	it("stripPrefix 直接断言：无 WJ 一律不剥（含像编号的文本）", () => {
		expect(stripPrefix("1 2024 总结", 2, DEFAULT_TEMPLATE)).toBe("1 2024 总结");
		expect(stripPrefix("2024 总结", 2, DEFAULT_TEMPLATE)).toBe("2024 总结");
		expect(stripPrefix("1 普通标题", 2, DEFAULT_TEMPLATE)).toBe("1 普通标题");
	});

	it("E13：含 WJ 标记时精确定界，标记前全部视为前缀、标记后全部保留", () => {
		// WJ（U+2060）是插件写出前缀的结束标记，导出/复制不可见；含 WJ 时直接截断到标记后。
		expect(stripPrefix(`1${WORD_JOINER}2024 总结`, 2, DEFAULT_TEMPLATE)).toBe("2024 总结");
		// WJ 后即使是纯数字也完整保留（不被当作序号剥掉）。
		expect(stripPrefix(`3.2${WORD_JOINER}2024 特殊节`, 2, DEFAULT_TEMPLATE)).toBe(
			"2024 特殊节",
		);
	});
});

describe("跳级占位策略 skipFill（每个模板各自决定）", () => {
	/** 在默认模板基础上替换 skipFill 策略。 */
	function withSkipFill(skipFill: SkipFill): Template {
		return { ...DEFAULT_TEMPLATE, skipFill };
	}

	const content = ["## 章", "### 节", "##### 细目甲", "##### 细目乙", "#### 子节"].join("\n");

	it("fill「0」：缺失中间层级补 0（默认）", () => {
		const result = renumberContent(content, withSkipFill({ mode: "fill", placeholder: "0" }));
		expect(result).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`##### ${WORD_JOINER}1.1.0.1 ${WORD_JOINER}细目甲`,
				`##### ${WORD_JOINER}1.1.0.2 ${WORD_JOINER}细目乙`,
				`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}子节`,
			].join("\n"),
		);
	});

	it("fill「1」：缺失中间层级补 1", () => {
		const result = renumberContent(content, withSkipFill({ mode: "fill", placeholder: "1" }));
		expect(result).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`##### ${WORD_JOINER}1.1.1.1 ${WORD_JOINER}细目甲`,
				`##### ${WORD_JOINER}1.1.1.2 ${WORD_JOINER}细目乙`,
				`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}子节`,
			].join("\n"),
		);
	});

	it("fill 数字占位「9」：缺失中间层级补该数字，且能幂等剥离", () => {
		const tpl = withSkipFill({ mode: "fill", placeholder: "9" });
		const once = renumberContent(content, tpl);
		expect(once).toContain(`##### ${WORD_JOINER}1.1.9.1 ${WORD_JOINER}细目甲`);
		expect(once).toContain(`##### ${WORD_JOINER}1.1.9.2 ${WORD_JOINER}细目乙`);
		// 再次编号应幂等（WJ 快速路径精确剥离，不重复叠加）。
		expect(renumberContent(once, tpl)).toBe(once);
	});

	it("fill 非数字占位被收口为 0（仅允许数字，保证可干净剥离）", () => {
		// 直接传非数字占位，引擎规范化时滤除非数字、回退 0。
		const tpl = withSkipFill({ mode: "fill", placeholder: "-" });
		const once = renumberContent(content, tpl);
		expect(once).toContain(`##### ${WORD_JOINER}1.1.0.1 ${WORD_JOINER}细目甲`);
		expect(once).not.toContain("1.1.-.1");
	});

	it("drop：不补位，缺失中间层级整段省略（H5 呈现为三段）", () => {
		const result = renumberContent(content, withSkipFill({ mode: "drop" }));
		expect(result).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`##### ${WORD_JOINER}1.1.1 ${WORD_JOINER}细目甲`,
				`##### ${WORD_JOINER}1.1.2 ${WORD_JOINER}细目乙`,
				`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}子节`,
			].join("\n"),
		);
	});

	it("fill 占位为空时按 0 处理（规范化兜底，避免空段）", () => {
		const result = renumberContent(content, withSkipFill({ mode: "fill", placeholder: "" }));
		expect(result).toContain(`##### ${WORD_JOINER}1.1.0.1 ${WORD_JOINER}细目甲`);
	});

	it("F7 none：跳级标题完全不编号、保持原样；仍推进计数器作重置边界", () => {
		const result = renumberContent(content, withSkipFill({ mode: "none" }));
		expect(result).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				"##### 细目甲", // 跳级（缺 H4）→ 不编号、裸标题
				"##### 细目乙",
				`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}子节`, // H4 正常嵌套（H2/H3 都在）→ 照常编号
			].join("\n"),
		);
		// 幂等：再触发不变。
		expect(renumberContent(result, withSkipFill({ mode: "none" }))).toBe(result);
	});

	it("F8 none：正常嵌套（无缺失段）的深层标题照常编号——不编号仅针对跳级", () => {
		const nested = ["## 章", "### 节", "#### 目", "##### 细目"].join("\n");
		expect(renumberContent(nested, withSkipFill({ mode: "none" }))).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}目`,
				`##### ${WORD_JOINER}1.1.1.1 ${WORD_JOINER}细目`,
			].join("\n"),
		);
	});

	it("F9 状态转移：fill 编出 1.1.0.1 → 改 none 再触发，旧前缀剥净裸出且幂等", () => {
		const filled = renumberContent(content, withSkipFill({ mode: "fill", placeholder: "0" }));
		expect(filled).toContain(`##### ${WORD_JOINER}1.1.0.1 ${WORD_JOINER}细目甲`);
		const bare = renumberContent(filled, withSkipFill({ mode: "none" }));
		expect(bare).toContain("##### 细目甲");
		expect(bare).not.toContain("1.1.0.1");
		expect(renumberContent(bare, withSkipFill({ mode: "none" }))).toBe(bare);
	});
});

describe("结束编号层级 bottomLevel（M6：编号区间下界）", () => {
	/** 在默认模板基础上替换 topLevel / bottomLevel。 */
	function withRange(topLevel: number, bottomLevel: number): Template {
		return { ...DEFAULT_TEMPLATE, topLevel, bottomLevel };
	}

	it("normalizeBottomLevel：夹到 1–6，非数字/缺失回退 H6（无下界）", () => {
		expect(normalizeBottomLevel(4)).toBe(4);
		expect(normalizeBottomLevel(0)).toBe(1); // 夹到下限
		expect(normalizeBottomLevel(9)).toBe(6); // 夹到上限
		expect(normalizeBottomLevel("x")).toBe(DEFAULT_BOTTOM_LEVEL); // 非数字回退
		expect(normalizeBottomLevel(undefined)).toBe(DEFAULT_BOTTOM_LEVEL); // 缺失（旧模板）回退
		expect(DEFAULT_BOTTOM_LEVEL).toBe(6);
	});

	it("只编号 H2–H4：H5/H6 不写前缀、原样保留", () => {
		const content = ["## 章", "### 节", "#### 子节", "##### 细目", "###### 末项"].join("\n");
		const result = renumberContent(content, withRange(2, 4)).split("\n");
		expect(result[0]).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		expect(result[1]).toBe(`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`);
		expect(result[2]).toBe(`#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}子节`);
		// 超出下界：不编号。
		expect(result[3]).toBe("##### 细目");
		expect(result[4]).toBe("###### 末项");
	});

	it("收窄结束层级后，超界标题残留的旧前缀被剥净（对称 C3）", () => {
		// 先按无下界编号（H5 拿到 1.1.1.1）。
		const content = ["## 章", "### 节", "#### 子", "##### 细"].join("\n");
		const full = renumberContent(content, withRange(2, 6));
		expect(full.split("\n")[3]).toBe(`##### ${WORD_JOINER}1.1.1.1 ${WORD_JOINER}细`);
		// 把结束层级收窄到 H4：H5 的旧前缀须被剥成裸标题。
		const narrowed = renumberContent(full, withRange(2, 4)).split("\n");
		expect(narrowed[3]).toBe("##### 细");
	});

	it("区间编号幂等：连续两次结果一致", () => {
		const content = ["## 章", "### 节", "#### 子", "##### 细"].join("\n");
		const once = renumberContent(content, withRange(2, 4));
		const twice = renumberContent(once, withRange(2, 4));
		expect(twice).toBe(once);
	});

	it("超界标题仍作重置边界：其后同级标题计数独立", () => {
		// H2–H3 编号；H4 超界但仍 bump，不影响 H3 计数。
		const content = ["## 章", "### 节一", "#### 深", "### 节二"].join("\n");
		const result = renumberContent(content, withRange(2, 3)).split("\n");
		expect(result[1]).toBe(`### ${WORD_JOINER}1.1 ${WORD_JOINER}节一`);
		expect(result[2]).toBe("#### 深"); // 超界，不编号
		expect(result[3]).toBe(`### ${WORD_JOINER}1.2 ${WORD_JOINER}节二`); // 计数照常递进
	});

	it("previewLevel：超出 [top, bottom] 区间返回空", () => {
		const tpl = withRange(2, 4);
		expect(previewLevel(tpl, 2).length).toBeGreaterThan(0);
		expect(previewLevel(tpl, 4).length).toBeGreaterThan(0);
		expect(previewLevel(tpl, 5)).toEqual([]); // 超下界
		expect(previewLevel(tpl, 1)).toEqual([]); // 超上界（低于 top）
	});
});

describe("U4：标题正文含 WJ 后前导空白时幂等（回归，testplan §3.2）", () => {
	// 根因：stripPrefix 按 WJ 精确剥离后，正文带前导空格（来自脏编辑/破坏前缀的残留）。
	// 白名单/超界分支写出 `${hashes} ${text}`，一个 hashes 后空格 + 前导空格 = 多余空格；
	// 下次 parser `[ \t]+` 贪婪吞掉这些空格，rawText 不同 → 非幂等。
	// 修：stripHeadingPrefix 及超界 text 均追加 .replace(/^\s+/, "") 去首白。

	it("白名单分支：WJ 后有前导空格，连续触发幂等且输出无前导空白", () => {
		const content = `## ${WORD_JOINER}1 ${WORD_JOINER}  - X`;
		const template: Template = {
			...DEFAULT_TEMPLATE,
			whitelist: [{ text: "- X", match: "partial" }],
		};
		const once = renumberContent(content, template);
		expect(once).toBe("## - X");
		expect(renumberContent(once, template)).toBe(once);
	});

	it("超界分支（level < topLevel）：WJ 后有前导空格，连续触发幂等", () => {
		// topLevel=3 → H2（level=2）低于起始层，走「只剥不编号」路径。
		const content = `## ${WORD_JOINER}1 ${WORD_JOINER}  - X`;
		const template: Template = { ...DEFAULT_TEMPLATE, topLevel: 3 };
		const once = renumberContent(content, template);
		expect(once).toBe("## - X");
		expect(renumberContent(once, template)).toBe(once);
	});

	it("编号分支：WJ 后有前导空格，编号后前导空白被去除，幂等", () => {
		// H2 在编号范围内（topLevel=2）；剥旧前缀得「  - X」→ 去首白→「- X」→ 加新前缀。
		const content = `## ${WORD_JOINER}1 ${WORD_JOINER}  - X`;
		const once = renumberContent(content, DEFAULT_TEMPLATE);
		expect(once).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}- X`);
		expect(renumberContent(once, DEFAULT_TEMPLATE)).toBe(once);
	});

	it("多个前导空格的极端情况：全部去掉，不影响尾随空白处理", () => {
		// 4 个前导空格；确认不误伤纯空标题（text 为空时去首不影响）。
		const content = `## ${WORD_JOINER}1 ${WORD_JOINER}    末项`;
		const template: Template = {
			...DEFAULT_TEMPLATE,
			whitelist: [{ text: "末项", match: "partial" }],
		};
		const once = renumberContent(content, template);
		expect(once).toBe("## 末项");
		expect(renumberContent(once, template)).toBe(once);
	});
});

describe("起始编号数字 startIndex（M8 批次 1，testplan N1–N8）", () => {
	/** 在默认模板基础上替换 startIndex 与其他字段（白名单清空，避免与场景无关的豁免）。 */
	function withStartIndex(startIndex: number, extra: Partial<Template> = {}): Template {
		return { ...DEFAULT_TEMPLATE, whitelist: [], startIndex, ...extra };
	}

	it("N1：startIndex=0 仅首段偏移——首 H2 得 0、其 H3 得 0.1、次 H2 得 1", () => {
		const content = ["## 甲", "### 乙", "## 丙"].join("\n");
		expect(renumberContent(content, withStartIndex(0))).toBe(
			[
				`## ${WORD_JOINER}0 ${WORD_JOINER}甲`,
				`### ${WORD_JOINER}0.1 ${WORD_JOINER}乙`,
				`## ${WORD_JOINER}1 ${WORD_JOINER}丙`,
			].join("\n"),
		);
	});

	it("N2：startIndex=5——首 H2 得 5、其 H3 得 5.1、次 H2 得 6", () => {
		const content = ["## 甲", "### 乙", "## 丙"].join("\n");
		expect(renumberContent(content, withStartIndex(5))).toBe(
			[
				`## ${WORD_JOINER}5 ${WORD_JOINER}甲`,
				`### ${WORD_JOINER}5.1 ${WORD_JOINER}乙`,
				`## ${WORD_JOINER}6 ${WORD_JOINER}丙`,
			].join("\n"),
		);
	});

	it("N3：状态转移 startIndex 1 → 0——旧前缀剥净重编，且幂等", () => {
		const content = ["## 甲", "### 乙"].join("\n");
		const first = renumberContent(content, withStartIndex(1)); // `1` / `1.1`
		expect(first).toContain(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`);
		const second = renumberContent(first, withStartIndex(0));
		expect(second).toBe(
			[`## ${WORD_JOINER}0 ${WORD_JOINER}甲`, `### ${WORD_JOINER}0.1 ${WORD_JOINER}乙`].join(
				"\n",
			),
		);
		expect(renumberContent(second, withStartIndex(0))).toBe(second); // 幂等
	});

	it("N4：跳级缺失首段仍按 skipFill 占位（不受偏移影响）；其后首个真实 H2 从 startIndex 起", () => {
		const content = ["### 深", "## 真"].join("\n");
		// 首个 H3 时 c2=0（缺失）→ 占位 0，不加偏移；随后真实 H2 → 5。
		expect(renumberContent(content, withStartIndex(5))).toBe(
			[`### ${WORD_JOINER}0.1 ${WORD_JOINER}深`, `## ${WORD_JOINER}5 ${WORD_JOINER}真`].join(
				"\n",
			),
		);
	});

	it("N5：继承前级=关——本级为起始层级时偏移，更深层级不偏移", () => {
		const tpl = withStartIndex(5, {
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h3: { ...DEFAULT_TEMPLATE.levels.h3, inherit: false },
			},
		});
		const content = ["## 甲", "### 乙"].join("\n");
		expect(renumberContent(content, tpl)).toBe(
			// H2 是首段（=topLevel）→ 5；H3 关闭继承只出本级序号 → 1（不偏移）。
			[`## ${WORD_JOINER}5 ${WORD_JOINER}甲`, `### ${WORD_JOINER}1 ${WORD_JOINER}乙`].join(
				"\n",
			),
		);
	});

	it("N6：normalizeStartIndex——负数夹 0、非数字/缺失回退默认 1、小数四舍五入、超大夹 9999", () => {
		expect(normalizeStartIndex(-3)).toBe(0);
		expect(normalizeStartIndex("abc")).toBe(DEFAULT_START_INDEX);
		expect(normalizeStartIndex(undefined)).toBe(DEFAULT_START_INDEX);
		expect(normalizeStartIndex(2.6)).toBe(3);
		expect(normalizeStartIndex(100000)).toBe(9999);
		expect(normalizeStartIndex(0)).toBe(0);
	});

	it("N7：非阿拉伯样式 + startIndex=0——cjk 首个标题得「零」，WJ 剥离幂等", () => {
		const tpl = withStartIndex(0, {
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h2: { ...DEFAULT_TEMPLATE.levels.h2, numeral: "cjk" },
			},
		});
		const content = ["## 甲", "## 丙"].join("\n");
		const once = renumberContent(content, tpl);
		expect(once).toBe(
			[`## ${WORD_JOINER}零 ${WORD_JOINER}甲`, `## ${WORD_JOINER}一 ${WORD_JOINER}丙`].join(
				"\n",
			),
		);
		expect(renumberContent(once, tpl)).toBe(once); // WJ 边界剥离与字形无关
	});

	it("N8：子树豁免块后计数器重置（决策 D1）与 startIndex 组合——块后重开也从 startIndex 起", () => {
		const tpl = withStartIndex(0, {
			whitelist: [{ text: "附录", match: "subtree" }],
		});
		const content = ["## 甲", "## 附录", "### 附一", "## 乙"].join("\n");
		expect(renumberContent(content, tpl)).toBe(
			[
				`## ${WORD_JOINER}0 ${WORD_JOINER}甲`,
				"## 附录",
				"### 附一",
				`## ${WORD_JOINER}0 ${WORD_JOINER}乙`, // 块后重开，仍从 startIndex=0 起
			].join("\n"),
		);
	});

	it("预览跟随：previewLevel 首段偏移、深层从 1 起（供 GUI N9 的逻辑保证）", () => {
		const h2 = previewLevel(withStartIndex(0), 2, 2);
		expect(h2[0]).toBe(`${WORD_JOINER}0 ${WORD_JOINER}`);
		expect(h2[1]).toBe(`${WORD_JOINER}1 ${WORD_JOINER}`);
		const h3 = previewLevel(withStartIndex(0), 3, 2);
		expect(h3[0]).toBe(`${WORD_JOINER}0.1 ${WORD_JOINER}`);
		expect(h3[1]).toBe(`${WORD_JOINER}0.2 ${WORD_JOINER}`);
	});
});
