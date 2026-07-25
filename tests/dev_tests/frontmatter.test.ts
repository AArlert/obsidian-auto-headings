import { describe, expect, it } from "vitest";
import {
	isDisabledByFrontmatter,
	planPauseFileSwitch,
	planResumeFileSwitch,
	readFileSwitch,
	type SwitchEdit,
} from "../../src/frontmatter";

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

describe("planPauseFileSwitch / planResumeFileSwitch（1.0.15 写入侧，testplan H15/H16）", () => {
	/** 把编辑计划真正施加到内容上，便于用最终文本断言（main.ts 走编辑器事务，这里走字符串）。 */
	function apply(content: string, edit: SwitchEdit | null): string {
		if (!edit) {
			return content;
		}
		const lines = content.split("\n");
		lines.splice(edit.startLine, edit.removedLines, ...edit.lines);
		return lines.join("\n");
	}

	describe("planPauseFileSwitch", () => {
		it("无 frontmatter：在文件最前新建区块", () => {
			const out = apply("## 章", planPauseFileSwitch("## 章"));
			expect(out).toBe(["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n"));
			expect(readFileSwitch(out)).toBe(false);
		});

		it("已有区块但无该键：插在闭合符之前，保留用户原有键序", () => {
			const src = ["---", "tags: [a]", "aliases: [b]", "---", "## 章"].join("\n");
			expect(apply(src, planPauseFileSwitch(src))).toBe(
				[
					"---",
					"tags: [a]",
					"aliases: [b]",
					"obsidian-auto-headings: false",
					"---",
					"## 章",
				].join("\n"),
			);
		});

		it("该键存在但值不是 false：就地替换那一行（不新增第二行同名键）", () => {
			const src = ["---", "obsidian-auto-headings: true", "---", "## 章"].join("\n");
			const out = apply(src, planPauseFileSwitch(src));
			expect(readFileSwitch(out)).toBe(false);
			expect(out.split("obsidian-auto-headings").length - 1).toBe(1);
		});

		it("已经是 false：返回 null，不做无谓改动", () => {
			const src = ["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n");
			expect(planPauseFileSwitch(src)).toBeNull();
		});

		it("frontmatter 未闭合（畸形）：返回 null，保守不碰", () => {
			expect(planPauseFileSwitch(["---", "tags: [a]", "## 章"].join("\n"))).toBeNull();
		});

		it("CRLF 文件：生成的行跟随原换行风格，不插进孤立的 LF 行", () => {
			const src = ["---\r", "tags: [a]\r", "---\r", "## 章"].join("\n");
			const edit = planPauseFileSwitch(src);
			expect(edit?.lines).toEqual(["obsidian-auto-headings: false\r"]);
		});
	});

	describe("planResumeFileSwitch", () => {
		it("该键是区块里唯一一项：整个 --- 块一并移除，不留空壳", () => {
			const src = ["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n");
			expect(apply(src, planResumeFileSwitch(src))).toBe("## 章");
		});

		it("区块还有别的键：只删这一行", () => {
			const src = ["---", "tags: [a]", "obsidian-auto-headings: false", "---", "## 章"].join(
				"\n",
			);
			expect(apply(src, planResumeFileSwitch(src))).toBe(
				["---", "tags: [a]", "---", "## 章"].join("\n"),
			);
		});

		it("值为 true：不归本命令管，返回 null", () => {
			const src = ["---", "obsidian-auto-headings: true", "---", "## 章"].join("\n");
			expect(planResumeFileSwitch(src)).toBeNull();
		});

		it("没有该键 / 没有 frontmatter：返回 null", () => {
			expect(
				planResumeFileSwitch(["---", "tags: [a]", "---", "## 章"].join("\n")),
			).toBeNull();
			expect(planResumeFileSwitch("## 章")).toBeNull();
		});

		it("暂停 → 恢复往返回到原文（无 frontmatter 的文件）", () => {
			const src = "## 章\n正文";
			const paused = apply(src, planPauseFileSwitch(src));
			expect(apply(paused, planResumeFileSwitch(paused))).toBe(src);
		});
	});
});
