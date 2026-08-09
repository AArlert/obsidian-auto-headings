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

describe("parseHeadings — 注释块跳过（M12，testplan E19–E26）", () => {
	it("E19：`%%` 块内的 `#` 行不当作标题", () => {
		const content = [
			"## 真标题",
			"%%",
			"# 注释里的不是标题",
			"## 也不是",
			"%%",
			"## 又一个真标题",
		];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual([
			"真标题",
			"又一个真标题",
		]);
	});

	it("E20：`<!-- -->` 块内的 `#` 行不当作标题", () => {
		const content = ["## 真标题", "<!--", "# 注释里的不是标题", "-->", "## 又一个真标题"];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual([
			"真标题",
			"又一个真标题",
		]);
	});

	it("E21/R3：行内开闭的注释不影响本行标题成立，注释原文留在 text 里", () => {
		// 行首第 0 列不在注释内 ⇒ 是标题。编号会写在 `#` 与标题文本之间，即注释的**左侧**。
		const headings = parseHeadings("## 标题 %% 批注 %%\n## 下一个标题");
		expect(headings.map((h) => h.text)).toEqual(["标题 %% 批注 %%", "下一个标题"]);
	});

	it("E22/R4：`## 标题 <!--` 本行仍是标题，其后各行被遮蔽直到 `-->`", () => {
		const content = ["## 标题 <!--", "## 被遮蔽", "-->", "## 恢复"];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual(["标题 <!--", "恢复"]);
	});

	it("E23/R5 正向：围栏内的 `%%` 不开启注释（围栏后的标题仍被识别）", () => {
		// 若围栏内的 `%%` 泄漏了状态，`## 围栏后的标题` 会被误当作注释内容而丢失。
		const content = ["```", "%%", "```", "## 围栏后的标题"];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual(["围栏后的标题"]);
	});

	it("E23/R5 反向【已知限制】：注释内的 ``` 会开启围栏，故 `-->` 之后仍被围栏遮蔽", () => {
		// 刻意钉住现状。失败方向是「多跳过 / 冻结」而非「误编号」，安全；要修正需让注释抑制
		// 围栏检测，代价与收益不成比例（见 scan.ts 说明）。
		const content = ["<!--", "```", "-->", "## 本该恢复但被围栏吃掉"];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual([]);
		// 对照组：去掉那行 ``` 后必须能恢复识别——否则上面的空数组只是「解析器整个坏了」，
		// 这条用例就失去了鉴别力。
		const control = ["<!--", "-->", "## 本该恢复但被围栏吃掉"];
		expect(parseHeadings(control.join("\n")).map((h) => h.text)).toEqual([
			"本该恢复但被围栏吃掉",
		]);
	});

	it("E24/R6【已知限制】：行内代码里的 `<!--` 照常开启注释", () => {
		// 正确处理需要 CommonMark 级的反引号游程 tokenizer，收益不成比例。同样是「冻结」方向。
		const content = ["## 讲 `<!--` 的标题", "## 被意外遮蔽"];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual(["讲 `<!--` 的标题"]);
	});

	it("E25/R7：未闭合的注释一直延伸到文件末尾", () => {
		expect(
			parseHeadings(["## 真标题", "%%", "## 之后全被遮蔽", "## 也是"].join("\n")).map(
				(h) => h.text,
			),
		).toEqual(["真标题"]);
		expect(
			parseHeadings(["## 真标题", "<!--", "## 之后全被遮蔽"].join("\n")).map((h) => h.text),
		).toEqual(["真标题"]);
	});

	it("E26/R8：HTML 注释不嵌套，首个 `-->` 即闭合", () => {
		const content = ["<!-- <!--", "-->", "## 已恢复"];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual(["已恢复"]);
	});

	it("E26/R10：`%%%` 贪婪左到右 = 开标记 + 残留 `%`；`%%%%` 则配平", () => {
		// `%%%`：前两个 `%` 开启注释，剩一个 `%` 落在注释内 ⇒ 下方被遮蔽。
		expect(parseHeadings(["%%%", "## 被遮蔽"].join("\n")).map((h) => h.text)).toEqual([]);
		// `%%%%`：开 + 闭，行末已闭合 ⇒ 下方正常。
		expect(parseHeadings(["%%%%", "## 正常"].join("\n")).map((h) => h.text)).toEqual(["正常"]);
	});

	it("同一行内开闭后，行末状态干净——下一行的标题照常识别", () => {
		const content = ["%% 整行都是注释 %%", "## 正常标题"];
		expect(parseHeadings(content.join("\n")).map((h) => h.text)).toEqual(["正常标题"]);
	});
});
