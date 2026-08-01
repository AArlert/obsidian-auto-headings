import { describe, expect, it } from "vitest";
import {
	DEFAULT_TEMPLATE,
	normalizeInheritDepth,
	renumberContent,
	type SkipFill,
	type Template,
	WORD_JOINER,
} from "../../src/numbering";

function templateWithDepth(level: 1 | 2 | 3 | 4 | 5 | 6, depth: number | null): Template {
	const key = `h${level}` as keyof Template["levels"];
	return {
		...DEFAULT_TEMPLATE,
		topLevel: 1,
		whitelist: [],
		levels: {
			...DEFAULT_TEMPLATE.levels,
			[key]: { ...DEFAULT_TEMPLATE.levels[key], inheritDepth: depth },
		},
	};
}

function visible(content: string): string {
	return content.replaceAll(WORD_JOINER, "");
}

describe("inheritDepth 核心与向后兼容", () => {
	it("规范化只接受正整数，并按物理祖先上限收口", () => {
		expect(normalizeInheritDepth(undefined)).toBeNull();
		expect(normalizeInheritDepth(null)).toBeNull();
		expect(normalizeInheritDepth(2, 5)).toBe(2);
		expect(normalizeInheritDepth(9, 2)).toBe(2);
		for (const value of [0, -1, 1.2, Number.NaN, Number.POSITIVE_INFINITY, "1", {}]) {
			expect(normalizeInheritDepth(value)).toBeNull();
		}
	});

	it("字段缺失、null 与旧模板的完整继承输出一致", () => {
		const legacy = {
			...DEFAULT_TEMPLATE,
			topLevel: 1,
			whitelist: [],
			levels: {
				...DEFAULT_TEMPLATE.levels,
				h3: { ...DEFAULT_TEMPLATE.levels.h3 },
			},
		};
		delete legacy.levels.h3.inheritDepth;
		const explicitNull = templateWithDepth(3, null);
		const input = ["# A", "## B", "### C"].join("\n");
		expect(renumberContent(input, legacy)).toBe(renumberContent(input, explicitNull));
		expect(visible(renumberContent(input, legacy))).toContain("### 1.1.1 C");
	});

	it.each([
		[3, 1, "1.1"],
		[3, 2, "1.1.1"],
		[4, 1, "1.1"],
		[4, 2, "1.1.1"],
	] as const)("H%i depth=%i 只包含指定数量的祖先段", (level, depth, expected) => {
		const headings = Array.from({ length: level }, (_, i) => `${"#".repeat(i + 1)} H${i + 1}`);
		const last = visible(renumberContent(headings.join("\n"), templateWithDepth(level, depth)))
			.split("\n")
			.at(-1);
		expect(last).toBe(`${"#".repeat(level)} ${expected} H${level}`);
	});

	it("depth 超过范围时在 topLevel 截断，绝不包含更浅层级", () => {
		const tpl = { ...templateWithDepth(4, 5), topLevel: 2 };
		const result = visible(renumberContent(["# A", "## B", "### C", "#### D"].join("\n"), tpl));
		expect(result.split("\n")[3]).toBe("#### 1.1.1 D");
	});

	it("inherit=false 时忽略但保留 inheritDepth，只输出当前级", () => {
		const base = templateWithDepth(3, 1);
		const h3 = { ...base.levels.h3, inherit: false };
		const tpl = { ...base, levels: { ...base.levels, h3 } };
		const result = visible(renumberContent(["# A", "## B", "### C"].join("\n"), tpl));
		expect(result.split("\n")[2]).toBe("### 1 C");
		expect(h3.inheritDepth).toBe(1);
	});
});

