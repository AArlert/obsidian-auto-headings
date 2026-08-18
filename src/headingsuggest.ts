/**
 * 标题链接建议的 EditorSuggest 薄适配层（M13，见 spec.md Roadmap M13 与 doc/research 方案 §4）。
 *
 * 四个生命周期方法内部逻辑几乎全部委托给 headingtrigger.ts 的纯函数（触发词提取 / 上下文
 * 屏蔽 / 排序 / 链接构造），本文件只做「把纯函数接到 Obsidian 的类骨架上」——因此类本身的
 * DOM/CM6 交互（弹出定位、Tab 行为、触摸点按）留给真机手验（testplan Q 类），dev_tests
 * 只测纯函数（方案 §8.2 选项 A）。
 *
 * Tab 接受建议走官方公开 API（Scope.register，[] 表示只拦截不带修饰键的 Tab，不影响
 * Shift+Tab）；「接受当前高亮项」的内部调用（.suggestions.useSelectedItem）不是公开 API，
 * 包 try/catch 静默降级——内部形状变化时用户仍可用 Obsidian 内置的 Enter 接受
 * （方案 §12 核实清单第 7 条，未来 Obsidian 版本升级时最优先复查）。
 */

import {
	EditorSuggest,
	type Editor,
	type EditorPosition,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
	type TFile,
} from "obsidian";
import type AutoHeadingsPlugin from "./main";
import type { HeadingIndexEntry } from "./headingindex";
import {
	buildHeadingLink,
	extractTriggerToken,
	isBlockedContext,
	sortEntries,
} from "./headingtrigger";
import { normalizeForWhitelist } from "./whitelist";

/** 建议列表条数上限（官方 EditorSuggest.limit 字段，方案 §2.4，可调常量）。 */
const SUGGEST_LIMIT = 20;

export class HeadingLinkSuggest extends EditorSuggest<HeadingIndexEntry> {
	constructor(private readonly plugin: AutoHeadingsPlugin) {
		super(plugin.app);
		this.limit = SUGGEST_LIMIT;
		// Tab 接受建议：[] = 只匹配不带任何修饰键的 Tab，不会误吃 Shift+Tab（大纲缩进等场景）。
		this.scope.register([], "Tab", () => {
			const suggest = (
				this as unknown as {
					suggestions?: { useSelectedItem?: (evt: Partial<KeyboardEvent>) => unknown };
				}
			).suggestions;
			try {
				suggest?.useSelectedItem?.({});
			} catch {
				/* 内部 API 形状变化：静默降级，Enter 仍可接受（Obsidian 内置）。 */
			}
			return false; // 阻止默认的编辑器 Tab（缩进）行为继续传播。
		});
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.headingLinkSuggestEnabled) {
			return null;
		}
		if (!file) {
			return null;
		}
		if (this.plugin.imeComposing) {
			return null; // IME 组合期间不触发（复用 main.ts 既有标志位，见方案 §4.4）
		}
		if (this.plugin.headingIndex.size === 0) {
			return null;
		}

		const line = editor.getLine(cursor.line);
		const before = line.slice(0, cursor.ch);
		const extracted = extractTriggerToken(before);
		if (!extracted) {
			return null;
		}
		const { token, start } = extracted;
		if (isBlockedContext(line, before, start)) {
			return null;
		}

		const query = normalizeForWhitelist(token);
		if (!query) {
			return null;
		}
		if (!this.plugin.headingIndex.hasAnyPrefixMatch(query)) {
			return null; // 礼貌规则：无真候选就让路（onTrigger 每次按键都跑，尽早返回 null）
		}

		return {
			start: { line: cursor.line, ch: start },
			end: cursor,
			query: token, // 原样保留用户实际打的文字，供 selectSuggestion 用作 alias
		};
	}

	getSuggestions(context: EditorSuggestContext): HeadingIndexEntry[] {
		const query = normalizeForWhitelist(context.query);
		if (!query) {
			return [];
		}
		// 稍多取一点再排序截断，保证排序规则（精确优先等）在截断前生效。
		const matches = this.plugin.headingIndex.queryPrefix(query, this.limit * 4);
		return sortEntries(matches, query).slice(0, this.limit);
	}

	renderSuggestion(entry: HeadingIndexEntry, el: HTMLElement): void {
		el.addClass("ah-heading-suggest-item");
		el.createDiv({ cls: "ah-heading-suggest-title", text: entry.displayText });
		const activeFile = this.context?.file;
		const isSelf = activeFile?.path === entry.path;
		el.createDiv({
			cls: "ah-heading-suggest-path",
			text: isSelf ? this.plugin.messages().headingSuggestThisFile : entry.path,
		});
	}

	selectSuggestion(entry: HeadingIndexEntry, _evt: MouseEvent | KeyboardEvent): void {
		const ctx = this.context;
		if (!ctx) {
			return;
		}
		// alias 恒为完整标题名（displayText），见 headingtrigger.ts buildHeadingLink。
		const link = buildHeadingLink(entry, ctx.file.path);
		ctx.editor.replaceRange(link, ctx.start, ctx.end);
		ctx.editor.setCursor({ line: ctx.start.line, ch: ctx.start.ch + link.length });
	}
}
