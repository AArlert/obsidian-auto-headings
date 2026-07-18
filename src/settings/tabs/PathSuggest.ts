import {
	type PathCandidate,
	filterPathCandidates,
	listImmediateChildren,
	parentDir,
} from "../../pathrules";

/** 分层浏览模式用到的少量提示文案，由调用方（`PathRules.ts`）按当前语言传入。 */
export interface PathSuggestLabels {
	emptyFolder: string;
	backTooltip: string;
	descendTooltip: string;
	selectHereTooltip: string;
}

/**
 * 路径输入的建议弹窗（参考 numeroflip/obsidian-auto-template-trigger 的 `TextInputSuggest` 交互，
 * 见 doc/spec.md §3.8「参考实现」）：支持键盘 ↑↓ 选择、Enter 确认、Esc 关闭，鼠标点击 / 悬停同样
 * 可选中；选中文件夹时自动带上尾斜杠。
 *
 * **两种模式（testplan K14）**：
 * - **输入框为空** → **分层浏览**：从根目录开始，只列出当前层的直接子项（文件夹优先、字典序）；
 *   顶部 header 显示当前层路径且可点击直接选中该层（根层即「/」），非根层额外有一个 `⬅` 返回
 *   上一级；文件夹行右侧的小箭头 `▸` 用于下钻查看下一层（**不**选中），行文字本身点击＝选中
 *   （与打字搜索模式手感一致，贴合参考实现「点击即选中」的默认行为——见 K14 与用户讨论定案）。
 * - **输入框有内容** → 沿用既有**扁平模糊搜索**（`filterPathCandidates`，跨全库匹配），不支持下钻。
 * 一旦开始打字即从浏览模式退出；清空回空输入则重新从根开始浏览（不记忆上次下钻到的层级，
 * 避免「误以为在编辑一个新规则、其实还停留在上次浏览的深层目录」的困惑）。
 *
 * **不注入合成根候选**：参考实现的 `FolderSuggest` 显式排除根目录（`folder.path &&`），根规则
 * 改由浏览模式的 header 承接「点击选中当前层」——见 `PathRules.ts` `collectPathCandidates` 注释。
 *
 * **自实现、不依赖 Popper**：弹窗定位仅在每次显示 / 刷新时用 `getBoundingClientRect()` 算一次
 * （`position: fixed`，视口坐标系，无需叠加滚动偏移），不追踪连续滚动——容器发生滚动时直接关闭
 * 弹窗，比持续重新定位更简单可靠，足够覆盖设置面板「不会横向 resize、只会纵向滚动」的场景。
 *
 * **挂载点选 `activeDocument.body`（而非行内 `position: absolute`）**：`.ah-path-table` 有
 * `max-height` + `overflow-y: auto`（M6 引入），若弹窗挂在行内，纵向滚动裁剪会把弹窗切掉一截，
 * 规则条数一多体验很差；挂 body 则不受表格自身滚动裁剪影响。
 */
export class PathSuggestPopup {
	private el: HTMLElement | null = null;
	private items: PathCandidate[] = [];
	private itemEls: HTMLElement[] = [];
	private selectedIndex = -1;
	private closeTimer: number | null = null;
	/** `null` = 扁平模糊搜索模式；非 `null`（含 `""` 根）= 分层浏览模式，值为当前浏览的目录路径。 */
	private browseDir: string | null = null;

	constructor(
		private readonly inputEl: HTMLInputElement,
		private readonly getCandidates: () => PathCandidate[],
		private readonly onSelect: (candidate: PathCandidate) => void,
		private readonly labels: PathSuggestLabels,
	) {
		OPEN_POPUPS.add(this);
		inputEl.addEventListener("input", () => this.refresh());
		inputEl.addEventListener("focus", () => this.refresh());
		inputEl.addEventListener("blur", () => {
			// 延迟关闭：点击建议项的 mousedown 已 preventDefault 抢在 blur 之前触发选中，
			// 这里的延时只是兜底，避免二者时序在个别环境下颠倒导致选中前弹窗已被关闭。
			this.closeTimer = activeWindow.setTimeout(() => this.close(), 120);
		});
	}

