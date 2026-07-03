import { describe, expect, it } from "vitest";
import { isDisabledByFrontmatter, readFileSwitch } from "../../src/frontmatter";

function withFrontmatter(value: string): string {
	return ["---", `obsidian-auto-headings: ${value}`, "---", "# 文档", "## 章"].join("\n");
}

describe("readFileSwitch", () => {
	it("识别合法的 true / false（YAML 布尔值）", () => {
		expect(readFileSwitch(withFrontmatter("true"))).toBe(true);
		expect(readFileSwitch(withFrontmatter("false"))).toBe(false);
	});

	it("旧版 ON/OFF 文本视为非法（返回 null）", () => {
		expect(readFileSwitch(withFrontmatter("ON"))).toBeNull();
		expect(readFileSwitch(withFrontmatter("OFF"))).toBeNull();
		expect(readFileSwitch(withFrontmatter("on"))).toBeNull();
		expect(readFileSwitch(withFrontmatter("off"))).toBeNull();
		expect(readFileSwitch(withFrontmatter("True"))).toBeNull();
		expect(readFileSwitch(withFrontmatter("False"))).toBeNull();
	});

	it("键缺省时返回 null", () => {
		const content = ["---", "title: 我的笔记", "---", "# 文档"].join("\n");
		expect(readFileSwitch(content)).toBeNull();
	});

	it("无 frontmatter 时返回 null", () => {
		expect(readFileSwitch("# 文档\n## 章")).toBeNull();
		expect(readFileSwitch("")).toBeNull();
	});

	it("未闭合的 frontmatter 返回 null", () => {
		const content = ["---", "obsidian-auto-headings: false", "# 文档"].join("\n");
		expect(readFileSwitch(content)).toBeNull();
	});

	it("frontmatter 必须位于文件最开头", () => {
		const content = ["正文", "---", "obsidian-auto-headings: false", "---"].join("\n");
		expect(readFileSwitch(content)).toBeNull();
	});

	it("容忍值两侧的引号与空白", () => {
		expect(readFileSwitch(withFrontmatter('"true"'))).toBe(true);
		expect(readFileSwitch(withFrontmatter("'false'"))).toBe(false);
		expect(readFileSwitch(withFrontmatter("  true  "))).toBe(true);
	});

	it("以 ... 闭合的 frontmatter 也能识别", () => {
		const content = ["---", "obsidian-auto-headings: false", "...", "# 文档"].join("\n");
		expect(readFileSwitch(content)).toBe(false);
	});

	it("取第一个匹配键", () => {
		const content = [
			"---",
			"obsidian-auto-headings: false",
			"obsidian-auto-headings: true",
			"---",
		].join("\n");
		expect(readFileSwitch(content)).toBe(false);
	});
});

describe("isDisabledByFrontmatter", () => {
	it("仅 false 视为关闭", () => {
		expect(isDisabledByFrontmatter(withFrontmatter("false"))).toBe(true);
		expect(isDisabledByFrontmatter(withFrontmatter("true"))).toBe(false);
		expect(isDisabledByFrontmatter(withFrontmatter("off"))).toBe(false);
		expect(isDisabledByFrontmatter("# 文档")).toBe(false);
	});
});
