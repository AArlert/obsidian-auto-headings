/**
 * 全 vault 标题索引（M13「标题链接建议」，见 spec.md Roadmap M13 与 doc/research 方案 §2）。
 *
 * 把「剥编号前缀后的标题原文 → 位置」建成一份内存索引，供 EditorSuggest 做前缀匹配。
 * 刻意与编号引擎解耦：**不依赖** Template / pathRules / 白名单 / topLevel / bottomLevel——
 * 白名单豁免的标题（如「附录」）依然存在、依然应该可以被链接；「不编号」伪模板命中的
 * 文件夹同理。跳过围栏代码块 / 注释块内的假标题由 {@link parseHeadings} 保证，这里不重复实现。
 *
 * 数据结构：按 matchKey（normalizeForWhitelist 归一化后的标题原文）升序的扁平数组 +
 * 二分查找（见 {@link HeadingIndex.queryPrefix}），增量更新为「摘除旧条目 + 二分插入」。
 * 为可测试性主动选择排序数组而非 Trie（方案 §2.3）：整个结构是可直接纯函数单测的普通数组。
 */

import { displayAnchor } from "./backlinks";
import { parseHeadings } from "./parser";
import { stripPrefix } from "./strip";
import { normalizeForWhitelist } from "./whitelist";

/** 单个病态文件（如自动生成的日志）最多收录的标题数（方案 §2.4，可调常量）。 */
const MAX_HEADINGS_PER_FILE = 500;
/** 全库标题索引总量上限（方案 §2.4，可调常量）；达到后停止收录后续文件并置 truncated。 */
const MAX_INDEXED_HEADINGS = 50000;

/**
 * 「套话标题」门槛（testplan Q32）：同名标题（同一 matchKey）出现在这么多个文件里，就视为模板化的
 * 小节名（【边界】【反问】【Summary】），不参与标题链接建议、不写进 VC 词典。
 *
 * 为什么是 3（用户主力库实测，2026-10-18）：1987 个不同标题里 85% 只在一个文件出现；出现在 2 个文件的
 * 195 个多是真概念（`apb`、`cdc`），≥ 3 个文件的 102 个几乎全是面试模板小节。同名标题本来也
 * 不是好的链接目标——十几个文件里都有【流程】，链到哪个都说不清。
 */
export const GENERIC_FILE_COUNT = 3;

/**
 * 是否 Excalidraw 绘图文件（testplan Q33）：文件名 `*.excalidraw.md`，或 frontmatter 带
 * `excalidraw-plugin` 键。这类文件里的【Excalidraw Data】【Text Elements】是插件的存储结构，
 * 不是用户写的标题——主力库实测各 48 个，原样收录会让它们成为头号「套话」。
 */
export function isExcalidrawFile(path: string, content: string): boolean {
	if (/\.excalidraw\.md$/i.test(path)) {
		return true;
	}
	const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
	return !!fm && /^excalidraw-plugin\s*:/m.test(fm[1]);
}

/**
 * 查询时要排除的那一条：某文件的某一行（testplan Q7：正在写的标题不建议给它自己）。行号取自上次收录该文件时，
 * 用户正在这一行打字时它基本不会漂移。
 */
export interface ExcludeAt {
	path: string;
	lineIndex: number;
}

const isExcluded = (e: HeadingIndexEntry, ex: ExcludeAt | undefined): boolean =>
	!!ex && e.path === ex.path && e.lineIndex === ex.lineIndex;

/** 「标题这一层」有没有变（只看会进词典的字段，不看行号——正文增删行只会让行号漂移）。 */
function sameHeadings(a: readonly HeadingIndexEntry[], b: readonly HeadingIndexEntry[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (
			a[i].matchKey !== b[i].matchKey ||
			a[i].anchor !== b[i].anchor ||
			a[i].displayText !== b[i].displayText
		) {
			return false;
		}
	}
	return true;
}

