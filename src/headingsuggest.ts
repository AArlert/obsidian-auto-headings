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
 * 包 try/catch 静默降级——内部形状变化时用户仍可点按接受
 * （方案 §12 核实清单第 7 条，未来 Obsidian 版本升级时最优先复查）。
 *
 * **回车不接受**（testplan Q58，issue #10）：框是打字时自己弹的，回车的本意是换行。Obsidian 给建议框内置了
 * Enter 接受，这里把它摘掉、换成「关框、不拦截」（见 {@link HeadingLinkSuggest.dropBuiltInEnter} 与构造函数）。
 */

import {
	EditorSuggest,
	MarkdownView,
	TFile,
	setIcon,
	type Editor,
	type KeymapEventHandler,
	type EditorPosition,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
} from "obsidian";
import type AutoHeadingsPlugin from "./main";
import type { HeadingIndexEntry } from "./headingindex";
import { detectVcStatus, shouldYieldSuggestToVc } from "./vcintegration";
import {
	buildHeadingLink,
	extractTriggerToken,
	isBlockedContext,
	hasShortWordSignal,
	resolveTriggerQuery,
	sortEntries,
} from "./headingtrigger";
import { normalizeForWhitelist } from "./whitelist";

/** 建议列表条数上限（官方 EditorSuggest.limit 字段，方案 §2.4，可调常量）。 */
const SUGGEST_LIMIT = 20;

/**
 * 条目 icon 的候选序列。
 *
 * 1.0.29 用的是 `heading`（H 标志）；**1.0.32 改为书架语义**（`library`）——用户决定
 * 两个建议框的观感统一到 VC 那一套：VC 框里标题候选走的是「自定义词典」类型，图标固定是
 * 书架（ionicons library），且 VC 的 DOM 没有任何 per-word / per-dictionary 钩子，我们**改不了**
 * 那边（只能覆盖整个 customDictionary 类型的 CSS，会误伤用户自己的词典条目，已否决）。
 * 既然改不了那边，就把这边对齐过去，免得同一功能在两个框里长两副面孔。
 *
 * 刻意**不照搬 VC 样式表里的 base64 资产**（第三方资产 + 署名问题），改用 Obsidian 内置 lucide
 * 的同语义图标，顺带自动跟随主题。
 *
 * 为什么要兜底：`setIcon` 的 id 只是字符串，官方 .d.ts 不枚举、也不校验——传了内置集里没有的
 * id 会**静默留空**（条目前面变成一个空洞）。逐个试 + 检查是否真渲染出子元素，比赌某个 id
 * 一定存在稳妥，代价只有首次渲染的一两次 DOM 判空。
 */
const ICON_CANDIDATES = ["library", "book", "heading"] as const;

/** 按 {@link ICON_CANDIDATES} 依次尝试，取第一个真正渲染出内容的 icon。 */
function setHeadingIcon(el: HTMLElement): void {
	for (const id of ICON_CANDIDATES) {
		setIcon(el, id);
		if (el.childElementCount > 0) {
			return;
		}
	}
}

/**
 * 「不选就记住」（testplan Q63，未发版，2026-10-24 用户定）：框弹出后没选就关了（Esc、回车、接着打字），这次框开着时出现过的
 * 查询在这一篇里不再弹；切到别的笔记即清空。主力库重放（`scripts/suggest-replay.mjs`）里这一项把打扰再降一大半，且不掉召回——
 * 每个词第一次照样弹。只在内存里，不持久化：它是「这一会儿别烦我」，不是长期偏好。
 */
export class DismissMemory {
	private readonly byPath = new Map<string, Set<string>>();
	private readonly episode = new Set<string>();
	private episodePath: string | null = null;
	private accepted = false;

	/** 这一篇里这个查询是否已被「不选」过。 */
	isDismissed(path: string, query: string): boolean {
		return this.byPath.get(path)?.has(query) ?? false;
	}

	/** 框为这个查询弹出（或开着时查询变了）。 */
	shown(path: string, query: string): void {
		if (this.episodePath !== path) {
			this.episode.clear();
		}
		this.episodePath = path;
		this.episode.add(query);
	}

	/** 用户选中了某一条：这次不记。 */
	accept(): void {
		this.accepted = true;
	}

	/** 框关了：没选的话，把这次出现过的查询记到这一篇上。 */
	closed(): void {
		if (!this.accepted && this.episodePath !== null && this.episode.size > 0) {
			const set = this.byPath.get(this.episodePath) ?? new Set<string>();
			for (const q of this.episode) {
				set.add(q);
			}
			this.byPath.set(this.episodePath, set);
		}
		this.episode.clear();
		this.episodePath = null;
		this.accepted = false;
	}

