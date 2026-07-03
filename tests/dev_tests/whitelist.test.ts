/**
 * 白名单系统测试（Milestone 4，对应 testplan D 类）。
 *
 * 覆盖：归一化（剥前缀 → 去行内 Markdown → NFKC → trim/折叠空白 → 小写）、三种匹配方式
 * （exact/partial/subtree）的命中与子树范围、「取豁免范围最大者」的并集、豁免即去号，以及
 * 设置面板用的 {@link analyzeWhitelist}（命中数 + 含子标题告警）。
 */

import { describe, expect, it } from "vitest";
import {
	analyzeWhitelist,
	computeWhitelistExemptions,
	DEFAULT_TEMPLATE,
	filterSortWhitelist,
	WORD_JOINER,
	normalizeForWhitelist,
	numberHeadings,
	renumberContent,
	type Template,
	type WhitelistEntry,
} from "../../src/numbering";
import { parseHeadings } from "../../src/parser";

/** 以默认模板为基底、替换白名单，便于各场景独立配置。 */
function withWhitelist(whitelist: WhitelistEntry[]): Template {
	return { ...DEFAULT_TEMPLATE, whitelist };
}

/** 解析内容并按模板编号，返回每行的前缀（null = 未编号）。 */
function prefixes(content: string, template: Template): (string | null)[] {
	return numberHeadings(parseHeadings(content), template).map((h) => h.prefix);
}

describe("normalizeForWhitelist（白名单归一化）", () => {
	it("去除行内 Markdown 标记：粗体 / 斜体 / 下划线 / 代码", () => {
		expect(normalizeForWhitelist("**目录**")).toBe("目录");
		expect(normalizeForWhitelist("*目录*")).toBe("目录");
		expect(normalizeForWhitelist("_目录_")).toBe("目录");
		expect(normalizeForWhitelist("`目录`")).toBe("目录");
	});

	it("链接 [文字](url) 还原为「文字」", () => {
		expect(normalizeForWhitelist("[参考文献](https://x)")).toBe("参考文献");
	});

	it("NFKC 折叠全角空格、trim 与折叠内部空白", () => {
		// 全角空格 U+3000 → 普通空格，再被 trim/折叠。
		expect(normalizeForWhitelist("　目录　")).toBe("目录");
		expect(normalizeForWhitelist("  附录   A ")).toBe("附录 a");
	});

	it("拉丁字母统一转小写", () => {
		expect(normalizeForWhitelist("APPENDIX")).toBe("appendix");
		expect(normalizeForWhitelist("References")).toBe("references");
	});
});

describe("D1 / D7 — exact 命中：不写前缀、不占槽位、豁免即去号", () => {
	it("D1：exact 命中不占计数器槽位（下一个 H2 不跳号）", () => {
		const tpl = withWhitelist([{ text: "参考文献", match: "exact" }]);
		const content = ["# 标题", "## 章", "## 参考文献", "## 章"].join("\n");
		expect(prefixes(content, tpl)).toEqual([
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			null,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
		]);
	});

	it("D7：命中标题身上有插件写入的(带 WJ)旧编号 → 豁免时剥掉旧编号（去号）", () => {
		const tpl = withWhitelist([{ text: "目录", match: "exact" }]);
		// 方案A：白名单匹配前的剥离也只认 WJ；插件写过的 `## 1 ⁠目录` 剥到 WJ 后归一为「目录」→ 命中 → 去号。
		const out = renumberContent(`## ${WORD_JOINER}1 ${WORD_JOINER}目录`, tpl);
		expect(out).toBe("## 目录");
	});
});

