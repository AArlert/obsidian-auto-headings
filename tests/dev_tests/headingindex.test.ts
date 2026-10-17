/**
 * M13 标题索引（headingindex.ts）纯函数 + 内存索引单测（对应 testplan Q 类的逻辑部分：
 * Q1 关闭即零成本 / Q2 剥前缀原文 / Q3 前缀匹配 / Q6 多文件同名 / Q16 截断 / Q18 改名删除）。
 *
 * 无 obsidian 运行时依赖（headingindex.ts 只 import ./parser ./strip ./backlinks ./whitelist），
 * 不需要 obsidian-mock.ts。
 */
import { describe, expect, it } from "vitest";
import { WORD_JOINER } from "../../src/numbering";
import {
	GENERIC_FILE_COUNT,
	HeadingIndex,
	buildEntriesForFile,
	isExcalidrawFile,
} from "../../src/headingindex";

/** 构造插件默认模板写入后的已编号标题行（render.ts buildPrefix 的字节形态）。 */
const numbered = (num: string, title: string) => `## ${WORD_JOINER}${num} ${WORD_JOINER}${title}`;

describe("buildEntriesForFile：标题解析与剥前缀", () => {
	it("普通标题：displayText 与原文一致，matchKey 归一化（去 Markdown、转小写）", () => {
		const entries = buildEntriesForFile("a.md", "a", "# 文档\n## **章**一\n### 节");
		expect(entries.map((e) => e.displayText)).toEqual(["文档", "**章**一", "节"]);
		expect(entries[1].matchKey).toBe("章一"); // ** 被 normalizeForWhitelist 剥掉
		expect(entries[1].anchor).toBe("**章**一"); // displayAnchor 保留原文（仅去非法字符）
		expect(entries[0].level).toBe(1);
		expect(entries[2].level).toBe(3);
		expect(entries.map((e) => e.lineIndex)).toEqual([0, 1, 2]);
	});

	it("已编号标题：displayText 剥净前缀，anchor 保留 WORD_JOINER（Q2 逻辑面）", () => {
		const entries = buildEntriesForFile("a.md", "a", `${numbered("1.1", "交叉矩阵")}\n正文`);
		expect(entries).toHaveLength(1);
		expect(entries[0].displayText).toBe("交叉矩阵");
		expect(entries[0].matchKey).toBe("交叉矩阵");
		// render.ts buildPrefix 的字节形态：首尾各一个 WJ，displayAnchor 原样保留。
		expect(entries[0].anchor).toBe(`${WORD_JOINER}1.1 ${WORD_JOINER}交叉矩阵`);
	});

	it("空标题（仅编号无文本）跳过", () => {
		const entries = buildEntriesForFile("a.md", "a", `${numbered("1.1", "")}\n## 有内容`);
		expect(entries.map((e) => e.displayText)).toEqual(["有内容"]);
	});

	it("围栏代码块与注释块内的假标题被跳过（复用 parseHeadings）", () => {
		const content = [
			"## 真标题",
			"```ts",
			"# 假标题一",
			"```",
			"%%",
			"# 假标题二",
			"%%",
			"<!--",
			"# 假标题三",
			"-->",
			"## 真标题二",
		].join("\n");
		const entries = buildEntriesForFile("a.md", "a", content);
		expect(entries.map((e) => e.displayText)).toEqual(["真标题", "真标题二"]);
	});

	it("白名单豁免的标题照常收录（索引与编号引擎解耦）", () => {
		const entries = buildEntriesForFile("a.md", "a", "## 附录\n## 目录");
		expect(entries.map((e) => e.displayText)).toEqual(["附录", "目录"]);
	});

	it("单文件标题数超过 MAX_HEADINGS_PER_FILE（500）时截断", () => {
		const lines: string[] = [];
		for (let i = 0; i < 510; i++) {
			lines.push(`## 标题${i}`);
		}
		const entries = buildEntriesForFile("a.md", "a", lines.join("\n"));
		expect(entries).toHaveLength(500);
	});
});

