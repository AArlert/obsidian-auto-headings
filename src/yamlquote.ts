/**
 * 属性（frontmatter）里链接文本的 YAML 读写规则（Backlink 同步改写属性链接用，见 spec.md §3.12、
 * testplan M29–M30）。
 *
 * 属性里的链接改写后 frontmatter 必须仍是合法 YAML——写坏了，Obsidian 读不出该文件的**全部**属性。
 * 链接落在哪种标量里，决定了源码怎么还原成文本、新文本怎么写回：
 * - 双引号串：`\` 与 `"` 须转义（`\\` / `\"`）；比对前先还原转义；
 * - 单引号串：`'` 写成 `''`；
 * - 其余位置（裸值、流式裸值、块标量正文、注释）：没有可用的转义手段——新文本若引入此处可能改变
 *   YAML 结构的字符，就不写（调用方保守不改，链接暂不同步也绝不写坏 YAML）。
 *
 * 只做「够用且保守」的词法扫描，不引入 YAML 解析器依赖：引号只在**节点起点**才开启引号串（行首缩进后、
 * `- ` / `? ` / `: ` 之后、流式集合的 `[` `{` `,` 之后），裸值中间的引号是普通字符；`#` 注释、块标量
 * （`|` / `>`）正文与多行裸值的续行都不会被误认成引号串。拿不准的位置一律归「其余」——那里只做不需要
 * 转义的改写，误判的代价是少改一处链接，而不是写坏 YAML。
 */

import { findFrontmatterEnd } from "./frontmatter";

/** 链接文本在所处位置的读写规则。 */
export interface LinkTextCodec {
	/** 把源码还原成可比对的文本；遇到无法还原的写法（如不认识的转义）返回 null。 */
	decode(raw: string): string | null;
	/** 把新文本编码回源码；`raw` 是被替换的旧源码。此处无法安全写入时返回 null。 */
	encode(text: string, raw: string): string | null;
}

/** 正文（frontmatter 之外）：源码即文本，原样读写。 */
export const BODY_CODEC: LinkTextCodec = {
	decode: (raw) => raw,
	encode: (text) => text,
};

/** YAML 双引号串的单字符转义（`\x` / `\u` / `\U` 十六进制转义另行处理）。 */
const DOUBLE_QUOTED_ESCAPES: Record<string, string> = {
	"0": "\0",
	a: "\x07",
	b: "\b",
	t: "\t",
	"\t": "\t",
	n: "\n",
	v: "\v",
	f: "\f",
	r: "\r",
	e: "\x1b",
	" ": " ",
	'"': '"',
	"/": "/",
	"\\": "\\",
	N: "\x85",
	_: "\xa0",
	L: " ",
	P: " ",
};

/** 还原 YAML 双引号串内容里的转义；不认识的转义返回 null（调用方按「不匹配」处理）。 */
export function unescapeYamlDouble(raw: string): string | null {
	let out = "";
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (ch !== "\\") {
			out += ch;
			continue;
		}
		const esc = raw[i + 1];
		const hexLength = esc === "x" ? 2 : esc === "u" ? 4 : esc === "U" ? 8 : 0;
		if (hexLength > 0) {
			const hex = raw.slice(i + 2, i + 2 + hexLength);
			if (!new RegExp(`^[0-9a-fA-F]{${hexLength}}$`).test(hex)) return null;
			const codePoint = parseInt(hex, 16);
			if (codePoint > 0x10ffff) return null;
			out += String.fromCodePoint(codePoint);
			i += 1 + hexLength;
			continue;
		}
		const mapped = esc === undefined ? undefined : DOUBLE_QUOTED_ESCAPES[esc];
		if (mapped === undefined) return null;
		out += mapped;
		i++;
	}
	return out;
}