	/** 打开了某一篇：其余笔记的记录清掉（离开即忘，回来重新算）。 */
	keepOnly(path: string | null): void {
		for (const p of [...this.byPath.keys()]) {
			if (p !== path) {
				this.byPath.delete(p);
			}
		}
	}
}

export class HeadingLinkSuggest extends EditorSuggest<HeadingIndexEntry> {
	/** 「不选就记住」（Q63）；main 在 file-open 时调 {@link DismissMemory.keepOnly}。 */
	readonly dismissed = new DismissMemory();

	constructor(private readonly plugin: AutoHeadingsPlugin) {
		super(plugin.app);
		this.limit = SUGGEST_LIMIT;
		// Tab 接受建议：[] = 只匹配不带任何修饰键的 Tab，不会误吃 Shift+Tab（大纲缩进等场景）。
		// 输入法组合中的 Tab 归输入法（testplan Q29）：返回 undefined 让按键继续传播，与 Obsidian
		// 自带建议框 Enter 的 `!e.isComposing` 判定一致。
		this.scope.register([], "Tab", (evt) => {
			if (evt.isComposing) {
				return;
			}
			const suggest = (
				this as unknown as {
					suggestions?: { useSelectedItem?: (evt: Partial<KeyboardEvent>) => unknown };
				}
			).suggestions;
			try {
				suggest?.useSelectedItem?.({});
			} catch {
				/* 内部 API 形状变化：静默降级，点按仍可接受。 */
			}
			return false; // 阻止默认的编辑器 Tab（缩进）行为继续传播。
		});
		this.dropBuiltInEnter();
		// 回车 = 关框 + 照常换行（Q58）。必须先关框：编辑器自己的 CM 键表里 Enter 在「有建议框开着」时被吞掉
		// （app.js：`{key: "Enter", run: () => editorSuggest.isShowingSuggestion()}`），所以只摘掉内置的还不够。
		// 关掉后返回 undefined 不拦截，按键照常落到编辑器，换行（列表续项）由 Obsidian 自己做。
		// 输入法组合中的回车归输入法。
		this.scope.register([], "Enter", (evt) => {
			if (!evt.isComposing) {
				this.close();
			}
			return undefined;
		});
	}

	/**
	 * 摘掉 Obsidian 内置的「Enter 接受建议」（Q58）。Scope 按注册顺序取第一个匹配的处理器，内置的先注册，
	 * 追加同键处理器盖不住，只能经公开的 `unregister` 摘掉；处理器列表 `keys` 未公开，认不出就什么都不做，
	 * 由 {@link selectSuggestion} 兜底。
	 */
	private dropBuiltInEnter(): void {
		const keys = (this.scope as unknown as { keys?: unknown }).keys;
		if (!Array.isArray(keys)) {
			return;
		}
		for (const h of [...keys] as Array<{ key?: unknown; modifiers?: unknown }>) {
			if (h.key === "Enter" && (h.modifiers === "" || h.modifiers === null)) {
				this.scope.unregister(h as KeymapEventHandler);
			}
		}
	}

	/**
	 * 标题建议显示在 VC 的框里（VC 已启用且词典联动开着）时返回 true——本插件放弃本次触发。
	 *
	 * 为什么必须二选一：Obsidian 的 `EditorSuggest` 同一时刻**只显示一个**弹框，先返回非
	 * null 的那个赢。VC 与本插件都以普通 `EditorSuggest` 注册，本插件一命中，VC 的文件链接
	 * 与词补全建议就整个看不见（用户实测截图确认）。判定见 {@link shouldYieldSuggestToVc}。
	 */
	private shouldYieldToVc(): boolean {
		// 先看两个纯字段（onTrigger 每次按键都跑）：任一不满足就免去 detectVcStatus 的探测。
		const { vcIntegrationMode } = this.plugin.settings;
		if (vcIntegrationMode === "off") {
			return false; // 先看纯字段：onTrigger 每次按键都跑，免去 detectVcStatus 的探测
		}
		return shouldYieldSuggestToVc(detectVcStatus(this.plugin.app), vcIntegrationMode);
	}