describe("D2 — exact 命中的归一化健壮性", () => {
	const tpl = withWhitelist([{ text: "目录", match: "exact" }]);

	it("加粗 ## **目录** 仍命中", () => {
		expect(renumberContent("## **目录**", tpl)).toBe("## **目录**");
	});

	it("全角空格 ## 　目录　 仍命中（不编号；尾随空白按既有行为 trim）", () => {
		// 归一后命中 → 不写前缀；与普通编号一致地清理尾随空白（含全角空格）。
		expect(renumberContent("## 　目录　", tpl)).toBe("## 　目录");
	});

	it("尾随空格 ## 目录  仍命中（不编号）", () => {
		expect(renumberContent("## 目录  ", tpl)).toBe("## 目录");
	});

	it("非命中标题正常编号（## 目录说明 不等于 目录）", () => {
		expect(renumberContent("## 目录说明", tpl)).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}目录说明`,
		);
	});
});

describe("D3 — partial 部分匹配", () => {
	const tpl = withWhitelist([{ text: "附录", match: "partial" }]);

	it("## 附录 A / ## 技术附录 都命中（包含子串）", () => {
		const content = ["## 附录 A", "## 技术附录", "## 概述"].join("\n");
		expect(prefixes(content, tpl)).toEqual([null, null, `${WORD_JOINER}1 ${WORD_JOINER}`]);
	});
});

describe("D8 — 拉丁字母大小写不敏感", () => {
	it("## APPENDIX 命中条目 appendix", () => {
		const tpl = withWhitelist([{ text: "appendix", match: "exact" }]);
		expect(renumberContent("## APPENDIX", tpl)).toBe("## APPENDIX");
	});
});

describe("D4 — subtree 子树匹配", () => {
	const tpl = withWhitelist([{ text: "附录", match: "subtree" }]);

	it("根与整棵子树都不编号、不占槽位；块后计数器重置（决策 D1，0.7.10 起）", () => {
		const content = [
			"## 章", // 1
			"## 附录", // 子树根，豁免
			"### 数据表", // 子树内，豁免
			"#### 明细", // 子树内，豁免
			"## 小结", // 1（D1：子树块 = 独立结构，其后编号**重新开始**；0.7.10 前为 2）
		].join("\n");
		expect(prefixes(content, tpl)).toEqual([
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			null,
			null,
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
		]);
	});

	it("子树范围遇同级 / 更高级即终止", () => {
		const content = [
			"## 附录", // 根，豁免
			"### 子", // 更深，豁免
			"## 后续", // 同级，终止 → 正常编号
		].join("\n");
		expect(prefixes(content, tpl)).toEqual([null, null, `${WORD_JOINER}1 ${WORD_JOINER}`]);
	});
});

describe("D9/D10 — 子树块后计数器重置（决策 D1，spec §3.7）", () => {
	const tpl = withWhitelist([
		{ text: "附录", match: "subtree" },
		{ text: "索引", match: "subtree" },
		{ text: "目录", match: "exact" },
	]);

	it("D9：子树块后编号重新开始，子级层级也从头计（附录之后如新篇章）", () => {
		const content = [
			"## 方法", // 1
			"### 数据来源", // 1.1
			"## 结论", // 2
			"## 附录", // 子树根，豁免
			"### 图表", // 子树内，豁免
			"## 后续内容", // 1（重置后重新开始，而非 3）
			"### 我的补充", // 1.1（子级同样重开）
		].join("\n");
		expect(prefixes(content, tpl)).toEqual([
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			`${WORD_JOINER}1.1 ${WORD_JOINER}`,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
			null,
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			`${WORD_JOINER}1.1 ${WORD_JOINER}`,
		]);
	});

	it("D10：多个子树块间隔出现，每块之后都正确重开", () => {
		const content = [
			"## 甲", // 1
			"## 乙", // 2
			"## 附录", // 子树块 1
			"## 索引", // 子树块 2（与前块相邻，同为豁免）
			"## 丙", // 1（重开）
			"## 丁", // 2
		].join("\n");
		expect(prefixes(content, tpl)).toEqual([
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
			null,
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
		]);
	});

	it("对照：exact / partial 单标题豁免**不**触发重置（沿用计数、不跳号）", () => {
		const content = [
			"## 甲", // 1
			"## 目录", // exact 豁免，不占槽位、不重置
			"## 乙", // 2（沿用）
		].join("\n");
		expect(prefixes(content, tpl)).toEqual([
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			null,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
		]);
	});

	it("子树块与下一编号标题之间夹 exact 豁免：重置语义不被打断", () => {
		const content = [
			"## 甲", // 1
			"## 附录", // 子树块
			"### 子", // 子树内
			"## 目录", // exact 豁免（透明，不清除待重置标记）
			"## 乙", // 1（仍重开）
		].join("\n");
		expect(prefixes(content, tpl)).toEqual([
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			null,
			null,
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
		]);
	});

	it("幂等：带 D1 重置的文档反复重排结果稳定", () => {
		const content = ["## 甲", "## 附录", "### 子", "## 乙"].join("\n");
		const once = renumberContent(content, tpl);
		expect(renumberContent(once, tpl)).toBe(once);
	});
});

describe("D6 — 多条目命中同一标题取并集（子树 > 全部）", () => {
	it("同一标题被 exact + subtree 命中 → 整棵子树豁免", () => {
		const tpl = withWhitelist([
			{ text: "附录", match: "exact" },
			{ text: "附录", match: "subtree" },
		]);
		const content = ["## 附录", "### 子", "## 后续"].join("\n");
		// subtree 取胜：附录及其子标题都豁免；后续正常编号。
		expect(prefixes(content, tpl)).toEqual([null, null, `${WORD_JOINER}1 ${WORD_JOINER}`]);
	});

	it("computeWhitelistExemptions 返回根 + 子树全部标题", () => {
		const tpl = withWhitelist([{ text: "附录", match: "subtree" }]);
		const headings = parseHeadings(["## 附录", "### 子", "#### 孙", "## 别的"].join("\n"));
		const exempt = computeWhitelistExemptions(headings, tpl);
		expect(exempt.has(headings[0])).toBe(true); // 附录
		expect(exempt.has(headings[1])).toBe(true); // 子
		expect(exempt.has(headings[2])).toBe(true); // 孙
		expect(exempt.has(headings[3])).toBe(false); // 别的（同级，子树外）
	});
});

describe("默认模板：预填充中英结构性词表自动生效", () => {
	it("摘要 / 致谢 / References / Abstract 等不被编号", () => {
		const content = [
			"## 摘要", // 命中，豁免
			"## 概述", // 1
			"## References", // 命中，豁免
			"## 详情", // 2
		].join("\n");
		expect(prefixes(content, DEFAULT_TEMPLATE)).toEqual([
			null,
			`${WORD_JOINER}1 ${WORD_JOINER}`,
			null,
			`${WORD_JOINER}2 ${WORD_JOINER}`,
		]);
	});

	it("默认词表含 16 条（中英各 8）", () => {
		expect(DEFAULT_TEMPLATE.whitelist).toHaveLength(16);
		expect(DEFAULT_TEMPLATE.whitelist.every((e) => e.match === "exact")).toBe(true);
	});
});

describe("analyzeWhitelist（设置面板命中预览 + ⚠ 告警）", () => {
	it("逐条命中数 + 豁免并集顺序", () => {
		const tpl = withWhitelist([
			{ text: "目录", match: "exact" },
			{ text: "附录", match: "partial" },
		]);
		const headings = parseHeadings(
			["## 目录", "## 附录 A", "## 技术附录", "## 正文"].join("\n"),
		);
		const res = analyzeWhitelist(headings, tpl);
		expect(res.perEntry[0].count).toBe(1); // 目录
		expect(res.perEntry[1].count).toBe(2); // 附录 A + 技术附录
		expect(res.exempted.map((h) => h.text)).toEqual(["目录", "附录 A", "技术附录"]);
	});

	it("L19：perEntry.matches 列出各条命中标题的展示文本（剥前缀、按出现顺序、与 count 等长）", () => {
		const tpl = withWhitelist([
			{ text: "目录", match: "exact" },
			{ text: "附录", match: "partial" },
			{ text: "不存在", match: "exact" },
		]);
		// 「目录」带旧编号前缀（WJ 边界），matches 应给剥净后的展示文本。
		const headings = parseHeadings(
			[`## ${WORD_JOINER}1 ${WORD_JOINER}目录`, "## 附录 A", "## 技术附录"].join("\n"),
		);
		const res = analyzeWhitelist(headings, tpl);
		expect(res.perEntry[0].matches).toEqual(["目录"]);
		expect(res.perEntry[1].matches).toEqual(["附录 A", "技术附录"]);
		expect(res.perEntry[2].matches).toEqual([]);
		res.perEntry.forEach((hit) => expect(hit.matches.length).toBe(hit.count));
	});

	it("全部 / 部分命中且含子标题 → warnHasChildren=true；子树则不告警", () => {
		const headings = parseHeadings(["## 附录", "### 数据表"].join("\n"));
		const exactRes = analyzeWhitelist(
			headings,
			withWhitelist([{ text: "附录", match: "exact" }]),
		);
		expect(exactRes.perEntry[0].warnHasChildren).toBe(true);

		const subtreeRes = analyzeWhitelist(
			headings,
			withWhitelist([{ text: "附录", match: "subtree" }]),
		);
		expect(subtreeRes.perEntry[0].warnHasChildren).toBe(false);
	});
});

