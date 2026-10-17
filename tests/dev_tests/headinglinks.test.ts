/**
 * 标题被链接次数（headinglinks.ts）纯函数单测：testplan Q31（短中文词需被链接过）/ Q34（排序）的
 * 信号来源。链接解析与目标文件条目都是注入的，不需要 obsidian-mock。
 */
import { describe, expect, it } from "vitest";
import { buildEntriesForFile } from "../../src/headingindex";
import { HeadingLinkCounts, resolveLinkedHeadingKeys } from "../../src/headinglinks";

const WJ = "⁠";
const files: Record<string, string> = {
	"soc/noc.md": `## AXI\n## ${WJ}1.1 ${WJ}中断\n## 交叉 矩阵`, // 编号写入的格式：WJ 双哨兵
	"here.md": "## 本地标题",
};
const entriesOf = (p: string) => buildEntriesForFile(p, p.split("/").pop()!, files[p] ?? "");
const resolveFrom = (src: string) => (linkpath: string) => {
	if (linkpath === "") return src;
	return linkpath === "noc" ? "soc/noc.md" : null;
};

describe("resolveLinkedHeadingKeys：出链 → 被链接的标题", () => {
	it("按目标文件的索引条目比对锚点：编号前缀与 WJ 由条目自带的 anchor 吸收", () => {
		const anchor = entriesOf("soc/noc.md")[1].anchor; // 写入链接时用的锚点（含编号与 WJ）
		const keys = resolveLinkedHeadingKeys(
			["noc#AXI", `noc#${anchor}`, "noc#axi"],
			resolveFrom("x.md"),
			entriesOf,
		);
		expect(keys).toEqual(["axi", "中断", "axi"]); // 大小写不敏感；同一标题链几次计几次
	});

	it("同文件链接 [[#标题]]、多级路径取末级、URL 编码的 Markdown 链接", () => {
		const keys = resolveLinkedHeadingKeys(
			["#本地标题", "noc#AXI#交叉 矩阵", "noc#%E4%BA%A4%E5%8F%89%20%E7%9F%A9%E9%98%B5"],
			resolveFrom("here.md"),
			entriesOf,
		);
		expect(keys).toEqual(["本地标题", "交叉 矩阵", "交叉 矩阵"]);
	});

	it("跳过：无 # 的文件链接、块引用、解析不到的文件、对不上的标题", () => {
		const keys = resolveLinkedHeadingKeys(
			["noc", "noc#^abc123", "missing#AXI", "noc#不存在的标题", "noc#"],
			resolveFrom("x.md"),
			entriesOf,
		);
		expect(keys).toEqual([]);
	});
});

describe("HeadingLinkCounts：按源文件分桶的增量计数", () => {
	it("setSource 替换贡献、removeSource 撤销", () => {
		const c = new HeadingLinkCounts();
		c.setSource("a.md", ["axi", "axi", "中断"]);
		c.setSource("b.md", ["axi"]);
		expect(c.count("axi")).toBe(3);
		c.setSource("a.md", ["中断"]);
		expect(c.count("axi")).toBe(1);
		expect(c.count("中断")).toBe(1);
		c.removeSource("b.md");
		expect(c.count("axi")).toBe(0);
	});

	it("renameSource：贡献跟着走；目标已存在时先撤掉被覆盖文件的贡献", () => {
		const c = new HeadingLinkCounts();
		c.setSource("a.md", ["axi"]);
		c.setSource("b.md", ["中断", "中断"]);
		c.renameSource("a.md", "b.md");
		expect(c.count("中断")).toBe(0);
		expect(c.count("axi")).toBe(1);
		c.removeSource("b.md");
		expect(c.count("axi")).toBe(0);
		c.renameSource("x.md", "x.md"); // 自身改名：无操作
	});
});
