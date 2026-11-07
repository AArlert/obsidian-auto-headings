/**
 * M6 全样式并集剥离器：清除编号，独立于任何模板（见 spec.md §3.10）。
 *
 * 对外暴露 {@link clearNumberingContent}，用于：
 * - 「清除当前文件编号」命令（main.ts）：对 Editor 内容调用后以单一事务写回。
 * - 「清除全库编号」按钮（SettingsTab.ts）：对每个 .md 文件读取 → 清除 → 写回。
 *
 * 另暴露只读探测 {@link hasUnclaimedForeignNumbering}，供 main.ts 自动路径在写入前判断是否为
 * 「插件从未接触过 + 疑似外来编号」的迁移场景（testplan J10）；以及 {@link previewForeignNumberingCleanup}，
 * 供迁移守卫 Notice 点击后的清理预览确认框计算「现状 → 清理后」逐条对照（testplan J14）。
 */

import { assessForeignNumbering, type ForeignTier } from "./foreignassess";
import { parseHeadings } from "./parser";
import {
	cleanDemotedResidue,
	hasPluginPrefix,
	isNumberOnlyHeading,
	stripPrefixBroad,
	WORD_JOINER,
} from "./numbering";

/** {@link clearNumberingContent} 的可选项。 */
export interface CleanupOptions {
	/** 已知前缀候选（含空串；由 main.ts 传入全模板前缀并集，提高对历史前缀的识别率）。 */
	strippablePrefixes?: readonly string[];
	/** 已知后缀候选（同上）。 */
	strippableSuffixes?: readonly string[];
	/**
	 * 不带插件痕迹的标题一律不动（手写编号原样留下）。「清除全库编号」用它（testplan H24）：批量、未打开的文件
	 * 撤销不了，又常是卸载前的清理，只该清插件自己写的；手写编号交给逐篇、带预览的「清理手写编号…」。
	 */
	keepForeign?: boolean;
}

/**
 * 剥离内容中**所有标题**（代码块外）的编号前缀，返回无编号的裸标题文本。
 *
 * 使用**全样式并集**剥离器（arabic ∪ cjk ∪ circled ∪ lower-alpha ∪ upper-alpha），独立于任何
 * 模板——不管历史编号是用哪个模板、哪种序号样式写入的，都尽力剥净。仅剥一层（「2024 折中」）。
 *
 * **已知风险（spec §3.10 / §2.3 预期取舍）**：若标题文本恰以序号样字（含字母）开头紧跟分隔符
 * （如用户手写的 `## 1.1 标题`、`## a) 备注`），全样式剥离器可能将其误当作插件前缀剥掉。
 * 这是「清除编号」命令固有的权衡——与 {@link stripPrefix} 的既有风险同源。
 *
 * @param content 待清除的 Markdown 文件全文。
 * @param options 可选的前后缀候选（传入全模板前后缀并集可提高识别率）。
 * @returns 剥除编号前缀后的文件全文；若无任何标题则原样返回。
 */
export function clearNumberingContent(content: string, options: CleanupOptions = {}): string {
	const headings = parseHeadings(content);
	const prefixes = options.strippablePrefixes ?? [];
	const suffixes = options.strippableSuffixes ?? [];

	const lines = content.split("\n");
	const headingLines = new Set<number>();
	const affixes = { strippablePrefixes: prefixes, strippableSuffixes: suffixes };
	// 不带插件前缀的标题只剥「确定」的手写编号，「存疑」原样留给用户在清理预览框里定（testplan H23）。
	const sure = new Map(
		options.keepForeign
			? []
			: assessForeignNumbering(content)
					.filter((a) => a.tier === "sure")
					.map((a) => [a.lineIndex, a.stripped]),
	);
	for (const h of headings) {
		const hashes = "#".repeat(h.level);
		const text = hasPluginPrefix(h.rawText, affixes)
			? stripPrefixBroad(h.rawText, prefixes, suffixes)
			: (sure.get(h.lineIndex) ?? h.rawText.replace(/\s+$/, ""));
		lines[h.lineIndex] = `${hashes} ${text}`;
		headingLines.add(h.lineIndex);
	}
	// 与 renumberContent 的 ③ 一致：也清掉「降级为正文」的行里残留的 WJ 哨兵 + 编号——否则用户降级
	// 标题后跑「清除编号」会留下 `⁠①） 三` 之类垃圾。清除是全样式独立于模板，故用 stripPrefixBroad。
	// 与自动路径不同，清除命令**注释块与围栏内一并清**：注释里的 WJ 残留在阅读视图不可见、用户肉眼
	// 永远找不到，若挺过「清除全库编号」就直接违背标记契约「永远可退出 / 精确剥净」的承诺。
	cleanDemotedResidue(
		lines,
		headingLines,
		(paragraph) => stripPrefixBroad(paragraph, prefixes, suffixes),
		{ comments: true, fences: true },
	);
	return lines.join("\n");
}