describe("HeadingIndex：loadInitial / 查询", () => {
	it("loadInitial 收录全部文件并按 matchKey 升序排序", () => {
		const idx = new HeadingIndex();
		idx.loadInitial([
			{ path: "a.md", basename: "a", content: "## 交叉矩阵" },
			{ path: "b.md", basename: "b", content: "## 应用\n## 交叉验证" },
		]);
		expect(idx.size).toBe(3);
		expect(idx.hasAnyPrefixMatch("交叉")).toBe(true);
		expect(idx.hasAnyPrefixMatch("应用")).toBe(true);
		expect(idx.hasAnyPrefixMatch("不存在的标题")).toBe(false);
		// 前缀查询按 matchKey 字典序（中文按 UTF-16 code unit，稳定全序即可）
		expect(idx.queryPrefix("交", 10).map((e) => e.displayText)).toEqual([
			"交叉矩阵",
			"交叉验证",
		]);
	});

	it("hasExactMatch：只认 matchKey 完全相等，前缀不算（Q28 行内后缀触发）", () => {
		const idx = new HeadingIndex();
		idx.loadInitial([
			{ path: "a.md", basename: "a", content: "## 交叉矩阵\n## 交叉矩阵与其应用" },
		]);
		expect(idx.hasExactMatch("交叉矩阵")).toBe(true);
		expect(idx.hasExactMatch("交叉矩")).toBe(false);
		expect(idx.hasExactMatch("交叉矩阵与")).toBe(false);
		expect(idx.hasExactMatch("")).toBe(false);
	});

	it("queryPrefix 空查询返回空、limit 生效", () => {
		const idx = new HeadingIndex();
		idx.loadInitial([{ path: "a.md", basename: "a", content: "## 甲\n## 乙\n## 丙" }]);
		expect(idx.queryPrefix("", 10)).toEqual([]);
		expect(idx.queryPrefix("甲", 1)).toHaveLength(1);
	});

	it("多文件同名标题：全部收录、path 次级排序确定", () => {
		const idx = new HeadingIndex();
		idx.loadInitial([
			{ path: "z.md", basename: "z", content: "## 同名" },
			{ path: "a.md", basename: "a", content: "## 同名" },
		]);
		expect(idx.size).toBe(2);
		expect(idx.queryPrefix("同名", 10).map((e) => e.path)).toEqual(["a.md", "z.md"]);
	});

	it("loadInitial 超过上限：后续文件不再收录、置 truncated（Q16 逻辑面）", () => {
		const idx = new HeadingIndex(3);
		idx.loadInitial([
			{ path: "a.md", basename: "a", content: "## 甲\n## 乙" },
			{ path: "b.md", basename: "b", content: "## 丙\n## 丁" },
			{ path: "c.md", basename: "c", content: "## 戊" },
		]);
		expect(idx.size).toBe(3);
		expect(idx.isTruncated).toBe(true);
		expect(idx.hasAnyPrefixMatch("丁")).toBe(false); // b.md 超限部分未收录
		expect(idx.hasAnyPrefixMatch("戊")).toBe(false); // c.md 整体未收录
		expect(idx.hasAnyPrefixMatch("丙")).toBe(true);
	});
});

describe("HeadingIndex：增量更新（setFile / removeFile / renameFile）", () => {
	it("setFile 新增文件后立即可查，再次 setFile 替换旧条目（Q18 逻辑面）", () => {
		const idx = new HeadingIndex();
		idx.setFile("a.md", "a", "## 旧标题");
		expect(idx.size).toBe(1);
		idx.setFile("a.md", "a", "## 新标题\n## 第二");
		expect(idx.size).toBe(2);
		expect(idx.hasAnyPrefixMatch("旧标题")).toBe(false);
		expect(idx.hasAnyPrefixMatch("新标题")).toBe(true);
	});

	it("setFile 超过上限时按余量截断并置 truncated", () => {
		const idx = new HeadingIndex(3);
		idx.setFile("a.md", "a", "## 甲\n## 乙");
		idx.setFile("b.md", "b", "## 丙\n## 丁");
		expect(idx.size).toBe(3);
		expect(idx.isTruncated).toBe(true);
		expect(idx.hasAnyPrefixMatch("丙")).toBe(true);
		expect(idx.hasAnyPrefixMatch("丁")).toBe(false);
	});

	it("removeFile 删除后条目消失、size 回落", () => {
		const idx = new HeadingIndex();
		idx.setFile("a.md", "a", "## 甲");
		idx.setFile("b.md", "b", "## 乙");
		idx.removeFile("a.md");
		expect(idx.size).toBe(1);
		expect(idx.hasAnyPrefixMatch("甲")).toBe(false);
		idx.removeFile("不存在的.md"); // 幂等
		expect(idx.size).toBe(1);
	});

	it("renameFile 只改字段不重新解析，路径/排序同步更新（Q18 逻辑面）", () => {
		const idx = new HeadingIndex();
		idx.setFile("a.md", "a", "## 甲");
		idx.setFile("b.md", "b", "## 乙");
		idx.renameFile("a.md", "z/新名.md", "新名");
		const entries = idx.queryPrefix("甲", 10);
		expect(entries).toHaveLength(1);
		expect(entries[0].path).toBe("z/新名.md");
		expect(entries[0].basename).toBe("新名");
		// matchKey 未变；path 变了所以排序位置可能变化，但查询仍正确
		expect(idx.hasAnyPrefixMatch("乙")).toBe(true);
		expect(idx.size).toBe(2);
	});

	it("clear 清空全部状态", () => {
		const idx = new HeadingIndex();
		idx.setFile("a.md", "a", "## 甲");
		idx.clear();
		expect(idx.size).toBe(0);
		expect(idx.isTruncated).toBe(false);
		expect(idx.hasAnyPrefixMatch("甲")).toBe(false);
	});

	it("allEntries 返回全部条目且不影响内部状态", () => {
		const idx = new HeadingIndex();
		idx.setFile("a.md", "a", "## 甲");
		const all = idx.allEntries();
		expect(all.map((e) => e.displayText)).toEqual(["甲"]);
		all.push({} as never); // 修改副本不应影响内部
		expect(idx.size).toBe(1);
	});
});

