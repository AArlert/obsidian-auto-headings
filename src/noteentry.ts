/**
 * 笔记内入口（M16，spec §3.24）：新命令、编辑器右键菜单、状态栏「本篇」菜单。
 *
 * 业务逻辑是 `headingedit.ts` 的纯函数 + `main.ts` 既有的执行体；本类只做接线，持有插件引用
 * （与 `HeadingLinkSuggest` 同款先例，`main.ts` 为此放开了少数方法的可见性）。
 */
import {
	FuzzySuggestModal,
	Menu,
	Notice,
	type App,
	type Editor,
	type EditorChange,
	type TFile,
} from "obsidian";
import type AutoHeadingsPlugin from "./main";
import {
	planSectionShift,
	skipKindOf,
	stripSkipMarker,
	toggleSkipMarker,
	type SkipKind,
} from "./headingedit";
import { sectionHeadingAt } from "./copycommands";
import { readFileSwitch, SWITCH_KEY, TEMPLATE_KEY } from "./frontmatter";
import { parseHeadings, type Heading } from "./parser";
import { headingHandleExtension } from "./headinghandle";
import { stripWordJoiners } from "./strip";
import { NO_NUMBERING_TEMPLATE, resolvePathRule } from "./pathrules";

/** 选择器里「清除单篇模板、跟随路径规则」的哨兵项（模板名不会为空串）。 */
const FOLLOW_RULE = "";

/** 模板选择器：原生模糊搜索弹窗，选中即回调（单篇模板，S9）。 */
class TemplatePickerModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private readonly names: string[],
		private readonly followLabel: string,
		placeholder: string,
		private readonly onChoose: (name: string) => void,
	) {
		super(app);
		this.setPlaceholder(placeholder);
	}
	getItems(): string[] {
		return this.names;
	}
	getItemText(item: string): string {
		return item === FOLLOW_RULE ? this.followLabel : item;
	}
	onChooseItem(item: string): void {
		this.onChoose(item);
	}
}

/** 笔记内入口的接线类。 */
export class NoteEntry {
	private statusEl: HTMLElement | null = null;

	constructor(private readonly plugin: AutoHeadingsPlugin) {}

	/** 注册命令、右键菜单项与状态栏标签（在 `onload` 里调用一次）。 */
	register(): void {
		const t = this.plugin.messages();
		const p = this.plugin;

		// 光标所在小节的标题（光标行或其上最近的标题）；与「复制当前小节链接」同一口径。
		const headingCmd = (
			id: string,
			name: string,
			run: (editor: Editor, h: Heading) => void,
		): void => {
			p.addCommand({
				id,
				name,
				editorCheckCallback: (checking, editor, ctx) => {
					const h = ctx.file
						? sectionHeadingAt(editor.getValue(), editor.getCursor().line)
						: null;
					if (!h) {
						return false;
					}
					if (!checking) {
						run(editor, h);
					}
					return true;
				},
			});
		};
		headingCmd("toggle-heading-skip", t.cmdToggleHeadingSkip, (e, h) =>
			this.toggleSkip(e, h.lineIndex),
		);
		headingCmd("toggle-section-skip", t.cmdToggleSectionSkip, (e, h) =>
			this.toggleSkip(e, h.lineIndex, "tree"),
		);
		headingCmd("promote-section", t.cmdPromoteSection, (e, h) =>
			this.shiftSection(e, h.lineIndex, -1),
		);
		headingCmd("demote-section", t.cmdDemoteSection, (e, h) =>
			this.shiftSection(e, h.lineIndex, 1),
		);

		const fileCmd = (id: string, name: string, run: (file: TFile) => void): void => {
			p.addCommand({
				id,
				name,
				checkCallback: (checking) => {
					const file = p.app.workspace.getActiveFile?.();
					if (!file || file.extension !== "md") {
						return false;
					}
					if (!checking) {
						run(file);
					}
					return true;
				},
			});
		};
		fileCmd("choose-note-template", t.cmdChooseNoteTemplate, (f) => this.chooseTemplate(f));
		fileCmd("toggle-note-auto", t.cmdToggleNoteAuto, (f) => void this.toggleNoteAuto(f));

		// 编辑器右键菜单：只加两项，光标不在任何小节内时不出现（S13）。
		p.registerEvent(
			p.app.workspace.on("editor-menu", (menu, editor, view) => {
				const file = view.file;
				const h = file
					? sectionHeadingAt(editor.getValue(), editor.getCursor().line)
					: null;
				if (!h || !file) {
					return;
				}
				this.addHeadingItems(menu, editor, file, h, false);
			}),
		);

		p.registerEditorExtension(headingHandleExtension(this, () => p.messages().handleHint));
		this.registerStatusBar();
	}

