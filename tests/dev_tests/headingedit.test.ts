/** 跳过标记切换与整节升降级纯函数单测（testplan S1–S7，见 src/headingedit.ts）。 */
import { describe, expect, it } from "vitest";
import {
	bodyLineCount,
	moveSection,
	planSectionShift,
	skipKindOf,
	toggleSkipMarker,
} from "../../src/headingedit";

describe("toggleSkipMarker（S1/S2）", () => {
	it("无标记 → 行尾补规范标记", () => {
		expect(toggleSkipMarker("## 临时讨论")).toBe("## 临时讨论 <!-- skip -->");
	});
	it("行尾空白先去掉再补，不留双空格", () => {
		expect(toggleSkipMarker("## 临时讨论  ")).toBe("## 临时讨论 <!-- skip -->");
	});
	it.each(["## A <!-- skip -->", "## A <!--skip-->", "## A   <!--  SKIP  -->  "])(
		"有标记变体 %s → 整段移除",
		(line) => {
			expect(toggleSkipMarker(line)).toBe("## A");
		},
	);
	it("切换两次回到原样", () => {
		const l = "### 标题";
		expect(toggleSkipMarker(toggleSkipMarker(l))).toBe(l);
	});
});

describe("planSectionShift（S4–S7）", () => {
	const doc = ["# A", "## B", "### C", "正文", "## D", "### E"].join("\n");

	it("降级本节：本节与子标题各多一个 #，到下一个同级为止", () => {
		expect(planSectionShift(doc, 1, 1)).toEqual([
			{ line: 1, text: "### B" },
			{ line: 2, text: "#### C" },
		]);
	});
	it("升级本节", () => {
		expect(planSectionShift(doc, 4, -1)).toEqual([
			{ line: 4, text: "# D" },
			{ line: 5, text: "## E" },
		]);
	});
	it("越界整体拒绝（H1 升级 / 含 H6 降级）", () => {
		expect(planSectionShift(doc, 0, -1)).toBeNull();
		expect(planSectionShift("## A\n###### B", 0, 1)).toBeNull();
	});
	it("非标题行返回 null", () => {
		expect(planSectionShift(doc, 3, 1)).toBeNull();
	});
	it("围栏 / 注释里的 # 行不被改", () => {
		const d = ["## A", "```", "### 假", "```", "### B"].join("\n");
		expect(planSectionShift(d, 0, 1)).toEqual([
			{ line: 0, text: "### A" },
			{ line: 4, text: "#### B" },
		]);
	});
	it("末级小节到文件末尾", () => {
		expect(planSectionShift("# A\n## B\n## C", 2, 1)).toEqual([{ line: 2, text: "### C" }]);
	});
});

describe("moveSection（整节拖动）", () => {
	const doc = ["# A", "## B", "x", "### C", "## D", "y", "## E"].join("\n");

	it("把 B 小节（含子标题）移到 E 之前", () => {
		expect(moveSection(doc, 1, 6)).toBe(
			["# A", "## D", "y", "## B", "x", "### C", "## E"].join("\n"),
		);
	});
	it("移到文末", () => {
		expect(moveSection(doc, 4, bodyLineCount(doc))).toBe(
			["# A", "## B", "x", "### C", "## E", "## D", "y"].join("\n"),
		);
	});
	it("向前移（E 移到 B 之前）", () => {
		expect(moveSection(doc, 6, 1)).toBe(
			["# A", "## E", "## B", "x", "### C", "## D", "y"].join("\n"),
		);
	});
	it("落在自身内部或紧贴其后 → null（等于没动）", () => {
		expect(moveSection(doc, 1, 3)).toBeNull();
		expect(moveSection(doc, 1, 4)).toBeNull();
		expect(moveSection(doc, 1, 1)).toBeNull();
	});
	it("文末换行符原样保留，不多不少", () => {
		const d = "# A\n## B\nx\n## C\ny\n";
		expect(moveSection(d, 3, 1)).toBe("# A\n## C\ny\n## B\nx\n");
		expect(moveSection(d, 1, bodyLineCount(d))).toBe("# A\n## C\ny\n## B\nx\n");
	});
	it("围栏里的 # 行不是小节边界", () => {
		const d = ["## A", "```", "## 假", "```", "## B"].join("\n");
		expect(moveSection(d, 0, 5)).toBe(["## B", "## A", "```", "## 假", "```"].join("\n"));
	});
	it("非标题行 → null", () => {
		expect(moveSection(doc, 2, 0)).toBeNull();
	});
});

describe("整节跳过标记（skip-tree）", () => {
	it("补 / 去 / 与单标题标记互换", () => {
		expect(toggleSkipMarker("## A", "tree")).toBe("## A <!-- skip-tree -->");
		expect(toggleSkipMarker("## A <!-- skip-tree -->", "tree")).toBe("## A");
		expect(toggleSkipMarker("## A <!-- skip -->", "tree")).toBe("## A <!-- skip-tree -->");
		expect(toggleSkipMarker("## A <!--SKIP-TREE-->", "self")).toBe("## A <!-- skip -->");
	});
	it("skipKindOf 区分两类", () => {
		expect(skipKindOf("## A <!-- skip -->")).toBe("self");
		expect(skipKindOf("## A <!-- skip-tree -->")).toBe("tree");
		expect(skipKindOf("## A")).toBeNull();
	});
});
