import { describe, expect, it } from "vitest";
import { parseHeadings } from "../../src/parser";

describe("parseHeadings", () => {
	it("识别各级标题及其级别", () => {
		const content = ["# 文档标题", "## 第一章", "### 细节", "###### 最深级"].join("\n");
		const headings = parseHeadings(content);
		expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 6]);
		expect(headings.map((h) => h.text)).toEqual(["文档标题", "第一章", "细节", "最深级"]);
	});

	it("text 去除行尾空白，rawText 保留行尾空白", () => {
		// `### 1.1 ` 是插件给「空行直接转标题」写入编号后的形态（末尾即标题间隔符空格）：
		// text 去尾后为 `1.1`，rawText 保留为 `1.1 `。后者是「不重复叠编号」修复的关键信号
		// （用带空格的 rawText 剥离才能命中标题间隔符、把前缀干净剥成空，见 numbering.ts）。
		const headings = parseHeadings("## 标题  \n### 1.1 ");
		expect(headings.map((h) => h.text)).toEqual(["标题", "1.1"]);
		expect(headings.map((h) => h.rawText)).toEqual(["标题  ", "1.1 "]);
	});

	it("记录每个标题所在行下标", () => {
		const content = ["前言", "", "## 第一章", "正文", "## 第二章"].join("\n");
		const headings = parseHeadings(content);
		expect(headings.map((h) => h.lineIndex)).toEqual([2, 4]);
	});

	it("需要 `#` 与文本之间有空白才视为标题", () => {
		const content = ["#不是标题", "#### 是标题"].join("\n");
		const headings = parseHeadings(content);
		expect(headings).toHaveLength(1);
		expect(headings[0].level).toBe(4);
	});

	it("七个及以上的 `#` 不再是 ATX 标题", () => {
		const headings = parseHeadings("####### 过深");
		expect(headings).toHaveLength(0);
	});

	it("去除标题文本的行尾空白", () => {
		const headings = parseHeadings("##   带空白的标题   ");
		expect(headings[0].text).toBe("带空白的标题");
	});

	it("忽略反引号围栏代码块内的 `#` 行", () => {
		const content = [
			"## 真标题",
			"```",
			"# 这是注释不是标题",
			"## 也不是",
			"```",
			"## 又一个真标题",
		].join("\n");
		const headings = parseHeadings(content);
		expect(headings.map((h) => h.text)).toEqual(["真标题", "又一个真标题"]);
	});

	it("忽略波浪号围栏代码块内的 `#` 行", () => {
		const content = ["~~~", "# 代码里的井号", "~~~", "## 标题"].join("\n");
		const headings = parseHeadings(content);
		expect(headings.map((h) => h.text)).toEqual(["标题"]);
	});

	it("不同栅栏符号不互相闭合", () => {
		// 以 ``` 开启的代码块不会被 ~~~ 闭合，因此其间的标题仍被忽略。
		const content = ["```", "~~~", "# 仍在代码块内", "```", "## 代码块外的标题"].join("\n");
		const headings = parseHeadings(content);
		expect(headings.map((h) => h.text)).toEqual(["代码块外的标题"]);
	});

	it("带语言标识的围栏起始行也能正确识别", () => {
		const content = ["```ts", "# const x = 1; // 不是标题", "```", "## 标题"].join("\n");
		const headings = parseHeadings(content);
		expect(headings.map((h) => h.text)).toEqual(["标题"]);
	});

	it("空内容返回空列表", () => {
		expect(parseHeadings("")).toEqual([]);
	});
});
