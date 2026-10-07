/** 链接别名同步（testplan M33–M35，见 src/backlinks.ts `aliases` / `buildAliasMap`）。 */
import { describe, expect, it } from "vitest";
import {
	buildAliasMap,
	computeHeadingRenames,
	rewriteBacklinksInContent,
} from "../../src/backlinks";
import { WORD_JOINER } from "../../src/numbering";

const WJ = WORD_JOINER;

function run(oldDoc: string, newDoc: string, source: string): string {
	const renames = computeHeadingRenames(oldDoc, newDoc);
	const map = new Map(renames.map((r) => [r.from, r.to]));
	return rewriteBacklinksInContent(source, "基础", false, map, buildAliasMap(renames)).content;
}

describe("链接别名同步", () => {
	it("别名恰是旧标题 → 锚点与别名一起改（仅显示模式，M33）", () => {
		const out = run(
			"# 文档标题（H1）",
			"# 文档标题（H1）阿松大",
			"[[基础#文档标题（H1）|文档标题（H1）]]",
		);
		expect(out).toBe("[[基础#文档标题（H1）阿松大|文档标题（H1）阿松大]]");
	});

	it("用户自己写的别名原样保留（M34）", () => {
		const out = run("# 概述", "# 概述补充", "[[基础#概述|看这里]]");
		expect(out).toBe("[[基础#概述补充|看这里]]");
	});

	it("写入模式：别名是去编号后的旧标题 → 改成去编号后的新标题（M35）", () => {
		const out = run(
			`## ${WJ}1 ${WJ}背景`,
			`## ${WJ}1 ${WJ}背景补充`,
			`[[基础#${WJ}1 ${WJ}背景|背景]]`,
		);
		expect(out).toBe(`[[基础#${WJ}1 ${WJ}背景补充|背景补充]]`);
	});

	it("嵌入链接无别名时不受影响；新别名含危险字符时不改别名", () => {
		expect(run("# 概述", "# 概述补充", "![[基础#概述]]")).toBe("![[基础#概述补充]]");
		expect(run("# 概述", "# 概述|补充", "[[基础#概述|概述]]")).toBe("[[基础#概述补充|概述]]");
	});
});