	/**
	 * 标题手柄菜单（S17）：标签行 / 跳过（勾选）/ 升降级 / 复制链接 / 本篇编号设置…。
	 * 先按当前文本重新核对 `lineIndex` 确是结构标题——手柄是 DOM 反查的，文档可能刚变过。
	 */
	openHeadingMenu(evt: MouseEvent, editor: Editor, file: TFile, lineIndex: number): void {
		const p = this.plugin;
		const h = parseHeadings(editor.getValue()).find((x) => x.lineIndex === lineIndex);
		if (!h) {
			return;
		}
		const m = p.messages();
		const menu = new Menu();
		const title = stripWordJoiners(stripSkipMarker(h.text)).trim();
		menu.addItem((i) => i.setTitle(m.menuHandleLabel(title, h.level)).setIsLabel(true));
		menu.addSeparator();
		this.addHeadingItems(menu, editor, file, h, true);
		menu.addSeparator();
		menu.addItem((i) =>
			i
				.setTitle(m.menuNoteSettings)
				.setIcon("settings")
				.onClick(
					() =>
						void this.openNoteMenu(file, evt, () =>
							this.openHeadingMenu(evt, editor, file, lineIndex),
						),
				),
		);
		menu.showAtMouseEvent(evt);
	}

	// ───────────────────────── 单标题 / 整节改写 ─────────────────────────

	/**
	 * 标题相关菜单项（右键菜单与标题菜单共用）：两种跳过标记（勾选项）、可选的升降级、复制链接 / 嵌入。
	 * 右键菜单不放升降级（只加最必要的几项，不喧宾夺主）。
	 */
	private addHeadingItems(
		menu: Menu,
		editor: Editor,
		file: TFile,
		h: Heading,
		withShift: boolean,
	): void {
		const m = this.plugin.messages();
		const kind = skipKindOf(h.rawText);
		const lineIndex = h.lineIndex;
		menu.addItem((i) =>
			i
				.setTitle(m.menuToggleSkip)
				.setIcon("eye-off")
				.setChecked(kind === "self")
				.onClick(() => this.toggleSkip(editor, lineIndex)),
		);
		menu.addItem((i) =>
			i
				.setTitle(m.menuToggleSkipTree)
				.setIcon("folder-x")
				.setChecked(kind === "tree")
				.onClick(() => this.toggleSkip(editor, lineIndex, "tree")),
		);
		if (withShift) {
			menu.addItem((i) =>
				i
					.setTitle(m.menuPromoteSection)
					.setIcon("arrow-up")
					.onClick(() => this.shiftSection(editor, lineIndex, -1)),
			);
			menu.addItem((i) =>
				i
					.setTitle(m.menuDemoteSection)
					.setIcon("arrow-down")
					.onClick(() => this.shiftSection(editor, lineIndex, 1)),
			);
		}
		menu.addItem((i) =>
			i
				.setTitle(m.menuCopySectionLink)
				.setIcon("link")
				.onClick(() => void this.plugin.runCopySectionLink(file, h)),
		);
		menu.addItem((i) =>
			i
				.setTitle(m.menuCopySectionEmbed)
				.setIcon("file-input")
				.onClick(() => void this.plugin.runCopySectionLink(file, h, "embed")),
		);
	}

