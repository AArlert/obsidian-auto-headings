/**
 * 「复制编号大纲」「复制当前小节链接」纯逻辑单测（R 组，见 src/copycommands.ts 与 doc/testplan.md §R）。
 *
 * 覆盖 R1–R5 的纯函数部分：写入模式取标题所见文本、仅显示模式取虚拟编号、缩进与空标题跳过、
 * 围栏/注释跳过、小节查找、锚点（保留 WJ）与 alias（剥编号）。剪贴板写入、Notice、命令可用性
 * 判定是 main.ts 的接线，留给 main.test.ts 的命令层用例。
 */
import { describe, expect, it } from "vitest";
import { buildNumberedOutline, sectionHeadingAt, sectionLinkParts } from "../../src/copycommands";
import { DEFAULT_TEMPLATE, renumberContent, WORD_JOINER } from "../../src/numbering";
import { computeVirtualNumbers } from "../../src/virtual/compute";

const WJ = WORD_JOINER;

describe("buildNumberedOutline：写入模式（R1）", () => {
	it("标题所见文本即编号 + 标题，按层级缩进（最浅层级不缩进，每深一级两个空格）", () => {
		const content = ["# 书名", "## 概述", "### 背景", "## 细节"].join("\n");
		const written = renumberContent(content, DEFAULT_TEMPLATE);
		const { text, count } = buildNumberedOutline(written, null);
		expect(text).toBe(["书名", "  1 概述", "    1.1 背景", "  2 细节"].join("\n"));
		expect(count).toBe(4);
	});

	it("围栏代码块与注释块里的 # 行不算标题，不出现在大纲里", () => {
		const content = [
			"## 概述",
			"```",
			"## 假标题（围栏内）",
			"```",
			"<!--",
			"## 假标题（注释内）",
			"-->",
			"## 细节",
		].join("\n");
		const { text, count } = buildNumberedOutline(content, null);
		expect(text).toBe(["概述", "细节"].join("\n"));
		expect(count).toBe(2);
	});

	it("标题去空白后为空（只有 `##` 没有文字）时跳过、不计数，但仍参与最浅级别的缩进基准", () => {
		const content = ["## ", "### 有标题"].join("\n");
		const { text, count } = buildNumberedOutline(content, null);
		// 空标题（level 2）虽被跳过，但仍是"全文最浅级别"的一部分：有标题（level 3）相对它缩进两格。
		expect(text).toBe("  有标题");
		expect(count).toBe(1);
	});
});

describe("buildNumberedOutline：仅显示模式（R2）", () => {
	it("虚拟编号与写入模式逐行一致；不编号的标题只有文字", () => {
		const content = ["# 书名", "## 概述", "### 背景", "## 细节"].join("\n");
		const labels = computeVirtualNumbers(content, DEFAULT_TEMPLATE);
		const { text, count } = buildNumberedOutline(content, labels);
		expect(text).toBe(["书名", "  1 概述", "    1.1 背景", "  2 细节"].join("\n"));
		expect(count).toBe(4);
	});

	it("带残留旧编号（WJ 打头）的标题输出「虚拟编号 + 纯标题」，不带残留", () => {
		const content = `## ${WJ}7 ${WJ}概述`;
		const labels = computeVirtualNumbers(content, DEFAULT_TEMPLATE);
		expect(labels[0].staleRange).toBeDefined(); // 确认 fixture 真的触发了残留判定
		const { text, count } = buildNumberedOutline(content, labels);
		expect(text).toBe("1 概述"); // 新算出的虚拟编号，不是残留的 "7"
		expect(count).toBe(1);
	});

	it("某标题在 labels 里找不到对应行时，该行单独退回标题所见文本兜底", () => {
		const content = ["## 概述", "## 细节"].join("\n");
		// 模拟调用方传入了与 content 不一致的 labels（行号整体错位）。
		const labels = computeVirtualNumbers(content, DEFAULT_TEMPLATE).map((l) => ({
			...l,
			lineIndex: l.lineIndex + 100,
		}));
		const { text, count } = buildNumberedOutline(content, labels);
		expect(text).toBe(["概述", "细节"].join("\n"));
		expect(count).toBe(2);
	});
});

describe("buildNumberedOutline：没有标题（R3）", () => {
	it("没有标题的文件返回空文本、count 为 0（写入与仅显示两种调用方式）", () => {
		expect(buildNumberedOutline("只有正文，没有任何标题。", null)).toEqual({
			text: "",
			count: 0,
		});
		expect(buildNumberedOutline("", computeVirtualNumbers("", DEFAULT_TEMPLATE))).toEqual({
			text: "",
			count: 0,
		});
	});
});

describe("sectionHeadingAt（R4 小节查找 / R5 不可用）", () => {
	const content = [
		"正文最前面，没有标题。", // 0
		"## 一、概述", // 1
		"内容 A", // 2
		"### 1.1 背景", // 3
		"内容 B", // 4
		"## 二、总结", // 5
		"内容 C", // 6
	].join("\n");

	it("光标在小节正文里：取其上方最近的标题", () => {
		expect(sectionHeadingAt(content, 2)?.text).toBe("一、概述");
	});

	it("光标正好在标题行：取该标题自身", () => {
		expect(sectionHeadingAt(content, 3)?.text).toBe("1.1 背景");
	});

	it("光标在最后一节的正文里：取最后一个标题", () => {
		expect(sectionHeadingAt(content, 6)?.text).toBe("二、总结");
	});

	it("R5：光标在第一个标题之前 → null", () => {
		expect(sectionHeadingAt(content, 0)).toBeNull();
	});

	it("R5：文件没有标题 → null", () => {
		expect(sectionHeadingAt("只有正文，从头到尾没有任何标题。", 0)).toBeNull();
	});
});

describe("sectionLinkParts（R4：锚点保留 WJ，alias 剥编号）", () => {
	it("写入模式已编号标题：锚点保留 WJ（与标题字节一致），alias 是剥掉编号的纯标题", () => {
		const written = renumberContent("## 概述", DEFAULT_TEMPLATE);
		const heading = sectionHeadingAt(written, 0);
		expect(heading).not.toBeNull();
		const { anchor, alias } = sectionLinkParts(heading!);
		expect(anchor).toBe(`${WJ}1 ${WJ}概述`);
		expect(anchor).toContain(WJ);
		expect(alias).toBe("概述");
	});

	it("未编号的普通标题：锚点与 alias 均为标题原文", () => {
		const heading = sectionHeadingAt("## 普通标题", 0);
		const { anchor, alias } = sectionLinkParts(heading!);
		expect(anchor).toBe("普通标题");
		expect(alias).toBe("普通标题");
	});

	it("标题剥完编号后为空（极端情形）：alias 为 undefined，不强塞空字符串", () => {
		const heading = sectionHeadingAt(`## ${WJ}1 ${WJ}`, 0);
		const { alias } = sectionLinkParts(heading!);
		expect(alias).toBeUndefined();
	});
});
