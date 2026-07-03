/**
 * 白名单匹配（引擎四职之一，Milestone 4，见 `numbering.ts` 顶部说明）。
 *
 * 命中白名单的标题不写编号前缀、不占计数器槽位（既不累加也不归零、不跳号）。比较前对标题文本与条目
 * 词语应用同一套**归一化**（见 {@link normalizeForWhitelist}），归一化**仅用于判定，绝不改写文件**。
 * 三种匹配方式（exact/partial/subtree）的命中与「取豁免范围最大者」的并集解析见
 * {@link computeWhitelistExemptions}。
 */

import type { Heading } from "./parser";
import { stripHeadingPrefix, stripPrefix, type StripAffixOptions } from "./strip";
import type { Template, WhitelistEntry } from "./template";

/**
 * 去除行内 Markdown 标记，仅用于白名单归一化（见 {@link normalizeForWhitelist}）。
 * - 链接 / 图片 `[文字](url)` / `![alt](url)` → 还原为「文字」/「alt」。
 * - 强调 / 代码标记 `*`、`_`、`` ` `` 直接删除（`**目录**`、`_目录_`、`` `目录` `` 均归一为「目录」）。
 */
function stripInlineMarkdown(s: string): string {
	return s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "");
}

/**
 * 白名单命中判定前对文本的**归一化**（见 spec.md §3.7）。**仅用于命中判定，绝不改写写入文件的内容。**
 *
 * 步骤（标题文本须先由调用方剥离编号前缀，见 {@link computeWhitelistExemptions}）：
 * 1. 去除行内 Markdown 标记（`**` / `*` / `_` / `` ` `` 与链接）。
 * 2. Unicode **NFKC** 归一（折叠全角 / 半角等价字符，如全角空格 U+3000 → 普通空格）。
 * 3. 双侧 `trim()` 并将内部连续空白折叠为单个空格。
 * 4. 拉丁字母统一转小写（使「Appendix」≡「appendix」）。
 *
 * 如此 `## **目录**`、含全角空格的标题、`## APPENDIX` 都能稳定命中条目「目录」/「Appendix」。
 */
export function normalizeForWhitelist(text: string): string {
	let s = stripInlineMarkdown(text);
	s = s.normalize("NFKC");
	s = s.trim().replace(/\s+/g, " ");
	return s.toLowerCase();
}

/** {@link computeWhitelistExemptionDetail} 的结果：豁免集合 + 子树块成员集合。 */
export interface WhitelistExemptions {
	/** 应被豁免（不写前缀、不占计数器槽位）的标题集合。 */
	exempt: Set<Heading>;
	/**
	 * 属于某个**子树**豁免块（根或其子孙）的标题集合（`exempt` 的子集）。
	 * 子树块视为**独立结构**（如附录）：块结束后计数器**重新开始**（决策 D1，见 spec.md §3.7 /
	 * testplan D9/D10）；`exact` / `partial` 的单标题豁免不在此列、不触发重置。
	 */
	subtreeMembers: Set<Heading>;
}

/**
 * 计算一篇文档里应被白名单**豁免**（不写前缀、不占计数器槽位）的标题集合，并标出其中的子树块成员。
 *
 * 对每个标题：先用 {@link stripPrefix} 剥离本模板写入的旧编号前缀（豁免即去号，见 testplan D7），
 * 再 {@link normalizeForWhitelist} 归一，与各条目（同样归一）逐一比对：
 * - `exact`：归一后**完全相等** → 豁免该标题自身。
 * - `partial`：归一后**包含**条目子串 → 豁免该标题自身。
 * - `subtree`：归一后**完全相等** → 以该标题为根，连同其后所有**层级更深**的标题（遇与根**同级或
 *   更高级**的标题即终止）整体豁免，并记入 `subtreeMembers`（块后计数器重置，决策 D1）。
 *
 * **多条目命中取并集**（`子树 > 全部 = 部分`）：被任一条目命中即豁免；命中它的条目中只要有一条是
 * `subtree`（以它为根精确命中），就连同整棵子树一并豁免。空条目（归一后为空）忽略。
 */
