/**
 * 阅读视图里的标题菜单（未发版，spec §3.24「阅读视图里也能用标题菜单」，testplan S33–S35）。
 *
 * 阅读视图里标题左侧同样有原生折叠箭头（`.heading-collapse-indicator`，是 `h1`–`h6` 的子元素）。右键它打开与编辑视图
 * 同一份标题菜单（{@link NoteEntry.openHeadingMenu}）；单击照旧折叠，**不能拖动**——这里根本不挂拖动逻辑，整节移动只在
 * 编辑视图做（`headinghandle.ts`）。
 *
 * 阅读视图的 DOM 不带行号，且区块是懒渲染的（离屏区块不在 DOM 里），按标题在 DOM 里的序号对应不可靠。改用阅读视图渲染器
 * 自己的 `getSectionInfo(el)`（与公开的 `MarkdownPostProcessorContext.getSectionInfo` 同一实现，2026-10-23 对照 1.10.6
 * app.js）取标题所在区块的起始行；该入口认不出时按标题文字在全文里**唯一**匹配，仍对不上就不弹菜单。
 *
 * 菜单里改文件的项走该视图自带的 `editor`（阅读模式下 MarkdownView 仍持有编辑器，改动随即反映到阅读视图）。
 * 例外：同一篇又在别的叶子里编辑着时改**那个**编辑器（S35 ②）——各叶子的编辑器各存一份缓冲，阅读视图那份不含
 * 别处还没落盘的编辑，改它会让两边各自落盘、后存的盖掉先存的。行号按标题文字与同名序号映射到那份内容上
 * （{@link mapHeadingLine}）。
 */
import { MarkdownView } from "obsidian";
import type AutoHeadingsPlugin from "./main";
import type { NoteEntry } from "./noteentry";
import { stripSkipMarker } from "./headingedit";
import { parseHeadings } from "./parser";
import { stripWordJoiners } from "./strip";

/** 阅读视图渲染器里本模块用到的部分（非公开结构）。 */
interface PreviewRendererLike {
	getSectionInfo?: (el: HTMLElement) => { lineStart: number } | null;
}

/**
 * 标题文字比对用的规整：去 WJ、去跳过标记、压空白。阅读视图里的文字已渲染（无 `**` 等标记），源文本可能带内联格式，
 * 所以只作兜底，且只认唯一匹配。
 */
function normalizeTitle(text: string): string {
	return stripWordJoiners(stripSkipMarker(text)).replace(/\s+/g, " ").trim();
}

/**
 * 找出阅读视图里某个标题元素对应的源文本行号；对不上返回 `null`（纯逻辑部分，供单测）。
 *
 * @param content 笔记全文
 * @param sectionLine 渲染器给出的区块起始行（取不到为 `null`）
 * @param renderedText 标题元素的渲染文字
 */
export function resolveReadingHeadingLine(
	content: string,
	sectionLine: number | null,
	renderedText: string,
): number | null {
	const headings = parseHeadings(content);
	if (sectionLine !== null && headings.some((h) => h.lineIndex === sectionLine)) {
		return sectionLine;
	}
	const want = normalizeTitle(renderedText);
	const hits = headings.filter((h) => normalizeTitle(h.text) === want);
	return hits.length === 1 ? hits[0].lineIndex : null;
}

/**
 * 把 `from` 里第 `line` 行的标题映射到 `to` 里的同一个标题（S35 ②：两个叶子的缓冲可能不同步）。按规整后的标题文字
 * 找，同名标题按「第几个同名」对应；对不上返回 `null`（纯逻辑部分，供单测）。
 */
export function mapHeadingLine(from: string, line: number, to: string): number | null {
	if (from === to) {
		return line;
	}
	const src = parseHeadings(from);
	const at = src.find((h) => h.lineIndex === line);
	if (!at) {
		return null;
	}
	const want = normalizeTitle(at.text);
	const nth = src.filter((h) => h.lineIndex < line && normalizeTitle(h.text) === want).length;
	const hits = parseHeadings(to).filter((h) => normalizeTitle(h.text) === want);
	return hits[nth]?.lineIndex ?? null;
}

/** 注册阅读视图的标题右键菜单与悬停提示（主窗口与之后打开的弹出窗口都挂上）。 */
export function registerReadingHeadingMenu(
	plugin: AutoHeadingsPlugin,
	entry: NoteEntry,
	hint: () => string,
): void {
	const indicatorOf = (e: Event): HTMLElement | null => {
		const ind = (e.target as HTMLElement | null)?.closest?.(
			".markdown-preview-view .heading-collapse-indicator",
		) as HTMLElement | null;
		return ind && /^H[1-6]$/.test(ind.parentElement?.tagName ?? "") ? ind : null;
	};

	const viewOf = (el: HTMLElement): MarkdownView | null => {
		for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (
				view instanceof MarkdownView &&
				view.getMode() === "preview" &&
				view.containerEl.contains(el)
			) {
				return view;
			}
		}
		return null;
	};

	const onContext = (e: MouseEvent): void => {
		const ind = indicatorOf(e);
		const heading = ind?.parentElement;
		const view = heading ? viewOf(heading) : null;
		if (!heading || !view?.file || !view.editor) {
			return;
		}
		const renderer = (view as unknown as { previewMode?: { renderer?: PreviewRendererLike } })
			.previewMode?.renderer;
		let sectionLine: number | null = null;
		try {
			sectionLine = renderer?.getSectionInfo?.(heading)?.lineStart ?? null;
		} catch {
			/* 渲染器结构认不出：走文字兜底 */
		}
		const shown = view.editor.getValue();
		const line = resolveReadingHeadingLine(shown, sectionLine, heading.textContent ?? "");
		if (line === null) {
			return;
		}
		const target = plugin.markdownContextForPath(view.file.path)?.editor ?? view.editor;
		const targetLine =
			target === view.editor ? line : mapHeadingLine(shown, line, target.getValue());
		if (targetLine === null) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		entry.openHeadingMenu(e, target, view.file, targetLine);
	};

	const onHover = (e: MouseEvent): void => {
		const ind = indicatorOf(e);
		if (ind && !ind.title) {
			ind.title = hint();
		}
	};

	const attach = (doc: Document): void => {
		plugin.registerDomEvent(doc, "contextmenu", onContext, true);
		plugin.registerDomEvent(doc, "mouseover", onHover);
	};
	attach(document);
	plugin.registerEvent(plugin.app.workspace.on("window-open", (win) => attach(win.doc)));
}