/** vault 标题索引中的一条标题记录。 */
export interface HeadingIndexEntry {
	/** 文件的 vault 相对路径（含 .md 后缀），即 TFile.path。 */
	path: string;
	/** 文件 basename（不含目录与 .md 后缀），用于拼 `[[basename#...]]`。 */
	basename: string;
	/** 标题级别 1–6。 */
	level: number;
	/** 标题所在行号（0 起）。v1 不使用（不做「跳到具体行」），留作后续扩展（如侧栏大纲）。 */
	lineIndex: number;
	/** 剥离本插件编号前缀后的标题文本（未归一化，已 trim），用于建议列表展示与 alias 兜底。 */
	displayText: string;
	/** displayText 经 normalizeForWhitelist 归一化后的匹配 key，用于前缀匹配。 */
	matchKey: string;
	/** 写入链接锚点用的文本（保留 WJ，已用 displayAnchor 处理）。 */
	anchor: string;
}

/**
 * 把单个文件的内容解析为索引条目（纯函数）。
 *
 * 注意两个**不能混用**的文本来源（与 strip.ts / backlinks.ts 的既有约定一致）：
 * - 剥前缀取原文走 `stripPrefix(h.rawText)`——rawText 保留行尾空白，空标题行（`### 1.1 `）
 *   能干净剥成空从而被跳过；缺省 level/template 即可（双哨兵完好或完全无 WJ 时行为正确）。
 * - 构造锚点走 `displayAnchor(h.text)`——text 已 trim，与 backlinks.ts 的既有用法一致。
 */
export function buildEntriesForFile(
	path: string,
	basename: string,
	content: string,
): HeadingIndexEntry[] {
	if (isExcalidrawFile(path, content)) {
		return [];
	}
	const headings = parseHeadings(content);
	const out: HeadingIndexEntry[] = [];
	for (const h of headings) {
		if (out.length >= MAX_HEADINGS_PER_FILE) {
			break;
		}
		const displayText = stripPrefix(h.rawText)
			.replace(/^[ \t]+/, "")
			.replace(/\s+$/, "");
		if (!displayText) {
			continue; // 空标题（仅编号无文本）无法作为候选，跳过
		}
		const matchKey = normalizeForWhitelist(displayText);
		if (!matchKey) {
			continue;
		}
		out.push({
			path,
			basename,
			level: h.level,
			lineIndex: h.lineIndex,
			displayText,
			matchKey,
			anchor: displayAnchor(h.text),
		});
	}
	return out;
}

/** 排序 key：matchKey 主键 + path 次级键（确定性可测；对二分查找只需稳定全序）。 */
function compareEntries(a: HeadingIndexEntry, b: HeadingIndexEntry): number {
	if (a.matchKey !== b.matchKey) {
		return a.matchKey < b.matchKey ? -1 : 1;
	}
	if (a.path !== b.path) {
		return a.path < b.path ? -1 : 1;
	}
	return 0;
}

/** 在 sorted（按 compareEntries 升序）里找第一个「>= needle 的条目」的下标（needle 是完整条目）。 */
/** 在 sorted（按 compareEntries 升序）里找第一个「> needle 的条目」的下标——相等区间的**末尾**，
 *  插入点用它可保持「先插入在前」的稳定顺序（1.0.28 压测修复，见 setFile/renameFile）。 */
function upperBoundEntry(sorted: HeadingIndexEntry[], needle: HeadingIndexEntry): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (compareEntries(sorted[mid], needle) <= 0) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	return lo;
}

/** 在 sorted（按 matchKey 升序）里找第一个 matchKey >= needle 的下标（needle 是字符串）。 */
function lowerBoundByKey(sorted: HeadingIndexEntry[], needle: string): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (sorted[mid].matchKey < needle) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	return lo;
}

/**
 * 内存索引：按文件路径分桶 + 按 matchKey 排序的扁平数组（方案 §2.3）。
 *
 * `maxIndexed` 构造参数仅为测试可调（默认 {@link MAX_INDEXED_HEADINGS}）。
 */
export class HeadingIndex {
	private readonly byFile = new Map<string, HeadingIndexEntry[]>();
	private sorted: HeadingIndexEntry[] = [];
	private totalCount = 0;
	private truncated = false;
	/** matchKey → 含该标题的**文件数**（同一文件里重复的同名标题只算一次），判定套话标题用。 */
	private readonly keyFileCount = new Map<string, number>();

	constructor(private readonly maxIndexed: number = MAX_INDEXED_HEADINGS) {}

