/**
 * 模板卡片 / 编辑弹窗纯视图逻辑（1.2.2 视觉更新，testplan L34 / L37 / L38 / L40 / L41）。
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, type LevelFormat, type Template } from "../../src/numbering";
import {
	applyInheritChoice,
	buildPreviewLines,
	cardPreviewLines,
	inheritChoiceOf,
	inheritDepthOptions,
	sampleNoteContent,
	showSpaces,
	summarizeTemplateUsage,
} from "../../src/settings/templateView";
import type { PathRule } from "../../src/pathrules";

function tpl(patch: Partial<Template> = {}): Template {
	return { ...structuredClone(DEFAULT_TEMPLATE), ...patch };
}

function fmt(patch: Partial<LevelFormat> = {}): LevelFormat {
	return {
		prefix: "",
		numeral: "arabic",
		suffix: "",
		numberSeparator: ".",
		titleSeparator: " ",
		inherit: true,
		...patch,
	};
}

describe("上级编号合并列（L37）", () => {
	it("读：inherit=false → 不带；inheritDepth 缺省 / null → 全部；k → k", () => {
		expect(inheritChoiceOf(fmt({ inherit: false, inheritDepth: 2 }), 4)).toBe("none");
		expect(inheritChoiceOf(fmt(), 4)).toBe("all");
		expect(inheritChoiceOf(fmt({ inheritDepth: null }), 4)).toBe("all");
		expect(inheritChoiceOf(fmt({ inheritDepth: 2 }), 4)).toBe(2);
	});

	it("写：三种选择各自落到 inherit + inheritDepth 两个字段", () => {
		const f = fmt({ inheritDepth: 2 });
		applyInheritChoice(f, "none", 4);
		expect(f.inherit).toBe(false);
		expect(f.inheritDepth).toBe(2); // 保留原级数，切回来能恢复
		applyInheritChoice(f, "all", 4);
		expect(f).toMatchObject({ inherit: true, inheritDepth: null });
		applyInheritChoice(f, 1, 4);
		expect(f).toMatchObject({ inherit: true, inheritDepth: 1 });
	});

	it("读写往返一致", () => {
		for (const choice of ["none", "all", 1, 2, 3] as const) {
			const f = fmt();
			applyInheritChoice(f, choice, 4);
			expect(inheritChoiceOf(f, 4)).toBe(choice);
		}
	});

	it("级数选项为 1 … level−1", () => {
		expect(inheritDepthOptions(1)).toEqual([]);
		expect(inheritDepthOptions(4)).toEqual([1, 2, 3]);
	});
});

describe("空格可视化（L38）", () => {
	it("空格换成 ␣，其余原样", () => {
		expect(showSpaces(" ")).toBe("␣");
		expect(showSpaces(") ")).toBe(")␣");
		expect(showSpaces("、")).toBe("、");
		expect(showSpaces("")).toBe("");
	});
});

describe("卡片三行预览（L34）", () => {
	it("H1–H6 全部列出：范围内取第一个序号，范围外不带编号", () => {
		const lines = cardPreviewLines(tpl({ topLevel: 2, bottomLevel: 4 }));
		expect(lines.map((l) => [l.level, l.label, l.indent])).toEqual([
			[1, null, 0],
			[2, "1 ", 1],
			[3, "1.1 ", 2],
			[4, "1.1.1 ", 3],
			[5, null, 4],
			[6, null, 5],
		]);
	});
});

describe("底部预览行（L40）", () => {
	it("按模板编号；白名单命中带标签；范围外浅色无标签", () => {
		const content = ["# 文档", "## 概述", "### 背景", "## 参考文献", "## 结论"].join("\n");
		const lines = buildPreviewLines(content, tpl({ topLevel: 2, bottomLevel: 6 }));
		expect(lines.map((l) => [l.label, l.text, l.tag, l.inRange])).toEqual([
			[null, "文档", null, false],
			["1 ", "概述", null, true],
			["1.1 ", "背景", null, true],
			[null, "参考文献", "whitelist", true],
			["2 ", "结论", null, true],
		]);
	});

	it("行尾 skip 标记 → skip 标签，文本去掉标记", () => {
		const lines = buildPreviewLines("## 草稿 <!-- skip -->", tpl({ topLevel: 2 }));
		expect(lines[0]).toMatchObject({ label: null, text: "草稿", tag: "skip" });
	});

	it("跳级且选「不编号」→ unnumbered 标签", () => {
		const content = ["## 一", "#### 跳级"].join("\n");
		const lines = buildPreviewLines(content, tpl({ topLevel: 2, skipFill: { mode: "none" } }));
		expect(lines[1]).toMatchObject({ label: null, tag: "unnumbered", indent: 2 });
	});

	it("示例笔记覆盖 H1–H6", () => {
		const words = ["文档", "概述", "背景", "动机", "细节", "补充", "方法", "结论"];
		const levels = buildPreviewLines(sampleNoteContent(words), tpl()).map((l) => l.level);
		expect(new Set(levels)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
	});
});

describe("影响说明（L41）", () => {
	const rules: PathRule[] = [
		{ pattern: "/", template: "A" },
		{ pattern: "Work/", template: "B", mode: "virtual" },
		{ pattern: "Work/notes/", template: "A" },
	];
	const paths = ["a.md", "Work/b.md", "Work/c.md", "Work/notes/d.md"];

	it("按每篇笔记实际解析出的规则计数", () => {
		expect(summarizeTemplateUsage(rules, paths, "A")).toEqual({
			rules: 2,
			notes: 2,
			writeNotes: 2,
		});
		expect(summarizeTemplateUsage(rules, paths, "B")).toEqual({
			rules: 1,
			notes: 2,
			writeNotes: 0,
		});
	});

	it("没有规则引用 → 全 0", () => {
		expect(summarizeTemplateUsage(rules, paths, "C")).toEqual({
			rules: 0,
			notes: 0,
			writeNotes: 0,
		});
	});
});