/**
 * 只剥离**本插件写入**（带 Word Joiner 标记）的编号前缀，手写 / 外来编号原样保留（M14，spec.md §3.22）。
 *
 * 用于「写入 → 仅显示」的模式切换与「清除本文件残留编号」命令。与 {@link clearNumberingContent} 的区别：
 * - 只动**以 WJ 开头**的标题：按标记契约，插件前缀以首哨兵打头；这些行用全样式剥离器剥净（含尾哨兵
 *   被毁的残缺前缀）。其余标题一个字节都不动——批量切换模式时不能顺手吃掉用户手写的 `1.1`，也不能
 *   把标题中间的 WJ（如指向写入文件标题的链接 `[[#⁠1 ⁠概述]]`）误当前缀截断。0.7.20 以前的单哨兵
 *   旧格式（WJ 在前缀之后）不认：1.0 上架时已是双哨兵，公开用户没有这种数据。
 * - 降级残留只清正文与注释块，**不进围栏**：与自动路径同一口径（spec §3.17），围栏里的 WJ 可能是用户
 *   有意写的代码示例，批量操作不该碰。
 * - 不碰 frontmatter（不写 `fm:false`）：写了反而会关掉虚拟渲染。
 *
 * @param content 待清除的 Markdown 文件全文。
 * @param options 可选的前后缀候选（传入全模板前后缀并集可提高残缺前缀的识别率）。
 * @returns 剥除插件前缀后的全文；无插件前缀时原样返回（字节不变）。
 */
export function clearPluginNumberingContent(content: string, options: CleanupOptions = {}): string {
	if (!content.includes(WORD_JOINER)) {
		return content;
	}
	const prefixes = options.strippablePrefixes ?? [];
	const suffixes = options.strippableSuffixes ?? [];
	const lines = content.split("\n");
	const headingLines = new Set<number>();
	for (const h of parseHeadings(content)) {
		headingLines.add(h.lineIndex);
		if (!h.rawText.startsWith(WORD_JOINER)) {
			continue;
		}
		const text = stripPrefixBroad(h.rawText, prefixes, suffixes);
		lines[h.lineIndex] = `${"#".repeat(h.level)} ${text}`;
	}
	cleanDemotedResidue(
		lines,
		headingLines,
		(paragraph) => stripPrefixBroad(paragraph, prefixes, suffixes),
		{ comments: true, fences: false },
	);
	return lines.join("\n");
}

/** 内容里是否有本插件写入的编号（{@link clearPluginNumberingContent} 会不会改动它）。 */
export function hasPluginNumbering(content: string): boolean {
	return content.includes(WORD_JOINER) && clearPluginNumberingContent(content) !== content;
}

/**
 * 剥离内容中**外来 / 手写**（**非本插件写入**）的标题编号前缀，返回清理后的全文（0.6.6，spec §3.10）。
 *
 * 与 {@link clearNumberingContent} 的区别：本函数**只动不带插件前缀的标题**——带的是本插件自己写的编号，
 * **原样保留不动**；其余标题（含「中间有链接锚点 WJ」的，testplan E40）按整篇判定
 * {@link assessForeignNumbering} 的结果剥一层外来编号。用于「我有一批手写 / 导入的编号，想清掉好让插件接管」
 * 的场景（方案 A 下插件不会自动吸收无 WJ 的手写编号，故提供此主动清理命令）。
 *
 * - **不传 `keepLines`**（命令面板，不弹框）：只剥「确定」，「存疑」原样保留（testplan J34）。
 * - **传 `keepLines`**（清理预览框确认）：用户勾选的一律剥（含勾上的「存疑」），`keepLines` 里的保留原文
 *   （testplan J17）；插件仍会在下一步套用模板时把自己的编号叠在原文前面——由调用方（main.ts）紧接着调用
 *   renumberContent 完成。
 *
 * @param content 待清理的 Markdown 文件全文。
 * @returns 剥除外来编号前缀后的全文；无可剥条目则原样返回。
 */