	/** 是否已展开——供调用方判断 Enter/↑↓ 该交给本弹窗还是外层输入框处理。 */
	isOpen(): boolean {
		return this.el !== null;
	}

	/** 处理输入框上的键盘事件；返回 `true` 表示已消费（调用方不应再对该按键做其它处理）。 */
	handleKeydown(e: KeyboardEvent): boolean {
		if (!this.isOpen()) {
			return false;
		}
		if (this.browseDir !== null) {
			if (e.key === "ArrowLeft" && this.browseDir !== "") {
				e.preventDefault();
				this.navigateTo(parentDir(this.browseDir));
				return true;
			}
			if (e.key === "ArrowRight") {
				const item = this.items[this.selectedIndex];
				if (item?.isFolder && this.hasChildren(item.path)) {
					e.preventDefault();
					this.navigateTo(item.path);
					return true;
				}
			}
			if (e.key === "Enter" && this.items.length === 0) {
				// 浏览到一个空文件夹：Enter 等价于点击 header，选中当前层本身。
				e.preventDefault();
				this.selectCurrentDir();
				return true;
			}
		}
		if (this.items.length === 0) {
			return false;
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.setSelected((this.selectedIndex + 1) % this.items.length);
			return true;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			this.setSelected((this.selectedIndex - 1 + this.items.length) % this.items.length);
			return true;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			this.chooseSelected();
			return true;
		}
		if (e.key === "Escape") {
			this.close();
			return true;
		}
		return false;
	}

	/** 所在行销毁前调用，确保挂在 body 上的弹窗 DOM 节点随之清理（见 `closeAllPathSuggestPopups`）。 */
	destroy(): void {
		OPEN_POPUPS.delete(this);
		this.close();
	}

	private refresh(): void {
		if (this.closeTimer !== null) {
			activeWindow.clearTimeout(this.closeTimer);
			this.closeTimer = null;
		}
		if (this.inputEl.value.trim() === "") {
			// 空输入：进入 / 维持分层浏览，默认从根开始（不记忆上次浏览到的层级，见类注释）。
			if (this.browseDir === null) {
				this.browseDir = "";
			}
			this.items = listImmediateChildren(this.getCandidates(), this.browseDir);
			this.open();
			this.render();
			return;
		}
		// 有输入内容：退出浏览模式，回到既有的扁平模糊搜索。
		this.browseDir = null;
		this.items = filterPathCandidates(this.getCandidates(), this.inputEl.value);
		if (this.items.length === 0) {
			this.close();
			return;
		}
		this.open();
		this.render();
	}

	private navigateTo(dir: string): void {
		this.browseDir = dir;
		this.items = listImmediateChildren(this.getCandidates(), dir);
		this.render();
	}

	private hasChildren(dir: string): boolean {
		return listImmediateChildren(this.getCandidates(), dir).length > 0;
	}

	private selectCurrentDir(): void {
		if (this.browseDir === null) {
			return;
		}
		this.onSelect({ path: this.browseDir, isFolder: true });
		this.close();
	}

	private open(): void {
		if (!this.el) {
			this.el = activeDocument.body.createDiv({ cls: "ah-path-suggest" });
			// 弹窗内 mousedown 先 preventDefault，避免其抢在建议项自身的 mousedown 选中逻辑之前
			// 触发输入框 blur（blur 会在 120ms 后关闭弹窗，与点击选中产生竞态）。
			this.el.addEventListener("mousedown", (e) => e.preventDefault());
		}
		this.reposition();
	}

	private reposition(): void {
		if (!this.el) {
			return;
		}
		const rect = this.inputEl.getBoundingClientRect();
		this.el.style.left = `${rect.left}px`;
		this.el.style.top = `${rect.bottom}px`;
		this.el.style.width = `${rect.width}px`;
	}

