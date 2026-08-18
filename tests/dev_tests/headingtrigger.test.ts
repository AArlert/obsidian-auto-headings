/**
 * M13 触发边界与链接构造（headingtrigger.ts）纯函数单测（对应 testplan Q 类逻辑部分：
 * Q2/Q3 前缀匹配触发、Q4 链接形态、Q7/Q8 上下文屏蔽、Q9 的 token 提取面）。
 *
 * 无 obsidian 运行时依赖，不需要 obsidian-mock.ts。
 */
import { describe, expect, it } from "vitest";
import {
	MAX_TOKEN_LENGTH,
	MIN_QUERY_LENGTH,
	buildHeadingLink,
	extractTriggerToken,
	isBlockedContext,
	sortEntries,
} from "../../src/headingtrigger";
import type { HeadingIndexEntry } from "../../src/headingindex";

const entry = (over: Partial<HeadingIndexEntry>): HeadingIndexEntry => ({
	path: "notes/a.md",
	basename: "a",
	level: 2,
	lineIndex: 0,
	displayText: "交叉矩阵",
	matchKey: "交叉矩阵",
	anchor: "交叉矩阵",
	...over,
});

describe("extractTriggerToken：触发词回溯提取", () => {
	it("中文词：从光标位置向左整段纳入", () => {
		expect(extractTriggerToken("正文里提到「交叉矩阵")).toEqual({
			token: "交叉矩阵",
			start: 6,
		});
	});

	it("中英混排：字母数字连续段整体纳入", () => {
		expect(extractTriggerToken("see the 交叉矩阵")).toEqual({
			token: "交叉矩阵",
			start: 8,
		});
		expect(extractTriggerToken("version 3.1 说明")).toEqual({ token: "说明", start: 12 });
	});

	it("光标前是标点/空白：不触发（token 为空或不足最短长度）", () => {
		expect(extractTriggerToken("打完句号。")).toBeNull();
		expect(extractTriggerToken("abc ")).toBeNull();
	});

	it(`最短触发长度 ${MIN_QUERY_LENGTH}：单字符不触发（噪音防护）`, () => {
		expect(extractTriggerToken("交")).toBeNull();
		expect(extractTriggerToken("交叉")).toEqual({ token: "交叉", start: 0 });
		expect(extractTriggerToken("a")).toBeNull();
		expect(extractTriggerToken("ab")).toEqual({ token: "ab", start: 0 });
	});

	it(`回溯上限 ${MAX_TOKEN_LENGTH}：无标点大段文本只取末尾 ${MAX_TOKEN_LENGTH} 码点`, () => {
		const long = "x".repeat(MAX_TOKEN_LENGTH + 10);
		expect(extractTriggerToken(long)?.token).toHaveLength(MAX_TOKEN_LENGTH);
	});
});

describe("isBlockedContext：上下文屏蔽（礼貌规则）", () => {
	it("光标所在整行是 ATX 标题行：屏蔽（Q7 逻辑面）", () => {
		expect(isBlockedContext("## 正在写的标题", "## 正在写的", 2)).toBe(true);
		// CommonMark：ATX 标题最多缩进 3 个空格（4 空格是代码块，不是标题行，不屏蔽）。
		expect(isBlockedContext("   ### 缩进标题", "   ### 缩进标", 3)).toBe(true);
		expect(isBlockedContext("    ### 四空格缩进", "    ### 四空格缩进", 4)).toBe(false);
	});

	it("紧邻 #（标签输入）：屏蔽", () => {
		expect(isBlockedContext("正文 #", "正文 #", 4)).toBe(true);
	});

	it("处于未闭合 [[ 内：屏蔽（Q8 逻辑面，最高优先级礼貌规则）", () => {
		expect(isBlockedContext("打 [[交叉", "打 [[交叉", 4)).toBe(true);
	});

	it("已闭合 [[…]] 之后正常打字：不屏蔽", () => {
		expect(isBlockedContext("见 [[笔记]] 交叉", "见 [[笔记]] 交", 8)).toBe(false);
	});

	it("紧邻单个 [（markdown 链接上下文）：屏蔽", () => {
		expect(isBlockedContext("看 [交叉", "看 [交", 3)).toBe(true);
	});

	it("普通正文：不屏蔽", () => {
		expect(isBlockedContext("这里提到交叉矩阵", "这里提到交叉矩", 5)).toBe(false);
	});
});

describe("sortEntries：建议排序", () => {
	it("精确匹配优先、其次 matchKey 长度升序、path 兜底", () => {
		const entries = [
			entry({ matchKey: "交叉矩阵abc", path: "a.md" }),
			entry({ matchKey: "交叉", path: "a.md" }),
			entry({ matchKey: "交叉矩阵", path: "b.md" }),
			entry({ matchKey: "交叉矩阵", path: "a.md" }),
		];
		const sorted = sortEntries(entries, "交叉矩阵");
		expect(sorted.map((e) => `${e.path}:${e.matchKey}`)).toEqual([
			"a.md:交叉矩阵", // 精确 + path 最小
			"b.md:交叉矩阵", // 精确
			"a.md:交叉", // 长度 2
			"a.md:交叉矩阵abc", // 长度最长
		]);
	});

	it("不修改入参数组", () => {
		const entries = [entry({ matchKey: "乙" }), entry({ matchKey: "甲" })];
		sortEntries(entries, "甲");
		expect(entries[0].matchKey).toBe("乙");
	});
});

describe("buildHeadingLink：链接构造（Q4 逻辑面）", () => {
	it("目标在当前文件内：省略文件名的同文件锚点形式，alias 为完整标题名", () => {
		expect(buildHeadingLink(entry({ path: "notes/a.md" }), "notes/a.md")).toBe(
			"[[#交叉矩阵|交叉矩阵]]",
		);
	});

	it("目标在其它文件：[[basename#锚点|完整标题名]]（1.0.27：alias 补全为完整标题名而非残缺前缀）", () => {
		expect(buildHeadingLink(entry({ path: "notes/b.md", basename: "b" }), "notes/a.md")).toBe(
			"[[b#交叉矩阵|交叉矩阵]]",
		);
	});

	it("已编号标题：锚点保留 WORD_JOINER（与 backlinks.ts displayAnchor 一致）", () => {
		const wj = "\u2060";
		expect(buildHeadingLink(entry({ anchor: `1.1 ${wj}交叉矩阵` }), "notes/a.md")).toBe(
			`[[#1.1 ${wj}交叉矩阵|交叉矩阵]]`,
		);
	});
});