describe("HeadingIndex：套话标题与 Excalidraw（Q32 / Q33）", () => {
	const file = (path: string, content: string) => ({
		path,
		basename: path.replace(/\.md$/, ""),
		content,
	});

	it(`同名标题出现在 ≥ ${GENERIC_FILE_COUNT} 个文件里即套话：前缀 / 完整查询都跳过`, () => {
		const idx = new HeadingIndex();
		idx.loadInitial([
			file("a.md", "## 边界\n## 边界条件分析"),
			file("b.md", "## 边界"),
			file("c.md", "## 边界\n## 边界\n## AXI"), // 同一文件重复只算一个文件
		]);
		expect(idx.fileCountOf("边界")).toBe(3);
		expect(idx.isGenericKey("边界")).toBe(true);
		expect(idx.hasExactMatch("边界")).toBe(false);
		expect(idx.queryPrefix("边界", 10).map((e) => e.matchKey)).toEqual(["边界条件分析"]);
		expect(idx.hasAnyPrefixMatch("边界")).toBe(true); // 有非套话的【边界条件分析】
		expect(idx.eligibleEntries().map((e) => e.matchKey)).toEqual(["axi", "边界条件分析"]);
		expect(idx.allEntries()).toHaveLength(6); // allEntries 不过滤
	});

	it("只有套话标题以该串开头时：hasAnyPrefixMatch 为 false", () => {
		const idx = new HeadingIndex();
		idx.loadInitial([
			file("a.md", "## 流程"),
			file("b.md", "## 流程"),
			file("c.md", "## 流程"),
		]);
		expect(idx.hasAnyPrefixMatch("流")).toBe(false);
	});

	it("文件计数随增量更新：setFile / removeFile / renameFile 覆盖", () => {
		const idx = new HeadingIndex();
		idx.loadInitial([file("a.md", "## 反问"), file("b.md", "## 反问")]);
		expect(idx.isGenericKey("反问")).toBe(false);
		idx.setFile("c.md", "c", "## 反问");
		expect(idx.isGenericKey("反问")).toBe(true);
		idx.removeFile("a.md");
		expect(idx.fileCountOf("反问")).toBe(2);
		idx.renameFile("b.md", "c.md", "c"); // 改名覆盖：被覆盖的 c.md 的标题随之消失
		expect(idx.fileCountOf("反问")).toBe(1);
		idx.setFile("c.md", "c", "## 别的");
		expect(idx.fileCountOf("反问")).toBe(0);
	});

	it("Excalidraw 绘图文件不进索引（文件名或 frontmatter 识别）", () => {
		expect(isExcalidrawFile("draw/x.excalidraw.md", "")).toBe(true);
		expect(
			isExcalidrawFile(
				"x.md",
				"---\nexcalidraw-plugin: parsed\ntags: []\n---\n## Text Elements",
			),
		).toBe(true);
		expect(isExcalidrawFile("x.md", "---\ntags: [excalidraw-plugin]\n---\n")).toBe(false);
		expect(isExcalidrawFile("x.md", "## excalidraw-plugin: 正文里提到")).toBe(false);
		const idx = new HeadingIndex();
		idx.loadInitial([
			file("x.excalidraw.md", "# Excalidraw Data\n## Text Elements"),
			file("note.md", "## Text Elements"),
		]);
		expect(idx.size).toBe(1);
		expect(idx.entriesOf("x.excalidraw.md")).toEqual([]);
		expect(idx.entriesOf("note.md").map((e) => e.matchKey)).toEqual(["text elements"]);
	});
});

describe("HeadingIndex：排除正在写的那一条 / 识别标题是否真的变了（Q7 / Q48）", () => {
	it("exclude 指定文件 + 行：前缀与完整查询都跳过它，同文件其他标题照常", () => {
		const idx = new HeadingIndex();
		idx.loadInitial([{ path: "a.md", basename: "a", content: "## haha\n正文\n## haha 二" }]);
		const self = { path: "a.md", lineIndex: 0 };
		expect(idx.hasExactMatch("haha", self)).toBe(false);
		expect(idx.hasExactMatch("haha")).toBe(true);
		expect(idx.hasAnyPrefixMatch("haha", self)).toBe(true); // 第 3 行的「haha 二」
		expect(idx.queryPrefix("haha", 10, self).map((e) => e.lineIndex)).toEqual([2]);
		expect(idx.findByAnchor("a.md", "haha")?.lineIndex).toBe(0);
	});

	it("setFile 返回标题是否变了：只改正文（含行号漂移）为 false，改标题 / 加删标题为 true", () => {
		const idx = new HeadingIndex();
		expect(idx.setFile("a.md", "a", "## 甲\n正文")).toBe(true);
		expect(idx.setFile("a.md", "a", "新增一行\n## 甲\n正文改了")).toBe(false);
		expect(idx.setFile("a.md", "a", "## 乙")).toBe(true);
		expect(idx.setFile("a.md", "a", "## 乙\n## 丙")).toBe(true);
	});
});
