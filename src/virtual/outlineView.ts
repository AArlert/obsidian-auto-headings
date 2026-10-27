/**
 * 虚拟编号在大纲面板里的显示：Obsidian 内置大纲（原 M14 二期，1.2.0 提前）与 Quiet Outline 插件
 * （testplan V48–V53）。见 spec.md §3.22、testplan V40–V53。
 *
 * ## 内置大纲
 *
 * 大纲是核心插件的视图（view type `outline`），没有公开 API。下面这些结构按 Obsidian 1.10 的实现核对过：
 * - 视图持有所示文件 `file` 与条目数组 `cachedHeadingDom`（文档顺序，每个标题一个条目对象）；条目上有
 *   `heading`（metadataCache 的 `HeadingCache`：`level` + `position.start.line`）与 `innerEl`
 *   （`.tree-item-inner`，放标题文字的元素）。
 * - 大纲每次刷新（元数据变化、换文件、搜索过滤）都用 `innerEl.setText()` 重写文字，插进去的节点会被
 *   冲掉——所以编号只写成 `innerEl` 上的 {@link OUTLINE_NUMBER_ATTR} 属性，由 CSS `::before` 画出来，
 *   也就不碰大纲自己的搜索高亮、拖动与点击跳转。
 * - 条目按需渲染（虚拟滚动），屏幕外的条目不在 DOM 里。编号挂在**条目对象**的元素上，滚进视口时自带；
 *   不靠扫描屏幕上的 DOM 去对齐标题（那样滚动、折叠、过滤之后会错位）。
 * - 刷新入口 `requestUpdate` 在构造时就捕获了原始 `update`，给实例打补丁挂不住刷新——改用
 *   MutationObserver：刷新会重写可见条目的文字（`childList` 变化），观察到就重新核对全部条目。
 *   写属性不是 `childList` 变化，不会自激。
 *
 * ## Quiet Outline
 *
 * 第三方插件（view type `quiet-outline`，按 0.5.15 核对）。它是 Vue + naive-ui 的树，没有条目对象，
 * 但每个节点的 `id="no-N"` 里 N 就是该标题在 `metadataCache` `headings` 里的下标（它自己点击跳转也用这个
 * 下标），`class="level-L"` 带级别，文字容器是 `.n-tree-node-content__text`。所以用 N 取 `headings[N]`
 * 得到行号，再按行号取编号。它没开虚拟滚动，展开着的节点都在 DOM 里。所示文件取自
 * `plugin.navigator.view.file`（它跟的是 Markdown 视图，不是工作区活动文件）。
 *
 * 两种大纲共用观察器、缓存与门控，差别收在 {@link OutlineAdapter} 里。
 *
 * ## 共同的规则
 *
 * 条目与编号的对应：按条目的标题行号取编号，再核对级别，对不上就不画（宁缺勿错）。以 WJ 开头的残留
 * 旧编号标题不画：大纲只能显示文件原文，叠上去就是两层数字（编辑器里另有虚线提示）。
 *
 * 取不到上述任何结构（Obsidian 或 Quiet Outline 改了内部实现）就什么都不做：不报错，编辑视图 / 阅读视图的
 * 虚拟编号不受影响。
 */

import type { VirtualHeadingLabel } from "./compute";

/** 编号写在大纲条目 `innerEl` 上的属性名（styles.css 用 `::before` 画出来）。 */
export const OUTLINE_NUMBER_ATTR = "data-ah-number";

/** 编号缓存最多记住几篇笔记（大纲视图通常只有一两个）。 */
const CACHE_LIMIT = 8;

/** 写编号需要的最小元素形状（真实为 `HTMLElement`；单测传假对象）。 */
export interface OutlineLabelTarget {
	getAttribute(name: string): string | null;
	setAttribute(name: string, value: string): void;
	removeAttribute(name: string): void;
}

