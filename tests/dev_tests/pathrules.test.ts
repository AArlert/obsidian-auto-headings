/**
 * 路径规则解析的单元测试（Milestone 5，见 src/pathrules.ts 与 spec.md §3.8）。
 *
 * 覆盖：匹配判定（根 / 文件夹 / 文件）、具体度排序（文件 ＞ 最长文件夹前缀 ＞ 根）、
 * 并列取靠后、无命中返回 null、归一化（反斜杠 / 前导斜杠 / 多斜杠）、hasRootRule。
 * 对应 testplan §K（路径规则）。
 */
import { describe, expect, it } from "vitest";
import {
	findDuplicatePatternIndex,
	hasRootRule,
	type PathRule,
	resolvePathRule,
	ruleMatches,
	ruleSpecificity,
} from "../../src/pathrules";

describe("ruleMatches", () => {
	it("根 / 匹配所有文件", () => {
		expect(ruleMatches("/", "a.md")).toBe(true);
		expect(ruleMatches("/", "deep/nested/note.md")).toBe(true);
	});

	it("文件夹规则匹配其下全部文件（含深层）", () => {
		expect(ruleMatches("Projects/", "Projects/a.md")).toBe(true);
		expect(ruleMatches("Projects/", "Projects/sub/b.md")).toBe(true);
		expect(ruleMatches("Projects/", "Other/a.md")).toBe(false);
		// 前缀相同但不在文件夹内（无分隔斜杠）不应误命中。
		expect(ruleMatches("Proj/", "Projects/a.md")).toBe(false);
	});

	it("文件规则仅精确匹配", () => {
		expect(ruleMatches("读书笔记/深度工作.md", "读书笔记/深度工作.md")).toBe(true);
		expect(ruleMatches("读书笔记/深度工作.md", "读书笔记/其它.md")).toBe(false);
	});

	it("归一化：反斜杠 / 前导斜杠 / 重复斜杠", () => {
		expect(ruleMatches("Projects\\", "Projects/a.md")).toBe(true);
		expect(ruleMatches("/Projects/", "Projects/a.md")).toBe(true);
		expect(ruleMatches("Projects//", "Projects/a.md")).toBe(true);
		expect(ruleMatches("Projects/", "/Projects/a.md")).toBe(true);
	});

	it("空串（未配置）不匹配任何文件，与根 / 严格区分（testplan K11）", () => {
		expect(ruleMatches("", "a.md")).toBe(false);
		expect(ruleMatches("", "deep/nested/note.md")).toBe(false);
		expect(ruleMatches("   ", "a.md")).toBe(false);
	});
});

describe("ruleSpecificity", () => {
	it("根 < 文件夹 < 文件", () => {
		expect(ruleSpecificity("/")).toBe(0);
		expect(ruleSpecificity("Projects/")).toBeLessThan(ruleSpecificity("a/b.md"));
		expect(ruleSpecificity("/")).toBeLessThan(ruleSpecificity("Projects/"));
	});

	it("更长（更深）的文件夹前缀更具体", () => {
		expect(ruleSpecificity("a/b/c/")).toBeGreaterThan(ruleSpecificity("a/"));
	});
});

