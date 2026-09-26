/**
 * 属性（frontmatter）里的标题链接（testplan M29–M31，见 spec.md §3.12）：
 * `rewriteBacklinksInContent` 在 YAML 属性里的改写结果。
 *
 * 属性里的链接改写后 frontmatter 必须仍是合法 YAML——写坏了，该文件的**全部属性**都会失效。故断言一律
 * 用 js-yaml 解析改写后的 frontmatter（Obsidian 的解析器同为 YAML 1.2，引号与转义规则一致），
 * 并以随机不变量覆盖「任意引号风格 × 含敏感字符的标题改名」。
 */
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import {
	computeHeadingRenames,
	displayAnchor,
	rewriteBacklinksInContent,
	snapshotHeadings,
	type HeadingRename,
} from "../../src/backlinks";
import { WORD_JOINER as WJ } from "../../src/numbering";
import { Rng } from "./uvm/rng";

function asMap(renames: HeadingRename[]): Map<string, string> {
	return new Map(renames.map((r) => [r.from, r.to]));
}

/** 编号后的标题文本（双哨兵：WJ + 序号 + 空格 + WJ + 原文）。 */
const numbered = (text: string) => `${WJ}1 ${WJ}${text}`;

/** 目标文件 a 的标题 `## oldH` 改成 `## newH` 后，改写引用方 `---\n<fm>\n---\n<body>`。 */
function rewrite(fm: string, oldH: string, newH: string, body = "正文。") {
	const renames = computeHeadingRenames(`## ${oldH}`, `## ${newH}`);
	const out = rewriteBacklinksInContent(`---\n${fm}\n---\n${body}`, "a", false, asMap(renames));
	const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(out.content);
	if (!m) throw new Error(`frontmatter 结构被破坏：${out.content}`);
	return { count: out.count, fm: m[1], body: m[2], data: yaml.load(m[1]) };
}

describe("M29 属性里的标题链接：常见 YAML 写法都跟着改", () => {
	const to = numbered("简介");

	it("Obsidian 写出的文本属性 / 列表属性（含别名），指向别的文件的不动", () => {
		const fm = [
			'related: "[[a#简介]]"',
			"links:",
			'  - "[[a#简介]]"',
			'  - "[[a#简介|别名]]"',
			'  - "[[b#简介]]"',
		].join("\n");
		const r = rewrite(fm, "简介", to);
		expect(r.count).toBe(3);
		expect(r.data).toEqual({
			related: `[[a#${to}]]`,
			links: [`[[a#${to}]]`, `[[a#${to}|别名]]`, "[[b#简介]]"],
		});
	});

	it("手写的流式序列 / 单引号 / 文本内嵌 / 裸值", () => {
		const fm = [
			'flow: ["[[a#简介]]", "[[b#简介]]"]',
			"single: '[[a#简介]]'",
			'text: "见 [[a#简介]] 一节"',
			"plain: 见 [[a#简介]] 一节",
		].join("\n");
		const r = rewrite(fm, "简介", to);
		expect(r.count).toBe(4);
		expect(r.data).toEqual({
			flow: [`[[a#${to}]]`, "[[b#简介]]"],
			single: `[[a#${to}]]`,
			text: `见 [[a#${to}]] 一节`,
			plain: `见 [[a#${to}]] 一节`,
		});
	});

	it("块标量正文与 YAML 注释里的链接按文本改写", () => {
		const r = rewrite(
			["note: |", "  见 [[a#简介]]", "k: v # 见 [[a#简介]]"].join("\n"),
			"简介",
			to,
		);
		expect(r.count).toBe(2);
		expect(r.fm).toBe(["note: |", `  见 [[a#${to}]]`, `k: v # 见 [[a#${to}]]`].join("\n"));
		expect(r.data).toEqual({ note: `见 [[a#${to}]]\n`, k: "v" });
	});

	it("属性与正文里的链接一起改、计数合计", () => {
		const r = rewrite('related: "[[a#简介]]"', "简介", to, "见 [[a#简介]]。");
		expect(r.count).toBe(2);
		expect(r.data).toEqual({ related: `[[a#${to}]]` });
		expect(r.body).toBe(`见 [[a#${to}]]。`);
	});

	it("不在文件开头或未闭合的 `---` 区块不是 frontmatter：按正文处理，引号不做 YAML 转义", () => {
		const renames = asMap(computeHeadingRenames("## Say hi", '## Say "hi"'));
		const notAtStart = '正文\n---\nrelated: "[[a#Say hi]]"\n---\n';
		expect(rewriteBacklinksInContent(notAtStart, "a", false, renames).content).toBe(
			'正文\n---\nrelated: "[[a#Say "hi"]]"\n---\n',
		);
		const unclosed = '---\nrelated: "[[a#Say hi]]"\n正文';
		expect(rewriteBacklinksInContent(unclosed, "a", false, renames).content).toBe(
			'---\nrelated: "[[a#Say "hi"]]"\n正文',
		);
	});
});

