/**
 * 虚拟编号在 Obsidian 内置大纲面板里的显示（原 M14 二期，1.2.0 提前；见 spec.md §3.22、testplan V40–V45）。
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
 * 条目与编号的对应：按条目的标题行号取编号，再核对级别，对不上就不画（宁缺勿错）。以 WJ 开头的残留
 * 旧编号标题不画：大纲只能显示文件原文，叠上去就是两层数字（编辑器里另有虚线提示）。
 *
 * 取不到上述任何结构（Obsidian 改了内部实现）就什么都不做：不报错，编辑视图 / 阅读视图的虚拟编号不受影响。
 */

import type { VirtualHeadingLabel } from "./compute";

/** 编号写在大纲条目 `innerEl` 上的属性名（styles.css 用 `::before` 画出来）。 */
export const OUTLINE_NUMBER_ATTR = "data-ah-number";

/** 核心插件「大纲」的视图类型。 */
const OUTLINE_VIEW_TYPE = "outline";

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
}

/** 大纲渲染需要插件提供的能力（接口隔离，便于单测）。 */
export interface VirtualOutlineHost {
	/** 某文件此刻应显示的虚拟编号；不该显示时返回 `null`（门控见 main.ts `virtualNumberingFor`）。 */
	virtualNumberingFor(path: string, content: string): VirtualHeadingLabel[] | null;
	/** 读文件全文（与 metadataCache 解析的是同一份内容）；读不到返回 `null`。 */
	readFileContent(path: string): Promise<string | null>;
	/** 设置「在大纲中显示编号」是否开着。 */
	outlineNumbersEnabled(): boolean;
}

/** 工作区的最小形状（`app.workspace`）。 */
export interface OutlineWorkspaceLike {
	getLeavesOfType(type: string): Array<{ view: unknown }>;
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

/** 认得出的大纲视图（有条目数组）；延迟加载的占位视图、别的视图一律不认。 */
function isOutlineView(view: unknown): view is OutlineViewLike {
	return (
		typeof view === "object" &&
		view !== null &&
		Array.isArray((view as OutlineViewLike).cachedHeadingDom)
	);
}

/** 视图的条目数组；结构不认识时为空。 */
function itemsOf(view: OutlineViewLike): OutlineItemLike[] {
	const items = view.cachedHeadingDom;
	return Array.isArray(items) ? (items as OutlineItemLike[]) : [];
}

/** 去掉某个大纲上我们画的全部编号。 */
function clearView(view: OutlineViewLike): void {
	for (const item of itemsOf(view)) {
		if (isLabelTarget(item.innerEl)) {
			setOutlineLabel(item.innerEl, null);
		}
	}
}

/** 节点所在窗口的 MutationObserver 构造器（弹出窗口各有一份）；都取不到返回 `null`（node 单测）。 */
function observerCtorFor(node: unknown): typeof MutationObserver | null {
	const win = (node as { ownerDocument?: { defaultView?: unknown } | null } | null)?.ownerDocument
		?.defaultView as { MutationObserver?: typeof MutationObserver } | null | undefined;
	if (win && typeof win.MutationObserver === "function") {
		return win.MutationObserver;
	}
	return typeof MutationObserver === "function" ? MutationObserver : null;
}

/** 内置大纲面板的虚拟编号渲染器：给每个大纲挂观察器，大纲一刷新就按行号重新核对全部条目。 */
export class VirtualOutlineDecorator {
	/** 正在跟踪的大纲视图 → 它的观察器（环境里没有 MutationObserver 时为 `null`）。 */
	private readonly tracked = new Map<OutlineViewLike, MutationObserver | null>();
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

	/**
	 * 给新出现的大纲挂观察器、注销已关闭的（layout-change / 布局就绪时调用）。设置关着时一个都不挂，
	 * 并去掉已画的编号——关掉这个功能后，插件对大纲内部结构零接触。
	 */
	attachAll(): void {
		if (this.disposed) {
			return;
		}
		const views = this.host.outlineNumbersEnabled() ? this.currentViews() : [];
		const alive = new Set(views);
		for (const view of [...this.tracked.keys()]) {
			if (!alive.has(view)) {
				this.untrack(view);
			}
		}
		for (const view of views) {
			if (!this.tracked.has(view)) {
				this.track(view);
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
		if (this.disposed || !this.tracked.has(view)) {
			return;
		}
		const round = (this.rounds.get(view) ?? 0) + 1;
		this.rounds.set(view, round);
		try {
			const path = typeof view.file?.path === "string" ? view.file.path : null;
			const raw = path === null ? null : await this.host.readFileContent(path);
			if (this.disposed || this.rounds.get(view) !== round) {
				return;
			}
			const nowPath = typeof view.file?.path === "string" ? view.file.path : null;
			if (nowPath !== path) {
				this.schedule(view); // 读文件期间大纲换了文件：按新文件再来一轮。
				return;
			}
			const labels =
				path === null || raw === null
					? null
					: this.labelsFor(path, raw.replace(/\r\n/g, "\n"));
			const items = itemsOf(view);
			const picked = pickOutlineLabels(items, labels);
			items.forEach((item, i) => {
				if (isLabelTarget(item.innerEl)) {
					setOutlineLabel(item.innerEl, picked[i]);
				}
			});
		} catch {
			/* 大纲内部结构与预期不符：静默放弃，不影响其他渲染（V45） */
		}
	}

	private currentViews(): OutlineViewLike[] {
		try {
			return this.workspace
				.getLeavesOfType(OUTLINE_VIEW_TYPE)
				.map((leaf) => leaf.view)
				.filter(isOutlineView);
		} catch {
			return [];
		}
	}

	private track(view: OutlineViewLike): void {
		let observer: MutationObserver | null = null;
		const target = view.contentEl;
		const Observer =
			typeof target === "object" && target !== null ? observerCtorFor(target) : null;
		if (Observer) {
			try {
				observer = new Observer(() => this.schedule(view));
				observer.observe(target as Node, { childList: true, subtree: true });
			} catch {
				observer = null;
			}
		}
		this.tracked.set(view, observer);
		this.schedule(view);
	}

	private untrack(view: OutlineViewLike): void {
		this.tracked.get(view)?.disconnect();
		this.tracked.delete(view);
		this.rounds.delete(view);
		this.pending.delete(view);
		try {
			clearView(view);
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