export function clearForeignNumberingContent(
	content: string,
	options: { keepLines?: ReadonlySet<number> } = {},
): string {
	const lines = content.split("\n");
	for (const a of assessForeignNumbering(content)) {
		const keep = options.keepLines ? options.keepLines.has(a.lineIndex) : a.tier !== "sure";
		if (!keep) {
			lines[a.lineIndex] = `${"#".repeat(a.level)} ${a.stripped}`;
		}
	}
	return lines.join("\n");
}

/** 插件接触过的行：去前导空白（及可选的 `#` 段）后以 WJ 哨兵起头——已编号标题或降级残留。 */
const CLAIMED_LINE_RE = new RegExp(`^[ \\t]*(?:#{1,6}[ \\t]+)?${WORD_JOINER}`, "m");

/**
 * 只读探测：本文件是否「插件从未接触过」且含外来编号（迁移守卫，testplan J10）。
 *
 * 用于自动路径（`scheduleRenumber`/`renumberOnOpen`/`renumberActiveFile`）写入前的门控——方案A下
 * 自动路径只认 WJ，会把 `## 1 红米` 当纯正文、在前面再叠一层自己的编号，写成 `## 1 1 红米`，观感
 * 上与 bug 无异。命中时调用方应跳过本次自动写入，引导用户先跑「清理非本插件的标题编号」
 * （{@link clearForeignNumberingContent}）。**手动命令不查此函数**——用户显式触发的操作永远按既定
 * 语义执行。
 *
 * 判定条件**两者都满足**才为 true：
 * - 插件从未给这份内容写过编号：没有任何行以 {@link WORD_JOINER} 哨兵起头、也没有标题带插件前缀（避免把
 *   「已被本插件接管、只是新增了一个以数字起头的标题」误判为迁移场景，见 spec §3.10 相邻讨论）；
 * - 至少一个标题被整篇判定为「确定」（{@link assessForeignNumbering}），**或**过半标题「确定」或本身就是编号
 *   （`# 第一章`，{@link isNumberOnlyHeading}，testplan J25）。「存疑」（`## 2024 总结`、`## 30 秒版`）**不拦**
 *   （testplan J31）——此前单标题正则一个误判就拦下整篇。
 */
export function hasUnclaimedForeignNumbering(content: string): boolean {
	// 「插件接触过」只认结构性证据：某行（含注释 / 围栏里的标题形残留、降级残留）以 WJ 哨兵起头，或某个
	// 标题带插件前缀（含旧单哨兵）。**不能**看全文含不含 WJ：`displayAnchor` 会把 WJ 写进任何文件里指向
	// 已编号标题的链接（`[[a#⁠1 ⁠概述]]`），一条链接就足以废掉整份文件的守卫（1.1.5 修，testplan E40）。
	if (CLAIMED_LINE_RE.test(content)) {
		return false;
	}
	const headings = parseHeadings(content);
	if (headings.some((h) => hasPluginPrefix(h.rawText))) {
		return false;
	}
	const sure = sureLines(content);
	return sure.size > 0 || isMostlyForeignHeadings(headings, sure);
}

/**
 * 仅显示模式的外来编号判定（M14，spec §3.22）：**超过一半**的标题「确定」带手写编号或本身就是编号，才算
 * 整篇带外来编号、不显示虚拟编号（否则会叠出两套数字）。「存疑」不计（testplan V80）。
 *
 * 为什么不沿用写入模式「一个就算」的 {@link hasUnclaimedForeignNumbering}：写入模式下用户在清理框里
 * 确认一次，插件写入编号后文件含 WJ，守卫就永久解除；仅显示模式永不写文件，没有这个出口。按多数判定后：
 * 从别的编号插件迁来、每个标题都带编号的笔记照样被拦下；偶尔一个手写编号的标题照常编号。
 * 以 WJ 打头的标题是本插件写过的残留，不算外来编号。
 */
