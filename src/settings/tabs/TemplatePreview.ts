import type { Template } from "../../numbering";
import { buildPreviewLines, sampleNoteContent } from "../templateView";
import type { TemplateEditorHost } from "./TemplateEditorModal";

/** 预览块对外的两个操作：重算内容、按级别高亮。 */
export interface PreviewHandle {
	/** 按模板现值重算并重绘（模板改动后调用）。 */
	refresh(): void;
	/** 高亮某一级的全部标题；`null` 取消高亮（格式表行的悬停联动）。 */
	highlight(level: number | null): void;
}

/**
 * 模板编辑弹窗格式页底部的预览块（1.2.2，testplan L40）：单栏、可滚动。
 *
 * - 「当前笔记」：活动笔记的真实标题按**正在编辑的模板**渲染（与编辑器同一编号引擎），白名单命中、
 *   行尾 skip 标记、范围内却没编上的标题带灰色小标签；
 * - 「示例」：一篇覆盖 H1–H6 的样例笔记；没有打开的笔记时只有示例。
 * - 选哪种挂在宿主上（{@link TemplateEditorHost.previewSource}），跨整窗重绘保持。
 */
export function renderTemplatePreview(
	host: TemplateEditorHost,
	parent: HTMLElement,
	template: Template,
): PreviewHandle {
	const t = host.t;
	const plugin = host.plugin;
	const box = parent.createDiv({ cls: "ah-preview" });
	let highlighted: number | null = null;

	const draw = (): void => {
		box.empty();
		const note = plugin.activeNoteForPreview();
		const source = note ? host.previewSource : "sample";

		const head = box.createDiv({ cls: "ah-preview-head" });
		head.createSpan({
			cls: "ah-preview-title",
			text:
				source === "current" && note ? `${t.previewTitle} · ${note.path}` : t.previewTitle,
		});
		const toggles = head.createDiv({ cls: "ah-preview-toggles" });
		const toggle = (id: "sample" | "current", label: string): void => {
			const btn = toggles.createEl("button", {
				cls: id === source ? "ah-preview-toggle is-active" : "ah-preview-toggle",
				text: label,
			});
			btn.setAttr("aria-pressed", String(id === source));
			btn.addEventListener("click", () => {
				host.previewSource = id;
				draw();
			});
		};
		toggle("sample", t.previewSample);
		if (note) {
			toggle("current", t.previewCurrent);
		}

		const list = box.createDiv({ cls: "ah-preview-list" });
		const content =
			source === "current" && note ? note.content : sampleNoteContent(t.previewSampleWords);
		const affixes = plugin.strippableAffixes();
		const lines = buildPreviewLines(content, template, {
			strippablePrefixes: affixes.prefixes,
			strippableSuffixes: affixes.suffixes,
		});
		if (lines.length === 0) {
			list.createDiv({ cls: "ah-preview-empty", text: t.previewNoHeadings });
			return;
		}
		for (const line of lines) {
			const el = list.createDiv({ cls: "ah-preview-line" });
			el.dataset.level = String(line.level);
			el.setCssStyles({ paddingInlineStart: `${0.5 + line.indent * 1.25}em` });
			if (line.label === null) {
				el.addClass("is-faint");
			} else {
				el.createSpan({ cls: "ah-preview-num", text: line.label });
			}
			el.createSpan({ cls: "ah-preview-text", text: line.text });
			if (line.tag) {
				const tagText =
					line.tag === "whitelist"
						? t.previewTagWhitelist
						: line.tag === "skip"
							? t.previewTagSkip
							: t.previewTagUnnumbered;
				el.createSpan({ cls: "ah-preview-tag", text: tagText });
			}
			if (line.level === highlighted) {
				el.addClass("is-highlight");
			}
		}
	};

	draw();
	return {
		refresh: draw,
		highlight(level: number | null): void {
			highlighted = level;
			box.querySelectorAll<HTMLElement>(".ah-preview-line").forEach((el) => {
				el.toggleClass(
					"is-highlight",
					level !== null && el.dataset.level === String(level),
				);
			});
		},
	};
}