/** 把文本写进 YAML 双引号串：转义 `\` 与 `"`（链接锚点已折叠空白，不含控制字符）。 */
export function escapeYamlDouble(text: string): string {
	return text.replace(/[\\"]/g, "\\$&");
}

const DOUBLE_CODEC: LinkTextCodec = {
	decode: unescapeYamlDouble,
	encode: escapeYamlDouble,
};

const SINGLE_CODEC: LinkTextCodec = {
	decode: (raw) => raw.replace(/''/g, "'"),
	encode: (text) => text.replace(/'/g, "''"),
};

/**
 * 引号串之外可能改变 YAML 结构的字符：`: `（映射分隔）、`,` `{` `}`（流式集合）、引号与反斜杠
 * （位置拿不准时可能开启 / 转义引号串）。`#` `[` `]` 不会出现在链接锚点里（写入前已剔除）。
 */
const UNQUOTED_RISKY = ['"', "'", "\\", ": ", ",", "{", "}"];

const UNQUOTED_CODEC: LinkTextCodec = {
	decode: (raw) => raw,
	// 旧源码里本就有的字符在此处显然合法；只拦新引入的。
	encode: (text, raw) =>
		UNQUOTED_RISKY.some((token) => text.includes(token) && !raw.includes(token)) ? null : text,
};

/** frontmatter 正文（两条 `---` 之间）在整份内容里的源码偏移，含头不含尾。 */
export interface FrontmatterBody {
	start: number;
	end: number;
}

/** 定位 frontmatter 正文；无 frontmatter 或未闭合时返回 null（与 {@link findFrontmatterEnd} 同口径）。 */
export function frontmatterBody(content: string): FrontmatterBody | null {
	const lines = content.split("\n");
	const close = findFrontmatterEnd(lines);
	if (close === -1) return null;
	const start = lines[0].length + 1;
	let end = start;
	for (let i = 1; i < close; i++) end += lines[i].length + 1;
	return { start, end };
}

/** 一个 YAML 引号串的内侧源码区间（不含两端引号）。 */
export interface YamlQuotedRange {
	start: number;
	end: number;
	style: "double" | "single";
}

const isBlank = (ch: string | undefined) => ch === " " || ch === "\t" || ch === "\r";

/** 从 `from` 起找双引号串的闭合 `"`（跳过 `\` 转义）；未闭合返回 `end`。 */
function closeDoubleQuote(content: string, from: number, end: number): number {
	for (let i = from; i < end; i++) {
		if (content[i] === "\\") i++;
		else if (content[i] === '"') return i;
	}
	return end;
}

/** 从 `from` 起找单引号串的闭合 `'`（`''` 是转义）；未闭合返回 `end`。 */
function closeSingleQuote(content: string, from: number, end: number): number {
	for (let i = from; i < end; i++) {
		if (content[i] !== "'") continue;
		if (content[i + 1] === "'") i++;
		else return i;
	}
	return end;
}

/**
 * 扫描 frontmatter 正文，返回全部引号串的内侧区间（按出现顺序）。
 *
 * 追踪的状态：流式集合深度；当前是否在「节点起点」；块标量正文的父节点列（缩进大于它的行都是正文，
 * 整行跳过）；多行裸值（缩进大于父节点列的续行仍属同一裸值，行首引号是普通字符）。
 */
export function yamlQuotedRanges(content: string, body: FrontmatterBody): YamlQuotedRange[] {
	const ranges: YamlQuotedRange[] = [];
	const { end } = body;
	let i = body.start;
	let lineStart = i;
	let atLineStart = true;
	let flowDepth = 0;
	let nodeStart = true;
	/** 刚闭合一个引号串：JSON 风格的 `"k":v` 里紧跟的 `:` 也是映射分隔。 */
	let afterQuoted = false;
	/** 当前条目的父节点列：映射取键所在列，序列标量取 `-` 所在列。 */
	let entryColumn = 0;
	/** 当前节点（键或值）起始列，遇 `: ` 时成为 entryColumn。 */
	let nodeColumn = 0;
	/** ≥0：处在块标量正文里，缩进大于它的行都是正文。 */
	let blockParent = -1;
	/** ≥0：上一行留下一个未结束的块内裸值，缩进大于它的行是续行。 */
	let plainParent = -1;

	const lineEndFrom = (from: number) => {
		const nl = content.indexOf("\n", from);
		return nl === -1 || nl > end ? end : nl;
	};

	while (i < end) {
		if (atLineStart) {
			atLineStart = false;
			lineStart = i;
			let j = i;
			while (j < end && content[j] === " ") j++;
			const indent = j - i;
			const lineEnd = lineEndFrom(i);
			const blank = content.slice(j, lineEnd).trim() === "";
			if (blockParent >= 0) {
				if (blank || indent > blockParent) {
					i = lineEnd + 1;
					atLineStart = true;
					continue;
				}
				blockParent = -1;
			}
			i = j;
			if (flowDepth === 0) {
				if (plainParent >= 0 && (blank || indent > plainParent)) {
					nodeStart = false; // 多行裸值的续行：行首引号是普通字符
				} else {
					plainParent = -1;
					nodeStart = true;
					entryColumn = indent;
				}
			}
			continue;
		}

		const ch = content[i];
		if (ch === "\n") {
			i++;
			atLineStart = true;
			continue;
		}
		if (ch === "#" && (nodeStart || isBlank(content[i - 1]) || i === lineStart)) {
			i = lineEndFrom(i); // 注释到行尾；注释会终结多行裸值
			plainParent = -1;
			continue;
		}

		if (nodeStart) {
			if (isBlank(ch)) {
				i++;
				continue;
			}
			if (ch === '"' || ch === "'") {
				const close =
					ch === '"'
						? closeDoubleQuote(content, i + 1, end)
						: closeSingleQuote(content, i + 1, end);
				ranges.push({ start: i + 1, end: close, style: ch === '"' ? "double" : "single" });
				nodeColumn = i - lineStart;
				i = close + 1;
				lineStart = content.lastIndexOf("\n", close) + 1; // 引号串可能跨行
				nodeStart = false;
				afterQuoted = true;
				continue;
			}
			if (
				(ch === "-" || ch === "?" || ch === ":") &&
				(i + 1 >= end || /\s/.test(content[i + 1]))
			) {
				if (ch === "-" && flowDepth === 0) entryColumn = i - lineStart;
				i++;
				continue;
			}
			if (ch === "[" || ch === "{") {
				flowDepth++;
				i++;
				continue;
			}
			if ((ch === "|" || ch === ">") && flowDepth === 0) {
				blockParent = entryColumn;
				i = lineEndFrom(i); // 块标量头（含可选的缩进 / 截断指示符与注释）
				continue;
			}
			if (ch === "&" || ch === "!") {
				while (i < end && !/\s/.test(content[i])) i++; // 锚点 / 标签属性：其后仍是节点起点
				continue;
			}
			nodeStart = false; // 裸值开始
			nodeColumn = i - lineStart;
			if (flowDepth === 0) plainParent = entryColumn;
		}

		if (
			ch === ":" &&
			(afterQuoted ||
				i + 1 >= end ||
				/\s/.test(content[i + 1]) ||
				(flowDepth > 0 && /[,[\]{}]/.test(content[i + 1])))
		) {
			// 映射分隔：前面是键，其后是值的节点起点。
			if (flowDepth === 0) entryColumn = nodeColumn;
			plainParent = -1;
			nodeStart = true;
			afterQuoted = false;
			i++;
			continue;
		}
		if (flowDepth > 0 && (ch === "," || ch === "]" || ch === "}")) {
			if (ch === ",") nodeStart = true;
			else flowDepth--;
			afterQuoted = false;
			i++;
			continue;
		}
		if (!isBlank(ch)) afterQuoted = false;
		i++;
	}
	return ranges;
}

/**
 * 为一份内容建「偏移区间 → 读写规则」的定位器：区间不在 frontmatter 里用 {@link BODY_CODEC}；
 * 整个落在某个双 / 单引号串内用对应的转义规则；frontmatter 里的其余位置只允许不需要转义的写入。
 */
export function linkCodecLocator(content: string): (start: number, end: number) => LinkTextCodec {
	const body = frontmatterBody(content);
	if (!body) return () => BODY_CODEC;
	const quoted = yamlQuotedRanges(content, body);
	return (start, end) => {
		if (end <= body.start || start >= body.end) return BODY_CODEC;
		const range = quoted.find((r) => r.start <= start && end <= r.end);
		if (!range) return UNQUOTED_CODEC;
		return range.style === "double" ? DOUBLE_CODEC : SINGLE_CODEC;
	};
}
