/**
 * 标题被链接次数（testplan Q31/Q34，spec §3.23）：标题链接建议的「这个标题是不是公认的链接目标」信号。
 *
 * 用途有二：中文短词完整命中时要求标题**被链接过**才弹（区分【中断】这类概念与【使用】这类普通词，
 * 用户主力库实测 310 个标题被链接过，短标题里的术语几乎都在其中）；候选排序时被链接多的靠前。
 *
 * 计数按 matchKey（剥编号、归一化后的标题原文）汇总，不区分目标文件——这是排序与门槛用的软信号，
 * 不需要精确到「哪个文件的哪个标题」。但**解析**是精确的：链接先解析到目标文件，再拿该文件索引里的
 * 标题按锚点比对，取比对上的那条的 matchKey——编号前缀、WJ 哨兵都由索引条目自带的 anchor 吸收，
 * 不在这里重新实现一遍剥离规则。
 *
 * 本文件无 Obsidian 依赖：链接列表、目标文件解析、目标文件条目都由调用方注入（main.ts 从
 * metadataCache 取），便于纯函数单测。
 */

import { WORD_JOINER } from "./strip";
import type { HeadingIndexEntry } from "./headingindex";

/** 链接里的标题锚点比对用 key：去 WJ、小写、压空白（与 Obsidian 解析标题锚点的宽松程度对齐）。 */
function anchorKey(text: string): string {
	return text.split(WORD_JOINER).join("").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * 把一个文件的出链解析成「被链接到的标题 matchKey」列表（同一标题被链接几次就出现几次）。
 *
 * @param links metadataCache 的 `links[].link`（如 `noc#AXI`、`#中断`、`a#b#c`、URL 编码的 Markdown 链接）
 * @param resolveDest 链接路径 → 目标文件路径（空串表示本文件；解析不到返回 null）
 * @param entriesOf 目标文件的索引条目
 *
 * 边界：块引用（`#^id`）与解析不到的链接跳过；多级标题路径 `a#b#c` 取最后一级（Obsidian 以末级定位）。
 */
export function resolveLinkedHeadingKeys(
	links: readonly string[],
	resolveDest: (linkpath: string) => string | null,
	entriesOf: (path: string) => readonly HeadingIndexEntry[],
): string[] {
	const out: string[] = [];
	for (const raw of links) {
		let link = raw;
		try {
			link = decodeURIComponent(raw);
		} catch {
			/* 不是合法 URL 编码：按原文处理 */
		}
		const hash = link.indexOf("#");
		if (hash < 0) {
			continue;
		}
		const segments = link.slice(hash + 1).split("#");
		const sub = segments[segments.length - 1];
		if (!sub || sub.startsWith("^")) {
			continue;
		}
		const dest = resolveDest(link.slice(0, hash));
		if (dest === null) {
			continue;
		}
		const key = anchorKey(sub);
		const hit = entriesOf(dest).find((e) => anchorKey(e.anchor) === key);
		if (hit) {
			out.push(hit.matchKey);
		}
	}
	return out;
}

/**
 * 全库「标题 → 被链接次数」计数，按**源文件**分桶增量维护：某文件改动时只重算它的出链贡献。
 *
 * 已知取舍：目标标题改名后，指向它的旧链接在源文件下次变动前仍按旧解析计数（Backlink 同步开着时
 * 源文件会被改写、随即重算）。软信号，接受这点滞后。
 */
export class HeadingLinkCounts {
	private readonly bySource = new Map<string, string[]>();
	private readonly totals = new Map<string, number>();

	/** 替换某源文件的出链贡献。 */
	setSource(sourcePath: string, linkedKeys: readonly string[]): void {
		this.removeSource(sourcePath);
		if (linkedKeys.length === 0) {
			return;
		}
		this.bySource.set(sourcePath, [...linkedKeys]);
		this.add(linkedKeys, 1);
	}

	/** 源文件删除：撤掉它的贡献。 */
	removeSource(sourcePath: string): void {
		const old = this.bySource.get(sourcePath);
		if (!old) {
			return;
		}
		this.bySource.delete(sourcePath);
		this.add(old, -1);
	}

	/** 源文件改名：贡献跟着走（目标覆盖时先撤掉被覆盖文件的贡献）。 */
	renameSource(oldPath: string, newPath: string): void {
		if (oldPath === newPath) {
			return;
		}
		const keys = this.bySource.get(oldPath);
		this.removeSource(newPath);
		if (!keys) {
			return;
		}
		this.bySource.delete(oldPath);
		this.bySource.set(newPath, keys);
	}

	/** 某标题被链接的次数。 */
	count(matchKey: string): number {
		return this.totals.get(matchKey) ?? 0;
	}

	clear(): void {
		this.bySource.clear();
		this.totals.clear();
	}

	private add(keys: readonly string[], delta: 1 | -1): void {
		for (const k of keys) {
			const next = (this.totals.get(k) ?? 0) + delta;
			if (next > 0) {
				this.totals.set(k, next);
			} else {
				this.totals.delete(k);
			}
		}
	}
}
