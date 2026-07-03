import { describe, expect, it } from "vitest";
import { clearForeignNumberingContent, clearNumberingContent } from "../../src/cleanup";
import { renumberContent, DEFAULT_TEMPLATE, WORD_JOINER } from "../../src/numbering";

describe("clearNumberingContent（M6 H 类场景）", () => {
	// H1: 对已编号文件执行清除 → 所有前缀剥成裸标题
	it("H1: 阿拉伯数字多级编号 → 裸标题", () => {
		const input = "## 1 概述\n### 1.1 背景\n### 1.2 动机\n## 2 细节";
		expect(clearNumberingContent(input)).toBe("## 概述\n### 背景\n### 动机\n## 细节");
	});

	// H2: 无模板命中时仍能清除（全样式并集剥离器独立于模板）
	it("H2: 无可用模板时仍按全样式剥离", () => {
		const input = "## 1.1 子节\n### 1.1.1 细节\n## 2.1 另一子节";
		expect(clearNumberingContent(input)).toBe("## 子节\n### 细节\n## 另一子节");
	});

	// H3: 混合样式（cjk + circled + alpha）
	it("H3: 中文 / 带圈 / 字母混合历史前缀都能剥", () => {
		const input = "## 一 概述\n### ① 细节\n#### a 备注\n## 二 结论";
		expect(clearNumberingContent(input)).toBe("## 概述\n### 细节\n#### 备注\n## 结论");
	});

	// H4: 清除后再重新编号，结果等价于裸文本直接编号（往返幂等）
	it("H4: 清除 + 重新编号 = 裸文本直接编号", () => {
		const content = "## 1 概述\n### 1.1 背景\n## 2 分析";
		const cleared = clearNumberingContent(content);
		const renumbered = renumberContent(cleared, DEFAULT_TEMPLATE);
		const reference = renumberContent("## 概述\n### 背景\n## 分析", DEFAULT_TEMPLATE);
		expect(renumbered).toBe(reference);
	});

	// 代码块内的 # 不受影响
	it("代码块内的 # 行不被处理", () => {
		const input = "```\n# 注释行\n```\n## 1 标题";
		expect(clearNumberingContent(input)).toBe("```\n# 注释行\n```\n## 标题");
	});

	// 无编号的裸标题不变（非数字/中文/字母直接起头）
	it("正常裸标题不受影响", () => {
		const input = "## 概述\n### 背景与动机\n## 结论";
		expect(clearNumberingContent(input)).toBe(input);
	});

	// 带前后缀（第1章 / 1章）的编号能被清除（需传 strippablePrefixes/Suffixes）
	it("带前缀（第）和后缀（章）的编号能被清除", () => {
		const input = "## 第1章 概述\n## 第2章 细节";
		expect(
			clearNumberingContent(input, {
				strippablePrefixes: ["第"],
				strippableSuffixes: ["章"],
			}),
		).toBe("## 概述\n## 细节");
	});

	// 只剥一层（「2024 折中」：清除后 2024 总结 中的 2024 不被二次吃掉）
	it("已清除的 1 2024 总结 在再次触发时稳定保留 2024", () => {
		// 先模拟：带历史前缀的 `## 1 2024 总结` 执行清除 → `## 2024 总结`
		const input = "## 1 2024 总结";
		const cleared = clearNumberingContent(input);
		// 清除器只剥一层：`1 ` 被剥掉，`2024 总结` 保留
		expect(cleared).toBe("## 2024 总结");
	});

	// 上界：H6 深度
	it("H6 深度的多段编号被剥净", () => {
		const input = "## 1 a\n### 1.1 b\n#### 1.1.1 c\n##### 1.1.1.1 d\n###### 1.1.1.1.1 e";
		expect(clearNumberingContent(input)).toBe("## a\n### b\n#### c\n##### d\n###### e");
	});
});

