import {
	Editor,
	MarkdownFileInfo,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	type App,
	type EditorChange,
	type MetadataCache,
} from "obsidian";
import {
	AutoHeadingsSettings,
	DEFAULT_SETTINGS,
	clampDebounceDelay,
	defaultPathRules,
} from "./settings/model";
import { AutoHeadingsSettingTab } from "./settings/SettingsTab";
import { getMessages, type Messages, resolveLang } from "./i18n";
import { readFileSwitch, SWITCH_KEY } from "./frontmatter";
import { renumberContent, type Template } from "./numbering";
import {
	clearForeignNumberingContent,
	clearNumberingContent,
	hasUnclaimedForeignNumbering,
} from "./cleanup";
import {
	computeHeadingRenames,
	computeSnapshotRenames,
	rewriteBacklinksInContent,
	snapshotHeadings,
	type HeadingRename,
	type HeadingSnapshot,
} from "./backlinks";
import { parseHeadings, type Heading } from "./parser";
import { resolvePathRule } from "./pathrules";
import { TemplateStore } from "./templates/TemplateStore";

/**
 * obsidian-auto-headings 插件入口。
 *
 * Milestone 2：editor onChange 监听 + 各文件防抖计时器；以单一事务整文件重写回编辑器；
 * 「立即重新编号」命令；面板全局开关 ↔ 全局命令双向同步；读取 frontmatter 单文件开关。
 * 注：插件**永不改写标题层级**，多个 H1 按各模板的「起始编号层级」处理（见 numbering.ts）。
 *
 * Milestone 3：接入 {@link TemplateStore}（首次启用自动创建 templates/default.json）。
 *
 * Milestone 4：白名单随模板自动生效——{@link renumberContent} 缺省即按 `template.whitelist`
 * 计算豁免（命中者不写前缀、不占计数器槽位，见 numbering.ts）。
 *
 * Milestone 5：**按路径选模板** + **开关/命令重构**（见 spec.md §3.1/§3.2/§3.8）——
 * - 路径规则解析 {@link getTemplateForFile}：按 `settings.pathRules` 为每个文件挑选模板，
 *   无命中则无可用模板（自动静默跳过 / 手动弹 Notice）。
 * - 「是否运行」两层化：`autoNumber`（全局自动编号面板开关）与文件级 frontmatter 强制。
 * - **自动触发**：`autoNumber` 开 或 `fm:true`，且 `fm≠false`（见 {@link shouldAutoTrigger}）。
 * - **手动命令**：绕过全局开关与 `fm:false`，仅受「能否命中模板」约束。
 */
export default class AutoHeadingsPlugin extends Plugin {
	settings: AutoHeadingsSettings = { ...DEFAULT_SETTINGS, pathRules: defaultPathRules() };

	/** 模板存储：读写 templates/*.json，首次启用时自动创建目录与默认模板。 */
	templateStore!: TemplateStore;

	private settingTab!: AutoHeadingsSettingTab;

	/** 以文件路径为键的防抖计时器；编辑另一个笔记不会取消当前笔记的待处理更新。 */
	private readonly debounceTimers = new Map<string, number>();

	/**
	 * 「清除全库编号」进行中标志（M7 多 TAB 敏感操作，见 spec.md §3.10）：置位期间
	 * {@link shouldAutoTrigger} 恒 false——批量写回会触发已打开文件的 editor-change，若不压制，
	 * 防抖到期后刚清掉的编号会被立刻编回去。仅内存标志，不持久化；清除完毕（含异常）恢复。
	 */
	private vaultClearInProgress = false;

	/**
	 * IME 组合（composition）进行中标志（0.7.17，testplan J8）：中文拼音等输入法组合期间，
	 * editor-change 会携带**尚未上屏的拼音字母**——此时防抖到点不写回、顺延一个周期，
	 * 避免把组合中间态编入标题。由 activeDocument 级 compositionstart/end 事件维护，仅内存标志。
	 */
	imeComposing = false;

	/**
	 * 各文件「上次同步点」的标题快照（Backlink 同步基线，testplan M14，见 spec.md §3.12）：
	 * 文件打开时播种、每次插件写回后刷新。有它才能看见用户在两次触发之间做的**纯文本改名**
	 * （改名发生在「编号前」快照之前，仅比较编号前后看不见）。与 `updateBacklinks` 开关无关地维护，
	 * 保证用户中途打开开关时基线已就绪。
	 */
	private readonly headingSnapshots = new Map<string, HeadingSnapshot[]>();

	/**
	 * 已提示过「疑似外来编号」的文件路径集合（迁移守卫，testplan J10）：仅内存标志，用于把
	 * {@link guardForeignNumbering} 的 Notice 限制为每文件每会话一次——命中后仍持续跳过自动写入，
	 * 但不重复打扰。随文件改名迁移键、随删除清除，插件卸载时整体清空。
	 */
	private readonly foreignNumberingWarned = new Set<string>();