describe("filterSortWhitelist（编辑器搜索 / 排序纯视图，M8 批次 1，testplan L14/L15）", () => {
	const entries: WhitelistEntry[] = [
		{ text: "目录", match: "exact" },
		{ text: "Appendix", match: "subtree" },
		{ text: "附录 A", match: "partial" },
		{ text: "abstract", match: "exact" },
	];

	it("空搜索词 + 添加顺序：原样返回，视图携带原始下标", () => {
		const views = filterSortWhitelist(entries, "", "added");
		expect(views.map((v) => v.index)).toEqual([0, 1, 2, 3]);
		expect(views.map((v) => v.entry.text)).toEqual(["目录", "Appendix", "附录 A", "abstract"]);
	});

	it("过滤与命中判定同一套归一化：小写 / 全角折叠均能匹配", () => {
		// 小写搜索命中「Appendix」（大小写不敏感）。
		expect(filterSortWhitelist(entries, "appendix", "added").map((v) => v.index)).toEqual([1]);
		// 全角字符 NFKC 折叠后命中（Ａ → A）。
		expect(filterSortWhitelist(entries, "Ａ", "added").map((v) => v.entry.text)).toEqual([
			"Appendix",
			"附录 A",
			"abstract",
		]);
		// 中文子串。
		expect(filterSortWhitelist(entries, "附录", "added").map((v) => v.index)).toEqual([2]);
		// 无匹配 → 空数组。
		expect(filterSortWhitelist(entries, "不存在", "added")).toEqual([]);
	});

	it("A–Z 排序按 localeCompare，携带原始下标不变", () => {
		const views = filterSortWhitelist(
			[
				{ text: "banana", match: "exact" },
				{ text: "Apple", match: "exact" },
				{ text: "cherry", match: "exact" },
			],
			"",
			"az",
		);
		expect(views.map((v) => v.entry.text)).toEqual(["Apple", "banana", "cherry"]);
		expect(views.map((v) => v.index)).toEqual([1, 0, 2]);
	});

	it("按匹配方式排序：全部 → 部分 → 子树 分组，组内保持添加序（稳定）", () => {
		const views = filterSortWhitelist(entries, "", "match");
		expect(views.map((v) => v.entry.match)).toEqual(["exact", "exact", "partial", "subtree"]);
		// exact 组内保持添加序：目录(0) 在 abstract(3) 前。
		expect(views.map((v) => v.index)).toEqual([0, 3, 2, 1]);
	});

	it("过滤 + 排序组合，且绝不改动传入数组", () => {
		const snapshot = entries.map((e) => ({ ...e }));
		const views = filterSortWhitelist(entries, "a", "az"); // 命中 Appendix / 附录 A / abstract
		expect(views.map((v) => v.entry.text)).toEqual(["abstract", "Appendix", "附录 A"]);
		expect(entries).toEqual(snapshot); // 存储数组原样
	});
});
