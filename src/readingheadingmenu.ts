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
import { MarkdownView, type Editor, type TFile } from "obsidian";
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

/** 一处整行内的编辑（与 `Editor.transaction` 的 `changes` 同形，只用到这几个字段）。 */
export interface TextChange {
	from: { line: number; ch: number };
	to?: { line: number; ch: number };
	text: string;
}

/**
 * 把行列坐标的变更集套到全文上（纯逻辑部分，供单测）。坐标按「以换行符分行」计，文件是 CRLF 时先规整再还原换行；
 * 多处变更按起点从后往前套，互不挪动对方的坐标。
 */
export function applyTextChanges(content: string, changes: TextChange[]): string {
	const crlf = content.includes("\r\n");
	let text = crlf ? content.replace(/\r\n/g, "\n") : content;
	const starts: number[] = [0];
	for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
		starts.push(i + 1);
	}
	const off = (p: { line: number; ch: number }): number =>
		(starts[Math.min(p.line, starts.length - 1)] ?? 0) + p.ch;
	const sorted = changes
		.map((c) => ({ from: off(c.from), to: off(c.to ?? c.from), text: c.text }))
		.sort((a, b) => b.from - a.from);
	for (const c of sorted) {
		text = text.slice(0, c.from) + c.text + text.slice(c.to);
	}
	return crlf ? text.replace(/\n/g, "\r\n") : text;
}

/**
 * 阅读视图自带的编辑器只是个躲在后面的缓冲：往里 `transaction` 不保证落盘、阅读视图也不一定随之重绘，缓冲本身也不随
 * 落盘更新（2026-10-27 用户实测「点了没用」；真机探针 `heading-menu.js` 抓到升级后再降级按旧缓冲算偏了列）。
 * 菜单里改文件的项因此在只有阅读视图的笔记上改走**文件本身**（`vault.process`，Obsidian 随后重绘阅读视图）；
 * 这里给菜单一个只实现 `getValue` / `getLine` / `transaction` 的替身，菜单代码不必分叉，读写都以弹菜单时从磁盘读到的
 * `snapshot` 为准（菜单是即点即用的，期间文件被别处改动的窗口可忽略）。代价是这类改动进不了编辑器的撤销栈。
 */
export function fileBackedEditor(
	plugin: AutoHeadingsPlugin,
	file: TFile,
	snapshot: string,
): Editor {
	const lines = snapshot.replace(/\r\n/g, "\n").split("\n");
	return {
		getValue: () => lines.join("\n"),
		getLine: (n: number) => lines[n] ?? "",
		transaction: (tx: { changes?: TextChange[] }) => {
			const changes = tx.changes ?? [];
			if (changes.length > 0) {
				void plugin.app.vault.process(file, (c) => applyTextChanges(c, changes));
			}
		},
	} as unknown as Editor;
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
		if (!entry.headingMenuOn()) {
			return;
		}
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
		const file = view.file;
		// 能认出标题行才拦截（用背后缓冲判断，够快、同步）；真正的行号随后按磁盘内容重新解析。
		const text = heading.textContent ?? "";
		const shown = view.editor.getValue();
		if (resolveReadingHeadingLine(shown, sectionLine, text) === null) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		void (async () => {
			const disk = await plugin.app.vault.read(file);
			const line = resolveReadingHeadingLine(disk, sectionLine, text);
			if (line === null) {
				return;
			}
			const editing = plugin.markdownContextForPath(file.path)?.editor;
			// 同篇另有编辑视图：改那个编辑器；只有阅读视图：直接改文件（见 fileBackedEditor）。
			if (editing && editing !== view.editor) {
				const targetLine = mapHeadingLine(disk, line, editing.getValue());
				if (targetLine !== null) {
					entry.openHeadingMenu(e, editing, file, targetLine);
				}
				return;
			}
			entry.openHeadingMenu(e, fileBackedEditor(plugin, file, disk), file, line);
		})();
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