export function computeWhitelistExemptionDetail(
	headings: Heading[],
	template: Template,
	options: StripAffixOptions = {},
): WhitelistExemptions {
	const exempt = new Set<Heading>();
	const subtreeMembers = new Set<Heading>();
	const entries = template.whitelist
		.map((e) => ({ norm: normalizeForWhitelist(e.text), match: e.match }))
		.filter((e) => e.norm.length > 0);
	if (entries.length === 0) {
		return { exempt, subtreeMembers };
	}

	// 预归一化每个标题（先剥前缀，使身上带旧编号的标题也能命中）。
	const normed = headings.map((h) =>
		normalizeForWhitelist(stripPrefix(h.rawText, h.level, template, options)),
	);

	for (let i = 0; i < headings.length; i++) {
		const nh = normed[i];
		let selfMatch = false;
		let subtreeMatch = false;
		for (const e of entries) {
			const hit = e.match === "partial" ? nh.includes(e.norm) : nh === e.norm;
			if (!hit) {
				continue;
			}
			if (e.match === "subtree") {
				subtreeMatch = true;
			} else {
				selfMatch = true;
			}
		}
		if (subtreeMatch) {
			// 子树：根 + 其下所有更深层级标题，遇同级 / 更高级终止。
			exempt.add(headings[i]);
			subtreeMembers.add(headings[i]);
			const rootLevel = headings[i].level;
			for (let j = i + 1; j < headings.length; j++) {
				if (headings[j].level <= rootLevel) {
					break;
				}
				exempt.add(headings[j]);
				subtreeMembers.add(headings[j]);
			}
		} else if (selfMatch) {
			exempt.add(headings[i]);
		}
	}
	return { exempt, subtreeMembers };
}

/**
 * 计算应被白名单豁免的标题集合（{@link computeWhitelistExemptionDetail} 的薄封装，保持既有 API）。
 * 需要区分子树块成员（决策 D1 的计数器重置）时用 detail 版。
 */
export function computeWhitelistExemptions(
	headings: Heading[],
	template: Template,
	options: StripAffixOptions = {},
): Set<Heading> {
	return computeWhitelistExemptionDetail(headings, template, options).exempt;
}

/** {@link analyzeWhitelist} 中单个白名单条目的命中信息（供设置面板角标与 ⚠ 告警）。 */
export interface WhitelistEntryHit {
	/** 该条目独立命中（作为根 / 自身）的标题数。 */
	count: number;
	/**
	 * 该条目命中的标题**展示文本**（剥离编号前缀后，按文档出现顺序，与 {@link count} 等长）。
	 * 供角标 tooltip 列出「具体命中了谁」（0.7.16，testplan L19）；GUI 侧自行截断长列表。
	 */
	matches: string[];
	/**
	 * 该条目为 `exact` / `partial`、且其命中的某个标题**下面还有子标题**——此时仅豁免标题自身、
	 * 子标题会错挂到上一已编号祖先（见 spec.md §3.7 / testplan D5），应改用「子树」。触发面板 ⚠ 提示。
	 */
	warnHasChildren: boolean;
}

/** {@link analyzeWhitelist} 的结果：用于设置面板的实时命中预览与逐条角标 / 告警。 */
export interface WhitelistPreview {
	/** 全部被豁免的标题（并集，按文档出现顺序），用于「当前文件将豁免 N 个标题：…」。 */
	exempted: Heading[];
	/** 与 `template.whitelist` **下标对齐**的逐条命中信息。 */
	perEntry: WhitelistEntryHit[];
}

/**
 * 针对**当前活动文件**分析白名单命中情况，供设置面板实时预览（命中数 + 标题清单）与逐条角标 / ⚠ 告警。
 *
 * - `exempted`：实际被豁免的标题并集（与 {@link computeWhitelistExemptions} 一致），按出现顺序。
 * - `perEntry[i]`：第 i 条白名单条目独立命中的标题数，以及「自身被全部 / 部分豁免却含子标题」的告警。
 */
