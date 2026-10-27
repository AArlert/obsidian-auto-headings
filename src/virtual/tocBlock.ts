/**
 * 目录块 `ah-toc`（M17-B，见 spec.md §3.25、testplan V54–V72）：用户放一个围栏代码块，这里把它渲染成
 * 当前文件的目录——**渲染只读**，不把目录文本写进文件；唯一的写入是用户拖滑块松手时改写块内 `depth:`
 * 一行（{@link rewriteTocBlock}，带多重校验，对不上就不写）。
 *
 * 存在的理由：仅显示模式的编号不在文件里，别的目录插件拿元数据缓存拼目录，拼出来没有编号；自己渲染就能
 * 在目录里带上与编辑器一致的编号。编号的取法与大纲面板同一套「按行号 + 级别对，宁缺勿错」
 * （{@link pickOutlineLabels} 的口径）。
 *
 * 分两层：纯函数 {@link parseTocLevels} / {@link buildTocTree}（node 单测）+ 渲染器
 * {@link TocBlockRenderer}（代码块处理器 + 块登记 + 原地重画，DOM 部分留真机手验）。
 */

import { MarkdownRenderChild, type MarkdownPostProcessorContext } from "obsidian";
import { WORD_JOINER } from "../numbering";
import { displayAnchor } from "../backlinks";
import type { VirtualHeadingLabel } from "./compute";

/** 围栏语言名。不用 `toc`：Automatic Table Of Contents 等插件已注册，同名后注册的覆盖先注册的。 */
export const TOC_FENCE = "ah-toc";

/** 目录块需要的标题信息（metadataCache `HeadingCache` 的子集）。 */
export interface TocHeading {
	level: number;
	heading: string;
	position: { start: { line: number } };
}

/** 目录树的一个节点。 */
export interface TocNode {
	level: number;
	/** 显示用文本：原文剥掉 WJ，纯文本。 */
	text: string;
	/** 跳转用锚点（保留 WJ，写入模式的标题才解析得到，见 {@link displayAnchor}）。 */
	anchor: string;
	/** 虚拟编号（如 `"1.1 "`）；写入模式 / 不编号 / 残留旧编号时为 `null`。 */
	label: string | null;
	children: TocNode[];
	/** 比「父级的下一级」多跳过了几级（H3 下直接出现 H5 则为 1）：缩进要补上，让它与同级别的标题对齐。 */
	gap: number;
}

/** 收录的级别范围（含两端）。 */
export interface TocRange {
	min: number;
	max: number;
}

const ALL_LEVELS: TocRange = { min: 1, max: 6 };

/**
 * 解析块内容里的 `levels: A-B`（或 `levels: N`）。写不出合法范围（缺省、非数字、`5-2`、超出 1–6）
 * 一律当作收录全部级别，不报错。
 */
export function parseTocLevels(source: string): TocRange {
	for (const line of source.split(/\r?\n/)) {
		const m = /^\s*levels\s*:\s*(\d)\s*(?:-\s*(\d))?\s*$/i.exec(line);
		if (!m) {
			continue;
		}
		const min = Number(m[1]);
		const max = m[2] === undefined ? min : Number(m[2]);
		if (min >= 1 && max <= 6 && min <= max) {
			return { min, max };
		}
		return ALL_LEVELS;
	}
	return ALL_LEVELS;
}

/** 块里是否写了 `slider` 一行（`slider` / `slider: on|true|yes|1`；`off` 等一律当作没写）。 */
export function parseTocSlider(source: string): boolean {
	return source
		.split(/\r?\n/)
		.some((line) => /^\s*slider\s*(?::\s*(?:on|true|yes|1)\s*)?$/i.test(line));
}

/** 块里的 `depth: N`（最深收录到第几级，1–6）；缺省 / 非法返回 `null`。 */
export function parseTocDepth(source: string): number | null {
	for (const line of source.split(/\r?\n/)) {
		const m = /^\s*depth\s*:\s*(\d)\s*$/i.exec(line);
		if (m) {
			const n = Number(m[1]);
			return n >= 1 && n <= 6 ? n : null;
		}
	}
	return null;
}

/**
 * 在现存级别 `levels`（升序、非空）里选当前停靠的级别：`depth` 缺省取最深；否则取**不超过**它的最大现存级别，
 * 全都比它深就取最浅。
 */
export function pickTocLevel(levels: readonly number[], depth: number | null): number {
	if (depth === null) {
		return levels[levels.length - 1];
	}
	let chosen = levels[0];
	for (const l of levels) {
		if (l <= depth) {
			chosen = l;
		}
	}
	return chosen;
}