/** 大纲条目的最小形状（Obsidian 内部对象，逐字段防御性收窄）。 */
export interface OutlineItemLike {
	heading?: { level?: unknown; position?: { start?: { line?: unknown } } };
	innerEl?: unknown;
}

/** 大纲视图的最小形状（Obsidian 内部对象）。 */
export interface OutlineViewLike {
	file?: { path?: unknown } | null;
	cachedHeadingDom?: unknown;
	contentEl?: unknown;
	/** Quiet Outline 视图持有它的插件实例；插件的 `navigator.view` 才是它所示的 Markdown 视图。 */
	plugin?: { navigator?: { view?: { file?: { path?: unknown; extension?: unknown } | null } } };
}

/** 大纲渲染需要插件提供的能力（接口隔离，便于单测）。 */
export interface VirtualOutlineHost {
	/** 某文件此刻应显示的虚拟编号；不该显示时返回 `null`（门控见 main.ts `virtualNumberingFor`）。 */
	virtualNumberingFor(path: string, content: string): VirtualHeadingLabel[] | null;
	/** 读文件全文（与 metadataCache 解析的是同一份内容）；读不到返回 `null`。 */
	readFileContent(path: string): Promise<string | null>;
	/** 某文件 metadataCache 里的标题（文档顺序）；Quiet Outline 节点的下标指向这里。取不到返回 `null`。 */
	cachedHeadings(path: string): Array<NonNullable<OutlineItemLike["heading"]>> | null;
}

/** 工作区的最小形状（`app.workspace`）。 */
export interface OutlineWorkspaceLike {
	getLeavesOfType(type: string): Array<{ view: unknown }>;
}

/** 一种大纲面板的接入方式：怎么认出视图、取所示文件、取条目、清掉编号。 */
export interface OutlineAdapter {
	readonly viewType: string;
	/** 认得出的视图（结构符合预期）；占位视图、别的视图一律不认。 */
	accepts(view: unknown): view is OutlineViewLike;
	/** 视图所示的文件路径；不是 Markdown 笔记或取不到返回 `null`。 */
	filePath(view: OutlineViewLike): string | null;
	/** 当前全部条目（带标题行号 / 级别与写编号的元素）。 */
	items(view: OutlineViewLike, path: string, host: VirtualOutlineHost): OutlineItemLike[];
	/** 去掉视图上我们画的全部编号。 */
	clear(view: OutlineViewLike): void;
	/** 除 `childList` 外还要盯的属性（节点复用时靠它察觉；内置大纲不需要）。 */
	readonly observeAttributes?: string[];
}

/**
 * 给每个大纲条目挑要画的编号（与 `items` 等长；`null` = 不画）。
 *
 * 按条目标题的行号取编号并核对级别：大纲的标题来自 metadataCache，编号来自同一份文件内容的解析，行号
 * 应当一致；级别对不上说明两边内容还没同步（刚改完、大纲尚未刷新），先不画，等下一次刷新。不编号的标题
 * （超出编号区间、白名单跳过）与残留旧编号的标题也不画。
 */
export function pickOutlineLabels(
	items: readonly OutlineItemLike[],
	labels: readonly VirtualHeadingLabel[] | null,
): Array<string | null> {
	if (!labels) {
		return items.map(() => null);
	}
	const byLine = new Map<number, VirtualHeadingLabel>();
	for (const l of labels) {
		byLine.set(l.lineIndex, l);
	}
	return items.map((item) => {
		const line = item.heading?.position?.start?.line;
		const level = item.heading?.level;
		if (typeof line !== "number" || typeof level !== "number") {
			return null;
		}
		const hit = byLine.get(line);
		if (!hit || hit.level !== level || hit.label === null || hit.staleRange) {
			return null;
		}
		return hit.label;
	});
}

/** 把编号写到条目元素上（`null` = 去掉）；与现值相同就不动 DOM。 */
export function setOutlineLabel(el: OutlineLabelTarget, label: string | null): void {
	const current = el.getAttribute(OUTLINE_NUMBER_ATTR);
	if (label === null) {
		if (current !== null) {
			el.removeAttribute(OUTLINE_NUMBER_ATTR);
		}
		return;
	}
	if (current !== label) {
		el.setAttribute(OUTLINE_NUMBER_ATTR, label);
	}
}

