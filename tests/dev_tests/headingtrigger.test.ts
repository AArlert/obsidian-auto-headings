/**
 * M13 触发边界与链接构造（headingtrigger.ts）纯函数单测（对应 testplan Q 类逻辑部分：
 * Q2/Q3 前缀匹配触发、Q4 链接形态、Q7/Q8 上下文屏蔽、Q9 的 token 提取面）。
 *
 * 无 obsidian 运行时依赖，不需要 obsidian-mock.ts。
 */
import { describe, expect, it } from "vitest";
import {
	MAX_TOKEN_LENGTH,
	MIN_PREFIX_WEIGHT,
	MIN_TOKEN_CHARS,
	buildHeadingLink,
	extractTriggerToken,
	isBlockedContext,
	resolveTriggerQuery,
	sortEntries,
	suffixCandidates,
	triggerWeight,
	type TriggerIndexProbe,
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
		expect(extractTriggerToken("version 3.1 使用说明")).toEqual({
			token: "使用说明",
			start: 12,
		});
	});

	it("光标前是标点/空白：不触发（token 为空或不足最短长度）", () => {
		expect(extractTriggerToken("打完句号。")).toBeNull();
		expect(extractTriggerToken("abc ")).toBeNull();
	});

	it(`最短 ${MIN_TOKEN_CHARS} 个码点：单字符不触发；门槛之外的规则交给 resolveTriggerQuery`, () => {
		expect(extractTriggerToken("，项")).toBeNull();
		expect(extractTriggerToken("a")).toBeNull();
		expect(extractTriggerToken("，项目")).toEqual({ token: "项目", start: 1 });
		expect(extractTriggerToken(" ab")).toEqual({ token: "ab", start: 1 });
		expect(extractTriggerToken("𠮷野")).toEqual({ token: "𠮷野", start: 0 }); // 按码点不按 code unit
	});

	it("triggerWeight：中日韩字符记 2、其他记 1，按码点计", () => {
		expect(triggerWeight("项目")).toBe(4);
		expect(triggerWeight("json")).toBe(4);
		expect(triggerWeight("かな")).toBe(4);
		expect(triggerWeight("한국")).toBe(4);
		expect(triggerWeight("𠮷野家")).toBe(6); // 星平面汉字只算一个字
		expect(triggerWeight("3.1")).toBe(3);
	});

	it(`回溯上限 ${MAX_TOKEN_LENGTH}：无标点大段文本只取末尾 ${MAX_TOKEN_LENGTH} 码点`, () => {
		const long = "x".repeat(MAX_TOKEN_LENGTH + 10);
		expect(extractTriggerToken(long)?.token).toHaveLength(MAX_TOKEN_LENGTH);
	});
});

describe("suffixCandidates：整段 + 逐级后缀候选（Q22）", () => {
	it("整段排第一，其后按用户输入量递减，start 指向各候选自身的起点", () => {
		expect(suffixCandidates("一个交叉", 5)).toEqual([
			{ text: "一个交叉", start: 5, boundary: true },
			{ text: "个交叉", start: 6, boundary: false },
			{ text: "交叉", start: 7, boundary: false },
		]);
	});

	it(`后缀下限 ${MIN_TOKEN_CHARS} 个码点：不产出单字符候选`, () => {
		expect(suffixCandidates("交叉", 0).map((c) => c.text)).toEqual(["交叉"]);
	});

	it("中日韩字符与其他字符的交界算词边界（Q30）", () => {
		expect(suffixCandidates("用uart", 0)).toEqual([
			{ text: "用uart", start: 0, boundary: true },
			{ text: "uart", start: 1, boundary: true }, // 汉字 → 字母
			{ text: "art", start: 2, boundary: false },
			{ text: "rt", start: 3, boundary: false },
		]);
		const zh = suffixCandidates("uart接口", 0).find((c) => c.text === "接口");
		expect(zh?.boundary).toBe(true); // 字母 → 汉字
	});

	it("按码点切分：代理对不会被劈成半个字符", () => {
		// 「𠮷」是星平面字符（2 个 code unit），后缀 start 用 UTF-16 偏移换算。
		expect(suffixCandidates("一𠮷野", 0)).toEqual([
			{ text: "一𠮷野", start: 0, boundary: true },
			{ text: "𠮷野", start: 1, boundary: false },
		]);
	});
});

