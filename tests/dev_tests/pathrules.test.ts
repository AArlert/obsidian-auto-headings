/**
 * 路径规则解析的单元测试（Milestone 5，见 src/pathrules.ts 与 spec.md §3.8）。
 *
 * 覆盖：匹配判定（根 / 文件夹 / 文件）、具体度排序（文件 ＞ 最长文件夹前缀 ＞ 根）、
 * 并列取靠后、无命中返回 null、归一化（反斜杠 / 前导斜杠 / 多斜杠）、hasRootRule。
 * 对应 testplan §K（路径规则）。
 */
import { describe, expect, it } from "vitest";
import {
	autocompleteFolderSlash,
	browseDirForInput,
	filterPathCandidates,
	findDuplicatePatternIndex,
	hasRootRule,
	listImmediateChildren,
	parentDir,
	type PathCandidate,
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

describe("filterPathCandidates（testplan K13：路径建议弹窗排序）", () => {
	const candidates: PathCandidate[] = [
		{ path: "Projects", isFolder: true },
		{ path: "My Projects", isFolder: true },
		{ path: "Projects/todo.md", isFolder: false },
		{ path: "Archive", isFolder: true },
	];

	it("空输入：返回全部候选（截至 limit），不过滤", () => {
		expect(filterPathCandidates(candidates, "")).toHaveLength(4);
	});

	it("大小写不敏感子串匹配", () => {
		const result = filterPathCandidates(candidates, "PROJ");
		expect(result.map((c) => c.path)).toEqual(
			expect.arrayContaining(["Projects", "My Projects", "Projects/todo.md"]),
		);
		expect(result.some((c) => c.path === "Archive")).toBe(false);
	});

	it("排序：命中位置越靠前越优先", () => {
		const result = filterPathCandidates(candidates, "proj");
		// "Projects" 与 "Projects/todo.md" 命中位置为 0；"My Projects" 命中位置为 3。
		expect(result[0].path === "Projects" || result[0].path === "Projects/todo.md").toBe(true);
		expect(result[result.length - 1].path).toBe("My Projects");
	});

	it("位置并列时文件夹优先于文件", () => {
		const result = filterPathCandidates(candidates, "projects");
		const idxFolder = result.findIndex((c) => c.path === "Projects");
		const idxFile = result.findIndex((c) => c.path === "Projects/todo.md");
		expect(idxFolder).toBeLessThan(idxFile);
	});

	it("limit 截断结果数量", () => {
		expect(filterPathCandidates(candidates, "", 2)).toHaveLength(2);
	});

	it("testplan K14：前导 / 被剥离，不当作字面字符匹配（否则顶层文件夹会被错误排除）", () => {
		// "/" 只是根锚点写法（呼应 normalizePattern），不应收窄成「候选路径本身含字面斜杠」的子集，
		// 否则会复现用户报告的症状：提交根规则 `/` 后重新点击输入框，顶层文件夹全部从建议里消失。
		const withLeadingSlash = filterPathCandidates(candidates, "/proj");
		const withoutLeadingSlash = filterPathCandidates(candidates, "proj");
		expect(withLeadingSlash.map((c) => c.path)).toEqual(withoutLeadingSlash.map((c) => c.path));
		expect(withLeadingSlash.some((c) => c.path === "Projects")).toBe(true);
	});
});

describe("autocompleteFolderSlash（testplan K13：用户报告 bug——手动输入文件夹路径漏打尾斜杠）", () => {
	const folderPaths = ["Projects", "Projects/sub", "读书笔记"];

	it("输入恰好等于某真实文件夹路径（未带尾斜杠）：自动补全", () => {
		expect(autocompleteFolderSlash("Projects", folderPaths)).toBe("Projects/");
		expect(autocompleteFolderSlash("读书笔记", folderPaths)).toBe("读书笔记/");
	});

	it("已带尾斜杠：原样返回，不重复添加", () => {
		expect(autocompleteFolderSlash("Projects/", folderPaths)).toBe("Projects/");
	});

	it("不对应任何真实文件夹（如指向具体文件，或尚未创建的文件夹）：原样返回", () => {
		expect(autocompleteFolderSlash("读书笔记/深度工作.md", folderPaths)).toBe(
			"读书笔记/深度工作.md",
		);
		expect(autocompleteFolderSlash("尚不存在的文件夹", folderPaths)).toBe("尚不存在的文件夹");
	});

	it("未配置的空串：原样返回", () => {
		expect(autocompleteFolderSlash("", folderPaths)).toBe("");
		expect(autocompleteFolderSlash("   ", folderPaths)).toBe("   ");
	});

	it("前导斜杠 / 反斜杠归一化后仍能识别对应的真实文件夹", () => {
		expect(autocompleteFolderSlash("/Projects", folderPaths)).toBe("/Projects/");
		expect(autocompleteFolderSlash("Projects\\sub", folderPaths)).toBe("Projects\\sub/");
	});
});

describe("parentDir（testplan K14：路径建议弹窗分层浏览）", () => {
	it('顶层项（路径本身不含 /）：父目录是根 ""', () => {
		expect(parentDir("Projects")).toBe("");
		expect(parentDir("top.md")).toBe("");
	});

	it("嵌套项：父目录是去掉最后一段的前缀", () => {
		expect(parentDir("Projects/Sub")).toBe("Projects");
		expect(parentDir("Projects/Sub/note.md")).toBe("Projects/Sub");
	});
});

describe("listImmediateChildren（testplan K14：路径建议弹窗分层浏览）", () => {
	const candidates: PathCandidate[] = [
		{ path: "Projects", isFolder: true },
		{ path: "Projects/Sub", isFolder: true },
		{ path: "Projects/Sub/note.md", isFolder: false },
		{ path: "Projects/todo.md", isFolder: false },
		{ path: "Archive", isFolder: true },
		{ path: "top.md", isFolder: false },
	];

	it('根目录（""）：只列出顶层项，不含更深层的嵌套项', () => {
		const result = listImmediateChildren(candidates, "");
		expect(result.map((c) => c.path)).toEqual(["Archive", "Projects", "top.md"]);
	});

	it("某文件夹：只列出该文件夹的直接子项，不含其孙项", () => {
		const result = listImmediateChildren(candidates, "Projects");
		expect(result.map((c) => c.path)).toEqual(["Projects/Sub", "Projects/todo.md"]);
	});

	it("排序：文件夹优先于文件，同类按字典序", () => {
		const result = listImmediateChildren(candidates, "");
		expect(result[0].isFolder).toBe(true);
		expect(result[result.length - 1].isFolder).toBe(false);
	});

	it("空文件夹（无直接子项）：返回空数组", () => {
		expect(listImmediateChildren(candidates, "Projects/Sub/note.md")).toEqual([]);
		expect(listImmediateChildren(candidates, "Archive")).toEqual([]);
	});
});

describe("browseDirForInput（testplan K14：re-click 已配置行仍进分层浏览，不回落扁平搜索）", () => {
	const folderPaths = ["Projects", "Projects/Sub", "读书笔记"];

	it('空 / 纯空白：浏览根 ""', () => {
		expect(browseDirForInput("", folderPaths)).toBe("");
		expect(browseDirForInput("   ", folderPaths)).toBe("");
	});

	it('根写法（/、//、\\）归一化后都浏览根 ""', () => {
		expect(browseDirForInput("/", folderPaths)).toBe("");
		expect(browseDirForInput("//", folderPaths)).toBe("");
		expect(browseDirForInput("\\", folderPaths)).toBe("");
	});

	it("已配置的真实文件夹（尾斜杠）：浏览进该文件夹（用户报告的核心场景）", () => {
		expect(browseDirForInput("Projects/", folderPaths)).toBe("Projects");
		expect(browseDirForInput("Projects/Sub/", folderPaths)).toBe("Projects/Sub");
		expect(browseDirForInput("读书笔记/", folderPaths)).toBe("读书笔记");
	});

	it("前导斜杠 / 反斜杠写法的真实文件夹也识别", () => {
		expect(browseDirForInput("/Projects/", folderPaths)).toBe("Projects");
		expect(browseDirForInput("Projects\\Sub\\", folderPaths)).toBe("Projects/Sub");
	});

	it("正在打字的片段（无尾斜杠）：null → 交给扁平搜索", () => {
		expect(browseDirForInput("Pro", folderPaths)).toBeNull();
		expect(browseDirForInput("Projects", folderPaths)).toBeNull();
	});

	it("文件规则（无尾斜杠）：null → 交给扁平搜索", () => {
		expect(browseDirForInput("读书笔记/深度工作.md", folderPaths)).toBeNull();
	});

	it("尾斜杠但不是真实文件夹（新建时手输、或已删除）：null → 交给扁平搜索", () => {
		expect(browseDirForInput("尚不存在/", folderPaths)).toBeNull();
	});
});
