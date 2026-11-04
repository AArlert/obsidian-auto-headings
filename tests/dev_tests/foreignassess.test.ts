import { describe, expect, it } from "vitest";
import { assessForeignNumbering } from "../../src/foreignassess";
import {
	clearForeignNumberingContent,
	clearNumberingContent,
	hasUnclaimedForeignNumbering,
	isMostlyForeignNumbered,
	previewForeignNumberingCleanup,
} from "../../src/cleanup";
import { WORD_JOINER } from "../../src/numbering";

/** 每个标题行的档位（不在结果里的记 `-`），按行号顺序。 */
function tiers(content: string): string[] {
	const byLine = new Map(assessForeignNumbering(content).map((a) => [a.lineIndex, a.tier]));
	return content
		.split("\n")
		.map((l, i) => (/^#{1,6}\s/.test(l) ? (byLine.get(i) ?? "-") : null))
		.filter((t): t is string => t !== null);
}

describe("assessForeignNumbering 形状（单独出现）", () => {
	it("强形状单独即确定", () => {
		for (const h of [
			"## 第三章 总结",
			"## （一）背景",
			"## (1) 概述",
			"## ① 备注",
			"## 一、要点",
			"## 1. 小节",
			"## 1) 列表",
			"## IV、结论",
			"## A) 概述",
			"## C. 语言",
		]) {
			expect(tiers(h), h).toEqual(["sure"]);
		}
	});

	it("英文句点后跟拉丁字母多半是缩写：单独只算存疑", () => {
		expect(tiers("## C. elegans 研究")).toEqual(["unsure"]);
	});

	it("带圈数字后跟空格、单独出现也是确定", () => {
		expect(tiers("### 背景\n### ⑤ 「门级仿真？带 SDF 吗？」")).toEqual(["-", "sure"]);
	});

	it("主力库实测：字母 + 冒号是标签，读不出值的字母词不算", () => {
		expect(
			tiers("### Q：随机跑绿了就算验过吗？\n### ID：顺序与乱序执行\n### CDC：慢时钟采快时钟"),
		).toEqual(["-", "-", "-"]);
	});

	it("字母 / 罗马后只跟空格、连字符词：单独不算", () => {
		expect(tiers("## a 备注\n## vim 配置\n## C 语言\n## K-means 聚类")).toEqual([
			"-",
			"-",
			"-",
			"-",
		]);
	});

	it("剥完为空的纯编号标题不在结果里（由 isNumberOnlyHeading 另算）", () => {
		expect(tiers("# 第一章\n## 1.")).toEqual(["-", "-"]);
	});

	it("带插件前缀的标题不参与判定，但占同级序位", () => {
		const W = WORD_JOINER;
		expect(tiers(`## ${W}1 ${W}概述\n## 2 方法`)).toEqual(["-", "sure"]);
		expect(tiers(`## ${W}1 ${W}概述\n## 1 方法`)).toEqual(["-", "unsure"]);
	});
});

describe("J29 同级连续成串", () => {
	it("字母、罗马、带标点的字母都能成串", () => {
		expect(tiers("## a 备注\n## b 结论")).toEqual(["sure", "sure"]);
		expect(tiers("## I 引言\n## II 方法\n## III 结果\n## IV 结论")).toEqual([
			"sure",
			"sure",
			"sure",
			"sure",
		]);
		expect(tiers("## A. Basics\n## B. CDC\n## C. Language")).toEqual(["sure", "sure", "sure"]);
	});

	it("中间夹着的无关标题跳过不断串，夹着的那个按自身形状定档", () => {
		expect(tiers("## 1 概述\n## 2 方法\n## 2024 总结\n## 3 结论")).toEqual([
			"sure",
			"sure",
			"unsure",
			"sure",
		]);
	});

	it("不从 0 / 1 起、跳得太远都不算串", () => {
		expect(tiers("## c 方法\n## d 结论")).toEqual(["-", "-"]);
		expect(tiers("## 1 概述\n## 5 结论")).toEqual(["sure", "unsure"]);
	});

	it("允许删掉过一节（相邻差 ≤ 2），从 0 起也算", () => {
		expect(tiers("## a 一\n## c 三")).toEqual(["sure", "sure"]);
		expect(tiers("## 0 前言\n## 1 概述")).toEqual(["sure", "sure"]);
	});

	it("只在同一父标题下成串", () => {
		expect(tiers("# 甲\n## a 备注\n# 乙\n## b 结论")).toEqual(["-", "-", "-", "-"]);
	});

	it("多段号按大纲规律推进（1.1 → 1.2 → 2.1）", () => {
		expect(tiers("## 1.1 子节\n## 1.2 子节二\n## 2.1 另一子节")).toEqual([
			"sure",
			"sure",
			"sure",
		]);
	});
});

describe("J30 成串但剥后重名", () => {
	it("整串作废", () => {
		expect(tiers("## A 计划\n## B 计划")).toEqual(["-", "-"]);
		expect(tiers("## I 型糖尿病\n## II 型糖尿病")).toEqual(["-", "-"]);
		expect(tiers("## 1 号线\n## 2 号线")).toEqual(["unsure", "unsure"]);
	});

	it("主力库实测：字母只跟空格的串，剥后都以同一个字起头 → 字母是修饰语，整串作废", () => {
		expect(
			tiers("### A 档 — 外企在华\n### B 档 — 国产 AI 芯片\n### C 档 — 国产 GPU 四小龙"),
		).toEqual(["-", "-", "-"]);
	});
});

describe("J31 单个数字开头：值 = 同级序位，量词否决", () => {
	it("值等于序位 → 确定；不等 → 存疑", () => {
		expect(tiers("## 1 红米")).toEqual(["sure"]);
		expect(tiers("## 2024 总结")).toEqual(["unsure"]);
		expect(tiers("## 背景\n## 目标\n## 3 方法")).toEqual(["-", "-", "sure"]);
		expect(tiers("## 一 概述")).toEqual(["sure"]);
	});

	it("字母不用序位规则", () => {
		expect(tiers("## A 股")).toEqual(["-"]);
		expect(tiers("## 甲\n## 乙\n## C 语言")).toEqual(["-", "-", "-"]);
	});

	it("主力库里的数量短语一律存疑（即便值恰好等于序位）", () => {
		for (const h of [
			"## 6 个 master 都发 ID 0",
			"## 4 位加法器：两种写法都要会",
			"## 30 秒版（电话初面 / 时间紧）",
			"## 2027 年第一季度",
			"## 100 题",
			"## 1 个目标",
		]) {
			expect(tiers(h), h).toEqual(["unsure"]);
		}
		expect(tiers("## 先读\n## 30 秒自我介绍")).toEqual(["-", "unsure"]);
		expect(tiers("## 先读\n## 2 分钟版")).toEqual(["-", "unsure"]);
	});

	it("量词不挡成串：单字量词常是普通词的开头", () => {
		expect(tiers("## 1 项目背景\n## 2 分析\n## 3 部署方案")).toEqual(["sure", "sure", "sure"]);
	});

	it("年份序列不从 1 起，不成串", () => {
		expect(tiers("## 2026 年第四季度\n## 2027 年第一季度\n## 2027 年第二季度")).toEqual([
			"unsure",
			"unsure",
			"unsure",
		]);
	});
});

describe("J32 上下级编号对得上", () => {
	it("子标题以父标题编号开头、末段为 1 → 父子都确定", () => {
		expect(tiers("## 1 红米\n### 1.1 工艺")).toEqual(["sure", "sure"]);
		expect(tiers("## 3 方案\n### 3.1 细节")).toEqual(["sure", "sure"]);
	});

	it("多级链一路对得上", () => {
		expect(tiers("## 1 a\n### 1.1 b\n#### 1.1.1 c")).toEqual(["sure", "sure", "sure"]);
	});

	it("父标题编号 + 子标题成串", () => {
		expect(tiers("## 4. 解释列\n### 4.1 一\n### 4.2 二\n### 4.3 三")).toEqual([
			"sure",
			"sure",
			"sure",
			"sure",
		]);
	});

	it("孤立多段号（父标题无编号）只算存疑", () => {
		expect(tiers("# 更新日志\n## 1.2 版本发布")).toEqual(["-", "unsure"]);
	});
});

describe("各入口按档位处理", () => {
	const mixed = "## 1 概述\n## 2 方法\n## 2024 总结\n## 30 秒版";

	it("J34 清理命令（不传 keepLines）只剥确定", () => {
		expect(clearForeignNumberingContent(mixed)).toBe(
			"## 概述\n## 方法\n## 2024 总结\n## 30 秒版",
		);
	});

	it("J33 预览列出确定与存疑；传 keepLines 时勾上的存疑也剥", () => {
		expect(previewForeignNumberingCleanup(mixed).map((i) => i.tier)).toEqual([
			"sure",
			"sure",
			"unsure",
			"unsure",
		]);
		expect(clearForeignNumberingContent(mixed, { keepLines: new Set([3]) })).toBe(
			"## 概述\n## 方法\n## 总结\n## 30 秒版",
		);
	});

	it("H23 清除命令：不带 WJ 的只剥确定，带 WJ 的照旧剥", () => {
		const W = WORD_JOINER;
		expect(clearNumberingContent(`## ${W}1 ${W}插件\n## 2024 总结\n### 1. 手写`)).toBe(
			"## 插件\n## 2024 总结\n### 手写",
		);
	});

	it("J31 守卫：只有存疑不拦，有确定才拦", () => {
		expect(hasUnclaimedForeignNumbering("## 2024 总结\n## 计划\n## 回顾")).toBe(false);
		expect(hasUnclaimedForeignNumbering("## 2024 总结")).toBe(false);
		expect(hasUnclaimedForeignNumbering("## 30 秒版\n## 60 秒版")).toBe(false);
		expect(hasUnclaimedForeignNumbering("## 1 红米")).toBe(true);
	});

	it("V80 仅显示模式过半判定只数确定与纯编号", () => {
		expect(isMostlyForeignNumbered("## 2023 总结\n## 2024 总结\n## 展望")).toBe(false);
		expect(isMostlyForeignNumbered("## 30 秒版\n## 60 秒版\n## 背景")).toBe(false);
		expect(isMostlyForeignNumbered("## 1. 引言\n## 2. 方法\n## 结论")).toBe(true);
	});
});

describe("J35 前导词与 第…步 / 第…部分", () => {
	it("① 前导词成串 → 确定，剥时连前导词一起剥", () => {
		const steps = "## Step 1 安装\n## Step 2 配置\n## Step 3 运行";
		expect(tiers(steps)).toEqual(["sure", "sure", "sure"]);
		expect(clearForeignNumberingContent(steps)).toBe("## 安装\n## 配置\n## 运行");
		expect(tiers("## Chapter 1: 引言\n## Chapter 2: 方法")).toEqual(["sure", "sure"]);
		expect(tiers("## Part I 背景\n## Part II 方法")).toEqual(["sure", "sure"]);
		expect(tiers("## Appendix A: 术语\n## Appendix B: 参考")).toEqual(["sure", "sure"]);
		expect(tiers("## §1 总则\n## § 2 定义")).toEqual(["sure", "sure"]);
		expect(tiers("## STEP 1 安装\n## step 2 配置")).toEqual(["sure", "sure"]);
	});

	it("① 前导词与上下级对得上", () => {
		expect(tiers("## Chapter 3 方法\n### 3.1 数据\n### 3.2 模型")).toEqual([
			"sure",
			"sure",
			"sure",
		]);
	});

	it("① 不同前导词、有无前导词不互相成串", () => {
		// 序位都对不上（第 3、4 个），只看成串：前导词算进签名，`Step 1` 接不上 `2 配置`。
		expect(tiers("## 背景\n## 概述\n## Step 1 安装\n## 2 配置")).toEqual([
			"-",
			"-",
			"unsure",
			"unsure",
		]);
		expect(tiers("## 背景\n## 概述\n## Step 1 安装\n## Phase 2 配置")).toEqual([
			"-",
			"-",
			"unsure",
			"unsure",
		]);
	});

	it("② 孤立的前导词：值 = 序位才确定，否则存疑、守卫不拦", () => {
		expect(tiers("## Step 1 安装\n## 总结")).toEqual(["sure", "-"]);
		expect(tiers("## Part 2 结果\n## 讨论")).toEqual(["unsure", "-"]);
		expect(tiers("## 背景\n## Section 3 讨论")).toEqual(["-", "unsure"]);
		expect(tiers("## Part 2: 结果")).toEqual(["unsure"]);
		expect(hasUnclaimedForeignNumbering("## Part 2 结果\n## 讨论")).toBe(false);
		expect(hasUnclaimedForeignNumbering("## Step 1 安装\n## Step 2 配置")).toBe(true);
	});

	it("③ 第…步 / 第…部分 是强形状", () => {
		expect(tiers("## 第1步 安装\n## 第2步 运行")).toEqual(["sure", "sure"]);
		expect(tiers("## 第一部分 背景")).toEqual(["sure"]);
		expect(clearForeignNumberingContent("## 第一部分 背景")).toBe("## 背景");
	});

	it("④ 标题只有前导词 + 序号 → 纯编号，过半即拦", () => {
		expect(hasUnclaimedForeignNumbering("# Chapter 1\n正文\n# Chapter 2\n正文")).toBe(true);
		expect(isMostlyForeignNumbered("## Day 1\n## Day 2\n## 感想")).toBe(true);
	});

	it("⑤ 像前导词的正文与不带 第 的数量不动", () => {
		for (const t of [
			"## Unit Test 规范",
			"## Stage Manager",
			"## Step Functions",
			"## Python 3 教程",
			"## 3步 搞定",
			"## 两部分 内容",
		]) {
			expect(tiers(t), t).toEqual(["-"]);
		}
		expect(
			hasUnclaimedForeignNumbering("## Unit Test 规范\n## Stage Manager\n## 3步 搞定"),
		).toBe(false);
	});
});