	/**
	 * 初始全量构建专用：一次性灌入 + 一次排序。
	 * 切勿循环调用 {@link setFile} 做初始构建——那会退化为 O((N·H)²)（见方案 §2.3）。
	 * 累计条目数达到上限后停止收录后续文件并置 `isTruncated`。
	 */
	loadInitial(files: Array<{ path: string; basename: string; content: string }>): void {
		this.byFile.clear();
		this.keyFileCount.clear();
		this.sorted = [];
		this.totalCount = 0;
		this.truncated = false;
		const all: HeadingIndexEntry[] = [];
		for (const f of files) {
			if (this.totalCount >= this.maxIndexed) {
				this.truncated = true;
				break;
			}
			const entries = buildEntriesForFile(f.path, f.basename, f.content);
			const room = this.maxIndexed - this.totalCount;
			const taken = entries.slice(0, room);
			if (entries.length > room) {
				this.truncated = true;
			}
			this.byFile.set(f.path, taken);
			this.adjustKeyFileCount(taken, 1);
			all.push(...taken);
			this.totalCount += taken.length;
		}
		all.sort(compareEntries);
		this.sorted = all;
	}

	/**
	 * 增量：单文件内容变化（新建/修改）后调用，替换该文件在索引中的全部条目。
	 * @returns 该文件的标题（文本 / 锚点）是否真的变了——只改正文时为 false，调用方据此决定要不要同步 VC 词典。
	 */
	setFile(path: string, basename: string, content: string): boolean {
		const entries = buildEntriesForFile(path, basename, content);
		const old = this.byFile.get(path) ?? [];
		const room = Math.max(0, this.maxIndexed - (this.totalCount - old.length));
		const taken = entries.slice(0, room);
		if (entries.length > room) {
			this.truncated = true;
		}
		this.byFile.set(path, taken);
		this.adjustKeyFileCount(old, -1);
		this.adjustKeyFileCount(taken, 1);
		this.totalCount = this.totalCount - old.length + taken.length;
		this.sorted = this.sorted.filter((e) => e.path !== path);
		for (const e of taken) {
			// 用 upperBound（相等区间的**末尾**）插入：同 (matchKey, path) 的条目保持
			// 「先插入在前」的稳定顺序（1.0.28 压测修复——lowerBound 前插会让反复更新
			// 同一文件时相同 key 的条目顺序反转，与参考模型稳定排序不一致）。
			this.sorted.splice(upperBoundEntry(this.sorted, e), 0, e);
		}
		return !sameHeadings(old, taken);
	}

	/** 增量：文件删除。 */
	removeFile(path: string): void {
		const old = this.byFile.get(path);
		if (!old) {
			return;
		}
		this.byFile.delete(path);
		this.adjustKeyFileCount(old, -1);
		this.totalCount -= old.length;
		this.sorted = this.sorted.filter((e) => e.path !== path);
	}

	/**
	 * 增量：文件改名——只改字段，不需要重新解析内容。
	 *
	 * 目标路径**已存在**时（改名覆盖，UVM 压测 1.0.28 覆盖）：被覆盖文件的旧条目一并移除、
	 * `totalCount` 同步修正——否则 sorted 里残留旧路径条目、计数漂移。**自身改名**
	 * （oldPath === newPath，UVM 压测 1.0.28 覆盖）按无操作处理：replaced 与 entries 是
	 * 同一数组，直接相减会把 totalCount 多扣一份。
	 */
	renameFile(oldPath: string, newPath: string, newBasename: string): void {
		const entries = this.byFile.get(oldPath);
		if (!entries) {
			return;
		}
		if (oldPath === newPath) {
			return; // 自身改名：无操作（Obsidian 的 rename 事件不会产生，防御边界）
		}
		const replaced = this.byFile.get(newPath) ?? [];
		this.adjustKeyFileCount(replaced, -1); // 被覆盖文件的标题随之消失
		this.byFile.delete(oldPath);
		this.sorted = this.sorted.filter((e) => e.path !== oldPath && e.path !== newPath);
		this.totalCount = this.totalCount - entries.length - replaced.length + entries.length;
		for (const e of entries) {
			e.path = newPath;
			e.basename = newBasename;
			this.sorted.splice(upperBoundEntry(this.sorted, e), 0, e);
		}
		this.byFile.set(newPath, entries);
	}

