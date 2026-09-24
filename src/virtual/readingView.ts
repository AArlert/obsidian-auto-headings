/**
 * 虚拟编号的阅读视图渲染（M14，见 spec.md §3.22「渲染」）：markdown post-processor 给 `h1`–`h6`
 * 前插编号 span。内置「导出 PDF」走同一条渲染管线，预期也带编号（须真机验证）。
 *
 * **难点：Obsidian 的阅读视图只重新渲染改过的段落。** 在前面插一个标题，后面没改动的段落不会再走
 * post-processor，它们身上的编号就过期了（真机实测：新标题「一、」后面仍是旧的「一、二、三」）。
 * 所以每个含标题的段落都登记成一个 {@link MarkdownRenderChild}（随段落加载 / 卸载），出现下列任一
 * 情况就把同一篇的所有登记段落按**各自当前的**段落信息重新核对，原地改编号（不整页重渲染，不闪）：
 * - 有段落重新渲染，且看到的原文与上次不同（编辑后切回阅读视图、分屏里实时改动）；
 * - 文件元数据更新（main.ts 转发 `metadataCache.on("changed")`，兜住「删掉一个标题但没有段落重渲染」）；
 * - 设置 / 模板 / 规则变化（{@link VirtualReadingRenderer.refreshAll}）。
 *
 * 其余要点：
 * - 定位：`ctx.getSectionInfo(el)` 给出整篇原文与段落行号区间，按行号取编号并核对 DOM 元素的级别
 *   （分屏编辑时段落信息可能滞后，级别对不上就不画）。
 * - 缓存：按路径记住上次的原文与设置版本，**字符串直接比较**，相同就复用，不对整篇重复计算。
 * - 兜底：嵌入、悬浮预览等场景拿不到段落信息，改读文件内容、按标题文本匹配，**只有唯一命中才画**。
 * - 幂等：编号 span 可以反复加 / 去；剥掉的残留前缀记在 span 上，去掉编号时原样还回文本。
 */

import { MarkdownRenderChild, type MarkdownPostProcessorContext } from "obsidian";
import { WORD_JOINER } from "../numbering";
import type { VirtualHeadingLabel } from "./compute";
import type { VirtualRenderHost } from "./editorExtension";

/** 阅读视图额外需要的能力：拿不到段落信息时读文件全文。 */
export interface VirtualReadingHost extends VirtualRenderHost {
	readFileContent(path: string): Promise<string | null>;
}

/** `NodeFilter.SHOW_TEXT`（写成常量，免得依赖全局 `NodeFilter`，node 环境单测也能跑）。 */
const SHOW_TEXT = 4;
/** DOM 文本节点的 `nodeType`。 */
const TEXT_NODE = 3;
/** 缓存最多记住几篇笔记（按最近使用）。 */
const CACHE_LIMIT = 32;
/** 元数据更新后到重新核对之间的延迟（毫秒）：等阅读视图自己先把改过的段落渲染完。 */
export const SWEEP_DELAY = 250;
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
const NUMBER_CLASS = "ah-virtual-number";
const STALE_CLASS = "ah-virtual-number--stale";
/** 编号 span 上记录「当初从文本里剥掉的残留前缀」，去掉编号时还回去。 */
const STRIPPED_ATTR = "data-ah-stripped";

/**
 * 取某个段落里各标题的编号：段落行号区间 `[lineStart, lineEnd]` 内的编号按顺序对应段落里的标题。
 * 级别对不上的位置给 `null`（不画），宁缺勿错。
 */
export function pickSectionLabels(
	labels: readonly VirtualHeadingLabel[],
	lineStart: number,
	lineEnd: number,
	levels: readonly number[],
): Array<VirtualHeadingLabel | null> {
	const inSection = labels.filter((l) => l.lineIndex >= lineStart && l.lineIndex <= lineEnd);
	return levels.map((level, i) => {
		const hit = inSection[i];
		return hit && hit.level === level ? hit : null;
	});
}

/**
 * 判断段落信息里的原文 `text` 与文件全文 `full` 的关系，决定按哪份原文、以多少行偏移取编号：
 * - `full` 缺失或二者相同：就用 `text`，偏移 0；
 * - `text` 是 `full` 里的一段（小节嵌入）：用 `full`，偏移为这一段之前的行数；
 * - 都不是，但 `text` 至少有全文一半长：视为比磁盘更新的全文（正在编辑），用 `text`，偏移 0；
 * - 否则返回 `null`，交给按文本匹配的兜底。
 */
