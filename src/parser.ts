/**
 * Markdown 标题解析器（Milestone 1）。
 *
 * 负责把原始 Markdown 文本逐行扫描为结构化的标题列表：
 * - 识别 ATX 标题行（行首一个或多个 `#` 加空格）。
 * - 记录标题级别（1–6）与标题文本。
 * - 跳过「不该介入的区域」内的 `#` 行——围栏代码块（``` / ~~~）与注释块（`%%…%%` /
 *   `<!--…-->`）。区域判定由 {@link scanSkipRegions} 统一负责（见 scan.ts 的裁决表）。
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

import { isSkipped, scanSkipRegions } from "./scan";

/**
 * 匹配围栏代码块的起止行。
 *
 * @deprecated 已迁入 {@link scan.FENCE_RE}（跳过区域的单一事实源）。此处 re-export 仅为
 * 兼容既有 import，新代码请从 `./scan` 取。
 */
export { FENCE_RE } from "./scan";

/** 匹配 ATX 标题行：行首 1–6 个 `#`，其后至少一个空白，再跟标题文本。 */
const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/;

/**
 * **单标题跳过标记**（用户 issue #6，见 spec.md §3.21）：写在标题行**末尾**的 HTML 注释
 * `<!-- skip -->`，命中该标记的标题不参与编号。
 *
 * 形态约束与理由：
 * - **必须在行尾**：`^` 之外的位置出现 `<!-- skip -->` 多半是用户在写正文/批注，不该被当成指令。
 * - **HTML 注释**而非 `^skip` 之类：注释在阅读视图天然不可见，且 1.0.14 的注释块跳过（spec §3.17
 *   R2「行首定标题」）已经保证 `## 标题 <!-- … -->` **本行仍是标题**、行内闭合也不遮蔽下方——
 *   正是本标记需要的语义，无需为它另开解析分支。
 * - **大小写不敏感、容忍内部空白**：`<!--skip-->`、`<!--  SKIP  -->` 一律认。写入侧（将来的 GUI
 *   一键切换）只产出规范形态 ` <!-- skip -->`。
 * - 与竞品 gurjar1 的标记**刻意同形**：两者本就声明不可共存（marker-contract §4），同形可以让
 *   从它迁移过来的用户的既有标记直接继续生效，迁移成本为零。
 */
const SKIP_MARKER_RE = /<!--\s*skip\s*-->\s*$/i;

/**
 * 判定一个标题是否带「跳过编号」标记。
 *
 * 传 {@link Heading.rawText}（保留行尾空白的那个字段）；传 `text` 亦可，正则末尾的 `\s*$`
 * 对两者等价。
 */
export function hasSkipMarker(headingText: string): boolean {
	return SKIP_MARKER_RE.test(headingText);
}

/**
 * 将完整文件内容解析为标题列表。
 *
 * 跳过区域的识别规则见 {@link scanSkipRegions}：围栏代码块须由**同种**栅栏符号闭合
 * （CommonMark 行为）；注释块按字符级配对，某行是否算标题只看它**行首**是否被遮蔽。
 * 区域内部的所有 `#` 行都被忽略——不编号、不推进计数器、不进 backlink 快照。
 */
export function parseHeadings(content: string): Heading[] {
	const lines = content.split("\n");
	const headings: Heading[] = [];
	const skip = scanSkipRegions(lines);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (isSkipped(skip[i])) {
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