export function analyzeWhitelist(
	headings: Heading[],
	template: Template,
	options: StripAffixOptions = {},
): WhitelistPreview {
	const normedHeadings = headings.map((h) =>
		normalizeForWhitelist(stripPrefix(h.rawText, h.level, template, options)),
	);
	// 命中标题的展示文本（剥前缀、不做归一化——tooltip 里给用户看原样文字）。
	const displayTexts = headings.map((h) => stripHeadingPrefix(h, h.level, template, options));
	const hasChildren = (i: number): boolean =>
		i + 1 < headings.length && headings[i + 1].level > headings[i].level;

	const perEntry: WhitelistEntryHit[] = template.whitelist.map((entry) => {
		const norm = normalizeForWhitelist(entry.text);
		let count = 0;
		let warnHasChildren = false;
		const matches: string[] = [];
		if (norm.length === 0) {
			return { count, warnHasChildren, matches };
		}
		for (let i = 0; i < headings.length; i++) {
			const hit =
				entry.match === "partial"
					? normedHeadings[i].includes(norm)
					: normedHeadings[i] === norm;
			if (!hit) {
				continue;
			}
			count++;
			matches.push(displayTexts[i]);
			if (entry.match !== "subtree" && hasChildren(i)) {
				warnHasChildren = true;
			}
		}
		return { count, warnHasChildren, matches };
	});

	const exemptSet = computeWhitelistExemptions(headings, template, options);
	const exempted = headings.filter((h) => exemptSet.has(h));
	return { exempted, perEntry };
}

/** 白名单编辑器的条目排序方式（纯视图层，M8 批次 1）：添加顺序 / A–Z / 匹配方式。 */
export type WhitelistSortMode = "added" | "az" | "match";

/**
 * 携带**原始下标**的白名单条目视图：过滤 / 排序绝不改动存储数组，
 * 删除、改匹配方式、命中数角标均按 `index` 回查原条目（见 testplan L14/L15）。
 */
export interface WhitelistEntryView {
	entry: WhitelistEntry;
	/** 条目在 `template.whitelist` 中的原始下标。 */
	index: number;
}

/** 「按匹配方式」排序时各方式的分组次序（全部 → 部分 → 子树）。 */
const MATCH_SORT_ORDER = { exact: 0, partial: 1, subtree: 2 } as const;

/**
 * 为白名单编辑器计算**纯视图层**的过滤 + 排序结果（M8 批次 1，见 testplan L14/L15）。
 *
 * - **过滤**：与白名单命中判定同一套归一化（{@link normalizeForWhitelist}：NFKC / 小写 /
 *   折叠空白）后做子串包含——搜索「appendix」能匹配条目「Appendix」。空搜索词不过滤。
 * - **排序**：`added` 保持存储顺序（数组序即添加序）；`az` 按 `localeCompare`；
 *   `match` 按 全部→部分→子树 分组、组内保持添加序（`Array.prototype.sort` 稳定）。
 * - **不改动存储数组**：返回的视图携带原始下标。
 */
export function filterSortWhitelist(
	entries: readonly WhitelistEntry[],
	filter: string,
	sort: WhitelistSortMode,
): WhitelistEntryView[] {
	const needle = normalizeForWhitelist(filter);
	let views: WhitelistEntryView[] = entries.map((entry, index) => ({ entry, index }));
	if (needle !== "") {
		views = views.filter((v) => normalizeForWhitelist(v.entry.text).includes(needle));
	}
	if (sort === "az") {
		views = [...views].sort((a, b) => a.entry.text.localeCompare(b.entry.text));
	} else if (sort === "match") {
		views = [...views].sort(
			(a, b) => MATCH_SORT_ORDER[a.entry.match] - MATCH_SORT_ORDER[b.entry.match],
		);
	}
	return views;
}
