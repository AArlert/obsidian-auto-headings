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
function lowerBoundEntry(sorted: HeadingIndexEntry[], needle: HeadingIndexEntry): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (compareEntries(sorted[mid], needle) < 0) {
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

	constructor(private readonly maxIndexed: number = MAX_INDEXED_HEADINGS) {}

	/**
	 * 初始全量构建专用：一次性灌入 + 一次排序。
	 * 切勿循环调用 {@link setFile} 做初始构建——那会退化为 O((N·H)²)（见方案 §2.3）。
	 * 累计条目数达到上限后停止收录后续文件并置 `isTruncated`。
	 */
	loadInitial(files: Array<{ path: string; basename: string; content: string }>): void {
		this.byFile.clear();
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
			all.push(...taken);
			this.totalCount += taken.length;
		}
		all.sort(compareEntries);
		this.sorted = all;
	}

	/** 增量：单文件内容变化（新建/修改）后调用，替换该文件在索引中的全部条目。 */
	setFile(path: string, basename: string, content: string): void {
		const entries = buildEntriesForFile(path, basename, content);
		const old = this.byFile.get(path) ?? [];
		const room = Math.max(0, this.maxIndexed - (this.totalCount - old.length));
		const taken = entries.slice(0, room);
		if (entries.length > room) {
			this.truncated = true;
		}
		this.byFile.set(path, taken);
		this.totalCount = this.totalCount - old.length + taken.length;
		this.sorted = this.sorted.filter((e) => e.path !== path);
		for (const e of taken) {
			this.sorted.splice(lowerBoundEntry(this.sorted, e), 0, e);
		}
	}

	/** 增量：文件删除。 */
	removeFile(path: string): void {
		const old = this.byFile.get(path);
		if (!old) {
			return;
		}
		this.byFile.delete(path);
		this.totalCount -= old.length;
		this.sorted = this.sorted.filter((e) => e.path !== path);
	}

	/** 增量：文件改名——只改字段，不需要重新解析内容。 */
	renameFile(oldPath: string, newPath: string, newBasename: string): void {
		const entries = this.byFile.get(oldPath);
		if (!entries) {
			return;
		}
		this.byFile.delete(oldPath);
		this.sorted = this.sorted.filter((e) => e.path !== oldPath);
		for (const e of entries) {
			e.path = newPath;
			e.basename = newBasename;
			this.sorted.splice(lowerBoundEntry(this.sorted, e), 0, e);
		}
		this.byFile.set(newPath, entries);
	}

	/** 前缀查询：返回 matchKey 以 normalizedQuery 为前缀的条目，最多 limit 条。 */
	queryPrefix(normalizedQuery: string, limit: number): HeadingIndexEntry[] {
		if (!normalizedQuery) {
			return [];
		}
		const start = lowerBoundByKey(this.sorted, normalizedQuery);
		const out: HeadingIndexEntry[] = [];
		for (let i = start; i < this.sorted.length && out.length < limit; i++) {
			if (!this.sorted[i].matchKey.startsWith(normalizedQuery)) {
				break; // 排序保证一旦不匹配即可停止
			}
			out.push(this.sorted[i]);
		}
		return out;
	}

	/** onTrigger 专用的廉价判定：是否存在至少一条前缀匹配（可提前退出，不收集结果）。 */
	hasAnyPrefixMatch(normalizedQuery: string): boolean {
		if (!normalizedQuery) {
			return false;
		}
		const idx = lowerBoundByKey(this.sorted, normalizedQuery);
		return idx < this.sorted.length && this.sorted[idx].matchKey.startsWith(normalizedQuery);
	}

	/** 全部条目（按 matchKey 排序的扁平视图副本），供 VC 词典生成等全量消费方使用。 */
	allEntries(): HeadingIndexEntry[] {
		return [...this.sorted];
	}

	get size(): number {
		return this.totalCount;
	}

	/** 是否因超过上限而未完整收录（触发一次性 Notice，见 main.ts buildInitialHeadingIndex）。 */
	get isTruncated(): boolean {
		return this.truncated;
	}

	clear(): void {
		this.byFile.clear();
		this.sorted = [];
		this.totalCount = 0;
		this.truncated = false;
	}
}