	private render(): void {
		if (!this.el) {
			return;
		}
		const el = this.el;
		el.empty();

		if (this.browseDir !== null) {
			this.renderLocationHeader(el, this.browseDir);
			if (this.items.length === 0) {
				el.createDiv({ cls: "ah-path-suggest-empty", text: this.labels.emptyFolder });
			}
		}

		this.itemEls = this.items.map((item, i) => this.renderItem(el, item, i));
		this.setSelected(0);
	}

	/** 分层浏览模式的顶部条：当前层路径（点击＝选中该层）+ 非根层的「返回上一级」箭头。 */
	private renderLocationHeader(el: HTMLElement, dir: string): void {
		const header = el.createDiv({ cls: "ah-path-suggest-location" });
		if (dir !== "") {
			const back = header.createSpan({ cls: "ah-path-suggest-back", text: "⬅" });
			back.setAttr("aria-label", this.labels.backTooltip);
			back.title = this.labels.backTooltip;
			back.addEventListener("mousedown", (e) => {
				e.preventDefault();
				this.navigateTo(parentDir(dir));
			});
		}
		const label = header.createSpan({
			cls: "ah-path-suggest-location-label",
			text: dir === "" ? "/" : `${dir}/`,
		});
		label.setAttr("aria-label", this.labels.selectHereTooltip);
		label.title = this.labels.selectHereTooltip;
		label.addEventListener("mousedown", (e) => {
			e.preventDefault();
			this.selectCurrentDir();
		});
	}

	private renderItem(el: HTMLElement, item: PathCandidate, i: number): HTMLElement {
		const row = el.createDiv({ cls: "ah-path-suggest-item" });
		row.createSpan({ cls: "ah-path-suggest-icon", text: item.isFolder ? "📁" : "📄" });
		const browsing = this.browseDir !== null;
		const label = browsing
			? item.path.slice(item.path.lastIndexOf("/") + 1)
			: item.isFolder
				? `${item.path}/`
				: item.path;
		row.createSpan({ cls: "ah-path-suggest-label", text: label });
		row.addEventListener("mousedown", (e) => {
			e.preventDefault();
			this.setSelected(i);
			this.chooseSelected();
		});
		row.addEventListener("mousemove", () => this.setSelected(i));

		if (browsing && item.isFolder && this.hasChildren(item.path)) {
			const chevron = row.createSpan({ cls: "ah-path-suggest-chevron", text: "▸" });
			chevron.setAttr("aria-label", this.labels.descendTooltip);
			chevron.title = this.labels.descendTooltip;
			chevron.addEventListener("mousedown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.navigateTo(item.path);
			});
		}
		return row;
	}

	private setSelected(index: number): void {
		this.itemEls[this.selectedIndex]?.removeClass("is-selected");
		this.selectedIndex = index;
		const el = this.itemEls[this.selectedIndex];
		el?.addClass("is-selected");
		el?.scrollIntoView({ block: "nearest" });
	}

	private chooseSelected(): void {
		const item = this.items[this.selectedIndex];
		if (item) {
			this.onSelect(item);
		}
		this.close();
	}

	private close(): void {
		if (this.closeTimer !== null) {
			activeWindow.clearTimeout(this.closeTimer);
			this.closeTimer = null;
		}
		this.el?.remove();
		this.el = null;
		this.items = [];
		this.itemEls = [];
		this.selectedIndex = -1;
		this.browseDir = null;
	}
}

/**
 * 已创建的弹窗实例集合，供 {@link closeAllPathSuggestPopups} 在整个 TAB 重新渲染前兜底清场。
 *
 * **动机**：弹窗 DOM 节点挂在 `activeDocument.body`，不在 `.ah-path-table` 容器子树内，
 * 该容器整体 `empty()` 重建（增删/拖拽规则、模板下拉改动后 `tab.display()`）不会连带把
 * 旧行仍展开着的弹窗一并移除，会留下孤儿节点。`PathRules.ts` 在每次渲染路径规则表前调用
 * 本函数，保证上一代所有弹窗都先被销毁。
 */
const OPEN_POPUPS = new Set<PathSuggestPopup>();

export function closeAllPathSuggestPopups(): void {
	for (const popup of OPEN_POPUPS) {
		popup.destroy();
	}
}