describe("resolveTriggerQuery：命中规则（Q22 / Q27 / Q28 / Q30 / Q31）", () => {
	/** 用一组 matchKey 模拟索引侧判定；linked 是被链接过的那些。 */
	const indexOf = (keys: string[], linked: string[] = []): TriggerIndexProbe => ({
		hasAnyPrefixMatch: (q) => keys.some((k) => k.startsWith(q)),
		hasExactMatch: (q) => keys.includes(q),
		isLinked: (q) => linked.includes(q),
	});

	it(`词边界起、权重 ≥ ${MIN_PREFIX_WEIGHT}：按前缀匹配，边打边出候选（Q27）`, () => {
		expect(resolveTriggerQuery("项目级", 1, indexOf(["项目级（影响当前项目）"]))).toEqual({
			text: "项目级",
			start: 1,
			query: "项目级",
		});
		expect(resolveTriggerQuery("interf", 0, indexOf(["interface"]))?.query).toBe("interf");
	});

	it("词边界起、权重不足：前缀不算（issue #10「项目」「json」）", () => {
		expect(resolveTriggerQuery("项目", 1, indexOf(["项目级（影响当前项目）"]))).toBeNull();
		expect(resolveTriggerQuery("json", 1, indexOf(["json 配置"]))).toBeNull();
	});

	it("短英文词完整命中即触发，不要求被链接过（Q30）", () => {
		const idx = indexOf(["uart", "axi"]);
		expect(resolveTriggerQuery("uart", 0, idx)?.query).toBe("uart");
		expect(resolveTriggerQuery("ax", 0, idx)).toBeNull(); // 前缀不算
		// 紧跟汉字的英文词：交界即词边界，start 指向 uart 本身
		expect(resolveTriggerQuery("用uart", 4, idx)).toEqual({
			text: "uart",
			start: 5,
			query: "uart",
		});
	});

	it("短中文词完整命中还要求被链接过（Q31）", () => {
		const idx = indexOf(["中断", "使用"], ["中断"]);
		expect(resolveTriggerQuery("中断", 1, idx)?.query).toBe("中断");
		expect(resolveTriggerQuery("使用", 1, idx)).toBeNull();
	});

	it("连写中间的后缀：完整命中，且（权重够或被链接过）（Q22 / Q28）", () => {
		const idx = indexOf(["交叉矩阵", "项目级（影响当前项目）", "事务", "总结"], ["事务"]);
		// 起点必须是后缀的起点——若返回整段起点，接受建议会把「一个」一起吃掉。
		expect(resolveTriggerQuery("一个交叉矩阵", 5, idx)).toEqual({
			text: "交叉矩阵",
			start: 7,
			query: "交叉矩阵",
		});
		expect(resolveTriggerQuery("一个交叉矩", 0, idx)).toBeNull(); // 只是前缀
		expect(resolveTriggerQuery("即表示当前项目级", 0, idx)).toBeNull(); // 只是前缀
		expect(resolveTriggerQuery("一笔事务", 0, idx)?.text).toBe("事务"); // 短但被链接过
		expect(resolveTriggerQuery("这是总结", 0, idx)).toBeNull(); // 短且没被链接过
	});

	it("整段本身命中时优先整段，不退化到更短后缀", () => {
		expect(resolveTriggerQuery("交叉矩阵", 0, indexOf(["交叉矩阵", "矩阵"]))).toEqual({
			text: "交叉矩阵",
			start: 0,
			query: "交叉矩阵",
		});
	});

	it("整段与各级后缀全落空：返回 null（让路给原生补全）", () => {
		expect(resolveTriggerQuery("一个交叉矩阵", 5, indexOf(["事务"]))).toBeNull();
	});

	it("光标在行中间（「一个交叉矩阵|拆成」）：只看光标之前的文字，照样命中", () => {
		const line = "一个交叉矩阵拆成";
		const extracted = extractTriggerToken(line.slice(0, 6)); // 「阵」之后、「拆」之前
		expect(extracted).toEqual({ token: "一个交叉矩阵", start: 0 });
		expect(
			resolveTriggerQuery(extracted!.token, extracted!.start, indexOf(["交叉矩阵"])),
		).toEqual({ text: "交叉矩阵", start: 2, query: "交叉矩阵" });
	});

	it("查询串已归一化（大小写/全角）后再交给索引", () => {
		const seen: string[] = [];
		const hit = resolveTriggerQuery("ｘｘAPPENDIX", 0, {
			hasAnyPrefixMatch: (q) => {
				seen.push(q);
				return false;
			},
			hasExactMatch: (q) => q === "appendix",
			isLinked: () => false,
		});
		expect(hit).toEqual({ text: "APPENDIX", start: 2, query: "appendix" });
		expect(seen[0]).toBe("xxappendix"); // NFKC 折全角 + 小写
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

	it("Q34：完整命中 → 被链接多 → 当前文件 → 短 → path", () => {
		const entries = [
			entry({ matchKey: "交叉矩阵与其应用", path: "c.md" }),
			entry({ matchKey: "交叉矩阵乘法", path: "d.md" }),
			entry({ matchKey: "交叉矩阵", path: "b.md" }),
			entry({ matchKey: "交叉矩阵", path: "here.md" }),
		];
		const links: Record<string, number> = { 交叉矩阵乘法: 3 };
		const sorted = sortEntries(entries, "交叉矩阵", {
			linkCount: (k) => links[k] ?? 0,
			activePath: "here.md",
		});
		expect(sorted.map((e) => `${e.path}:${e.matchKey}`)).toEqual([
			"here.md:交叉矩阵", // 完整命中 + 当前文件
			"b.md:交叉矩阵", // 完整命中
			"d.md:交叉矩阵乘法", // 被链接 3 次，压过更短的
			"c.md:交叉矩阵与其应用",
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

	it("重名文件：用调用方给的链接文本（路径），不然会链到另一篇同名笔记（Q47）", () => {
		const e = entry({ path: "甲科技/02-速查卡.md", basename: "02-速查卡" });
		expect(buildHeadingLink(e, "x.md", "甲科技/02-速查卡")).toBe(
			"[[甲科技/02-速查卡#交叉矩阵|交叉矩阵]]",
		);
		// 同文件仍省略文件名，与链接文本无关
		expect(buildHeadingLink(e, "甲科技/02-速查卡.md", "甲科技/02-速查卡")).toBe(
			"[[#交叉矩阵|交叉矩阵]]",
		);
	});

	it("已编号标题：锚点保留 WORD_JOINER（与 backlinks.ts displayAnchor 一致）", () => {
		const wj = "\u2060";
		expect(buildHeadingLink(entry({ anchor: `1.1 ${wj}交叉矩阵` }), "notes/a.md")).toBe(
			`[[#1.1 ${wj}交叉矩阵|交叉矩阵]]`,
		);
	});
});
