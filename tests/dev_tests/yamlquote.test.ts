/**
 * `src/yamlquote.ts` 单测（testplan M30）：frontmatter 定位、YAML 引号串扫描、转义读写。
 *
 * 扫描器只要回答「链接落在哪种引号串里」：误把裸值当引号串会错误转义（链接文本多出反斜杠），
 * 误把引号串当裸值只会少改一处（保守）。故重点覆盖**不应**识别为引号串的位置。
 */
import { describe, expect, it } from "vitest";
import {
	BODY_CODEC,
	escapeYamlDouble,
	frontmatterBody,
	linkCodecLocator,
	unescapeYamlDouble,
	yamlQuotedRanges,
} from "../../src/yamlquote";

/** 扫描 `---\n<fm>\n---\n` 的 frontmatter，返回各引号串的「风格:内容」。 */
function quoted(fm: string): string[] {
	const content = `---\n${fm}\n---\n正文`;
	const body = frontmatterBody(content);
	if (!body) throw new Error("没有 frontmatter");
	return yamlQuotedRanges(content, body).map(
		(r) => `${r.style}:${content.slice(r.start, r.end)}`,
	);
}

describe("frontmatterBody：与单文件开关同口径定位 frontmatter", () => {
	it("首行 `---`、`---` 或 `...` 闭合：返回两条分隔线之间的正文区间", () => {
		const content = "---\nk: v\nj: w\n---\n正文";
		const body = frontmatterBody(content);
		expect(body && content.slice(body.start, body.end)).toBe("k: v\nj: w\n");
		const dots = "---\nk: v\n...\n正文";
		const b2 = frontmatterBody(dots);
		expect(b2 && dots.slice(b2.start, b2.end)).toBe("k: v\n");
	});

	it("CRLF 换行同样识别", () => {
		const content = "---\r\nk: v\r\n---\r\n正文";
		const body = frontmatterBody(content);
		expect(body && content.slice(body.start, body.end)).toBe("k: v\r\n");
	});

	it("不在文件开头 / 未闭合：不是 frontmatter", () => {
		expect(frontmatterBody("正文\n---\nk: v\n---\n")).toBeNull();
		expect(frontmatterBody("---\nk: v\n正文")).toBeNull();
	});
});

describe("yamlQuotedRanges：只认节点起点处的引号", () => {
	it("映射值、序列项、流式集合里的双 / 单引号串", () => {
		expect(quoted(`k: "a"\nj: 'b'\nlist:\n  - "c"\n  - - 'd'\nflow: ["e", 'f', g]`)).toEqual([
			"double:a",
			"single:b",
			"double:c",
			"single:d",
			"double:e",
			"single:f",
		]);
	});

	it("转义：双引号串里的 \\\" 与单引号串里的 '' 不提前闭合", () => {
		expect(quoted(String.raw`k: "a\"b" # "c"`)).toEqual([String.raw`double:a\"b`]);
		expect(quoted("k: 'a''b'")).toEqual(["single:a''b"]);
	});

	it("裸值中间的引号是普通字符", () => {
		expect(quoted(`k: He said "hi" and 'bye'`)).toEqual([]);
	});

	it("引号键、JSON 风格流式映射、锚点与标签后的引号串", () => {
		expect(quoted(`"key": 'v'\nm: {"a":"b", c: 'd'}\nt: !!str "x"\nr: &id 'y'`)).toEqual([
			"double:key",
			"single:v",
			"double:a",
			"double:b",
			"single:d",
			"double:x",
			"single:y",
		]);
	});

	it("注释里的引号不算", () => {
		expect(quoted(`# "注释"\nk: v # 'c'\nj: a#"b"`)).toEqual([]);
	});

	it("多行双引号串跨行也只算一个", () => {
		expect(quoted(`k: "第一行\n  第二行 [[a#b]]"\nj: 'x'`)).toEqual([
			"double:第一行\n  第二行 [[a#b]]",
			"single:x",
		]);
	});

	it("块标量（| / >）正文整段跳过，行首引号不算", () => {
		expect(quoted(`note: |\n  "不是引号串"\n  'x'\nnext: "y"`)).toEqual(["double:y"]);
		expect(quoted(`items:\n  - key: >-\n      "z"\n    k2: 'w'`)).toEqual(["single:w"]);
	});

	it("多行裸值的续行：行首引号是普通字符；缩进回到键列即结束", () => {
		expect(quoted(`summary: 第一行\n  "续行" 仍是裸值\nnext: "q"`)).toEqual(["double:q"]);
		expect(quoted(`- 条目\n  "续行"\n- "新条目"`)).toEqual(["double:新条目"]);
		expect(quoted(`- key: v\n  k2: "同级键"`)).toEqual(["double:同级键"]);
	});
});

describe("转义读写与定位器", () => {
	it("unescapeYamlDouble：常见单字符转义与十六进制转义；不认识的转义返回 null", () => {
		expect(unescapeYamlDouble(String.raw`a\"b\\c\/d\u2060e\x41\U0001F600`)).toBe(
			'a"b\\c/d\u2060eA\u{1F600}',
		);
		expect(unescapeYamlDouble(String.raw`bad\q`)).toBeNull();
		expect(unescapeYamlDouble(String.raw`trailing\\`)).toBe("trailing\\");
		expect(unescapeYamlDouble("trailing\\")).toBeNull();
		expect(unescapeYamlDouble(String.raw`\u12`)).toBeNull();
	});

	it("escapeYamlDouble 与 unescapeYamlDouble 互逆", () => {
		const text = String.raw`C:\dir "引号" 'x' ${"\u2060"}1`;
		expect(unescapeYamlDouble(escapeYamlDouble(text))).toBe(text);
	});

	it("linkCodecLocator：正文原样；属性里按引号风格；裸值拦截新引入的敏感字符", () => {
		const content = `---\ndq: "L"\nsq: 'L'\nplain: 见 L\n---\n正文 L`;
		const at = linkCodecLocator(content);
		const codecOf = (needle: string, from = 0) => {
			const i = content.indexOf(needle, from);
			return at(i, i + 1);
		};
		const dq = codecOf("L");
		const sq = codecOf("L", content.indexOf("sq:"));
		const plain = codecOf("L", content.indexOf("plain:"));
		const body = codecOf("L", content.indexOf("正文"));
		expect(body).toBe(BODY_CODEC);
		expect(dq.encode('Say "hi"', "x")).toBe(String.raw`Say \"hi\"`);
		expect(sq.decode("What''s")).toBe("What's");
		expect(sq.encode("What's", "x")).toBe("What''s");
		expect(plain.encode("注意: 细节", "注意")).toBeNull();
		expect(plain.encode("甲, 乙", "甲, 丙")).toBe("甲, 乙"); // 旧源码里本就有的字符放行
		expect(plain.encode("1 简介", "简介")).toBe("1 简介");
	});

	it("没有 frontmatter 时全部按正文处理", () => {
		expect(linkCodecLocator("正文 [[a#b]]")(3, 10)).toBe(BODY_CODEC);
	});
});