/**
 * 把 `depth: N` 写进文件里 `[lineStart, lineEnd]` 行区间的 `ah-toc` 块（滑块松手时调用）。
 *
 * **盲写比不写危险**，所以先核对三件事，任何一项不符返回 `null`（调用方放弃落盘、只保留内存里的选择）：
 * 开头行是 `ah-toc` 围栏、结尾行是配对围栏、块内文本与渲染时拿到的 `oldSource` 一致（块没被挪动 / 编辑过）。
 * 只动块内：已有 `depth:` 行改写（多行只留第一行）、没有就追加在块末尾；其余字节、换行风格（CRLF）原样保留。
 * 返回新全文与新的块内文本（调用方用它更新自己记着的 `source`）。
 */
export function rewriteTocBlock(
	content: string,
	lineStart: number,
	lineEnd: number,
	oldSource: string,
	depth: number,
): { content: string; source: string } | null {
	const lines = content.split("\n");
	if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd)) {
		return null;
	}
	if (lineStart < 0 || lineEnd <= lineStart || lineEnd >= lines.length) {
		return null;
	}
	const crlf = content.includes("\r\n");
	const bare = (s: string): string => s.replace(/\r$/, "");
	const open = /^\s*(`{3,}|~{3,})\s*ah-toc\b/.exec(bare(lines[lineStart]));
	if (!open) {
		return null;
	}
	const fence = open[1];
	const close = new RegExp(`^\\s*${fence[0] === "`" ? "`" : "~"}{${fence.length},}\\s*$`);
	if (!close.test(bare(lines[lineEnd]))) {
		return null;
	}
	const inner = lines.slice(lineStart + 1, lineEnd).map(bare);
	const norm = (s: string): string => s.replace(/\r\n/g, "\n").replace(/\n+$/, "");
	if (norm(inner.join("\n")) !== norm(oldSource)) {
		return null;
	}
	const depthLine = /^\s*depth\s*:/i;
	const text = `depth: ${depth}`;
	const next: string[] = [];
	let written = false;
	for (const l of inner) {
		if (depthLine.test(l)) {
			if (!written) {
				next.push(text);
				written = true;
			}
			continue;
		}
		next.push(l);
	}
	if (!written) {
		next.push(text);
	}
	const tail = crlf ? "\r" : "";
	const out = [
		...lines.slice(0, lineStart + 1),
		...next.map((l) => l + tail),
		...lines.slice(lineEnd),
	];
	return { content: out.join("\n"), source: next.join("\n") };
}

/**
 * 「插入目录」命令要插入的文本：一个带 `slider` 的块；光标所在行在光标前 / 后还有文字时补空行，
 * 不把块粘进一行文字中间。
 */
export function tocInsertText(beforeCursor: string, afterCursor: string): string {
	return (
		(beforeCursor.trim() === "" ? "" : "\n\n") +
		"```ah-toc\nslider\n```" +
		(afterCursor.trim() === "" ? "" : "\n\n")
	);
}

/** 滑块能选的级别：`range` 内文件里实际存在的级别（升序，剥掉 WJ 后为空的标题不算）。 */
export function selectableLevels(headings: readonly TocHeading[], range: TocRange): number[] {
	const levels = new Set<number>();
	for (const h of headings) {
		if (
			h.level >= range.min &&
			h.level <= range.max &&
			h.heading.split(WORD_JOINER).join("").trim() !== ""
		) {
			levels.add(h.level);
		}
	}
	return [...levels].sort((a, b) => a - b);
}

/**
 * 把标题序列建成嵌套目录：**按相对级别嵌套**，跳级（H1→H3）时 H3 直接挂在 H1 下、不补空层；
 * 先出现更深的标题（文首就是 H3）时它自己成一层根。编号按标题行号取 `labels`，级别对不上 / 该标题不编号 /
 * 带残留旧编号都不画（`label: null`）。范围外的级别不收录；剥掉 WJ 后为空的标题跳过。
 */
export function buildTocTree(
	headings: readonly TocHeading[],
	labels: readonly VirtualHeadingLabel[] | null,
	range: TocRange = ALL_LEVELS,
): TocNode[] {
	const byLine = new Map<number, VirtualHeadingLabel>();
	for (const l of labels ?? []) {
		byLine.set(l.lineIndex, l);
	}
	const roots: TocNode[] = [];
	const stack: TocNode[] = [];
	const all: TocNode[] = [];
	const parents = new Map<TocNode, TocNode | null>();
	for (const h of headings) {
		if (h.level < range.min || h.level > range.max) {
			continue;
		}
		const text = h.heading.split(WORD_JOINER).join("").trim();
		if (text === "") {
			continue;
		}
		const hit = byLine.get(h.position.start.line);
		const label =
			hit && hit.level === h.level && hit.label !== null && !hit.staleRange
				? hit.label
				: null;
		const node: TocNode = {
			level: h.level,
			text,
			anchor: displayAnchor(h.heading),
			label,
			children: [],
			gap: 0,
		};
		while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
			stack.pop();
		}
		const parent = stack.length > 0 ? stack[stack.length - 1] : null;
		(parent ? parent.children : roots).push(node);
		parents.set(node, parent);
		all.push(node);
		stack.push(node);
	}
	// 缩进按级别对齐：以收录的最浅级别为基准，跳过的每一级补一格（H3 下的 H5 与别处 H4 下的 H5 同一缩进）。
	const base = all.reduce((m, n) => Math.min(m, n.level), 7);
	for (const n of all) {
		n.gap = n.level - (parents.get(n)?.level ?? base - 1) - 1;
	}
	return roots;
}

/** 目录块渲染需要插件提供的能力（接口隔离，便于单测）。 */
export interface TocBlockHost {
	/** 某文件此刻应显示的虚拟编号；不该显示时返回 `null`（门控见 main.ts `virtualNumberingFor`）。 */
	virtualNumberingFor(path: string, content: string): VirtualHeadingLabel[] | null;
	/** 读文件全文；读不到返回 `null`（此时目录退化为不带编号）。 */
	readFileContent(path: string): Promise<string | null>;
	/** 某文件 metadataCache 里的标题（文档顺序）；取不到返回 `null`。 */
	cachedHeadings(path: string): TocHeading[] | null;
	/** 原子改写某文件：`transform` 收到当前全文，返回新全文；返回 `null` 表示不改（校验没过）。 */
	processFile(path: string, transform: (content: string) => string | null): Promise<void>;
	/** 打开 `path#锚点`；`newLeaf` 为真时在新标签页打开（按住 Ctrl / Cmd 点击）。 */
	openHeadingLink(linkText: string, sourcePath: string, newLeaf: boolean): void;
}