	/** 切换某标题行的跳过标记；一次编辑事务（S1/S2/S26）。 */
	toggleSkip(editor: Editor, line: number, kind: SkipKind = "self"): void {
		const old = editor.getLine(line);
		const next = toggleSkipMarker(old, kind);
		if (next === old) {
			return;
		}
		editor.transaction({ changes: [this.plugin.lineChange(line, old, next)] });
	}

	/** 整节升降级；越界整体拒绝并提示（S4–S6）。 */
	shiftSection(editor: Editor, line: number, delta: -1 | 1): void {
		const edits = planSectionShift(editor.getValue(), line, delta);
		if (!edits) {
			new Notice(this.plugin.messages().noticeSectionShiftOutOfRange);
			return;
		}
		const changes: EditorChange[] = edits.map((e) =>
			this.plugin.lineChange(e.line, editor.getLine(e.line), e.text),
		);
		editor.transaction({ changes });
	}

	// ───────────────────────── 单篇模板 / 自动编号 ─────────────────────────

	/** 选择单篇模板（S9/S11）：路径无规则或为「不编号」时只提示。 */
	chooseTemplate(file: TFile): void {
		const p = this.plugin;
		const m = p.messages();
		const rule = resolvePathRule(p.settings.pathRules, file.path);
		if (!rule || rule.template === NO_NUMBERING_TEMPLATE) {
			new Notice(m.noticeNoteTemplateNoRule);
			return;
		}
		const names = p.templateStore.all().map((tpl) => tpl.name);
		if (names.length === 0) {
			new Notice(m.noticeNoTemplates);
			return;
		}
		new TemplatePickerModal(
			p.app,
			[FOLLOW_RULE, ...names],
			m.chooseTemplateFollowRule,
			m.chooseTemplatePlaceholder,
			(name) => {
				void this.writeFrontmatter(file, (fm) => {
					if (name === FOLLOW_RULE) {
						delete fm[TEMPLATE_KEY];
					} else {
						fm[TEMPLATE_KEY] = name;
					}
				}).then(
					() =>
						new Notice(
							name === FOLLOW_RULE
								? p.messages().noticeNoteTemplateCleared
								: p.messages().noticeNoteTemplateSet(name),
						),
				);
			},
		).open();
	}

	/** 开关当前笔记的自动编号（S12）：有效为开写 false，否则写 true。 */
	async toggleNoteAuto(file: TFile): Promise<void> {
		const content = await this.plugin.app.vault.cachedRead(file);
		const on = this.plugin.shouldAutoTrigger(content);
		await this.setNoteAuto(file, !on);
		const m = this.plugin.messages();
		new Notice(on ? m.noticeNoteAutoOff : m.noticeNoteAutoOn);
	}

	/** 写 / 删单篇自动编号开关（S15）：`null` 删除该键。 */
	async setNoteAuto(file: TFile, value: boolean | null): Promise<void> {
		await this.writeFrontmatter(file, (fm) => {
			if (value === null) {
				delete fm[SWITCH_KEY];
			} else {
				fm[SWITCH_KEY] = value;
			}
		});
	}

