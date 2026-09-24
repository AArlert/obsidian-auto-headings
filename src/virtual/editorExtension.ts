/**
 * 虚拟编号的编辑视图渲染（M14，见 spec.md §3.22「渲染」）：CM6 ViewPlugin 在每个标题正文起点放一个
 * 编号 widget，文件里残留的插件前缀用同一个 widget 替换掉（残留样式 + 悬停提示），永不改文档。
 *
 * - 文档变化时先把旧装饰 `map` 到新位置（不漂移），完整重算放进约 100ms 的去抖；
 * - 输入法组合期间（`view.composing`）不重算、不 dispatch，组合结束后再补——组合区旁的 widget 被
 *   替换会打断中文输入；
 * - 模板 / 设置 / 规则变化时，main.ts 向所有编辑器 dispatch {@link virtualRefreshEffect} 触发重算。
 *
 * 「状态 → DecorationSet」拆成纯函数 {@link buildVirtualDecorations}，node 环境可直接单测。
 */

import { RangeSetBuilder, StateEffect, type Extension, type Text } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	WidgetType,
	type DecorationSet,
	type ViewUpdate,
} from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type { VirtualHeadingLabel } from "./compute";

/** 让编辑器立即重算虚拟编号的广播信号（设置 / 模板 / 规则变化，以及去抖到期时自发）。 */
export const virtualRefreshEffect = StateEffect.define<null>();

/** 文档变化后到完整重算之间的去抖（毫秒）。 */
export const VIRTUAL_RECOMPUTE_DELAY = 100;

/** 渲染器需要插件提供的能力（接口隔离，便于单测与避免循环依赖）。 */
export interface VirtualRenderHost {
	/** 某文件此刻应显示的虚拟编号；不该显示时返回 `null`（门控见 main.ts `virtualNumberingFor`）。 */
	virtualNumberingFor(path: string, content: string): VirtualHeadingLabel[] | null;
	/** 残留样式编号的悬停提示文案（随界面语言）。 */
	staleTooltip(): string;
}

/** 编号 widget：只是一个 span，文本不进文档，复制自然不带编号。 */
class VirtualNumberWidget extends WidgetType {
	constructor(
		readonly label: string,
		readonly stale: boolean,
		readonly tooltip: string,
	) {
		super();
	}

	eq(other: VirtualNumberWidget): boolean {
		return other.label === this.label && other.stale === this.stale;
	}

	toDOM(): HTMLElement {
		const span = document.createElement("span");
		span.className = this.stale
			? "ah-virtual-number ah-virtual-number--stale"
			: "ah-virtual-number";
		span.textContent = this.label;
		if (this.stale) {
			span.title = this.tooltip;
		}
		return span;
	}

	/** 点击交给编辑器处理（放光标），不吞事件。 */
	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * 把一篇文档的虚拟编号转成装饰集（纯函数）。`labels` 须按行号升序（{@link computeVirtualNumbers} 的输出即是）。
 * - 无残留：在标题正文起点放 widget，`side: 1`（贴着正文、在 Obsidian 隐藏的 `## ` 标记之后）；
 * - 有残留且该标题要编号：用 widget **替换**残留区间，只显示一层编号，并标成残留样式；
 * - 有残留但该标题不编号（白名单等）：不动，让旧前缀照原样可见——宁可露出来，也不悄悄藏掉文件里的内容。
 */
export function buildVirtualDecorations(
	doc: Text,
	labels: readonly VirtualHeadingLabel[],
	tooltip: string,
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	for (const l of labels) {
		if (l.label === null || l.lineIndex + 1 > doc.lines) {
			continue;
		}
		const line = doc.line(l.lineIndex + 1);
		if (l.staleRange) {
			const from = line.from + l.staleRange.from;
			const to = line.from + l.staleRange.to;
			if (to <= line.to) {
				builder.add(
					from,
					to,
					Decoration.replace({ widget: new VirtualNumberWidget(l.label, true, tooltip) }),
				);
				continue;
			}
		}
		const pos = line.from + l.textStart;
		if (pos <= line.to) {
			builder.add(
				pos,
				pos,
				Decoration.widget({ widget: new VirtualNumberWidget(l.label, false, ""), side: 1 }),
			);
		}
	}
	return builder.finish();
}

/** 事务里是否带着重算信号。 */
function hasRefresh(update: ViewUpdate): boolean {
	return update.transactions.some((tr) => tr.effects.some((e) => e.is(virtualRefreshEffect)));
}

/** 构造编辑视图扩展，交给 `plugin.registerEditorExtension` 注册。 */
export function virtualNumberingExtension(host: VirtualRenderHost): Extension {
	const plugin = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			private path: string | null;
			private timer: number | null = null;

			constructor(private readonly view: EditorView) {
				this.path = this.currentPath();
				this.decorations = this.compute();
			}

			update(update: ViewUpdate): void {
				const path = this.currentPath();
				// Obsidian 会复用同一个编辑器显示别的文件：换了文件就立刻重算，不把上一篇的编号映射过来。
				if (hasRefresh(update) || path !== this.path) {
					this.path = path;
					this.cancel();
					this.decorations = this.compute();
					return;
				}
				if (update.docChanged) {
					this.decorations = this.decorations.map(update.changes);
					this.schedule();
				}
			}

			destroy(): void {
				this.cancel();
			}

			private currentPath(): string | null {
				return this.view.state.field(editorInfoField, false)?.file?.path ?? null;
			}

			private compute(): DecorationSet {
				if (!this.path) {
					return Decoration.none;
				}
				const doc = this.view.state.doc;
				const labels = host.virtualNumberingFor(this.path, doc.toString());
				return labels
					? buildVirtualDecorations(doc, labels, host.staleTooltip())
					: Decoration.none;
			}

			private schedule(): void {
				this.cancel();
				this.timer = window.setTimeout(() => {
					this.timer = null;
					if (this.view.composing) {
						this.schedule(); // 拼音还没上屏：顺延，组合结束后再算。
						return;
					}
					this.view.dispatch({ effects: virtualRefreshEffect.of(null) });
				}, VIRTUAL_RECOMPUTE_DELAY);
			}

			private cancel(): void {
				if (this.timer !== null) {
					window.clearTimeout(this.timer);
					this.timer = null;
				}
			}
		},
		{
			decorations: (v) => v.decorations,
			// 被替换的残留区间当作原子区：光标整体跨过，不会停在看不见的旧前缀里。
			provide: (p) =>
				EditorView.atomicRanges.of(
					(view) => view.plugin(p)?.decorations ?? Decoration.none,
				),
		},
	);
	return plugin;
}