	/**
	 * 当前界面语言的文案表（按 `settings.language` 解析，见 {@link resolveLang} / {@link getMessages}）。
	 * 命令名在 onload 注册时取一次（改语言需重载插件才更新）；Notice 在调用时取，即时生效。
	 */
	messages(): Messages {
		return getMessages(resolveLang(this.settings.language));
	}

	async onload(): Promise<void> {
		await this.loadSettings();
		const t = this.messages();

		// 向 Obsidian 注册 frontmatter 属性为复选框类型（内部 API，官方类型未声明，
		// 故以「可选方法」的结构化形状收窄，缺失时静默跳过）。注册后用户在属性面板看到
		// 勾选框，写入 true/false 而非文本。
		const mtm = (
			this.app as App & {
				metadataTypeManager?: {
					setPropertyInfo?: (key: string, info: { type: string }) => void;
				};
			}
		).metadataTypeManager;
		if (typeof mtm?.setPropertyInfo === "function") {
			mtm.setPropertyInfo(SWITCH_KEY, { type: "checkbox" });
		}

		// 初始化模板存储：确保 templates/ 目录与 default.json 存在并载入全部模板。
		const pluginDir =
			this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		this.templateStore = new TemplateStore(this.app.vault.adapter, pluginDir);
		await this.templateStore.init();

		this.settingTab = new AutoHeadingsSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		// 全局切换命令：与「全局自动编号」面板开关双向同步（统一经由 setAutoNumber）。
		// 命令 ID 不含插件 ID（Obsidian 注册时自动加 `auto-headings:` 前缀，审核要求不重复）。
		this.addCommand({
			id: "toggle-auto-numbering",
			name: t.cmdToggle,
			callback: async () => {
				await this.setAutoNumber(!this.settings.autoNumber);
				const m = this.messages();
				new Notice(this.settings.autoNumber ? m.noticeEnabled : m.noticeDisabled);
			},
		});

		// 立即重新编号：绕过防抖、绕过全局开关与 frontmatter false（手动命令路径，见 spec.md §3.1）。
		this.addCommand({
			id: "renumber-now",
			name: t.cmdRenumber,
			editorCallback: (editor, ctx) => {
				this.runImmediateRenumber(editor, ctx);
			},
		});

		// 清除当前文件编号：剥离当前文件所有标题的编号前缀（M6，见 spec.md §3.10）。
		this.addCommand({
			id: "clear-numbering",
			name: t.cmdClear,
			editorCallback: (editor, ctx) => {
				this.runClearNumbering(editor, ctx);
			},
		});

		// 清理非本插件的标题编号：只剥「不含 WJ」的手写 / 外来编号，保留插件自己写的（0.6.6，spec §3.10）。
		this.addCommand({
			id: "clear-foreign-numbering",
			name: t.cmdClearForeign,
			editorCallback: (editor, ctx) => {
				this.runClearForeignNumbering(editor, ctx);
			},
		});

		// 实时编辑监听：editor onChange → 重置该文件的防抖计时器。
		this.registerEvent(
			this.app.workspace.on("editor-change", (editor, info) => {
				this.scheduleRenumber(editor, info);
			}),
		);

		// IME 组合状态（J8）：挂当前活动窗口的 document（activeDocument，弹出窗口兼容），
		// 编辑器与设置面板输入框的组合都能覆盖。
		this.registerDomEvent(activeDocument, "compositionstart", () => {
			this.imeComposing = true;
		});
		this.registerDomEvent(activeDocument, "compositionend", () => {
			this.imeComposing = false;
		});

		// 文件打开：① 按当前生效模板自动重排（J9，用户需求：路径规则改投模板后无需先编辑，
		// 打开即刷新）；② 播种标题快照（M14 基线）。①在前——若①写回，快照会随 applyRenumber
		// 内的 syncAndSnapshot 一并刷新为写回后的状态，②的 has() 判断因此自然短路、不重复播种。
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (!file) {
					return;
				}
				this.renumberOnOpen(file);
				if (this.headingSnapshots.has(file.path)) {
					return;
				}
				void this.app.vault
					.cachedRead(file)
					.then((content) => {
						if (!this.headingSnapshots.has(file.path)) {
							this.headingSnapshots.set(file.path, snapshotHeadings(content));
						}
					})
					.catch(() => {
						/* 读取失败则不播种，回退到「编号前→编号后」口径。 */
					});
			}),
		);

		// 文件改名 / 删除时同步快照键，避免基线错挂到旧路径。
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				const snap = this.headingSnapshots.get(oldPath);
				if (snap) {
					this.headingSnapshots.delete(oldPath);
					this.headingSnapshots.set(file.path, snap);
				}
				if (this.foreignNumberingWarned.has(oldPath)) {
					this.foreignNumberingWarned.delete(oldPath);
					this.foreignNumberingWarned.add(file.path);
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.headingSnapshots.delete(file.path);
				this.foreignNumberingWarned.delete(file.path);
			}),
		);
	}

	onunload(): void {
		// 清理所有待处理的防抖计时器，避免向已卸载插件的回调写入。
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.clear();
		this.headingSnapshots.clear();
		this.foreignNumberingWarned.clear();
	}

	/**
	 * 设置「全局自动编号」开关并持久化，作为面板开关与命令之间的单一数据源，确保两者双向同步。
	 */
	async setAutoNumber(autoNumber: boolean): Promise<void> {
		this.settings.autoNumber = autoNumber;
		await this.saveSettings();
		// 若设置面板当前打开，刷新以反映最新状态（含「兜底缺失提示条」的显隐）。
		this.settingTab.display();
	}

	/**
	 * 按路径规则解析**某文件**应使用的模板（见 spec.md §3.8）。
	 *
	 * 用 `settings.pathRules` 对文件路径做具体度解析，命中规则后按模板名取模板。无任何规则
	 * 匹配（含 `/` 根规则被删）、或规则引用的模板已不存在时，返回 `null`（该文件**无可用模板**）。
	 *
	 * @param filePath 文件在仓库中的相对路径；为空时返回 `null`。
	 */
	getTemplateForFile(filePath: string | undefined | null): Template | null {
		if (!filePath) {
			return null;
		}
		const rule = resolvePathRule(this.settings.pathRules, filePath);
		if (!rule) {
			return null;
		}
		return this.templateStore.get(rule.template) ?? null;
	}

	/**
	 * **自动触发**是否应进行（见 spec.md §3.1 自动路径）。判定顺序：
	 * - frontmatter `false` → 不触发（即便全局开关开）。
	 * - frontmatter `true` → 触发（文件级强制 opt-in，即便全局开关关）。
	 * - 缺省 / 非法值 → 跟随「全局自动编号」开关。
	 *
	 * 注意：本判定仅决定「是否够格自动触发」，是否真正写入还取决于能否命中模板（见
	 * {@link getTemplateForFile}）。手动命令不走此判定。
	 */
	private shouldAutoTrigger(content: string): boolean {
		if (this.vaultClearInProgress) {
			return false; // 清除全库进行中：临时压制自动编号，完毕恢复（见 clearAllVaultNumbering）。
		}
		const sw = readFileSwitch(content);
		if (sw === false) {
			return false;
		}
		if (sw === true) {
			return true;
		}
		return this.settings.autoNumber;
	}

	/**
	 * 收集**全部模板各级别在用的前缀 / 后缀并集**，供剥离时识别历史前缀（方案 A，见
	 * {@link renumberContent} 的 `strippablePrefixes` / `strippableSuffixes`）。
	 *
	 * 解决 testplan B2/B3：用户把某模板的前缀（如「第」）改走、或在多模板间切换后，文件里用
	 * **旧前缀**写出的历史编号若只认当前模板值就剥不掉、会叠加。把所有模板用过的前后缀都纳入候选，
	 * 旧前缀即可被剥净。`stripPrefix` 自身还会并入「当前级别值 + 空串」，故此处只需提供跨模板的并集。
	 */
	strippableAffixes(): { prefixes: string[]; suffixes: string[] } {
		const prefixes = new Set<string>([""]);
		const suffixes = new Set<string>([""]);
		for (const tpl of this.templateStore.all()) {
			for (const level of Object.values(tpl.levels)) {
				prefixes.add(level.prefix);
				suffixes.add(level.suffix);
			}
		}
		return { prefixes: [...prefixes], suffixes: [...suffixes] };
	}

	/**
	 * 解析**当前活动 Markdown 文件**的标题列表，供设置面板的白名单实时命中预览使用（见
	 * SettingsTab 白名单编辑器）。无活动 Markdown 视图时返回空数组。
	 */
	currentFileHeadings(): Heading[] {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			return [];
		}
		return parseHeadings(view.editor.getValue());
	}

	/** 当前活动 Markdown 文件的路径（无活动视图时为 null），供设置面板的白名单预览取模板。 */
	currentFilePath(): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file?.path ?? null;
	}

	/**
	 * 重命名模板，并同步更新 `data.json` 中引用该模板名的路径规则（见 spec.md §3.6/§3.8）。
	 *
	 * @returns 重命名是否成功（名称冲突、为空或为默认模板时失败）。
	 */
	async renameTemplate(oldName: string, newName: string): Promise<boolean> {
		const ok = await this.templateStore.rename(oldName, newName);
		if (ok) {
			let changed = false;
			for (const rule of this.settings.pathRules) {
				if (rule.template === oldName) {
					rule.template = newName;
					changed = true;
				}
			}
			if (changed) {
				await this.saveSettings();
			}
		}
		return ok;
	}

	/**
	 * 在设置面板修改模板 / 路径规则后，立即对**所有已打开的 Markdown 文件**重新编号，使格式调整即时可见。
	 *
	 * **不走 `getActiveViewOfType`**：设置面板是模态层，打开时活动视图常不是 MarkdownView，
	 * `getActiveViewOfType(MarkdownView)` 会返回 `null` → 改模板后已编号文件不刷新（实测 bug）。
	 * 改为遍历 `getLeavesOfType("markdown")` 的全部打开叶子：每个仍走与自动触发一致的判定
	 * （{@link shouldAutoTrigger} + 按路径解析模板），全局开关关 / frontmatter `false` / 无可用模板时静默跳过。
	 */
	renumberActiveFile(): void {
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			// getLeavesOfType("markdown") 的叶子视图即 MarkdownView（含 editor / file），鸭子类型取用。
			const view = leaf.view as unknown as {
				editor?: Editor;
				file?: { path: string; basename?: string } | null;
			};
			const editor = view.editor;
			const file = view.file;
			if (!editor || !file) {
				continue;
			}
			if (!this.shouldAutoTrigger(editor.getValue())) {
				continue;
			}
			const template = this.getTemplateForFile(file.path);
			if (!template) {
				continue;
			}
			if (this.guardForeignNumbering(file.path, editor.getValue())) {
				continue;
			}
			this.applyRenumber(editor, template, file);
		}
	}

	/**
	 * 打开文件即按当前生效模板自动重排（testplan J9，用户需求：改了路径规则所投模板 / 模板本身
	 * 的样式后，无需先手动编辑或跑命令，只要**打开**该路径下的文件就自动刷新为新格式）。
	 *
	 * 走与实时编辑一致的**自动路径**门控（{@link shouldAutoTrigger} + 按路径解析模板）——全局
	 * 开关关且非 fm:true、或 fm:false 时不动；无可用模板时静默跳过。`applyRenumber` 内容未变时
	 * 不发起事务，故已是最新格式的文件打开时是静默 no-op，不会给每次打开都添一条撤销记录。
	 */
	private renumberOnOpen(file: { path: string }): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || view.file?.path !== file.path) {
			return; // 活动视图与本次打开的文件不一致（如后台/快速切换）时不强行处理。
		}
		const editor = view.editor;
		if (!editor || !this.shouldAutoTrigger(editor.getValue())) {
			return;
		}
		const template = this.getTemplateForFile(file.path);
		if (!template) {
			return;
		}
		if (this.guardForeignNumbering(file.path, editor.getValue())) {
			return;
		}
		this.applyRenumber(editor, template, view.file);
	}

	/**
	 * 迁移守卫（**仅自动路径**，testplan J10，见 spec.md §3.10 相邻讨论）：若本文件疑似含外来编号
	 * 且插件从未接触过它（{@link hasUnclaimedForeignNumbering}），跳过本次自动写入并提示用户先清理
	 * ——否则会在外来编号前叠加本插件自己的编号（`## 1 红米` → `## 1 1 红米`），观感上与 bug 无异。
	 * 同一文件本次会话只提示一次（{@link foreignNumberingWarned}），此后静默持续跳过直至用户清理
	 * 或重载插件。**手动命令**（立即重新编号 / 清除编号 / 清理外来编号）不查此函数，绕过一切开关
	 * 照常执行，与既有「Renumber now 绕过一切开关」原则一致。
	 *
	 * @returns 是否命中守卫（命中即调用方应跳过本次 {@link applyRenumber}）。
	 */
	private guardForeignNumbering(path: string, content: string): boolean {
		if (!hasUnclaimedForeignNumbering(content)) {
			return false;
		}
		if (!this.foreignNumberingWarned.has(path)) {
			this.foreignNumberingWarned.add(path);
			new Notice(this.messages().noticeForeignNumberingGuard);
		}
		return true;
	}

	/**
	 * 「清除当前文件编号」命令（**手动路径**，见 spec.md §3.10）：剥离当前文件所有标题的编号
	 * 前缀（全样式并集剥离器，独立于模板），以单一事务写回。绕过防抖与开关（与「立即重新编号」对称）。
	 */
	private runClearNumbering(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): void {
		// 取消该文件的待处理防抖更新，避免清除后立即被重新编号。
		const path = ctx.file?.path;
		if (path) {
			const existing = this.debounceTimers.get(path);
			if (existing !== undefined) {
				window.clearTimeout(existing);
				this.debounceTimers.delete(path);
			}
		}

		const { prefixes, suffixes } = this.strippableAffixes();
		const oldContent = editor.getValue();
		let newContent = clearNumberingContent(oldContent, {
			strippablePrefixes: prefixes,
			strippableSuffixes: suffixes,
		});

		if (newContent === oldContent) {
			new Notice(this.messages().noticeNothingToClear);
			return;
		}

		// 同文件内链先折进 newContent，随本次事务一并写回（见 foldSelfBacklinks）。
		const fold = this.foldSelfBacklinks(ctx.file, oldContent, newContent);
		newContent = fold.content;

		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");
		const changes: EditorChange[] = [];
		for (let i = 0; i < newLines.length; i++) {
			if (oldLines[i] !== newLines[i]) {
				changes.push({
					from: { line: i, ch: 0 },
					to: { line: i, ch: oldLines[i].length },
					text: newLines[i],
				});
			}
		}
		if (changes.length > 0) {
			editor.transaction({ changes });
			// Backlink 同步：清除编号也改写了标题文本（去掉前缀），更新别处指向它的内部链接。
			this.syncAndSnapshot(ctx.file, newContent, fold.renames, fold.selfCount);
		}
		new Notice(this.messages().noticeCleared);
	}

	/**
	 * 「清理非本插件的标题编号」命令（**手动路径**，0.6.6，见 spec.md §3.10）：只剥**不含 WJ** 的
	 * 手写 / 外来编号（{@link clearForeignNumberingContent}），保留插件自己写的（带 WJ）编号；以单一
	 * 事务写回。绕过防抖与开关（与「清除当前文件编号」对称）。
	 */
	private runClearForeignNumbering(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): void {
		const path = ctx.file?.path;
		if (path) {
			const existing = this.debounceTimers.get(path);
			if (existing !== undefined) {
				window.clearTimeout(existing);
				this.debounceTimers.delete(path);
			}
		}

		const oldContent = editor.getValue();
		let newContent = clearForeignNumberingContent(oldContent);

		if (newContent === oldContent) {
			new Notice(this.messages().noticeNoForeign);
			return;
		}

		// 同文件内链先折进 newContent，随本次事务一并写回（见 foldSelfBacklinks）。
		const fold = this.foldSelfBacklinks(ctx.file, oldContent, newContent);
		newContent = fold.content;

		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");
		const changes: EditorChange[] = [];
		for (let i = 0; i < newLines.length; i++) {
			if (oldLines[i] !== newLines[i]) {
				changes.push({
					from: { line: i, ch: 0 },
					to: { line: i, ch: oldLines[i].length },
					text: newLines[i],
				});
			}
		}
		if (changes.length > 0) {
			editor.transaction({ changes });
			// Backlink 同步：清理外来编号也改写了标题文本，更新别处指向它的内部链接。
			this.syncAndSnapshot(ctx.file, newContent, fold.renames, fold.selfCount);
		}
		new Notice(this.messages().noticeForeignCleared);
	}

	/**
	 * 清除全库所有 Markdown 文件的编号前缀（见 spec.md §3.10「清除全库编号」按钮）。
	 * 由 SettingsTab 的 ClearVaultModal 在二次确认后调用。
	 *
	 * **不在 Obsidian 编辑历史内（vault.modify 无撤销），建议用户操作前备份。**
	 * 逐文件读取 → 清除 → 写回；仅修改实际有变化的文件。
	 */
	async clearAllVaultNumbering(): Promise<void> {
		// 先**持久关闭**「全局自动编号」（0.7.17，testplan H7）：清完全库却留着开关开，
		// 一编辑又被编回去——「全开着却没一个被编号」不符合直觉。清库 = 用户明确表态
		// 「现在不要编号」，故先关开关再清；想恢复时手动再开即可。
		if (this.settings.autoNumber) {
			this.settings.autoNumber = false;
			await this.saveSettings();
			// 面板若开着，立即反映开关新状态（单测环境未挂设置面板，可选调用）。
			this.settingTab?.display();
		}
		// 临时压制自动编号（见 vaultClearInProgress），并取消全部待处理防抖——批量写回会触发
		// 已打开文件的 editor-change，不压制的话刚清掉的编号会被立刻编回去。完毕（含异常）恢复。
		// （开关已关后仍保留压制：frontmatter `true` 的文件不受全局开关约束，见 shouldAutoTrigger。）
		this.vaultClearInProgress = true;
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.clear();
		try {
			const { prefixes, suffixes } = this.strippableAffixes();
			const files = this.app.vault.getMarkdownFiles();
			let count = 0;
			for (const file of files) {
				const content = await this.app.vault.read(file);
				const newContent = clearNumberingContent(content, {
					strippablePrefixes: prefixes,
					strippableSuffixes: suffixes,
				});
				if (newContent !== content) {
					await this.app.vault.modify(file, newContent);
					count++;
					// 若该文件有快照基线，同步刷新（全库清除绕开编辑器路径，基线不能留在清除前的状态）。
					if (this.headingSnapshots.has(file.path)) {
						this.headingSnapshots.set(file.path, snapshotHeadings(newContent));
					}
				}
			}
			new Notice(this.messages().noticeClearedVault(count));
		} finally {
			this.vaultClearInProgress = false;
		}
	}

	/**
	 * 取「当前活动 Markdown 文件」的编辑器与上下文，供设置面板**敏感操作 TAB** 的两个单文件清除
	 * 入口使用。设置面板是模态层，`getActiveViewOfType(MarkdownView)` 可能返回 `null`（N1 同源），
	 * 故回退到「按 `getActiveFile()` 在打开的 markdown 叶子里找同路径视图」。找不到返回 `null`。
	 */
	private activeMarkdownContext(): { editor: Editor; ctx: MarkdownFileInfo } | null {
		const direct = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (direct?.editor) {
			return { editor: direct.editor, ctx: direct };
		}
		const active = this.app.workspace.getActiveFile?.();
		if (!active) {
			return null;
		}
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view as unknown as MarkdownFileInfo & { editor?: Editor };
			if (view.editor && view.file?.path === active.path) {
				return { editor: view.editor, ctx: view };
			}
		}
		return null;
	}

	/** 敏感操作 TAB 入口：对当前活动文件执行「清除当前文件编号」；无活动 Markdown 文件时 Notice。 */
	clearActiveFileNumbering(): void {
		const found = this.activeMarkdownContext();
		if (!found) {
			new Notice(this.messages().noticeNoActiveFile);
			return;
		}
		this.runClearNumbering(found.editor, found.ctx);
	}

	/** 敏感操作 TAB 入口：对当前活动文件执行「清理非本插件的标题编号」；无活动文件时 Notice。 */
	clearActiveFileForeignNumbering(): void {
		const found = this.activeMarkdownContext();
		if (!found) {
			new Notice(this.messages().noticeNoActiveFile);
			return;
		}
		this.runClearForeignNumbering(found.editor, found.ctx);
	}

	async loadSettings(): Promise<void> {
		const data = ((await this.loadData()) ?? {}) as Record<string, unknown>;
		const merged = Object.assign(
			{},
			DEFAULT_SETTINGS,
			{ pathRules: defaultPathRules() },
			data,
		) as Record<string, unknown>;
		// 迁移：历史字段 `enabled`（M2–M4）→ `autoNumber`（M5）。
		if (typeof data.enabled === "boolean" && typeof data.autoNumber !== "boolean") {
			merged.autoNumber = data.enabled;
		}
		delete merged.enabled;
		// pathRules 缺失 / 非数组时回退到默认（`/`→「默认」）。
		if (!Array.isArray(merged.pathRules)) {
			merged.pathRules = defaultPathRules();
		}
		// language 缺失 / 非法（含旧版本无此字段）时回退到默认 `auto`。
		if (merged.language !== "zh" && merged.language !== "en" && merged.language !== "auto") {
			merged.language = "auto";
		}
		// updateBacklinks 缺失 / 非布尔（含旧版本无此字段）时回退到默认 **true**（0.7.11 曝光度决策：
		// 1.0 头牌卖点默认开；显式设过 false 的用户不受影响）。首次说明标记缺失时视为未弹过。
		if (typeof merged.updateBacklinks !== "boolean") {
			merged.updateBacklinks = true;
		}
		if (typeof merged.backlinksIntroShown !== "boolean") {
			merged.backlinksIntroShown = false;
		}
		this.settings = merged as unknown as AutoHeadingsSettings;
		this.settings.debounceDelay = clampDebounceDelay(this.settings.debounceDelay);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * 实时编辑触发（**自动路径**）：达到自动触发资格才重置该文件的防抖计时器；到期后再次
	 * 校验资格与模板命中，命中则整文件重排。计时器以文件路径为单位互相独立。
	 */
	private scheduleRenumber(editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
		const file = info.file;
		if (!file) {
			return;
		}
		// 不够格自动触发（全局开关关且非 fm:true，或 fm:false）时不安排任何更新。
		if (!this.shouldAutoTrigger(editor.getValue())) {
			return;
		}

		const path = file.path;
		const existing = this.debounceTimers.get(path);
		if (existing !== undefined) {
			window.clearTimeout(existing);
		}

		const timer = window.setTimeout(() => {
			this.debounceTimers.delete(path);
			// IME 组合中（拼音尚未上屏，J8）：不写回，顺延一个防抖周期再试。
			if (this.imeComposing) {
				this.scheduleRenumber(editor, info);
				return;
			}
			// 计时器到期时再次校验（其间用户可能改了开关或 frontmatter）。
			if (!this.shouldAutoTrigger(editor.getValue())) {
				return;
			}
			const template = this.getTemplateForFile(path);
			if (!template) {
				return; // 无可用模板：自动触发静默跳过（不打扰）。
			}
			if (this.guardForeignNumbering(path, editor.getValue())) {
				return;
			}
			this.applyRenumber(editor, template, file);
		}, this.settings.debounceDelay);

		this.debounceTimers.set(path, timer);
	}

	/**
	 * 「立即重新编号」命令（**手动路径**，见 spec.md §3.1）：绕过防抖、绕过「全局自动编号」开关
	 * 与 frontmatter `false`，仅受「能否命中模板」约束；命中不到模板时弹 Notice 反馈。
	 */
	private runImmediateRenumber(editor: Editor, ctx: MarkdownView | MarkdownFileInfo): void {
		// 若有待处理的实时更新，先取消，避免随后重复触发。
		const path = ctx.file?.path;
		if (path) {
			const existing = this.debounceTimers.get(path);
			if (existing !== undefined) {
				window.clearTimeout(existing);
				this.debounceTimers.delete(path);
			}
		}

		const template = this.getTemplateForFile(path);
		if (!template) {
			new Notice(this.messages().noticeNoRule);
			return;
		}

		const m = this.messages();
		const changed = this.applyRenumber(editor, template, ctx.file);
		new Notice(changed ? m.noticeRenumbered : m.noticeNoChange);
	}

	/**
	 * 用给定模板对编辑器执行一次重新编号，并以**单一事务**写回变化的行。
	 *
	 * 本方法只做「剥旧前缀 + 按模板写新前缀」的机械动作，**不**再判定开关 / frontmatter / 模板命中
	 * （这些由调用方按自动 / 手动路径分别判定，见 {@link scheduleRenumber} / {@link runImmediateRenumber}）。
	 *
	 * - 仅当内容确有变化时才发起事务，避免无谓的撤销记录与光标抖动。
	 * - 整文件重写永不增删行，故按行索引逐行比较即可定位变化。
	 *
	 * @param target 当前文件（用于 Backlink 同步取反向链接 / basename）；缺省则不同步链接。
	 * @returns 是否实际写入了改动。
	 */
	private applyRenumber(editor: Editor, template: Template, target?: LinkTarget | null): boolean {
		const oldContent = editor.getValue();

		const { prefixes, suffixes } = this.strippableAffixes();
		let newContent = renumberContent(oldContent, template, {
			strippablePrefixes: prefixes,
			strippableSuffixes: suffixes,
		});
		// 同文件内链先折进 newContent，随本次事务一并写回（见 foldSelfBacklinks）；即便编号本身
		// 未变（M14 纯文本改名）也要折，本函数内的行级 diff 会自然识别出这一变化并写回。
		const fold = this.foldSelfBacklinks(target, oldContent, newContent);
		newContent = fold.content;
		let changed = false;
		if (newContent !== oldContent) {
			const oldLines = oldContent.split("\n");
			const newLines = newContent.split("\n");
			const changes: EditorChange[] = [];
			for (let i = 0; i < newLines.length; i++) {
				if (oldLines[i] !== newLines[i]) {
					changes.push({
						from: { line: i, ch: 0 },
						to: { line: i, ch: oldLines[i].length },
						text: newLines[i],
					});
				}
			}
			if (changes.length > 0) {
				// 单一事务：多处行替换合并为一条撤销记录。
				editor.transaction({ changes });
				changed = true;
			}
		}
		// Backlink 同步 + 快照刷新：**即便本轮编号没改动任何行也要做**（M14）——用户可能在上个
		// 同步点之后改了标题正文（编号不变），只有对照快照基线才看得见这类改名。
		this.syncAndSnapshot(target, newContent, fold.renames, fold.selfCount);
		return changed;
	}

	/**
	 * 把「本次标题改写」引发的**同文件内链**（`[[#锚点]]` / `[[本文件#锚点]]`）改动直接折进
	 * `newContent`，随主编号 / 清除事务**一次性**写回（实修 spec.md §3.12 曾登记的已知限制）。
	 *
	 * **根因**：旧实现把「引用方=本文件自身」这一支也交给 {@link syncBacklinks} 的
	 * `vault.process` 处理——但 `vault.process` 读的是 vault 缓存 / 磁盘上的内容，而本文件此刻
	 * 正被编辑器持有、编号/清除事务尚未落盘。二者异步竞态：`vault.process` 读到旧内容、写回
	 * 覆盖掉刚发生的编号/清除，用户看到 Notice 提示成功但文件其实未变（切到别的文件再切回、
	 * 相当于给足时间落盘后重跑才会成功）。同文件的情形我们手上已经有 `newContent`（本次真正
	 * 要写回编辑器的内容），直接对它做字符串重写、随原 diff 一起进同一个 `editor.transaction`，
	 * 天然不涉及任何异步读盘，无竞态可言。
	 *
	 * @returns 折叠自链接后的最终内容；供 {@link syncAndSnapshot}/{@link syncBacklinks} 复用、避免
	 * 重算的改名表；本轮自链接命中数（并入最终「已更新 N 处链接」的 Notice 合计）。
	 * `updateBacklinks` 关 / 无 target / 无改名时原样返回 `newContent`。
	 */
	private foldSelfBacklinks(
		target: LinkTarget | null | undefined,
		oldContent: string,
		newContent: string,
	): { content: string; renames: HeadingRename[]; selfCount: number } {
		if (!this.settings.updateBacklinks || !target?.path) {
			return { content: newContent, renames: [], selfCount: 0 };
		}
		const baseline = this.headingSnapshots.get(target.path);
		const renames =
			(baseline ? computeSnapshotRenames(baseline, newContent) : null) ??
			computeHeadingRenames(oldContent, newContent);
		if (renames.length === 0) {
			return { content: newContent, renames: [], selfCount: 0 };
		}
		const basename = target.basename ?? linkBasename(target.path);
		const map = new Map(renames.map((r) => [r.from, r.to]));
		const result = rewriteBacklinksInContent(newContent, basename, true, map);
		return { content: result.content, renames, selfCount: result.count };
	}

	/**
	 * Backlink 同步的统一入口 + 快照维护（testplan M14，见 spec.md §3.12）：用本次写回后的内容
	 * 刷新快照，然后异步触发 {@link syncBacklinks} 同步**别的文件**（本文件自身已由调用方经
	 * {@link foldSelfBacklinks} 折进 `newContent`）。快照维护与 `updateBacklinks` 开关无关。
	 *
	 * @param renames {@link foldSelfBacklinks} 已算好的改名表，直接传给 {@link syncBacklinks} 复用。
	 * @param selfCount 本轮同文件内链命中数，并入最终 Notice 合计。
	 */
	private syncAndSnapshot(
		target: LinkTarget | null | undefined,
		newContent: string,
		renames: HeadingRename[],
		selfCount: number,
	): void {
		if (target?.path) {
			this.headingSnapshots.set(target.path, snapshotHeadings(newContent));
		}
		void this.syncBacklinks(target, renames, selfCount);
	}

	/**
	 * Backlink 同步（M7，见 spec.md §3.12）：标题文本改写后，更新**别的文件**里指向旧标题锚点的
	 * 内部链接。**仅在 `updateBacklinks` 开启时工作**（默认开）。改名表由调用方（
	 * {@link foldSelfBacklinks}）算好传入，本方法只负责反查引用方 + 写回，不重算。
	 *
	 * 用 `metadataCache.getBacklinksForFile` 反查引用方 → 对每个**别的**引用文件用 `vault.process`
	 * 原子重写锚点（纯函数 {@link rewriteBacklinksInContent}）——**跳过引用方=本文件自身**的条目：
	 * 那一支已经在 {@link foldSelfBacklinks} 里随主事务同步处理过，这里重复处理只会重新引入
	 * 「读盘覆盖未落盘编辑器内容」的竞态（见 {@link foldSelfBacklinks} 的详细说明）。
	 *
	 * 防御性：`getBacklinksForFile` 为半公开 API（返回 `{data}` 包装），缺失 / 异常时**静默降级**——
	 * 绝不因链接同步失败而打断编号本身。
	 */
	private async syncBacklinks(
		target: LinkTarget | null | undefined,
		renames: HeadingRename[],
		selfCount: number,
	): Promise<void> {
		if (!this.settings.updateBacklinks || !target?.path || renames.length === 0) {
			return;
		}
		let total = selfCount;
		const map = new Map(renames.map((r) => [r.from, r.to]));
		// 半公开 API：官方类型未声明 getBacklinksForFile，以「可选方法」的结构化形状收窄（非 any）。
		const mc = this.app.metadataCache as MetadataCache & {
			getBacklinksForFile?: (file: LinkTarget) => unknown;
		};
		const vault = this.app.vault;
		if (typeof mc.getBacklinksForFile === "function") {
			const raw: unknown = mc.getBacklinksForFile(target);
			const data = backlinkMap(raw);
			if (data) {
				const basename = target.basename ?? linkBasename(target.path);
				for (const sourcePath of data.keys()) {
					if (typeof sourcePath !== "string" || sourcePath === target.path) {
						continue; // 本文件自身已由 foldSelfBacklinks 随主事务处理，跳过避免竞态重复写。
					}
					const file = vault.getAbstractFileByPath(sourcePath);
					// 仅处理文件（instanceof 收窄，排除文件夹，商店审核要求勿用 as TFile 断言）。
					if (!(file instanceof TFile)) {
						continue;
					}
					await vault.process(file, (content) => {
						const result = rewriteBacklinksInContent(content, basename, false, map);
						total += result.count;
						return result.content;
					});
				}
			}
		}
		if (total > 0) {
			const m = this.messages();
			new Notice(m.noticeBacklinksUpdated(total));
			// 首次实际改写别的文件时，弹一次较长的说明（默认开的曝光度配套，0.7.11）：说清改了什么、
			// 改动不在被改文件的撤销历史内、以及在哪里关闭。只弹一次并持久化。
			if (!this.settings.backlinksIntroShown) {
				this.settings.backlinksIntroShown = true;
				await this.saveSettings();
				new Notice(m.noticeBacklinksIntro, 12000);
			}
		}
	}
}

/** Backlink 同步所需的最小目标文件形状（真实为 Obsidian `TFile`，测试可传同形对象）。 */
interface LinkTarget {
	path: string;
	basename?: string;
}

/**
 * 从半公开 `getBacklinksForFile` 的返回值提取反链 Map（适配两种形状：裸 `Map`，或
 * `{ data: Map }` 包装）；形状不符时返回 undefined，调用方静默降级。
 */
function backlinkMap(raw: unknown): Map<unknown, unknown> | undefined {
	if (raw instanceof Map) {
		return raw as Map<unknown, unknown>;
	}
	if (raw && typeof raw === "object") {
		const data = (raw as { data?: unknown }).data;
		if (data instanceof Map) {
			return data as Map<unknown, unknown>;
		}
	}
	return undefined;
}

/** 从文件路径取 basename（去目录与 `.md` 后缀），用作 `TFile.basename` 缺失时的回退。 */
function linkBasename(path: string): string {
	const last = path.split("/").pop() ?? path;
	return last.replace(/\.md$/i, "");
}