function isLabelTarget(x: unknown): x is OutlineLabelTarget {
	if (typeof x !== "object" || x === null) {
		return false;
	}
	const el = x as Partial<OutlineLabelTarget>;
	return (
		typeof el.getAttribute === "function" &&
		typeof el.setAttribute === "function" &&
		typeof el.removeAttribute === "function"
	);
}

/** 内置大纲的条目数组；结构不认识时为空。 */
function coreItemsOf(view: OutlineViewLike): OutlineItemLike[] {
	const items = view.cachedHeadingDom;
	return Array.isArray(items) ? (items as OutlineItemLike[]) : [];
}

/** 核心插件「大纲」：条目是视图里的对象，`innerEl` 即写编号的元素。 */
export const CORE_OUTLINE_ADAPTER: OutlineAdapter = {
	viewType: "outline",
	accepts(view): view is OutlineViewLike {
		return (
			typeof view === "object" &&
			view !== null &&
			Array.isArray((view as OutlineViewLike).cachedHeadingDom)
		);
	},
	filePath(view) {
		return typeof view.file?.path === "string" ? view.file.path : null;
	},
	items(view) {
		return coreItemsOf(view);
	},
	clear(view) {
		for (const item of coreItemsOf(view)) {
			if (isLabelTarget(item.innerEl)) {
				setOutlineLabel(item.innerEl, null);
			}
		}
	},
};

/** DOM 元素的最小形状（Quiet Outline 的节点；单测传假对象）。 */
interface DomLike {
	id?: unknown;
	className?: unknown;
	querySelector?(selector: string): unknown;
	querySelectorAll?(selector: string): ArrayLike<unknown>;
}

const QUIET_NODE_ID = /^no-(\d+)$/;
const QUIET_LEVEL_CLASS = /(?:^|\s)level-(\d)(?:\s|$)/;
/** Quiet Outline 里放标题文字的容器（node 的 `id` 可能挂在行或内容层，文字容器总在其内）。 */
const QUIET_TEXT_SELECTOR = ".n-tree-node-content__text";

/** Quiet Outline 的视图根（`contentEl`）；认不出返回 `null`。 */
function quietRootOf(view: OutlineViewLike): DomLike | null {
	const root = view.contentEl as DomLike | null | undefined;
	return root && typeof root.querySelectorAll === "function" ? root : null;
}

/** Quiet Outline 所示的 Markdown 笔记路径（画布等别的文件类型、取不到都返回 `null`）。 */
function quietFilePath(view: OutlineViewLike): string | null {
	const file = view.plugin?.navigator?.view?.file;
	const path = file?.path;
	if (typeof path !== "string" || !path.toLowerCase().endsWith(".md")) {
		return null;
	}
	return file?.extension === undefined || file.extension === "md" ? path : null;
}