describe("resolvePathRule", () => {
	const rules: PathRule[] = [
		{ pattern: "/", template: "默认" },
		{ pattern: "Projects/", template: "技术文档" },
		{ pattern: "Projects/sub/", template: "深层" },
		{ pattern: "Projects/sub/special.md", template: "专属" },
	];

	it("精确文件规则胜过文件夹与根", () => {
		expect(resolvePathRule(rules, "Projects/sub/special.md")?.template).toBe("专属");
	});

	it("最长文件夹前缀优先", () => {
		expect(resolvePathRule(rules, "Projects/sub/other.md")?.template).toBe("深层");
		expect(resolvePathRule(rules, "Projects/top.md")?.template).toBe("技术文档");
	});

	it("仅根规则兜底", () => {
		expect(resolvePathRule(rules, "随手记/x.md")?.template).toBe("默认");
	});

	it("无任何规则匹配 → null", () => {
		expect(resolvePathRule([], "a.md")).toBeNull();
		// 删掉根规则后，不在任何文件夹内的文件无命中。
		const noRoot: PathRule[] = [{ pattern: "Projects/", template: "技术文档" }];
		expect(resolvePathRule(noRoot, "随手记/x.md")).toBeNull();
	});

	it("具体度并列（两条不同文件夹名恰好等长）时，列表中靠后的规则胜出（testplan K5）", () => {
		const tie: PathRule[] = [
			{ pattern: "Ab/", template: "A" },
			{ pattern: "Cd/", template: "B" },
		];
		expect(resolvePathRule(tie, "Cd/x.md")?.template).toBe("B");
		expect(resolvePathRule(tie, "Ab/x.md")?.template).toBe("A");
	});

	it("遗留/异常数据下路径模式完全重复，仍可确定性解析（GUI 已阻断新建，见 findDuplicatePatternIndex）", () => {
		const dup: PathRule[] = [
			{ pattern: "Notes/", template: "A" },
			{ pattern: "Notes/", template: "B" },
		];
		expect(resolvePathRule(dup, "Notes/x.md")?.template).toBe("B");
	});

	it("新增未填路径的规则（空串）不参与解析，不影响既有根规则命中（testplan K11）", () => {
		const withBlankRow: PathRule[] = [
			{ pattern: "/", template: "默认" },
			{ pattern: "", template: "刚选的新模板" },
		];
		expect(resolvePathRule(withBlankRow, "随手记/x.md")?.template).toBe("默认");
	});
});

describe("hasRootRule", () => {
	it("识别 / 根规则（含归一化写法）", () => {
		expect(hasRootRule([{ pattern: "/", template: "默认" }])).toBe(true);
		expect(hasRootRule([{ pattern: "Projects/", template: "技术文档" }])).toBe(false);
		expect(hasRootRule([])).toBe(false);
	});

	it("未填路径的规则（空串）不算根规则（testplan K11）", () => {
		expect(hasRootRule([{ pattern: "", template: "刚选的新模板" }])).toBe(false);
	});
});

describe("findDuplicatePatternIndex（testplan K12：GUI 阻断重复路径）", () => {
	it("无重复 → -1", () => {
		const rules: PathRule[] = [
			{ pattern: "/", template: "默认" },
			{ pattern: "Projects/", template: "技术文档" },
		];
		expect(findDuplicatePatternIndex(rules, 0)).toBe(-1);
		expect(findDuplicatePatternIndex(rules, 1)).toBe(-1);
	});

	it("两条规则同填根 / → 互相报告对方下标", () => {
		const rules: PathRule[] = [
			{ pattern: "/", template: "A" },
			{ pattern: "/", template: "B" },
		];
		expect(findDuplicatePatternIndex(rules, 1)).toBe(0);
		expect(findDuplicatePatternIndex(rules, 0)).toBe(1);
	});

	it("文件夹 / 文件路径重复同样检出，不止根 /", () => {
		const rules: PathRule[] = [
			{ pattern: "Projects/", template: "A" },
			{ pattern: "读书笔记/深度工作.md", template: "B" },
			{ pattern: "/Projects", template: "C" }, // 归一化后与下标0相同（去前导斜杠不影响文件夹尾斜杠）
			{ pattern: "读书笔记/深度工作.md", template: "D" },
		];
		// 下标2实际归一化为 "Projects"（无尾斜杠，视为文件规则），与下标0（文件夹 "Projects/"）不重复。
		expect(findDuplicatePatternIndex(rules, 2)).toBe(-1);
		expect(findDuplicatePatternIndex(rules, 1)).toBe(3);
		expect(findDuplicatePatternIndex(rules, 3)).toBe(1);
	});

	it("未配置的空串不参与判定，多条空串行互不冲突", () => {
		const rules: PathRule[] = [
			{ pattern: "", template: "A" },
			{ pattern: "", template: "B" },
		];
		expect(findDuplicatePatternIndex(rules, 0)).toBe(-1);
		expect(findDuplicatePatternIndex(rules, 1)).toBe(-1);
	});

	it("归一化后等价（反斜杠/前导斜杠/多斜杠）也算重复", () => {
		const rules: PathRule[] = [
			{ pattern: "Projects/", template: "A" },
			{ pattern: "/Projects//", template: "B" },
		];
		expect(findDuplicatePatternIndex(rules, 1)).toBe(0);
	});
});