	/** 经官方 `processFrontMatter` 改 frontmatter，写完刷新编号 / 虚拟显示。 */
	private async writeFrontmatter(
		file: TFile,
		edit: (fm: Record<string, unknown>) => void,
	): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(file, edit);
		// 删光最后一个键后官方 API 会留下空的 `---`/`---` 外壳，顺手清掉（S15：不留空壳）。
		await this.plugin.app.vault.process(file, (c) =>
			c.replace(/^---\r?\n---[ \t]*(\r?\n|$)/, ""),
		);
		this.plugin.renumberActiveFile();
		this.updateStatus();
	}

	// ───────────────────────── 状态栏「本篇」 ─────────────────────────

	private registerStatusBar(): void {
		const p = this.plugin;
		const add = (p as { addStatusBarItem?: () => HTMLElement }).addStatusBarItem;
		if (typeof add !== "function") {
			return; // 单测替身 / 移动端没有状态栏。
		}
		const el = add.call(p);
		el.addClass("auto-headings-status");
		el.addEventListener("click", (evt) => {
			const file = p.app.workspace.getActiveFile?.();
			if (file) {
				void this.openNoteMenu(file, evt);
			}
		});
		this.statusEl = el;
		const refresh = () => this.updateStatus();
		p.registerEvent(p.app.workspace.on("active-leaf-change", refresh));
		p.registerEvent(p.app.workspace.on("file-open", refresh));
		p.registerEvent(p.app.metadataCache.on("changed", refresh));
		this.updateStatus();
	}

	/** 状态栏标签文本；非 Markdown 文件返回 `null`（隐藏）。 */
	statusText(file: TFile | null): string | null {
		const p = this.plugin;
		if (!file || file.extension !== "md") {
			return null;
		}
		const m = p.messages();
		const rule = resolvePathRule(p.settings.pathRules, file.path);
		if (!rule || rule.template === NO_NUMBERING_TEMPLATE) {
			return m.statusNoNumbering;
		}
		const mode =
			p.numberingModeFor(file.path) === "virtual" ? m.statusModeVirtual : m.statusModeWrite;
		return m.statusLabel(mode, p.getTemplateForFile(file.path)?.name ?? rule.template);
	}

	private updateStatus(): void {
		if (!this.statusEl) {
			return;
		}
		const text = this.statusText(this.plugin.app.workspace.getActiveFile?.() ?? null);
		this.statusEl.style.display = text === null ? "none" : "";
		this.statusEl.setText(text ?? "");
	}

	/** 在鼠标位置弹出「本篇」原生菜单（状态栏 / 标题手柄的「本篇编号设置…」共用，S14）。 */
	async openNoteMenu(file: TFile, evt: MouseEvent, onBack?: () => void): Promise<void> {
		const menu = new Menu();
		await this.buildNoteMenu(menu, file, onBack);
		menu.showAtMouseEvent(evt);
	}

	/** 组装「本篇」菜单（S14/S15）。 */
	async buildNoteMenu(menu: Menu, file: TFile, onBack?: () => void): Promise<void> {
		const p = this.plugin;
		const m = p.messages();
		const rule = resolvePathRule(p.settings.pathRules, file.path);
		const sw = readFileSwitch(await p.app.vault.cachedRead(file));
		menu.addItem((i) =>
			i
				.setTitle("📍 " + (rule ? m.statusMenuRule(rule.pattern) : m.statusMenuNoRule))
				.setIsLabel(true),
		);
		menu.addSeparator();
		const auto = (title: string, value: boolean | null) =>
			menu.addItem((i) =>
				i
					.setTitle(title)
					.setChecked(sw === value)
					.onClick(() => void this.setNoteAuto(file, value)),
			);
		auto("🔁 " + m.statusMenuAutoFollow, null);
		auto("✅ " + m.statusMenuAutoOn, true);
		auto("🚫 " + m.statusMenuAutoOff, false);
		menu.addSeparator();
		menu.addItem((i) =>
			i.setTitle("📄 " + m.statusMenuChangeTemplate).onClick(() => this.chooseTemplate(file)),
		);
		menu.addItem((i) =>
			i.setTitle("🔄 " + m.statusMenuRenumber).onClick(() => p.renumberActiveNoteNow()),
		);
		menu.addItem((i) =>
			i.setTitle("📋 " + m.statusMenuCopyOutline).onClick(() => {
				const found = p.activeMarkdownContext();
				if (found) {
					void p.runCopyNumberedOutline(found.editor, file);
				}
			}),
		);
		if (p.isVirtualFile(file.path)) {
			menu.addItem((i) =>
				i
					.setTitle("🧹 " + m.statusMenuClearStale)
					.onClick(() => p.clearActiveFileStaleNumbering()),
			);
		}
		if (onBack) {
			menu.addSeparator();
			menu.addItem((i) => i.setTitle("↩️ " + m.menuBack).onClick(onBack));
		}
	}
}
