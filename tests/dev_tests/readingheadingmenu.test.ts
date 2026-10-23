/**
 * 阅读视图标题菜单的定位逻辑（spec §3.24，testplan S33 / S35）：渲染器给的区块行号优先，取不到时按标题文字唯一匹配。
 * 右键事件、视图查找与菜单弹出留真机探查（`tests/probes/maintenance-tab.js` 之外的 `reading-menu` 部分）。
 */
import { describe, expect, it } from "vitest";
import { mapHeadingLine, resolveReadingHeadingLine } from "../../src/readingheadingmenu";

const WJ = "⁠";
const doc = [
	"# 文档",
	`## ${WJ}1 ${WJ}甲`,
	"正文",
	"## 乙 <!-- skip -->",
	"## 重名",
	"## 重名",
].join("\n");

describe("resolveReadingHeadingLine", () => {
	it("渲染器给的行号正是标题行：直接用", () => {
		expect(resolveReadingHeadingLine(doc, 1, "1 甲")).toBe(1);
	});

	it("取不到区块行号：按标题文字唯一匹配（去 WJ、去跳过标记）", () => {
		expect(resolveReadingHeadingLine(doc, null, "1 甲")).toBe(1);
		expect(resolveReadingHeadingLine(doc, null, "乙")).toBe(3);
	});

	it("区块行号不是标题行（结构认错）：退回文字匹配", () => {
		expect(resolveReadingHeadingLine(doc, 2, "乙")).toBe(3);
	});

	it("文字重名或对不上：不弹菜单（null）", () => {
		expect(resolveReadingHeadingLine(doc, null, "重名")).toBeNull();
		expect(resolveReadingHeadingLine(doc, null, "不存在")).toBeNull();
	});

	it("重名时有区块行号仍能定位到右键的那一个", () => {
		expect(resolveReadingHeadingLine(doc, 5, "重名")).toBe(5);
	});
});

describe("mapHeadingLine（S35 ②：映射到别的叶子里正在编辑的那份内容）", () => {
	it("内容相同原样返回；别处在上方插了行时跟着挪", () => {
		expect(mapHeadingLine(doc, 3, doc)).toBe(3);
		expect(mapHeadingLine(doc, 3, "新的一行\n" + doc)).toBe(4);
	});

	it("同名标题按第几个对应；对不上返回 null", () => {
		expect(mapHeadingLine(doc, 5, "前言\n" + doc)).toBe(6);
		expect(mapHeadingLine(doc, 2, doc + "\n")).toBeNull(); // 第 2 行不是标题
		expect(mapHeadingLine(doc, 3, "# 文档\n## 丙")).toBeNull(); // 那边已改名
	});
});