/** 把目录树画进容器（容器先清空）；没有节点就什么都不画。 */
function drawTree(
	container: HTMLElement,
	nodes: readonly TocNode[],
	path: string,
	host: TocBlockHost,
): void {
	if (nodes.length === 0) {
		return;
	}
	const ul = container.createEl("ul", { cls: "ah-toc-list" });
	for (const node of nodes) {
		const li = ul.createEl("li");
		if (node.gap > 0) {
			li.setAttr("style", `margin-left: ${node.gap * 1.4}em`);
		}
		const a = li.createEl("a", { cls: "internal-link ah-toc-link", href: `#${node.anchor}` });
		if (node.label !== null) {
			a.createSpan({ cls: "ah-virtual-number", text: node.label });
		}
		a.appendText(node.text);
		a.addEventListener("click", (evt) => {
			evt.preventDefault();
			host.openHeadingLink(`${path}#${node.anchor}`, path, evt.ctrlKey || evt.metaKey);
		});
		drawTree(li, node.children, path, host);
	}
}

/** 一个已渲染的目录块：随块加载登记、卸载注销，供设置 / 元数据变化时原地重画。 */
class TocBlock extends MarkdownRenderChild {
	private round = 0;
	/** 最近一次取到的数据：拖滑块时直接用它重画列表，不再读文件。 */
	private data: { headings: TocHeading[]; labels: VirtualHeadingLabel[] | null } | null = null;
	/** 滑块选中的最深级别（内存里的选择，优先于块内 `depth:`；`null` = 听块里的）。 */
	private depth: number | null = null;
	/** 当前画着的滑块刻度（现存级别序列）；变了才重建滑块（拖动中不重建，免得丢焦点）。 */
	private barKey: string | null = null;
	private body: HTMLElement | null = null;
	private label: HTMLElement | null = null;

	constructor(
		private readonly el: HTMLElement,
		/** 块内文本；落盘成功后更新为新文本，下一次落盘的校验以它为准。 */
		private source: string,
		readonly path: string,
		private readonly ctx: MarkdownPostProcessorContext,
		private readonly owner: TocBlockRenderer,
	) {
		super(el);
	}

	onload(): void {
		this.owner.attach(this);
	}

	onunload(): void {
		this.owner.detach(this);
	}

	/** 按当前内容重画：先把数据都取齐、再一次性换掉 DOM，避免闪空。 */
	async render(): Promise<void> {
		const round = ++this.round;
		try {
			const headings = this.owner.host.cachedHeadings(this.path) ?? [];
			const raw = await this.owner.host.readFileContent(this.path);
			if (round !== this.round) {
				return; // 读文件期间又有更新的一轮
			}
			const labels =
				raw === null
					? null
					: this.owner.host.virtualNumberingFor(this.path, raw.replace(/\r\n/g, "\n"));
			this.data = { headings, labels };
			this.paint();
		} catch {
			/* 取不到信息：保持原样，不抛（V60） */
		}
	}