	/** 前缀查询：返回 matchKey 以 normalizedQuery 为前缀的条目（排除 `exclude` 那一条），最多 limit 条。 */
	queryPrefix(normalizedQuery: string, limit: number, exclude?: ExcludeAt): HeadingIndexEntry[] {
		if (!normalizedQuery) {
			return [];
		}
		const start = lowerBoundByKey(this.sorted, normalizedQuery);
		const out: HeadingIndexEntry[] = [];
		for (let i = start; i < this.sorted.length && out.length < limit; i++) {
			const e = this.sorted[i];
			if (!e.matchKey.startsWith(normalizedQuery)) {
				break; // 排序保证一旦不匹配即可停止
			}
			if (!this.isGenericKey(e.matchKey) && !isExcluded(e, exclude)) {
				out.push(e);
			}
		}
		return out;
	}

	/**
	 * onTrigger 专用的廉价判定：是否存在至少一条**非套话**的前缀匹配（不收集结果）。
	 * 跳过套话标题时最坏要扫过同前缀的全部套话条目，规模受「同前缀标题数」约束，可接受。
	 */
	hasAnyPrefixMatch(normalizedQuery: string, exclude?: ExcludeAt): boolean {
		if (!normalizedQuery) {
			return false;
		}
		for (let i = lowerBoundByKey(this.sorted, normalizedQuery); i < this.sorted.length; i++) {
			const e = this.sorted[i];
			if (!e.matchKey.startsWith(normalizedQuery)) {
				return false;
			}
			if (!this.isGenericKey(e.matchKey) && !isExcluded(e, exclude)) {
				return true;
			}
		}
		return false;
	}

	/** onTrigger 专用：是否存在 matchKey 恰好等于查询串的**非套话**条目（完整命中，testplan Q28/Q30）。 */
	hasExactMatch(normalizedQuery: string, exclude?: ExcludeAt): boolean {
		if (!normalizedQuery || this.isGenericKey(normalizedQuery)) {
			return false;
		}
		for (let i = lowerBoundByKey(this.sorted, normalizedQuery); i < this.sorted.length; i++) {
			const e = this.sorted[i];
			if (e.matchKey !== normalizedQuery) {
				return false;
			}
			if (!isExcluded(e, exclude)) {
				return true;
			}
		}
		return false;
	}

	/** 某文件里锚点为 `anchor` 的条目（VC 候选核对「这个标题还在不在」用，testplan Q48）。 */
	findByAnchor(path: string, anchor: string): HeadingIndexEntry | undefined {
		return this.byFile.get(path)?.find((e) => e.anchor === anchor);
	}

	/** 含该标题的文件数（0 = 索引里没有）。 */
	fileCountOf(matchKey: string): number {
		return this.keyFileCount.get(matchKey) ?? 0;
	}

	/** 是否套话标题（出现在 ≥ {@link GENERIC_FILE_COUNT} 个文件里，testplan Q32）。 */
	isGenericKey(matchKey: string): boolean {
		return this.fileCountOf(matchKey) >= GENERIC_FILE_COUNT;
	}

	/** 某文件的全部条目（只读视图；未收录返回空数组），供链接解析按目标文件比对标题。 */
	entriesOf(path: string): readonly HeadingIndexEntry[] {
		return this.byFile.get(path) ?? [];
	}

	/** 全部条目（按 matchKey 排序的扁平视图副本），含套话标题。 */
	allEntries(): HeadingIndexEntry[] {
		return [...this.sorted];
	}

	/** 参与建议的条目（剔除套话标题），供 VC 词典生成（testplan Q32：两个建议框同一套筛选）。 */
	eligibleEntries(): HeadingIndexEntry[] {
		return this.sorted.filter((e) => !this.isGenericKey(e.matchKey));
	}

	get size(): number {
		return this.totalCount;
	}

	/** 是否因超过上限而未完整收录（触发一次性 Notice，见 main.ts buildInitialHeadingIndex）。 */
	get isTruncated(): boolean {
		return this.truncated;
	}

	/** 按文件内**去重后**的 matchKey 增减文件计数（delta = ±1）。 */
	private adjustKeyFileCount(entries: readonly HeadingIndexEntry[], delta: 1 | -1): void {
		for (const key of new Set(entries.map((e) => e.matchKey))) {
			const next = (this.keyFileCount.get(key) ?? 0) + delta;
			if (next > 0) {
				this.keyFileCount.set(key, next);
			} else {
				this.keyFileCount.delete(key);
			}
		}
	}

	clear(): void {
		this.byFile.clear();
		this.keyFileCount.clear();
		this.sorted = [];
		this.totalCount = 0;
		this.truncated = false;
	}
}