export function locateSection(
	text: string,
	full: string | null,
): { content: string; offset: number } | null {
	if (full === null || full === text) {
		return { content: text, offset: 0 };
	}
	const at = full.indexOf(text);
	if (at >= 0) {
		let offset = 0;
		for (let i = full.indexOf("\n"); i >= 0 && i < at; i = full.indexOf("\n", i + 1)) {
			offset++;
		}
		return { content: full, offset };
	}
	return text.length * 2 >= full.length ? { content: text, offset: 0 } : null;
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

/** 段落里的标题元素（段落本身就是标题时也算上）。 */
function headingsIn(el: Element): Element[] {
	const found = Array.from(el.querySelectorAll(HEADING_SELECTOR));
	if (el.matches?.(HEADING_SELECTOR)) {
		found.unshift(el);
	}
	return found;
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

/** 标题的正文（不含我们加的编号 span）。 */
function headingText(el: Element): string {
	const span = el.querySelector(`.${NUMBER_CLASS}`);
	const all = el.textContent ?? "";
	const own = span?.textContent ?? "";
	return span && all.startsWith(own) ? all.slice(own.length) : all;
}

/**
 * 给一个标题元素加上编号。残留前缀（以 WJ 打头、尾哨兵完好）从第一个文本节点里去掉并记在 span 上，
 * 编号用残留样式；尾哨兵被毁、剥不干净时不画，避免两层数字。已有编号时不重复加。
 */
export function decorateHeading(el: Element, label: VirtualHeadingLabel, tooltip: string): void {
	if (label.label === null || el.querySelector(`.${NUMBER_CLASS}`)) {
		return;
	}
	const text = firstTextNode(el);
	const stale = label.staleRange !== undefined;
	let stripped = "";
	if (stale) {
		const end = text?.data.startsWith(WORD_JOINER) ? text.data.indexOf(WORD_JOINER, 1) : -1;
		if (!text || end < 0) {
			return;
		}
		stripped = text.data.slice(0, end + 1);
		text.data = text.data.slice(end + 1);
	}
	const span = el.ownerDocument.createElement("span");
	span.className = stale ? `${NUMBER_CLASS} ${STALE_CLASS}` : NUMBER_CLASS;
	span.textContent = label.label;
	if (stale) {
		span.title = tooltip;
		span.setAttribute(STRIPPED_ATTR, stripped);
	}
	if (text?.parentNode) {
		text.parentNode.insertBefore(span, text);
	} else {
		el.insertBefore(span, el.firstChild);
	}
}

/** 去掉标题上的编号 span，并把当初剥掉的残留前缀还回文本（幂等）。 */
export function undecorateHeading(el: Element): void {
	for (const span of Array.from(el.querySelectorAll(`.${NUMBER_CLASS}`))) {
		const stripped = span.getAttribute(STRIPPED_ATTR);
		const next = span.nextSibling;
		if (stripped && next && next.nodeType === TEXT_NODE) {
			(next as Text).data = stripped + (next as Text).data;
		}
		span.remove();
	}
}

/** 让标题显示指定编号（`null` = 不显示）；已经是目标状态时不动 DOM。 */
export function setHeadingLabel(
	el: Element,
	label: VirtualHeadingLabel | null,
	tooltip: string,
): void {
	const span = el.querySelector(`.${NUMBER_CLASS}`);
	const want = label?.label ?? null;
	if (!span && want === null) {
		return;
	}
	if (span && label && want !== null) {
		const isStale = span.className.split(" ").includes(STALE_CLASS);
		if (span.textContent === want && isStale === (label.staleRange !== undefined)) {
			return;
		}
	}
	undecorateHeading(el);
	if (label) {
		decorateHeading(el, label, tooltip);
	}
}

/** 阅读视图里一个含标题的段落：随段落加载登记、随段落卸载注销，供整篇重新核对时找回。 */
class VirtualSection extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		readonly ctx: MarkdownPostProcessorContext,
		readonly path: string,
		private readonly owner: VirtualReadingRenderer,
	) {
		super(containerEl);
	}

	onload(): void {
		this.owner.attach(this);
	}

	onunload(): void {
		this.owner.detach(this);
	}
}

/** 阅读视图的虚拟编号渲染器：post-processor + 段落登记 + 整篇重新核对。 */
export class VirtualReadingRenderer {
	private readonly sections = new Set<VirtualSection>();
	/** 每篇笔记当前登记了几个段落。 */
	private readonly perPath = new Map<string, number>();
	private readonly cache = new Map<
		string,
		{ content: string; generation: number; labels: VirtualHeadingLabel[] | null }
	>();
	/** 各路径最近一次在阅读视图里见到的原文：变了才整篇重新核对。 */
	private readonly lastSeen = new Map<string, string>();
	private readonly timers = new Map<string, number>();
	/** 设置版本：设置 / 模板 / 规则变化时递增，让缓存失效。 */
	private generation = 0;

	constructor(private readonly host: VirtualReadingHost) {}