	/** 用最近取到的数据重画：滑块刻度没变就只换列表，变了才重建整个块。 */
	private paint(): void {
		if (!this.data) {
			return;
		}
		const { headings, labels } = this.data;
		const range = parseTocLevels(this.source);
		const levels = parseTocSlider(this.source) ? selectableLevels(headings, range) : [];
		const withBar = levels.length >= 2;
		const chosen = withBar
			? pickTocLevel(levels, this.depth ?? parseTocDepth(this.source))
			: range.max;
		const key = withBar ? levels.join(",") : "";
		if (this.body === null || this.barKey !== key) {
			this.el.empty();
			this.el.addClass("ah-toc");
			this.barKey = key;
			if (withBar) {
				const bar = this.el.createEl("div", { cls: "ah-toc-bar" });
				const input = bar.createEl("input", {
					cls: "ah-toc-slider",
					type: "range",
					attr: {
						min: "0",
						max: String(levels.length - 1),
						step: "1",
						value: String(levels.indexOf(chosen)),
					},
				});
				this.label = bar.createSpan({ cls: "ah-toc-slider-label", text: `H${chosen}` });
				// 实时预览里代码块的渲染结果被点到会让光标进块、退回源码；拖滑块不该触发（V63）。
				for (const type of ["mousedown", "pointerdown", "click"]) {
					bar.addEventListener(type, (evt) => evt.stopPropagation());
				}
				const levelAt = (evt: Event): number | null => {
					const v = Number((evt.target as HTMLInputElement).value);
					return Number.isInteger(v) && v >= 0 && v < levels.length ? levels[v] : null;
				};
				input.addEventListener("input", (evt) => {
					this.depth = levelAt(evt);
					this.paint();
				});
				// 松手才落盘（拖动过程不写文件）。
				input.addEventListener("change", (evt) => {
					const level = levelAt(evt);
					if (level !== null) {
						void this.persist(level);
					}
				});
			} else {
				this.label = null;
			}
			this.body = this.el.createEl("div", { cls: "ah-toc-body" });
		} else {
			this.body.empty();
		}
		this.label?.setText(`H${chosen}`);
		const tree = buildTocTree(headings, labels, { min: range.min, max: chosen });
		drawTree(this.body, tree, this.path, this.owner.host);
	}

	/**
	 * 把选中的级别写进块内 `depth:`（spec §3.25）。块的行区间取自 `getSectionInfo`（嵌入 / 悬浮预览 / 导出里
	 * 取不到就不写）；校验与改写见 {@link rewriteTocBlock}，对不上就放弃，只保留内存里的选择。
	 */
	private async persist(level: number): Promise<void> {
		try {
			const info = this.ctx.getSectionInfo(this.el);
			if (!info) {
				return;
			}
			const oldSource = this.source;
			let newSource: string | null = null;
			await this.owner.host.processFile(this.path, (content) => {
				const r = rewriteTocBlock(content, info.lineStart, info.lineEnd, oldSource, level);
				newSource = r ? r.source : null;
				return r ? r.content : null;
			});
			if (newSource !== null) {
				this.source = newSource;
			}
		} catch {
			/* 落盘失败：保持内存里的选择，不抛（V71） */
		}
	}
}

/** `ah-toc` 代码块处理器 + 块登记：设置 / 元数据变化时让同一篇的块重画。 */
export class TocBlockRenderer {
	private readonly blocks = new Set<TocBlock>();

	constructor(readonly host: TocBlockHost) {}

	/**
	 * `registerMarkdownCodeBlockProcessor(TOC_FENCE, …)` 用的回调。**异步，等首次渲染完才返回**：导出 PDF 走
	 * 同一条渲染管线，只有等处理器的 Promise 结束才截取 DOM；不等就会导出一个空块（testplan V73）。
	 */
	readonly processor = async (
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	): Promise<void> => {
		const block = new TocBlock(el, source, ctx.sourcePath, ctx, this);
		ctx.addChild(block);
		await block.render();
	};

	attach(block: TocBlock): void {
		this.blocks.add(block);
	}

	detach(block: TocBlock): void {
		this.blocks.delete(block);
	}

	/** 某文件元数据变了：重画它的全部目录块。 */
	refreshPath(path: string): void {
		for (const block of this.blocks) {
			if (block.path === path) {
				void block.render();
			}
		}
	}

	/** 设置 / 模板 / 规则变了：重画全部目录块。 */
	refreshAll(): void {
		for (const block of this.blocks) {
			void block.render();
		}
	}

	/** 插件卸载：登记清空（块本身随处理器注销恢复成普通代码块）。 */
	dispose(): void {
		this.blocks.clear();
	}
}