/** 第三方插件 Quiet Outline：条目要从 DOM 节点（`id="no-N"`）经 metadataCache 标题下标还原。 */
export const QUIET_OUTLINE_ADAPTER: OutlineAdapter = {
	viewType: "quiet-outline",
	accepts(view): view is OutlineViewLike {
		return (
			typeof view === "object" &&
			view !== null &&
			quietRootOf(view as OutlineViewLike) !== null &&
			typeof (view as OutlineViewLike).plugin === "object"
		);
	},
	filePath: quietFilePath,
	items(view, path, host) {
		const root = quietRootOf(view);
		const headings = host.cachedHeadings(path);
		if (!root || !headings) {
			return [];
		}
		const out: OutlineItemLike[] = [];
		for (const node of Array.from(root.querySelectorAll?.('[id^="no-"]') ?? []) as DomLike[]) {
			const m = typeof node.id === "string" ? QUIET_NODE_ID.exec(node.id) : null;
			const heading = m ? headings[Number(m[1])] : undefined;
			const text = node.querySelector?.(QUIET_TEXT_SELECTOR);
			if (!heading || !isLabelTarget(text)) {
				continue;
			}
			// 面板自己的级别类与 metadataCache 对不上：说明面板还没跟上刚改的内容，先不画（V51）。
			const levelClass =
				typeof node.className === "string" ? QUIET_LEVEL_CLASS.exec(node.className) : null;
			if (levelClass && Number(levelClass[1]) !== heading.level) {
				continue;
			}
			out.push({ heading, innerEl: text });
		}
		return out;
	},
	clear(view) {
		const root = quietRootOf(view);
		for (const el of Array.from(
			root?.querySelectorAll?.(`[${OUTLINE_NUMBER_ATTR}]`) ?? [],
		) as unknown[]) {
			if (isLabelTarget(el)) {
				setOutlineLabel(el, null);
			}
		}
	},
	observeAttributes: ["id"],
};

const ADAPTERS: readonly OutlineAdapter[] = [CORE_OUTLINE_ADAPTER, QUIET_OUTLINE_ADAPTER];

/** 节点所在窗口的 MutationObserver 构造器（弹出窗口各有一份）；都取不到返回 `null`（node 单测）。 */
function observerCtorFor(node: unknown): typeof MutationObserver | null {
	const win = (node as { ownerDocument?: { defaultView?: unknown } | null } | null)?.ownerDocument
		?.defaultView as { MutationObserver?: typeof MutationObserver } | null | undefined;
	if (win && typeof win.MutationObserver === "function") {
		return win.MutationObserver;
	}
	return typeof MutationObserver === "function" ? MutationObserver : null;
}

/** 大纲面板（内置大纲 + Quiet Outline）的虚拟编号渲染器：给每个大纲挂观察器，一刷新就按行号重新核对全部条目。 */
export class VirtualOutlineDecorator {
	/** 正在跟踪的大纲视图 → 它的观察器（环境里没有 MutationObserver 时为 `null`）与接入方式。 */
	private readonly tracked = new Map<
		OutlineViewLike,
		{ observer: MutationObserver | null; adapter: OutlineAdapter }
	>();
	/** 已排队、尚未执行的核对（同一视图在同一轮里的多次变化合并成一次）。 */
	private readonly pending = new Set<OutlineViewLike>();
	/** 每个视图最近一轮核对的序号：异步读文件回来时若已有更新的一轮，就放弃这一轮。 */
	private readonly rounds = new Map<OutlineViewLike, number>();
	private readonly cache = new Map<
		string,
		{ content: string; generation: number; labels: VirtualHeadingLabel[] | null }
	>();
	/** 设置版本：设置 / 模板 / 规则变化时递增，让缓存失效。 */
	private generation = 0;
	private disposed = false;

	constructor(
		private readonly host: VirtualOutlineHost,
		private readonly workspace: OutlineWorkspaceLike,
	) {}

	/** 给新出现的大纲挂观察器、注销已关闭的（layout-change / 布局就绪时调用）。 */
	attachAll(): void {
		if (this.disposed) {
			return;
		}
		const views = this.currentViews();
		const alive = new Set(views.map((v) => v.view));
		for (const view of [...this.tracked.keys()]) {
			if (!alive.has(view)) {
				this.untrack(view);
			}
		}
		for (const { view, adapter } of views) {
			if (!this.tracked.has(view)) {
				this.track(view, adapter);
			}
		}
	}

	/** 设置 / 模板 / 规则变了：作废缓存，重新挂载并核对全部大纲。 */
	refreshAll(): void {
		if (this.disposed) {
			return;
		}
		this.generation++;
		this.attachAll();
		for (const view of this.tracked.keys()) {
			this.schedule(view);
		}
	}