	/**
	 * 输入法上屏后让 Obsidian 按注册顺序重新触发一轮建议框（testplan Q44）。
	 *
	 * 为什么需要（test-vault 用 CDP 模拟输入法复现，2026-10-18）：拼字期间编辑器里已经有拼音字母，
	 * Obsidian 照常触发，本插件因 `imeComposing` 返回 null，VC 便占了建议框；上屏若不改变文档内容
	 * （拼的就是英文，如 `axi`），就不会再有编辑事件，本插件再没有机会，VC 的框一直挂着。
	 *
	 * 走 Obsidian 自己的 `editorSuggest.trigger(editor, file, true)`：顺序、互斥、关闭旧框都交给它，
	 * 本插件匹配上就换成本插件的框，匹配不上 VC 照常。该入口不在官方 API 里，认不出就静默不做。
	 */
	retriggerAfterComposition(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const registry = (
			this.app.workspace as {
				editorSuggest?: {
					trigger?: (editor: Editor, file: TFile | null, open: boolean) => void;
				};
			}
		).editorSuggest;
		if (!view?.editor || typeof registry?.trigger !== "function") {
			return;
		}
		try {
			registry.trigger(view.editor, view.file, true);
		} catch {
			/* 内部结构变化：静默，下次键入照常触发 */
		}
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.headingLinkSuggestEnabled) {
			return null;
		}
		// 联动开着时给 VC 的框套上下文过滤（Q46）：本方法每次键入都先于 VC 跑，正好在这里自检补上。
		this.plugin.ensureVcContextFilter();
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
		if (isBlockedContext(before, start)) {
			return null;
		}

		// 命中规则见 resolveTriggerQuery（Q27/Q28/Q30/Q31）；无任何候选命中就让路——礼貌规则，
		// onTrigger 每次按键都跑，尽早返回 null。正在写的标题（当前文件当前行）不算命中（Q7）。
		const index = this.plugin.headingIndex;
		const links = this.plugin.headingLinkCounts;
		const self = { path: file.path, lineIndex: cursor.line };
		const hit = resolveTriggerQuery(token, start, {
			hasAnyPrefixMatch: (q) => index.hasAnyPrefixMatch(q, self),
			hasExactMatch: (q) => index.hasExactMatch(q, self),
			isRelevant: (q) =>
				hasShortWordSignal(
					index.exactMatchPaths(q, self),
					links.count(q),
					links.linksFrom(file.path, q),
					file.path,
				),
		});
		if (!hit || this.dismissed.isDismissed(file.path, hit.query)) {
			return null;
		}
		this.dismissed.shown(file.path, hit.query);

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
		// 排除正在写的标题本身（当前文件当前行，Q7）；同一篇笔记的其他标题照常。
		const self = { path: context.file.path, lineIndex: context.start.line };
		const matches = this.plugin.headingIndex.queryPrefix(query, this.limit * 4, self);
		return sortEntries(matches, query, {
			linkCount: (k) => this.plugin.headingLinkCounts.count(k),
			activePath: context.file.path,
		}).slice(0, this.limit);
	}

	renderSuggestion(entry: HeadingIndexEntry, el: HTMLElement): void {
		// 1.0.28：与 VC 原生建议框一致，条目带 icon。布局：icon 列 + 标题/来源两行文本列。
		// 1.0.32：icon 与两行字号统一对齐 VC 的自定义词典条目观感（见 ICON_CANDIDATES 与
		// styles.css）——同一功能在两个建议框里不该长两副面孔。
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

	/** 关框时交给 {@link DismissMemory}：没选就记住（Q63）。Esc、回车（Q58）、接着打字到不再命中都会走到这里。 */
	close(): void {
		this.dismissed.closed();
		super.close();
	}

	selectSuggestion(entry: HeadingIndexEntry, evt: MouseEvent | KeyboardEvent): void {
		const ctx = this.context;
		if (!ctx) {
			return;
		}
		// 兜底（Q58）：内置 Enter 没摘掉（Obsidian 内部结构变了）时回车仍会走到这里——不插链接，关框后照常换行。
		if ("key" in evt && evt.key === "Enter") {
			this.close();
			ctx.editor.exec("newlineAndIndent");
			return;
		}
		this.dismissed.accept();
		// alias 恒为完整标题名（displayText），见 headingtrigger.ts buildHeadingLink。链接文本走 Obsidian 的
		// fileToLinktext：重名文件写路径，否则会链到另一篇同名笔记（Q47）。
		const target = this.app.vault.getAbstractFileByPath(entry.path);
		const linktext =
			target instanceof TFile
				? this.app.metadataCache.fileToLinktext(target, ctx.file.path, true)
				: entry.basename;
		const link = buildHeadingLink(entry, ctx.file.path, linktext);
		ctx.editor.replaceRange(link, ctx.start, ctx.end);
		ctx.editor.setCursor({ line: ctx.start.line, ch: ctx.start.ch + link.length });
	}
}