	/** 交给 `plugin.registerMarkdownPostProcessor`。 */
	readonly postProcessor = async (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	): Promise<void> => {
		const path = ctx.sourcePath;
		if (!path) {
			return;
		}
		// 任何段落（含不带标题的）重新渲染时看到了新原文 → 别的段落上的编号可能过期了。
		const info = ctx.getSectionInfo(el);
		if (info && this.lastSeen.get(path) !== info.text) {
			const seenBefore = this.lastSeen.has(path);
			this.lastSeen.set(path, info.text);
			if (seenBefore) {
				this.scheduleSweep(path, 0);
			}
		}
		if (headingsIn(el).length === 0) {
			return;
		}
		const section = new VirtualSection(el, ctx, path, this);
		ctx.addChild(section);
		await this.sync(section);
	};

	/** 设置 / 模板 / 规则变了：作废缓存，所有登记段落重新核对（隐藏的阅读视图也照改）。 */
	refreshAll(): void {
		this.generation++;
		for (const section of this.sections) {
			void this.sync(section);
		}
	}

	/** 稍后重新核对某篇笔记的所有登记段落（同一篇的多次请求合并成一次）。 */
	scheduleSweep(path: string, delay = SWEEP_DELAY): void {
		const pending = this.timers.get(path);
		if (pending !== undefined) {
			window.clearTimeout(pending);
		}
		this.timers.set(
			path,
			window.setTimeout(() => {
				this.timers.delete(path);
				for (const section of this.sections) {
					if (section.path === path) {
						void this.sync(section);
					}
				}
			}, delay),
		);
	}

	/** 插件卸载时清掉计时器。 */
	dispose(): void {
		for (const t of this.timers.values()) {
			window.clearTimeout(t);
		}
		this.timers.clear();
	}

	/** @internal 段落加载时登记。 */
	attach(section: VirtualSection): void {
		if (this.sections.has(section)) {
			return;
		}
		this.sections.add(section);
		this.perPath.set(section.path, (this.perPath.get(section.path) ?? 0) + 1);
	}

	/** @internal 段落卸载时注销；某篇笔记的段落全卸载后，丢掉它的「上次原文」，不留内存。 */
	detach(section: VirtualSection): void {
		if (!this.sections.delete(section)) {
			return;
		}
		const left = (this.perPath.get(section.path) ?? 1) - 1;
		if (left > 0) {
			this.perPath.set(section.path, left);
			return;
		}
		this.perPath.delete(section.path);
		this.lastSeen.delete(section.path);
	}

	/** 当前登记的段落数（单测用）。 */
	get sectionCount(): number {
		return this.sections.size;
	}

	private labelsFor(path: string, content: string): VirtualHeadingLabel[] | null {
		const hit = this.cache.get(path);
		if (hit && hit.generation === this.generation && hit.content === content) {
			this.cache.delete(path);
			this.cache.set(path, hit); // 刷新为最近使用。
			return hit.labels;
		}
		const labels = this.host.virtualNumberingFor(path, content);
		this.cache.delete(path);
		this.cache.set(path, { content, generation: this.generation, labels });
		if (this.cache.size > CACHE_LIMIT) {
			const oldest = this.cache.keys().next().value;
			if (oldest !== undefined) {
				this.cache.delete(oldest);
			}
		}
		return labels;
	}

	/**
	 * 按段落**当前**的段落信息核对它的编号：
	 * - 段落信息里的原文就是全文（笔记自己的阅读视图、整篇嵌入）：按行号取；
	 * - 原文只是全文里的一段（小节嵌入 `![[笔记#标题]]`、悬浮预览某一节）：编号必须按全文算，否则会从
	 *   「一」重新数起（真机实测）——在全文里找到这一段，行号加上偏移再取；
	 * - 拿不到段落信息、或在全文里找不到这一段：原文若和全文差不多长，视为比磁盘更新的全文（正在编辑），
	 *   照样按行号取；否则按标题文本唯一匹配兜底。
	 */
	private async sync(section: VirtualSection): Promise<void> {
		const el = section.containerEl;
		const headings = headingsIn(el);
		const levels = headings.map(elementLevel);
		const tooltip = this.host.staleTooltip();
		const info = section.ctx.getSectionInfo(el);
		const raw = await this.host.readFileContent(section.path);
		const full = raw === null ? null : raw.replace(/\r\n/g, "\n");
		if (info) {
			const located = locateSection(info.text, full);
			if (located) {
				const labels = this.labelsFor(section.path, located.content);
				const picked = labels
					? pickSectionLabels(
							labels,
							info.lineStart + located.offset,
							info.lineEnd + located.offset,
							levels,
						)
					: levels.map(() => null);
				headings.forEach((h, i) => setHeadingLabel(h, picked[i], tooltip));
				return;
			}
		}
		const content = full;
		const labels = content === null ? null : this.labelsFor(section.path, content);
		for (const h of headings) {
			setHeadingLabel(
				h,
				labels ? pickLabelByText(labels, headingText(h), elementLevel(h)) : null,
				tooltip,
			);
		}
	}
}
