/**
 * 剪贴板净化纯逻辑层（M11「复制净化开关」，见 spec.md §2.8「同步净化 + 内存映射双通道」）。
 *
 * 职责边界：本文件只含可单测的纯函数与内存缓存——WJ 剥离、换行规范化、`净化文本 → 原文`
 * 的会话级 LRU 映射（OS 剪贴板隐藏通道被 2026-07-15 spike 判死后的内存替代）。DOM / 事件
 * 接线（copy/cut 监听、editor-paste 命中还原）在 main.ts。
 */

import { WORD_JOINER } from "./numbering";

/** LRU 条数上限：超过逐出最旧（spec §2.8「内存映射」）。 */
export const CLIPBOARD_CACHE_MAX_ENTRIES = 50;

/** LRU 总字符量上限（键 + 值合计）：防止巨量复制常驻内存；超限逐最旧，单条超限即不驻留。 */
export const CLIPBOARD_CACHE_MAX_CHARS = 2_000_000;

/** 剥净字符串中全部 Word Joiner 哨兵——净化对任意字符串成立、不做结构解析（spec §2.8 守卫定案）。 */
export function stripWordJoiners(text: string): string {
	return text.split(WORD_JOINER).join("");
}

/**
 * 剥净 HTML 字符串中的 WJ：除原始字符外，兼顾序列化可能产出的数字 / 十六进制字符实体写法
 * （阅读模式路径自构造 `text/html`、或改写已被写入的 `text/html` 时用，见 spec §2.8）。
 */
export function stripWordJoinersFromHtml(html: string): string {
	return stripWordJoiners(html).replace(/&#(?:8288|x2060);/gi, "");
}

/** 换行规范化（`\r\n`/`\r` → `\n`）：LRU 键与 paste 端查询共用同一口径，抹平外部应用中转差异。 */
export function normalizeClipboardText(text: string): string {
	return text.replace(/\r\n?/g, "\n");
}

/**
 * 会话级「净化文本 → 原文」LRU 映射（spec §2.8「内存映射」——隐藏通道的内存替代）。
 *
 * - 键 = 规范化(净化文本)，值 = 原始选区文本（含 WJ；存完整原文、不做差异编码，2026-07-10 定案）。
 * - **只存内存、不持久化**：把用户复制的任意文本写进 data.json 有隐私顾虑；跨会话的过期映射
 *   本就该走「当新内容处理」降级路径（spec §2.8 残余已知限制）。
 * - 逐出策略：条数或总字符量超限即从最旧开始逐出（Map 迭代序 = 插入序）；`record`/`lookup`
 *   命中都会把该条刷新为最新。
 */
export class ClipboardOriginalCache {
	private readonly entries = new Map<string, string>();
	private totalChars = 0;

	constructor(
		private readonly maxEntries = CLIPBOARD_CACHE_MAX_ENTRIES,
		private readonly maxChars = CLIPBOARD_CACHE_MAX_CHARS,
	) {}

	/**
	 * 记录一次净化：存入 `规范化(净化文本) → 原文`，返回净化文本（供调用方覆写剪贴板）。
	 * 原文不含 WJ（净化后与原文相同）时不入表——还原无意义，调用方的 WJ 守卫本已排除此路。
	 */
	record(original: string): string {
		const sanitized = stripWordJoiners(original);
		if (sanitized === original) {
			return sanitized;
		}
		const key = normalizeClipboardText(sanitized);
		this.remove(key);
		this.entries.set(key, original);
		this.totalChars += key.length + original.length;
		this.evict();
		return sanitized;
	}

	/** paste 端查询：按规范化口径查表，命中返回原文（含 WJ）并刷新新旧序，未命中返回 null。 */
	lookup(pastedText: string): string | null {
		const key = normalizeClipboardText(pastedText);
		const original = this.entries.get(key);
		if (original === undefined) {
			return null;
		}
		this.entries.delete(key);
		this.entries.set(key, original);
		return original;
	}

	/** 当前条数（单测断言用）。 */
	get size(): number {
		return this.entries.size;
	}

	private remove(key: string): void {
		const prev = this.entries.get(key);
		if (prev !== undefined) {
			this.entries.delete(key);
			this.totalChars -= key.length + prev.length;
		}
	}

	private evict(): void {
		for (const [key, value] of this.entries) {
			if (this.entries.size <= this.maxEntries && this.totalChars <= this.maxChars) {
				break;
			}
			this.entries.delete(key);
			this.totalChars -= key.length + value.length;
		}
	}
}
