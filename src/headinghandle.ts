/**
 * 标题手柄（M16，spec §3.24，testplan S16–S18、S24）。
 *
 * **桌面端不另造控件**：复用 Obsidian 自己在标题左侧悬停时出现的折叠箭头（`.cm-fold-indicator`，
 * 是 `.cm-line` 的子元素），给它加功能——
 * - 单击：照旧折叠 / 展开（原生行为，不拦截）；
 * - 按住拖动（位移超过阈值）：把整节（含子标题）拖到别处，落点用一条横线标出，松手一次事务移动；
 * - 右键：打开标题菜单。
 *
 * **手机端**没有悬停：光标进入标题行时，行尾浮出一个「⋯」浮层元素（挂在 `view.scrollDOM`，不进文档），
 * 点开为原生底部菜单。
 *
 * 菜单内容由 {@link NoteEntry.openHeadingMenu} 组装；整节移动的文本计算是 `headingedit.ts` 的纯函数
 * {@link moveSection}。
 */
import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { editorInfoField, Platform } from "obsidian";
import { bodyLineCount, moveSection } from "./headingedit";
import type { NoteEntry } from "./noteentry";
import { parseHeadings } from "./parser";

/** 拖动判定阈值（像素）：小于它视为普通单击（折叠）。 */
const DRAG_THRESHOLD = 5;
/** 拖到滚动区上 / 下缘多近时自动滚动（像素）及每次滚动量。 */
const EDGE_ZONE = 40;
const EDGE_STEP = 14;
/** 手机端浮层相对行右缘的偏移。 */
const MOBILE_INSET = 28;

/** Obsidian 给结构标题行打的类（实时预览与源码模式都有；围栏里的 `#` 行没有）。 */
function isHeadingLine(line: HTMLElement): boolean {
	return line.classList.contains("HyperMD-header");
}