describe("M30 属性链接的 YAML 引号安全：按所在引号风格还原匹配、转义写回，无法转义就不改", () => {
	it('锚点含双引号：双引号串里的 \\" 还原后匹配，写回时重新转义', () => {
		const r = rewrite(
			String.raw`related: "[[a#Say \"hi\"]]"`,
			'Say "hi"',
			numbered('Say "hi"'),
		);
		expect(r.count).toBe(1);
		expect(r.fm).toBe(`related: "[[a#${numbered(String.raw`Say \"hi\"`)}]]"`);
		expect(r.data).toEqual({ related: `[[a#${numbered('Say "hi"')}]]` });
	});

	it("锚点含撇号：单引号串里的 '' 还原后匹配，写回时重新成对", () => {
		const r = rewrite("related: '[[a#What''s new]]'", "What's new", numbered("What's new"));
		expect(r.count).toBe(1);
		expect(r.fm).toBe(`related: '[[a#${numbered("What''s new")}]]'`);
		expect(r.data).toEqual({ related: `[[a#${numbered("What's new")}]]` });
	});

	it("双引号串里的撇号、单引号串里的双引号本就无需转义：原样写入", () => {
		const a = rewrite(`related: "[[a#What's new]]"`, "What's new", numbered("What's new"));
		expect(a.fm).toBe(`related: "[[a#${numbered("What's new")}]]"`);
		const b = rewrite(`related: '[[a#Say "hi"]]'`, 'Say "hi"', numbered('Say "hi"'));
		expect(b.fm).toBe(`related: '[[a#${numbered('Say "hi"')}]]'`);
	});

	it("改名新引入双引号 / 反斜杠：双引号串里转义后写回", () => {
		const a = rewrite('related: "[[a#Say hi]]"', "Say hi", 'Say "hi"');
		expect(a.fm).toBe(String.raw`related: "[[a#Say \"hi\"]]"`);
		expect(a.data).toEqual({ related: '[[a#Say "hi"]]' });
		const b = rewrite('related: "[[a#路径]]"', "路径", String.raw`C:\new`);
		expect(b.fm).toBe(String.raw`related: "[[a#C:\\new]]"`);
		expect(b.data).toEqual({ related: String.raw`[[a#C:\new]]` });
	});

	it("改名新引入撇号：单引号串里成对写回", () => {
		const r = rewrite("related: '[[a#Whats new]]'", "Whats new", "What's new");
		expect(r.fm).toBe("related: '[[a#What''s new]]'");
		expect(r.data).toEqual({ related: "[[a#What's new]]" });
	});

	it("裸值里新引入无法转义的字符（: 、引号、反斜杠、逗号、花括号）：保守不改，YAML 原样", () => {
		const cases: Array<[string, string]> = [
			["注意", "注意: 细节"],
			["Say hi", 'Say "hi"'],
			["Whats new", "What's new"],
			["路径", String.raw`C:\new`],
			["甲乙", "甲, 乙"],
			["集合", "{集合}"],
		];
		for (const [oldH, newH] of cases) {
			const fm = `summary: 见 [[a#${oldH}]] 一节`;
			const r = rewrite(fm, oldH, newH);
			expect(r.count, newH).toBe(0);
			expect(r.fm, newH).toBe(fm);
		}
		// 同样的改名放在双引号串里就能安全写回（对照组）。
		const quoted = rewrite('summary: "见 [[a#注意]] 一节"', "注意", "注意: 细节");
		expect(quoted.data).toEqual({ summary: "见 [[a#注意: 细节]] 一节" });
	});

	it("随机不变量：任意引号风格 × 含 YAML 敏感字符的标题改名，YAML 始终合法；引号串必更新，其余要么更新要么原样", () => {
		const pieces = [
			"甲",
			"乙",
			"a",
			"Z",
			" ",
			'"',
			"'",
			"\\",
			":",
			": ",
			",",
			"{",
			"}",
			"1.",
			"·",
		];
		const heading = (rng: Rng) =>
			Array.from({ length: rng.intRange(1, 5) }, () => rng.pick(pieces)).join("");
		const dq = (s: string) => s.replace(/[\\"]/g, "\\$&");
		const sq = (s: string) => s.replace(/'/g, "''");
		const contexts: Array<{
			name: string;
			quoted: boolean;
			yaml: (anchor: string) => string;
			value: (anchor: string) => unknown;
		}> = [
			{
				name: "双引号",
				quoted: true,
				yaml: (x) => `k: "见 [[a#${dq(x)}]] 了"`,
				value: (x) => `见 [[a#${x}]] 了`,
			},
			{
				name: "单引号",
				quoted: true,
				yaml: (x) => `k: '见 [[a#${sq(x)}]] 了'`,
				value: (x) => `见 [[a#${x}]] 了`,
			},
			{
				name: "列表双引号",
				quoted: true,
				yaml: (x) => `k:\n  - "[[a#${dq(x)}]]"`,
				value: (x) => [`[[a#${x}]]`],
			},
			{
				name: "流式单引号",
				quoted: true,
				yaml: (x) => `k: ['[[a#${sq(x)}]]', x]`,
				value: (x) => [`[[a#${x}]]`, "x"],
			},
			{
				name: "裸值",
				quoted: false,
				yaml: (x) => `k: 见 [[a#${x}]] 了`,
				value: (x) => `见 [[a#${x}]] 了`,
			},
			{
				name: "块标量（行首引号）",
				quoted: false,
				yaml: (x) => `k: |\n  "引" [[a#${x}]]`,
				value: (x) => `"引" [[a#${x}]]\n`,
			},
			{
				name: "多行裸值续行（行首引号）",
				quoted: false,
				yaml: (x) => `k: 第一行\n  "续" [[a#${x}]] 了`,
				value: (x) => `第一行 "续" [[a#${x}]] 了`,
			},
			{
				name: "JSON 风格流式映射",
				quoted: true,
				yaml: (x) => `k: {"a":"[[a#${dq(x)}]]"}`,
				value: (x) => ({ a: `[[a#${x}]]` }),
			},
			{
				name: "标签 + 双引号 + 行尾注释",
				quoted: true,
				yaml: (x) => `k: !!str "[[a#${dq(x)}]]" # 注 [[a#${x}]]`,
				value: (x) => `[[a#${x}]]`,
			},
			{
				name: "引号键 + 嵌套序列单引号",
				quoted: true,
				yaml: (x) => `"k":\n  - - '[[a#${sq(x)}]]'`,
				value: (x) => [[`[[a#${x}]]`]],
			},
		];
		const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
		const perContext = new Map<string, number>();
		let checked = 0;
		for (let seed = 1; seed <= 1500; seed++) {
			const rng = new Rng(seed);
			const oldText = heading(rng);
			const newText = rng.chance(0.5) ? numbered(heading(rng)) : heading(rng);
			const renames = computeHeadingRenames(`## ${oldText}`, `## ${newText}`);
			if (renames.length !== 1) continue; // 锚点没变 / 为空：不是改名
			const from = displayAnchor(snapshotHeadings(`## ${oldText}`)[0].text);
			const to = renames[0].to;
			for (const ctx of contexts) {
				const fm = ctx.yaml(from);
				let before: { k?: unknown } | undefined;
				try {
					before = yaml.load(fm) as { k?: unknown };
				} catch {
					continue; // 原 YAML 本就不合法（如裸值里含 ": "）：不是有效输入
				}
				if (!same(before?.k, ctx.value(from))) continue;
				const out = rewriteBacklinksInContent(
					`---\n${fm}\n---\n`,
					"a",
					false,
					asMap(renames),
				);
				const fmOut = out.content.slice("---\n".length, -"\n---\n".length);
				const where = `seed=${seed} ${ctx.name} ${JSON.stringify(from)} → ${JSON.stringify(to)}`;
				let after: { k?: unknown } | undefined;
				expect(() => {
					after = yaml.load(fmOut) as { k?: unknown };
				}, where).not.toThrow();
				if (ctx.quoted) {
					expect(after?.k, where).toEqual(ctx.value(to));
				} else {
					expect(
						same(after?.k, ctx.value(to)) || same(after?.k, ctx.value(from)),
						where,
					).toBe(true);
				}
				checked++;
				perContext.set(ctx.name, (perContext.get(ctx.name) ?? 0) + 1);
			}
		}
		// 有效用例足够多，且每种形态都真被测到（不是因原 YAML 不合法而大半被跳过）。
		expect(checked).toBeGreaterThan(5000);
		for (const ctx of contexts) {
			expect(perContext.get(ctx.name) ?? 0, ctx.name).toBeGreaterThan(200);
		}
	});
});

describe("M31 属性里的 Markdown 链接：与正文同口径改写，fragment 全量 URL 编码", () => {
	it("各引号风格下改写后 YAML 仍合法（编码后的 fragment 不含任何需要转义的字符）", () => {
		const fm = [
			'dq: "[文](a.md#Say%20hi)"',
			"sq: '[文](a.md#Say%20hi)'",
			"plain: 见 [文](a.md#Say%20hi)",
		].join("\n");
		const r = rewrite(fm, "Say hi", `Say "hi" it's`);
		const frag = "Say%20%22hi%22%20it%27s";
		expect(r.count).toBe(3);
		expect(r.data).toEqual({
			dq: `[文](a.md#${frag})`,
			sq: `[文](a.md#${frag})`,
			plain: `见 [文](a.md#${frag})`,
		});
	});
});
