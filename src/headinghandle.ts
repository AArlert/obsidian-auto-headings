/**
 * 标题手柄（M16，spec §3.24，testplan S16–S18）：悬停标题行时在左边距浮出 ⋮⋮，点击弹出原生菜单；
 * 手机端没有悬停，光标进入标题行时行尾出现「⋯」。
 *
 * 手柄是挂在 `view.scrollDOM` 里的**单个浮层元素**（绝对定位、随内容滚动），不插进行内、不进文档，
 * 因此不碰原生折叠箭头、也不影响复制与光标。菜单内容由 {@link NoteEntry.openHeadingMenu} 组装。
 */
import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { editorInfoField, Platform } from "obsidian";
import type { NoteEntry } from "./noteentry";

/** 离开标题行后手柄收起的延迟（毫秒）：给鼠标从文字移向手柄留出时间。 */
const HIDE_DELAY = 250;
/** 桌面手柄相对行文字左缘的偏移（像素，避开原生折叠箭头）。 */
const DESKTOP_OFFSET = 44;

/** 创建标题手柄的 CM6 扩展。 */
export function headingHandleExtension(entry: NoteEntry): Extension {
	return ViewPlugin.fromClass(
		class {
			private readonly el: HTMLElement;
			private lineEl: HTMLElement | null = null;
			private hideTimer: number | null = null;
			private readonly onMove = (evt: MouseEvent) => this.hover(evt);
			private readonly onLeave = () => this.scheduleHide();

			constructor(private readonly view: EditorView) {
				this.el = document.createElement("div");
				this.el.className = "ah-heading-handle";
				this.el.textContent = Platform.isMobile ? "⋯" : "⋮⋮";
				this.el.addEventListener("mouseenter", () => this.cancelHide());
				this.el.addEventListener("mouseleave", () => this.scheduleHide());
				this.el.addEventListener("mousedown", (e) => e.preventDefault());
				this.el.addEventListener("click", (e) => this.open(e));
				view.scrollDOM.appendChild(this.el);
				if (!Platform.isMobile) {
					view.contentDOM.addEventListener("mousemove", this.onMove);
					view.contentDOM.addEventListener("mouseleave", this.onLeave);
				}
			}

			update(u: ViewUpdate): void {
				if (this.lineEl && (u.docChanged || u.geometryChanged)) {
					if (this.lineEl.isConnected) {
						this.place(this.lineEl);
					} else {
						this.hide();
					}
				}
				if (Platform.isMobile && (u.selectionSet || u.docChanged || u.focusChanged)) {
					this.showForCursor();
				}
			}

			destroy(): void {
				this.view.contentDOM.removeEventListener("mousemove", this.onMove);
				this.view.contentDOM.removeEventListener("mouseleave", this.onLeave);
				this.cancelHide();
				this.el.remove();
			}

			private hover(evt: MouseEvent): void {
				const line = (evt.target as HTMLElement | null)?.closest?.(
					".cm-line",
				) as HTMLElement | null;
				if (line && isHeadingLine(line)) {
					this.cancelHide();
					this.show(line);
				} else {
					this.scheduleHide();
				}
			}

			private showForCursor(): void {
				if (!this.view.hasFocus) {
					return this.hide();
				}
				const head = this.view.state.selection.main.head;
				const node = this.view.domAtPos(head).node;
				const base = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
				const line = base?.closest(".cm-line") as HTMLElement | null;
				if (line && isHeadingLine(line)) {
					this.show(line);
				} else {
					this.hide();
				}
			}

			private show(line: HTMLElement): void {
				this.lineEl = line;
				this.place(line);
				this.el.classList.add("is-visible");
			}

			private place(line: HTMLElement): void {
				const s = this.view.scrollDOM.getBoundingClientRect();
				const r = line.getBoundingClientRect();
				const top = r.top - s.top + this.view.scrollDOM.scrollTop;
				const base = Platform.isMobile ? r.right - 28 : r.left - DESKTOP_OFFSET;
				const left = Math.max(2, base - s.left + this.view.scrollDOM.scrollLeft);
				this.el.style.top = `${top}px`;
				this.el.style.left = `${left}px`;
				this.el.style.height = `${r.height}px`;
			}

			private hide(): void {
				this.lineEl = null;
				this.el.classList.remove("is-visible");
			}

			private scheduleHide(): void {
				this.cancelHide();
				this.hideTimer = window.setTimeout(() => this.hide(), HIDE_DELAY);
			}

			private cancelHide(): void {
				if (this.hideTimer !== null) {
					window.clearTimeout(this.hideTimer);
					this.hideTimer = null;
				}
			}

			/** 点击：由行 DOM 反查文档行号，交给 {@link NoteEntry.openHeadingMenu}（它会再次校验这确是结构标题）。 */
			private open(evt: MouseEvent): void {
				const line = this.lineEl;
				const info = this.view.state.field(editorInfoField, false);
				if (!line || !info?.editor || !info.file) {
					return;
				}
				const pos = this.view.posAtDOM(line);
				const lineIndex = this.view.state.doc.lineAt(pos).number - 1;
				entry.openHeadingMenu(evt, info.editor, info.file, lineIndex);
			}
		},
	);
}

/** Obsidian 给结构标题行打的类（实时预览与源码模式都有；围栏里的 `#` 行没有）。 */
function isHeadingLine(line: HTMLElement): boolean {
	return line.classList.contains("HyperMD-header");
}
