/**
 * 虚拟编号的阅读视图渲染（M14，见 spec.md §3.22「渲染」）：markdown post-processor 给 `h1`–`h6`
 * 前插编号 span。内置「导出 PDF」走同一条渲染管线，预期也带编号（须真机验证）。
 *
 * - 定位：`ctx.getSectionInfo(el)` 给出整篇原文与该段起始行；按行号取编号，并核对 DOM 元素的级别
 *   （分屏编辑时段落信息可能滞后，级别对不上就不画）。
 * - 缓存：post-processor 按段调用，每段都对整篇重算会接近平方级；按路径记住上次的原文，**字符串直接
 *   比较**，相同就复用。
 * - 兜底：嵌入、悬浮预览等场景 `getSectionInfo` 可能为 null，改读文件内容、按标题文本匹配，**只有唯一
 *   命中才画**，对不上就不画——宁缺勿错。
 */

import type { MarkdownPostProcessorContext } from "obsidian";
import { WORD_JOINER } from "../numbering";
import type { VirtualHeadingLabel } from "./compute";
import type { VirtualRenderHost } from "./editorExtension";

/** 阅读视图额外需要的能力：拿不到段落信息时读文件全文。 */
export interface VirtualReadingHost extends VirtualRenderHost {
	readFileContent(path: string): Promise<string | null>;
}

/** `NodeFilter.SHOW_TEXT`（写成常量，免得依赖全局 `NodeFilter`，node 环境单测也能跑）。 */
const SHOW_TEXT = 4;

/** 缓存最多记住几篇笔记（按最近使用）。 */
const CACHE_LIMIT = 8;

/** 按行号取某标题的编号，并核对级别；对不上返回 `null`。 */
export function pickLabelByLine(
	labels: readonly VirtualHeadingLabel[],
	lineIndex: number,
	level: number,
): VirtualHeadingLabel | null {
	const hit = labels.find((l) => l.lineIndex === lineIndex);
	return hit && hit.level === level ? hit : null;
}

/** 按标题文本兜底匹配：同级别、同文本的标题**恰好一个**才返回，否则 `null`（宁缺勿错）。 */
export function pickLabelByText(
	labels: readonly VirtualHeadingLabel[],
	text: string,
	level: number,
): VirtualHeadingLabel | null {
	const wanted = text.split(WORD_JOINER).join("").trim();
	const hits = labels.filter(
		(l) => l.level === level && l.text.split(WORD_JOINER).join("").trim() === wanted,
	);
	return hits.length === 1 ? hits[0] : null;
}

/** 标题元素的级别（`H2` → 2）；不是标题返回 0。 */
function elementLevel(el: Element): number {
	const m = /^H([1-6])$/.exec(el.tagName);
	return m ? Number(m[1]) : 0;
}

/** 标题元素里第一个非空文本节点。 */
function firstTextNode(el: Element): Text | null {
	const walker = el.ownerDocument.createTreeWalker(el, SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if ((n as Text).data.length > 0) {
			return n as Text;
		}
	}
	return null;
}

/**
 * 给一个标题元素加上编号。残留前缀（以 WJ 打头、尾哨兵完好）从第一个文本节点里去掉，编号用残留样式；
 * 尾哨兵被毁、剥不干净时不画，避免两层数字。
 */
export function decorateHeading(el: Element, label: VirtualHeadingLabel, tooltip: string): void {
	if (label.label === null || el.querySelector(".ah-virtual-number")) {
		return;
	}
	const text = firstTextNode(el);
	const stale = label.staleRange !== undefined;
	if (stale) {
		const end = text?.data.startsWith(WORD_JOINER) ? text.data.indexOf(WORD_JOINER, 1) : -1;
		if (!text || end < 0) {
			return;
		}
		text.data = text.data.slice(end + 1);
	}
	const span = el.ownerDocument.createElement("span");
	span.className = stale ? "ah-virtual-number ah-virtual-number--stale" : "ah-virtual-number";
	span.textContent = label.label;
	if (stale) {
		span.title = tooltip;
	}
	if (text?.parentNode) {
		text.parentNode.insertBefore(span, text);
	} else {
		el.insertBefore(span, el.firstChild);
	}
}

/** 构造阅读视图 post-processor，交给 `plugin.registerMarkdownPostProcessor` 注册。 */
export function createVirtualPostProcessor(
	host: VirtualReadingHost,
): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> {
	const cache = new Map<string, { content: string; labels: VirtualHeadingLabel[] | null }>();
	const labelsFor = (path: string, content: string): VirtualHeadingLabel[] | null => {
		const hit = cache.get(path);
		if (hit && hit.content === content) {
			cache.delete(path);
			cache.set(path, hit); // 刷新为最近使用。
			return hit.labels;
		}
		const labels = host.virtualNumberingFor(path, content);
		cache.delete(path);
		cache.set(path, { content, labels });
		if (cache.size > CACHE_LIMIT) {
			const oldest = cache.keys().next().value;
			if (oldest !== undefined) {
				cache.delete(oldest);
			}
		}
		return labels;
	};

	return async (el, ctx) => {
		const headings = Array.from(el.querySelectorAll("h1, h2, h3, h4, h5, h6"));
		if (el.matches?.("h1, h2, h3, h4, h5, h6")) {
			headings.unshift(el);
		}
		if (headings.length === 0 || !ctx.sourcePath) {
			return;
		}
		const tooltip = host.staleTooltip();
		let fallback: VirtualHeadingLabel[] | null | undefined;
		for (const h of headings) {
			const level = elementLevel(h);
			const info = ctx.getSectionInfo(h as HTMLElement) ?? ctx.getSectionInfo(el);
			let label: VirtualHeadingLabel | null = null;
			if (info) {
				const labels = labelsFor(ctx.sourcePath, info.text);
				label = labels ? pickLabelByLine(labels, info.lineStart, level) : null;
			} else {
				if (fallback === undefined) {
					const content = await host.readFileContent(ctx.sourcePath);
					fallback = content === null ? null : labelsFor(ctx.sourcePath, content);
				}
				label = fallback ? pickLabelByText(fallback, h.textContent ?? "", level) : null;
			}
			if (label) {
				decorateHeading(h, label, tooltip);
			}
		}
	};
}