describe("inheritDepth 样式与起始偏移", () => {
	it("用户目标案例得到 H2.H3，H3 不包含 H1 段", () => {
		const base = templateWithDepth(3, 1);
		const tpl: Template = {
			...base,
			levels: {
				...base.levels,
				h1: { ...base.levels.h1, numeral: "cjk", titleSeparator: "、" },
				h2: { ...base.levels.h2, inherit: false, titleSeparator: "、" },
				h3: {
					...base.levels.h3,
					numberSeparator: ".",
					titleSeparator: "",
					inheritDepth: 1,
				},
			},
		};
		const input = [
			"# UI布局区域建议",
			"# UI美化",
			"## 字体大小",
			"## 富文本",
			"### 换行",
			"### 斜体",
			"### 换色",
			"## 动效",
		].join("\n");
		expect(visible(renumberContent(input, tpl))).toBe(
			[
				"# 一、UI布局区域建议",
				"# 二、UI美化",
				"## 1、字体大小",
				"## 2、富文本",
				"### 2.1换行",
				"### 2.2斜体",
				"### 2.3换色",
				"## 3、动效",
			].join("\n"),
		);
	});

	it("startIndex 只作用于范围内真正的 topLevel 段", () => {
		const full = { ...templateWithDepth(3, 2), startIndex: 5 };
		const limited = { ...templateWithDepth(3, 1), startIndex: 5 };
		const input = ["# A", "## B", "### C"].join("\n");
		expect(visible(renumberContent(input, full)).split("\n")[2]).toBe("### 5.1.1 C");
		expect(visible(renumberContent(input, limited)).split("\n")[2]).toBe("### 1.1 C");
	});

	it("self 使用实际祖先样式，arabic 只转换实际继承的祖先段", () => {
		const base = templateWithDepth(4, 2);
		const levels = {
			...base.levels,
			h1: { ...base.levels.h1, numeral: "cjk" as const },
			h2: { ...base.levels.h2, numeral: "lower-alpha" as const },
			h3: { ...base.levels.h3, numeral: "circled" as const },
			h4: { ...base.levels.h4, numeral: "upper-roman" as const, inheritDepth: 2 },
		};
		const input = ["# A", "## B", "### C", "#### D"].join("\n");
		const own = visible(renumberContent(input, { ...base, levels, ancestorNumeral: "self" }));
		const arabic = visible(
			renumberContent(input, { ...base, levels, ancestorNumeral: "arabic" }),
		);
		expect(own.split("\n")[3]).toBe("#### a.①.I D");
		expect(arabic.split("\n")[3]).toBe("#### 1.1.I D");
		expect(own.split("\n")[3]).not.toContain("一");
	});
});

describe("inheritDepth 与 skipFill", () => {
	function withSkip(mode: SkipFill): Template {
		return { ...templateWithDepth(4, 1), skipFill: mode };
	}

	it("fill/drop 只作用于截取后的序列", () => {
		const input = ["# A", "## B", "#### D"].join("\n");
		expect(
			visible(renumberContent(input, withSkip({ mode: "fill", placeholder: "0" }))).split(
				"\n",
			)[2],
		).toBe("#### 0.1 D");
		expect(visible(renumberContent(input, withSkip({ mode: "drop" }))).split("\n")[2]).toBe(
			"#### 1 D",
		);
	});

	it("none 忽略有限范围外缺失祖先，但仍拒绝直接父级缺失", () => {
		const tpl = withSkip({ mode: "none" });
		const parentPresent = visible(renumberContent(["## B", "### C", "#### D"].join("\n"), tpl));
		const parentMissing = visible(renumberContent(["## B", "#### D"].join("\n"), tpl));
		expect(parentPresent.split("\n")[2]).toBe("#### 1.1 D");
		expect(parentMissing.split("\n")[1]).toBe("#### D");
	});

	it("none 在 depth=null 与 inherit=false 时保持旧的 topLevel 检查范围", () => {
		const input = ["## B", "### C", "#### D"].join("\n");
		const full = { ...templateWithDepth(4, null), skipFill: { mode: "none" } as const };
		const noInheritBase = templateWithDepth(4, 1);
		const noInherit = {
			...noInheritBase,
			skipFill: { mode: "none" } as const,
			levels: {
				...noInheritBase.levels,
				h4: { ...noInheritBase.levels.h4, inherit: false },
			},
		};
		expect(visible(renumberContent(input, full)).split("\n")[2]).toBe("#### D");
		expect(visible(renumberContent(input, noInherit)).split("\n")[2]).toBe("#### D");
	});
});

describe("inheritDepth 回归稳定性", () => {
	it("partial 附录仍不编号、不占用计数", () => {
		const tpl = {
			...templateWithDepth(1, null),
			whitelist: [{ text: "附录", match: "partial" as const }],
		};
		const result = visible(
			renumberContent(["# 四、自检清单", "# 附录、字体配色建议", "# 后续"].join("\n"), tpl),
		);
		expect(result).toBe(["# 1 四、自检清单", "# 附录、字体配色建议", "# 2 后续"].join("\n"));
	});

	it("连续重排幂等，并可在全部与 depth=1 间往返而不叠加", () => {
		const input = ["# A", "## B", "### C"].join("\n");
		const fullTpl = templateWithDepth(3, null);
		const limitedTpl = templateWithDepth(3, 1);
		const full = renumberContent(input, fullTpl);
		const limited = renumberContent(full, limitedTpl);
		expect(renumberContent(limited, limitedTpl)).toBe(limited);
		expect(visible(limited).split("\n")[2]).toBe("### 1.1 C");
		const restored = renumberContent(limited, fullTpl);
		expect(visible(restored).split("\n")[2]).toBe("### 1.1.1 C");
		expect(restored).toBe(full);
	});
});
