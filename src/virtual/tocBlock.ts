/**
 * 只读目录块 `ah-toc`（M17-B，见 spec.md §3.25、testplan V54–V62）：用户手写一个围栏代码块，这里把它
 * 渲染成当前文件的目录——**只读，不写文件**，块内容永远是用户写的那几行。
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
		};
		while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
			stack.pop();
		}
		(stack.length > 0 ? stack[stack.length - 1].children : roots).push(node);
		stack.push(node);
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

	constructor(
		private readonly el: HTMLElement,
		private readonly source: string,
		readonly path: string,
		private readonly owner: TocBlockRenderer,
	) {
		super(el);
	}

	onload(): void {
		this.owner.attach(this);
		void this.render();
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
			const tree = buildTocTree(headings, labels, parseTocLevels(this.source));
			this.el.empty();
			drawTree(this.el, tree, this.path, this.owner.host);
		} catch {
			/* 取不到信息：保持原样，不抛（V60） */
		}
	}
}

/** `ah-toc` 代码块处理器 + 块登记：设置 / 元数据变化时让同一篇的块重画。 */
export class TocBlockRenderer {
	private readonly blocks = new Set<TocBlock>();

	constructor(readonly host: TocBlockHost) {}

	/** `registerMarkdownCodeBlockProcessor(TOC_FENCE, …)` 用的回调。 */
	readonly processor = (
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	): void => {
		ctx.addChild(new TocBlock(el, source, ctx.sourcePath, this));
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
