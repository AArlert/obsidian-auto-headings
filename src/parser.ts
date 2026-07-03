/**
 * Markdown 标题解析器（Milestone 1）。
 *
 * 负责把原始 Markdown 文本逐行扫描为结构化的标题列表：
 * - 识别 ATX 标题行（行首一个或多个 `#` 加空格）。
 * - 记录标题级别（1–6）与标题文本。
 * - 跳过围栏代码块（``` 或 ~~~）内部的 `#` 行——它们不是标题。
 *
 * 本模块只做"结构识别"，不依赖任何模板；剥离已有编号前缀这类与模板相关
 * 的逻辑放在 numbering.ts 中处理。
 */

/** 单个被识别出的标题。 */
export interface Heading {
	/** 标题级别，1–6（`#` 的数量）。 */
	level: number;
	/** `#` 与其后空白之后的标题文本（已去除行尾空白；编号前缀**未**剥离）。 */
	text: string;
	/**
	 * `#` 与其后空白之后的标题文本，**保留行尾空白**（编号前缀**未**剥离）。
	 *
	 * 与 {@link text} 唯一的区别是不 trim 行尾空白。这对剥离编号前缀至关重要：当用户在**空行**
	 * 上用快捷键直接转成标题时，行形如 `### `，插件写入前缀后变为 `### 1.1 `（末尾即标题间隔符
	 * 那个空格）。若按 trim 后的 `text`（`1.1`）去剥离，会因缺了间隔符而剥不掉→被当正文→左侧再
	 * 叠一层新前缀，出现「1.1 1.1」叠加。改用本字段（`1.1 `，含尾随空格）剥离即可干净命中，
	 * 又不会误伤「`# 三`」这类**本身就是序号字样、末尾无空格**的真实标题。
	 */
	rawText: string;
	/** 标题所在行的下标（0 起）。 */
	lineIndex: number;
	/** 原始整行内容。 */
	raw: string;
}

/** 匹配围栏代码块的起止行：行首至多 3 个空格 + 至少 3 个反引号或波浪号。 */
export const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** 匹配 ATX 标题行：行首 1–6 个 `#`，其后至少一个空白，再跟标题文本。 */
const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/;

/**
 * 将完整文件内容解析为标题列表。
 *
 * 围栏代码块的识别规则：以 ``` 或 ~~~ 开启，必须由**同种**栅栏符号闭合
 * （CommonMark 行为）；代码块内部的所有行（包括看似标题的 `#` 行）都被忽略。
 */
export function parseHeadings(content: string): Heading[] {
	const lines = content.split("\n");
	const headings: Heading[] = [];

	let inFence = false;
	/** 开启当前代码块的栅栏符号首字符（'`' 或 '~'），用于要求同种符号闭合。 */
	let fenceChar = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		const fence = line.match(FENCE_RE);
		if (fence) {
			const char = fence[1][0];
			if (!inFence) {
				inFence = true;
				fenceChar = char;
			} else if (char === fenceChar) {
				inFence = false;
				fenceChar = "";
			}
			// 栅栏行本身不可能是标题，直接进入下一行。
			continue;
		}

		if (inFence) {
			continue;
		}

		const m = line.match(HEADING_RE);
		if (m) {
			headings.push({
				level: m[1].length,
				text: m[2].replace(/\s+$/, ""),
				rawText: m[2],
				lineIndex: i,
				raw: line,
			});
		}
	}

	return headings;
}