export function isMostlyForeignNumbered(content: string): boolean {
	return isMostlyForeignHeadings(parseHeadings(content), sureLines(content));
}

/** 整篇判定为「确定」的标题行号。 */
function sureLines(content: string): Set<number> {
	return new Set(
		assessForeignNumbering(content)
			.filter((a) => a.tier === "sure")
			.map((a) => a.lineIndex),
	);
}

/**
 * 过半判定的本体：超过一半的标题「确定」带手写编号，或**本身就是编号**（`# 第一章`，{@link isNumberOnlyHeading}；
 * 剥不掉，但套模板会叠成「第一章 第一章」，testplan J25 / V77）。
 *
 * 也按**级别**算一遍（testplan V81）：手写编号通常只用在某一级（`## 一、` 下挂一堆不带编号的 `###`），按全篇
 * 标题数算永远不过半，仅显示模式就会叠出 `1 一、背景`。某一级至少 2 个且占该级过半，同样算整篇带外来编号；
 * 只有一处的（`## 〇、一屏结论`）不算。
 */
function isMostlyForeignHeadings(
	headings: ReturnType<typeof parseHeadings>,
	sure: ReadonlySet<number>,
): boolean {
	if (headings.length === 0) {
		return false;
	}
	const isForeign = (h: (typeof headings)[number]) =>
		!h.rawText.startsWith(WORD_JOINER) &&
		(sure.has(h.lineIndex) || isNumberOnlyHeading(h.rawText));
	const foreign = headings.filter(isForeign).length;
	if (foreign * 2 > headings.length) {
		return true;
	}
	const byLevel = new Map<number, { total: number; foreign: number }>();
	for (const h of headings) {
		const s = byLevel.get(h.level) ?? { total: 0, foreign: 0 };
		s.total++;
		if (isForeign(h)) {
			s.foreign++;
		}
		byLevel.set(h.level, s);
	}
	return [...byLevel.values()].some((s) => s.foreign >= 2 && s.foreign * 2 > s.total);
}

/** 整篇判定为「存疑」的标题数——清理 / 清除命令跳过它们后，结果提示据此给「检查…」入口（testplan J34 / H23）。 */
export function countUnsure(content: string): number {
	return assessForeignNumbering(content).filter((a) => a.tier === "unsure").length;
}

/** {@link previewForeignNumberingCleanup} 单条对照项：某标题清理前后的完整行文本。 */
export interface ForeignNumberingPreviewItem {
	/** 该标题所在行号（0-based），用于清理预览确认框关联逐条勾选状态（testplan J17）。 */
	lineIndex: number;
	/** 清理前的完整标题行（`#` 组 + 原始文本）。 */
	before: string;
	/** 剥离外来编号后的完整标题行（不含模板前缀，仅剥离外来编号后的中间态）。 */
	after: string;
	/** 整篇判定的档位：「存疑」在清理预览框里默认不勾（testplan J33）。 */
	tier: ForeignTier;
}

/**
 * 预览 {@link clearForeignNumberingContent} 能改动哪些标题（清理预览确认框用，testplan J14）：「确定」与「存疑」
 * 都列出，按标题在文中出现的顺序；带插件前缀的、剥不出东西的不列。
 *
 * 与 {@link clearForeignNumberingContent} 共享同一份整篇判定 {@link assessForeignNumbering}，保证预览与
 * 「确认清理」后的实际结果逐条一致——绝不能出现预览说改 A、实际却改了 B 的落差。
 *
 * @param content 待预览的文件全文（通常取自实时编辑器 `editor.getValue()`）。
 * @returns 「现状 → 清理后」对照列表；无候选返回空数组。
 */
export function previewForeignNumberingCleanup(content: string): ForeignNumberingPreviewItem[] {
	const raw = new Map(parseHeadings(content).map((h) => [h.lineIndex, h.rawText]));
	return assessForeignNumbering(content).map((a) => {
		const hashes = "#".repeat(a.level);
		return {
			lineIndex: a.lineIndex,
			before: `${hashes} ${raw.get(a.lineIndex) ?? ""}`,
			after: `${hashes} ${a.stripped}`,
			tier: a.tier,
		};
	});
}