	/** 插件卸载：断开全部观察器、去掉全部编号，大纲恢复原样。 */
	dispose(): void {
		for (const view of [...this.tracked.keys()]) {
			this.untrack(view);
		}
		this.pending.clear();
		this.cache.clear();
		this.disposed = true;
	}

	/** 当前跟踪的大纲数（单测用）。 */
	get trackedCount(): number {
		return this.tracked.size;
	}

	/**
	 * @internal 立即核对某个大纲的全部条目（观察器回调经 {@link schedule} 合并后调用；单测可直接调）。
	 * 异步读文件回来后若已有更新的一轮核对，或大纲已换了文件，就交给那一轮。
	 */
	async sync(view: OutlineViewLike): Promise<void> {
		const entry = this.tracked.get(view);
		if (this.disposed || !entry) {
			return;
		}
		const { adapter } = entry;
		const round = (this.rounds.get(view) ?? 0) + 1;
		this.rounds.set(view, round);
		try {
			const path = adapter.filePath(view);
			const raw = path === null ? null : await this.host.readFileContent(path);
			if (this.disposed || this.rounds.get(view) !== round) {
				return;
			}
			const nowPath = adapter.filePath(view);
			if (nowPath !== path) {
				this.schedule(view); // 读文件期间大纲换了文件：按新文件再来一轮。
				return;
			}
			if (path === null) {
				adapter.clear(view); // 不是笔记（画布等）：不留旧编号。
				return;
			}
			const labels = raw === null ? null : this.labelsFor(path, raw.replace(/\r\n/g, "\n"));
			const items = adapter.items(view, path, this.host);
			const picked = pickOutlineLabels(items, labels);
			items.forEach((item, i) => {
				if (isLabelTarget(item.innerEl)) {
					setOutlineLabel(item.innerEl, picked[i]);
				}
			});
		} catch {
			/* 大纲内部结构与预期不符：静默放弃，不影响其他渲染（V45 / V52） */
		}
	}

	private currentViews(): Array<{ view: OutlineViewLike; adapter: OutlineAdapter }> {
		const found: Array<{ view: OutlineViewLike; adapter: OutlineAdapter }> = [];
		for (const adapter of ADAPTERS) {
			try {
				for (const leaf of this.workspace.getLeavesOfType(adapter.viewType)) {
					if (adapter.accepts(leaf.view)) {
						found.push({ view: leaf.view, adapter });
					}
				}
			} catch {
				/* 取不到这一种大纲：跳过 */
			}
		}
		return found;
	}

	private track(view: OutlineViewLike, adapter: OutlineAdapter): void {
		let observer: MutationObserver | null = null;
		const target = view.contentEl;
		const Observer =
			typeof target === "object" && target !== null ? observerCtorFor(target) : null;
		if (Observer) {
			try {
				observer = new Observer(() => this.schedule(view));
				observer.observe(target as Node, {
					childList: true,
					subtree: true,
					...(adapter.observeAttributes
						? { attributes: true, attributeFilter: adapter.observeAttributes }
						: {}),
				});
			} catch {
				observer = null;
			}
		}
		this.tracked.set(view, { observer, adapter });
		this.schedule(view);
	}

	private untrack(view: OutlineViewLike): void {
		const entry = this.tracked.get(view);
		entry?.observer?.disconnect();
		this.tracked.delete(view);
		this.rounds.delete(view);
		this.pending.delete(view);
		try {
			entry?.adapter.clear(view);
		} catch {
			/* 同上：静默 */
		}
	}

	/** 排一次核对（微任务里执行，赶在下一帧绘制之前；同一视图多次变化只核对一次）。 */
	private schedule(view: OutlineViewLike): void {
		if (this.disposed || this.pending.has(view)) {
			return;
		}
		this.pending.add(view);
		queueMicrotask(() => {
			this.pending.delete(view);
			void this.sync(view);
		});
	}

	private labelsFor(path: string, content: string): VirtualHeadingLabel[] | null {
		const hit = this.cache.get(path);
		if (hit && hit.generation === this.generation && hit.content === content) {
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
}