describe("C3 修复：调高 topLevel 后降出范围的标题旧前缀被剥除", () => {
	// C3 场景：topLevel=H1 时 H1 被编号，后调高到 H2，H1 的旧前缀应被清除
	it("C3: topLevel 从 H1 调高到 H2，H1 标题的旧前缀被剥除", () => {
		// 第一步：topLevel=H1，H1 被编号为 `# 1 篇`，H2 继承后为 `## 1.1 节`（testplan C2 已验）
		const tplH1 = { ...DEFAULT_TEMPLATE, topLevel: 1 };
		const afterH1 = renumberContent("# 篇\n## 节", tplH1);
		expect(afterH1).toBe(
			`# ${WORD_JOINER}1 ${WORD_JOINER}篇\n## ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
		);

		// 第二步：topLevel 调高到 H2，再触发 → H1 的 `1 ` 前缀应被剥除，H2 重排
		const tplH2 = { ...DEFAULT_TEMPLATE, topLevel: 2 };
		const afterH2 = renumberContent(afterH1, tplH2);
		expect(afterH2).toBe(`# 篇\n## ${WORD_JOINER}1 ${WORD_JOINER}节`);
	});

	it("C3: 深层 topLevel 调高（H2→H3），H2 旧前缀被剥除", () => {
		const tplH2 = { ...DEFAULT_TEMPLATE, topLevel: 2 };
		const numbered = renumberContent("## 节\n### 子节\n#### 细节", tplH2);
		expect(numbered).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}节\n### ${WORD_JOINER}1.1 ${WORD_JOINER}子节\n#### ${WORD_JOINER}1.1.1 ${WORD_JOINER}细节`,
		);

		// 调高 topLevel 到 H3
		const tplH3 = { ...DEFAULT_TEMPLATE, topLevel: 3 };
		const afterRaise = renumberContent(numbered, tplH3);
		// H2 降出范围，旧前缀 `1 ` 被剥除；H3/H4 重新编号
		expect(afterRaise).toBe(
			`## 节\n### ${WORD_JOINER}1 ${WORD_JOINER}子节\n#### ${WORD_JOINER}1.1 ${WORD_JOINER}细节`,
		);
	});

	it("C3: 幂等性 — 再次触发结果不变", () => {
		const tplH1 = { ...DEFAULT_TEMPLATE, topLevel: 1 };
		const after1 = renumberContent("# 篇\n## 节", tplH1);

		const tplH2 = { ...DEFAULT_TEMPLATE, topLevel: 2 };
		const after2a = renumberContent(after1, tplH2);
		const after2b = renumberContent(after2a, tplH2);
		expect(after2b).toBe(after2a);
	});

	it("C3: 非编号文本的 H1 不受调高 topLevel 影响", () => {
		// H1 没有编号前缀，不应被误剥（方案A：无 WJ 一律不剥，更不会误伤）。
		const tplH2 = { ...DEFAULT_TEMPLATE, topLevel: 2 };
		const result = renumberContent("# 纯裸标题\n## 节", tplH2);
		expect(result).toBe(`# 纯裸标题\n## ${WORD_JOINER}1 ${WORD_JOINER}节`);
	});
});

describe("clearForeignNumberingContent（0.6.6「清理非本插件的标题编号」）", () => {
	it("剥手写阿拉伯多级编号（无 WJ）", () => {
		const input = "## 1 概述\n### 1.1 背景\n## 2.3 细节";
		expect(clearForeignNumberingContent(input)).toBe("## 概述\n### 背景\n## 细节");
	});

	it("覆盖更多手写惯例：括号 / 第…章 / 顿号 / 方括号 / 右括号 / 点", () => {
		expect(clearForeignNumberingContent("## (1) 概述")).toBe("## 概述");
		expect(clearForeignNumberingContent("## （一）背景")).toBe("## 背景");
		expect(clearForeignNumberingContent("## 第3章 引言")).toBe("## 引言");
		expect(clearForeignNumberingContent("## 第一章 绪论")).toBe("## 绪论");
		expect(clearForeignNumberingContent("## 一、要点")).toBe("## 要点");
		expect(clearForeignNumberingContent("## [1] 参考")).toBe("## 参考");
		expect(clearForeignNumberingContent("## 1) 列表")).toBe("## 列表");
		expect(clearForeignNumberingContent("## 1. 小节")).toBe("## 小节");
		expect(clearForeignNumberingContent("## ① 带圈")).toBe("## 带圈");
	});

	it("**保留**本插件写的（带 WJ）编号，不动", () => {
		const input = `## ${WORD_JOINER}1 ${WORD_JOINER}概述\n### ${WORD_JOINER}1.1 ${WORD_JOINER}背景`;
		// 含 WJ → 视为本插件编号 → 原样保留。
		expect(clearForeignNumberingContent(input)).toBe(input);
	});

	it("混合：剥手写、保留带 WJ 的", () => {
		const input = `## ${WORD_JOINER}1 ${WORD_JOINER}插件编号\n### 2.3 手写编号`;
		expect(clearForeignNumberingContent(input)).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}插件编号\n### 手写编号`,
		);
	});

	it("无分隔符的纯序号字样标题不被误剥（如「100」「三」末尾无分隔符）", () => {
		expect(clearForeignNumberingContent("## 100")).toBe("## 100");
		expect(clearForeignNumberingContent("## 三")).toBe("## 三");
	});

	it("无标题 / 无外来编号时原样返回", () => {
		expect(clearForeignNumberingContent("正文一行\n另一行")).toBe("正文一行\n另一行");
		expect(clearForeignNumberingContent("## 裸标题\n### 另一个")).toBe("## 裸标题\n### 另一个");
	});

	it("清理后交给插件编号：得到干净的带 WJ 编号（典型工作流）", () => {
		const input = "## 1 旧概述\n### 1.1 旧背景";
		const cleaned = clearForeignNumberingContent(input);
		expect(cleaned).toBe("## 旧概述\n### 旧背景");
		const numbered = renumberContent(cleaned, DEFAULT_TEMPLATE);
		expect(numbered).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}旧概述\n### ${WORD_JOINER}1.1 ${WORD_JOINER}旧背景`,
		);
	});
});
