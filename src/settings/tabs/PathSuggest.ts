import { type PathCandidate, filterPathCandidates } from "../../pathrules";

/**
 * 路径输入的建议弹窗（参考 numeroflip/obsidian-auto-template-trigger 的 `TextInputSuggest` 交互，
 * 见 doc/spec.md §3.8「参考实现」）：随输入列出 vault 中的文件夹 / 文件，支持键盘 ↑↓ 选择、Enter
 * 确认、Esc 关闭，鼠标点击 / 悬停同样可选中；选中文件夹时自动带上尾斜杠。
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

	constructor(
		private readonly inputEl: HTMLInputElement,
		private readonly getCandidates: () => PathCandidate[],
		private readonly onSelect: (candidate: PathCandidate) => void,
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

	/** 是否已展开且有候选项——供调用方判断 Enter/↑↓ 该交给本弹窗还是外层输入框处理。 */
	isOpen(): boolean {
		return this.el !== null;
	}

	/** 处理输入框上的键盘事件；返回 `true` 表示已消费（调用方不应再对该按键做其它处理）。 */
	handleKeydown(e: KeyboardEvent): boolean {
		if (!this.isOpen() || this.items.length === 0) {
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
		this.items = filterPathCandidates(this.getCandidates(), this.inputEl.value);
		if (this.items.length === 0) {
			this.close();
			return;
		}
		this.open();
		this.render();
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
		this.itemEls = this.items.map((item, i) => {
			const row = el.createDiv({ cls: "ah-path-suggest-item" });
			row.createSpan({ cls: "ah-path-suggest-icon", text: item.isFolder ? "📁" : "📄" });
			row.createSpan({ text: item.isFolder ? `${item.path}/` : item.path });
			row.addEventListener("mousedown", (e) => {
				e.preventDefault();
				this.setSelected(i);
				this.chooseSelected();
			});
			row.addEventListener("mousemove", () => this.setSelected(i));
			return row;
		});
		this.setSelected(0);
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