/** 创建标题手柄的 CM6 扩展。`hint` 返回折叠箭头悬停提示（随界面语言）。 */
export function headingHandleExtension(entry: NoteEntry, hint: () => string): Extension {
	return ViewPlugin.fromClass(
		class {
			/** 手机端「⋯」浮层；桌面端为 `null`。 */
			private readonly el: HTMLElement | null;
			private lineEl: HTMLElement | null = null;
			private drag: {
				line: number;
				startX: number;
				startY: number;
				active: boolean;
				dest: number | null;
			} | null = null;
			private dropEl: HTMLElement | null = null;
			private readonly onDown = (e: MouseEvent) => this.mouseDown(e);
			private readonly onMove = (e: MouseEvent) => this.dragMove(e);
			private readonly onUp = (e: MouseEvent) => this.dragEnd(e);
			private readonly onContext = (e: MouseEvent) => this.contextMenu(e);
			private readonly onHover = (e: MouseEvent) => this.hover(e);

			constructor(private readonly view: EditorView) {
				if (Platform.isMobile) {
					this.el = view.scrollDOM.createDiv({ cls: "ah-heading-handle", text: "⋯" });
					this.el.addEventListener("mousedown", (e) => e.preventDefault());
					this.el.addEventListener("click", (e) => this.openAtLine(e, this.lineEl));
				} else {
					this.el = null;
					// 挂在 window 捕获阶段：其他插件（如 Outliner）也在捕获阶段拦 mousedown，
					// 挂在 contentDOM 上会被它们先吞掉。事件是否属于本编辑器在处理函数里判断。
					const win = this.win();
					win.addEventListener("mousedown", this.onDown, true);
					win.addEventListener("contextmenu", this.onContext, true);
					view.contentDOM.addEventListener("mousemove", this.onHover);
				}
			}

			update(u: ViewUpdate): void {
				if (
					this.el &&
					(u.selectionSet || u.docChanged || u.focusChanged || u.geometryChanged)
				) {
					this.showForCursor();
				}
			}

			destroy(): void {
				const win = this.win();
				win.removeEventListener("mousedown", this.onDown, true);
				win.removeEventListener("contextmenu", this.onContext, true);
				this.view.contentDOM.removeEventListener("mousemove", this.onHover);
				this.endDragListeners();
				this.dropEl?.remove();
				this.el?.remove();
			}

			// ───────────── 桌面：折叠箭头 ─────────────

			/** 编辑器所在窗口（弹出窗口里的编辑器不在主窗口）。 */
			private win(): Window {
				return this.view.dom.ownerDocument.defaultView ?? window;
			}

			/** 返回事件目标所属的「标题行里的折叠箭头」；不属于本编辑器或不是标题则 `null`。 */
			private indicatorOf(e: Event): { ind: HTMLElement; line: HTMLElement } | null {
				if (!this.view.contentDOM.contains(e.target as Node)) {
					return null;
				}
				const ind = (e.target as HTMLElement | null)?.closest?.(
					".cm-fold-indicator",
				) as HTMLElement | null;
				const line = ind?.closest(".cm-line") as HTMLElement | null;
				return ind && line && isHeadingLine(line) ? { ind, line } : null;
			}

			/** 悬停在标题的折叠箭头上时给一句提示（只设一次）。 */
			private hover(e: MouseEvent): void {
				const hit = this.indicatorOf(e);
				if (hit && !hit.ind.title) {
					hit.ind.title = hint();
				}
			}

			private mouseDown(e: MouseEvent): void {
				if (e.button !== 0) {
					return;
				}
				const hit = this.indicatorOf(e);
				if (!hit) {
					return;
				}
				const line = this.lineIndexOf(hit.line);
				if (line === null) {
					return;
				}
				this.drag = {
					line,
					startX: e.clientX,
					startY: e.clientY,
					active: false,
					dest: null,
				};
				document.addEventListener("mousemove", this.onMove, true);
				document.addEventListener("mouseup", this.onUp, true);
			}

			private dragMove(e: MouseEvent): void {
				const d = this.drag;
				if (!d) {
					return;
				}
				if (!d.active) {
					if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) {
						return;
					}
					d.active = true;
					document.body.classList.add("ah-dragging-section");
					this.dropEl = this.view.scrollDOM.createDiv({ cls: "ah-drop-line" });
				}
				e.preventDefault();
				this.autoScroll(e.clientY);
				this.updateDrop(e.clientY);
			}

			private dragEnd(e: MouseEvent): void {
				const d = this.drag;
				this.endDragListeners();
				this.drag = null;
				if (!d?.active) {
					return; // 没拖起来：保持原生单击折叠。
				}
				e.preventDefault();
				e.stopPropagation();
				// 拖动后浏览器仍会补发一次 click，会把节折叠掉：吞掉它。
				const swallow = (ev: MouseEvent) => {
					ev.stopPropagation();
					ev.preventDefault();
				};
				document.addEventListener("click", swallow, { capture: true, once: true });
				window.setTimeout(() => document.removeEventListener("click", swallow, true), 0);
				this.dropEl?.remove();
				this.dropEl = null;
				if (d.dest !== null) {
					this.applyMove(d.line, d.dest);
				}
			}

			private endDragListeners(): void {
				document.removeEventListener("mousemove", this.onMove, true);
				document.removeEventListener("mouseup", this.onUp, true);
				document.body.classList.remove("ah-dragging-section");
			}

			/** 拖到编辑区上 / 下缘时自动滚动。 */
			private autoScroll(y: number): void {
				const r = this.view.scrollDOM.getBoundingClientRect();
				if (y < r.top + EDGE_ZONE) {
					this.view.scrollDOM.scrollTop -= EDGE_STEP;
				} else if (y > r.bottom - EDGE_ZONE) {
					this.view.scrollDOM.scrollTop += EDGE_STEP;
				}
			}

			/** 按指针纵坐标选最近的合法落点（某个标题行之前 / 文末），并把落点线画出来。 */
			private updateDrop(y: number): void {
				const d = this.drag;
				if (!d || !this.dropEl) {
					return;
				}
				const doc = this.view.state.doc;
				const content = doc.toString();
				const total = bodyLineCount(content);
				const candidates = [...parseHeadings(content).map((h) => h.lineIndex), total];
				const top = this.view.documentTop;
				let best: { dest: number; y: number } | null = null;
				for (const dest of candidates) {
					// 与 moveSection 同口径：落在自身小节内 / 紧贴其后的落点无效（它返回 null）。
					if (moveSection(content, d.line, dest) === null) {
						continue;
					}
					const block =
						dest >= total
							? this.view.lineBlockAt(doc.length)
							: this.view.lineBlockAt(doc.line(dest + 1).from);
					const py = top + (dest >= total ? block.bottom : block.top);
					if (best === null || Math.abs(py - y) < Math.abs(best.y - y)) {
						best = { dest, y: py };
					}
				}
				d.dest = best?.dest ?? null;
				if (!best) {
					this.dropEl.hide();
					return;
				}
				const s = this.view.scrollDOM.getBoundingClientRect();
				this.dropEl.show();
				this.dropEl.style.top = `${best.y - s.top + this.view.scrollDOM.scrollTop}px`;
			}

			/** 整节移动：算出新全文，换成一次最小范围替换（一次撤销）。 */
			private applyMove(line: number, dest: number): void {
				const old = this.view.state.doc.toString();
				const next = moveSection(old, line, dest);
				if (next === null) {
					return;
				}
				let head = 0;
				const max = Math.min(old.length, next.length);
				while (head < max && old[head] === next[head]) {
					head++;
				}
				let tail = 0;
				while (
					tail < max - head &&
					old[old.length - 1 - tail] === next[next.length - 1 - tail]
				) {
					tail++;
				}
				this.view.dispatch({
					changes: {
						from: head,
						to: old.length - tail,
						insert: next.slice(head, next.length - tail),
					},
					userEvent: "move",
				});
			}

			private contextMenu(e: MouseEvent): void {
				const hit = this.indicatorOf(e);
				if (!hit) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
				this.openAtLine(e, hit.line);
			}

			// ───────────── 公用 ─────────────

			private lineIndexOf(line: HTMLElement): number | null {
				try {
					const pos = this.view.posAtDOM(line);
					return this.view.state.doc.lineAt(pos).number - 1;
				} catch {
					return null;
				}
			}

			private openAtLine(evt: MouseEvent, line: HTMLElement | null): void {
				const info = this.view.state.field(editorInfoField, false);
				const idx = line ? this.lineIndexOf(line) : null;
				if (idx === null || !info?.editor || !info.file) {
					return;
				}
				entry.openHeadingMenu(evt, info.editor, info.file, idx);
			}

			// ───────────── 手机：行尾「⋯」 ─────────────

			private showForCursor(): void {
				const el = this.el;
				if (!el) {
					return;
				}
				if (!this.view.hasFocus) {
					this.lineEl = null;
					el.classList.remove("is-visible");
					return;
				}
				const head = this.view.state.selection.main.head;
				const node = this.view.domAtPos(head).node;
				const base = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
				const line = base?.closest(".cm-line") as HTMLElement | null;
				if (!line || !isHeadingLine(line)) {
					this.lineEl = null;
					el.classList.remove("is-visible");
					return;
				}
				this.lineEl = line;
				const s = this.view.scrollDOM.getBoundingClientRect();
				const r = line.getBoundingClientRect();
				el.style.top = `${r.top - s.top + this.view.scrollDOM.scrollTop}px`;
				el.style.left = `${Math.max(2, r.right - MOBILE_INSET - s.left + this.view.scrollDOM.scrollLeft)}px`;
				el.style.height = `${r.height}px`;
				el.classList.add("is-visible");
			}
		},
	);
}
