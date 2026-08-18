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
	setIcon,
	type Editor,
	type EditorPosition,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
	type TFile,
} from "obsidian";
import type AutoHeadingsPlugin from "./main";
import type { HeadingIndexEntry } from "./headingindex";
import { detectVcStatus, shouldYieldSuggestToVc } from "./vcintegration";
import {
	buildHeadingLink,
	extractTriggerToken,
	isBlockedContext,
	resolveTriggerQuery,
	sortEntries,
} from "./headingtrigger";
import { normalizeForWhitelist } from "./whitelist";

/** 建议列表条数上限（官方 EditorSuggest.limit 字段，方案 §2.4，可调常量）。 */
const SUGGEST_LIMIT = 20;

/**
 * 条目 icon 的候选序列（1.0.29，用户要求「用标题的 H 标志」）：优先 lucide 的 `heading`，
 * 该 id 不在当前 Obsidian 内置图标集里时退到 `hash`（`#`，同样是标题语义），最后退到 `link`。
 *
 * 为什么要兜底：`setIcon` 的 id 只是字符串，官方 .d.ts 不枚举、也不校验——传了内置集里没有的
 * id 会**静默留空**（条目前面变成一个空洞）。逐个试 + 检查是否真渲染出子元素，比赌某个 id
 * 一定存在稳妥，代价只有首次渲染的一两次 DOM 判空。
 */
const ICON_CANDIDATES = ["heading", "hash", "link"] as const;

/** 按 {@link ICON_CANDIDATES} 依次尝试，取第一个真正渲染出内容的 icon。 */
function setHeadingIcon(el: HTMLElement): void {
	for (const id of ICON_CANDIDATES) {
		setIcon(el, id);
		if (el.childElementCount > 0) {
			return;
		}
	}
}

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

	/**
	 * VC 已启用且用户选择让路时返回 true——本插件放弃本次触发。
	 *
	 * 为什么必须二选一：Obsidian 的 `EditorSuggest` 同一时刻**只显示一个**弹框，先返回非
	 * null 的那个赢。VC 与本插件都以普通 `EditorSuggest` 注册，本插件一命中，VC 的文件链接
	 * 与词补全建议就整个看不见（用户实测截图确认）。让路后标题建议改由 VC 的框呈现——前提
	 * 是词典联动已开；联动关着时设置面板会明确警告「标题建议将无处出现」，不静默失效。
	 */
	private shouldYieldToVc(): boolean {
		// 先看设置（纯字段读取），"own" 时连探测都省了——onTrigger 每次按键都跑。
		if (this.plugin.settings.headingSuggestWhenVcActive !== "yield") {
			return false;
		}
		return shouldYieldSuggestToVc("yield", detectVcStatus(this.plugin.app));
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
		if (this.shouldYieldToVc()) {
			return null; // 见 shouldYieldToVc：把唯一的弹框位置让给 VC
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

		// 整段优先、其次逐级后缀（Q22「一笔事务」）；无任何候选命中就让路——礼貌规则，
		// onTrigger 每次按键都跑，尽早返回 null。
		const hit = resolveTriggerQuery(token, start, (q) =>
			this.plugin.headingIndex.hasAnyPrefixMatch(q),
		);
		if (!hit) {
			return null;
		}

		return {
			// 起点是**被匹配上的那一段**的起点：接受建议时只替换这一段，token 里没参与
			// 匹配的前半截（「一笔事务」里的「一笔」）原样保留。
			start: { line: cursor.line, ch: hit.start },
			end: cursor,
			query: hit.text, // 该段原文；getSuggestions 再归一化后查询与排序
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
		// 1.0.28：与 VC 原生建议框一致，条目带 icon。布局：icon 列 + 标题/来源两行文本列。
		// 1.0.29：icon 由 "link" 改为 "heading"（H 标志）——候选的语义是「某个标题」，
		// 而不是「某个链接」；VC 框里各来源也是按条目**种类**区分 icon 的。
		el.addClass("ah-heading-suggest-item");
		const iconEl = el.createDiv({ cls: "ah-heading-suggest-icon" });
		setHeadingIcon(iconEl);
		const content = el.createDiv({ cls: "ah-heading-suggest-content" });
		content.createDiv({ cls: "ah-heading-suggest-title", text: entry.displayText });
		const activeFile = this.context?.file;
		const isSelf = activeFile?.path === entry.path;
		content.createDiv({
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
