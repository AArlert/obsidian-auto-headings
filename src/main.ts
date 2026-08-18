import {
	Editor,
	MarkdownFileInfo,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	type App,
	type EditorChange,
	type EditorRangeOrCaret,
	type MetadataCache,
} from "obsidian";
import {
	AutoHeadingsSettings,
	DEFAULT_SETTINGS,
	clampDebounceDelay,
	defaultPathRules,
} from "./settings/model";
import { AutoHeadingsSettingTab } from "./settings/SettingsTab";
import { ForeignNumberingCleanupModal } from "./settings/ForeignNumberingCleanupModal";
import { getMessages, type Messages, resolveLang } from "./i18n";
import {
	planPauseFileSwitch,
	planResumeFileSwitch,
	readFileSwitch,
	SWITCH_KEY,
	type SwitchEdit,
} from "./frontmatter";
import { renumberContent, WORD_JOINER, type Template } from "./numbering";
import { ClipboardOriginalCache, stripWordJoiners, stripWordJoinersFromHtml } from "./clipboard";
import {
	clearForeignNumberingContent,
	clearNumberingContent,
	hasUnclaimedForeignNumbering,
	previewForeignNumberingCleanup,
	type ForeignNumberingPreviewItem,
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
import { NO_NUMBERING_TEMPLATE, resolvePathRule, ruleMatches, type PathRule } from "./pathrules";
import { TemplateStore } from "./templates/TemplateStore";
import { HeadingIndex } from "./headingindex";
import { HeadingLinkSuggest } from "./headingsuggest";
import {
	buildVcDictionaryJson,
	enableAutoIntegration,
	tryReloadVcDictionaries,
	VC_DICTIONARY_THROTTLE_MS,
	vcDictionaryPath,
} from "./vcintegration";

/** M13：初始标题索引扫描的批量大小（文件数），每批让出主线程一次（方案 §2.4，可调常量）。 */
const INITIAL_SCAN_BATCH_SIZE = 200;

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
 *
 * M12（CR-18，见 spec.md §3.12「独立于编号模板的触发」）：Backlink 同步有一条**不依赖**
 * {@link getTemplateForFile} 命中的触发路径（{@link shouldBacklinkStandaloneTrigger} /
 * {@link applyBacklinkStandaloneSync}），由 `updateBacklinks` 总开关统一控制（1.0.9 起与原「独立
 * 触发」开关合一，开启即全局生效）——常规编号路径本轮未处理（无模板 / 不够格自动触发）时，只要
 * 标题文本对照快照基线改写，仍同步引用链接，该路径从不写入编号前缀。
 */
export default class AutoHeadingsPlugin extends Plugin {
	settings: AutoHeadingsSettings = { ...DEFAULT_SETTINGS, pathRules: defaultPathRules() };

	/** 模板存储：读写 templates/*.json，首次启用时自动创建目录与默认模板。 */
	templateStore!: TemplateStore;

	private settingTab!: AutoHeadingsSettingTab;

	/** 以文件路径为键的防抖计时器；编辑另一个笔记不会取消当前笔记的待处理更新。 */
	private readonly debounceTimers = new Map<string, number>();

	/**
	 * 标题索引：全 vault「剥前缀后原文 → 位置」的内存索引（M13，见 headingindex.ts）。
	 * 刻意不加 private——HeadingLinkSuggest（另一个类）需要读它，与 imeComposing 完全同款先例。
	 */
	headingIndex = new HeadingIndex();
	/** 标题索引增量更新的按文件去抖计时器（与 debounceTimers 同构，独立维护）。 */
	private readonly headingIndexTimers = new Map<string, number>();
	/** VC 词典文件重写的全局节流计时器（见 vcintegration.ts）。 */
	private vcDictionaryTimer: number | null = null;
	/** 上次写出的词典 JSON（1.0.27 轻量改进：内容未变不写盘，避免 iCloud/同步无谓上传）。 */
	private lastVcDictionaryJson: string | null = null;
	/** 词典条数截断的一次性 Notice 是否已弹过（不重复打扰）。 */
	private vcTruncationNoticed = false;

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
	 * 屏幕上那条迁移守卫 Notice（至多一条）及其对应文件（testplan J10/J13/J14）。
	 *
	 * **为什么要记住它**（1.0.19 真机反馈的根因）：守卫检查的发起方**不保证是用户正看着的那个
	 * 文件**——{@link scheduleRenumber} 的防抖计时器捕获的是**安排那一刻**的路径，用户在 A 里
	 * 敲了字、300ms 还没到就切走，计时器会在**切换之后**才到期；{@link renumberActiveFile} 更是
	 * 直接遍历**全部**打开的叶子。1.0.18 之前没有这道校验，于是出现「打开外来编号文件时不弹、
	 * 切到另一个文件反而弹出来、点进去又说没什么可清理」——那条提示说的其实是上一个文件。
	 *
	 * 三条约束由此而来（全部落在 {@link showForeignNumberingGuardNotice}）：
	 * 1. **只为当前活动文件发声**：`path` 不是 `getActiveFile()` 时直接不弹——为看不见的文件弹
	 *    提示，用户只会把它读成在说眼前这篇。
	 * 2. **同一文件至多一条**：已有一条在屏幕上就不重建，避免用户持续打字时防抖反复到期造成
	 *    闪烁 / 堆叠（Notice 是 `duration: 0` 不自动消失的）。
	 * 3. **失效即收起**：切到别的文件、或该文件已被清理干净时主动 `hide()`，不留下一条指向别处
	 *    的孤儿提示。
	 */
	private activeGuardNotice: { path: string; notice: Notice } | null = null;

	/**
	 * 剪贴板净化的会话级「净化文本 → 原文」LRU（M11，spec.md §2.8「内存映射
	 * 双通道」）：copy/cut 出口净化时记录，editor-paste 命中时还原原文避免双重编号（O9）。
	 * 只存内存、不持久化，随插件卸载丢弃。
	 */
	private readonly clipboardCache = new ClipboardOriginalCache();

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

		// 标题链接建议（M13）：EditorSuggest 建议框。此处不依赖 headingIndex/vault 扫描是否已完成——
		// onTrigger 只有在用户真正打字触发时才会被调用，届时 onload() 早已跑完。
		this.registerEditorSuggest(new HeadingLinkSuggest(this));

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

		// 实时编辑监听：editor onChange → 重置该文件的防抖计时器（编号 + M13 标题索引各一套）。
		this.registerEvent(
			this.app.workspace.on("editor-change", (editor, info) => {
				this.scheduleRenumber(editor, info);
				this.scheduleHeadingIndexUpdate(editor, info);
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

		// 剪贴板净化（M11，spec.md §2.8；1.0.16 起恒开无开关）：copy/cut 出口剥 WJ + editor-paste
		// 命中还原。主窗口挂一份，弹出窗口在 window-open 时各挂一份（registerDomEvent 随插件
		// 卸载自动清理，重复打开同一弹窗会重新注册、旧监听随窗口销毁）。
		this.registerClipboardSanitizer(activeDocument);
		this.registerEvent(
			this.app.workspace.on("window-open", (ww) => {
				this.registerClipboardSanitizer(ww.doc);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("editor-paste", (evt, editor, info) => {
				this.restoreSanitizedPaste(evt, editor, info);
			}),
		);

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
				if (this.activeGuardNotice?.path === oldPath) {
					this.activeGuardNotice.path = file.path;
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.headingSnapshots.delete(file.path);
				this.dismissGuardNotice(file.path);
			}),
		);

		// 标题索引（M13）：初始全量扫描 + 增量维护监听器，延后到布局就绪后注册/执行——避免拖慢
		// 启动；且避免 vault.on("create") 在启动时为每个既存文件重放一遍（obsidian.d.ts 官方说明）。
		// 监听器必须先于初始扫描注册：扫描期间发生的真实变更不能被漏掉（setFile 幂等，重叠无害）。
		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(
				this.app.vault.on("create", (f) => {
					if (f instanceof TFile && f.extension === "md") {
						void this.indexSingleFile(f);
					}
				}),
			);
			this.registerEvent(
				this.app.vault.on("modify", (f) => {
					if (f instanceof TFile && f.extension === "md") {
						void this.indexSingleFile(f);
					}
				}),
			);
			this.registerEvent(
				this.app.vault.on("delete", (f) => {
					this.headingIndex.removeFile(f.path);
				}),
			);
			this.registerEvent(
				this.app.vault.on("rename", (f, oldPath) => {
					if (f instanceof TFile && f.extension === "md") {
						this.headingIndex.renameFile(oldPath, f.path, f.basename);
					} else {
						this.headingIndex.removeFile(oldPath);
					}
				}),
			);
			void this.buildInitialHeadingIndex();
		});
	}

	onunload(): void {
		// 清理所有待处理的防抖计时器，避免向已卸载插件的回调写入。
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.clear();
		this.headingSnapshots.clear();
		this.activeGuardNotice?.notice.hide();
		this.activeGuardNotice = null;
		// M13：标题索引与 VC 词典计时器一并清理，索引内存立即释放。
		for (const timer of this.headingIndexTimers.values()) {
			window.clearTimeout(timer);
		}
		this.headingIndexTimers.clear();
		this.headingIndex.clear();
		if (this.vcDictionaryTimer !== null) {
			window.clearTimeout(this.vcDictionaryTimer);
			this.vcDictionaryTimer = null;
		}
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
	 * 设置「标题链接建议」开关并持久化（M13）：开启且索引尚未构建时立即补建（不必重载插件）；
	 * 关闭时立即清空索引——兑现「关闭即零成本」（索引完全不构建，见 headingindex.ts）。
	 * 与 setAutoNumber 完全同构的「面板开关 ↔ 持久化」模式。
	 */
	async setHeadingLinkSuggestEnabled(enabled: boolean): Promise<void> {
		this.settings.headingLinkSuggestEnabled = enabled;
		await this.saveSettings();
		if (enabled && this.headingIndex.size === 0) {
			void this.buildInitialHeadingIndex();
		} else if (!enabled) {
			this.headingIndex.clear();
			// 同 setVcIntegrationOff：清写盘缓存，下次开启必须重新落盘。
			this.lastVcDictionaryJson = null;
		}
	}

	/** 本插件 VC 词典文件的完整路径（固定位于插件目录下，见 vcintegration.ts）。 */
	vcDictionaryFilePath(): string {
		const pluginDir =
			this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		return vcDictionaryPath(pluginDir);
	}

	/**
	 * 手动配置模式（M13，见方案 §5.10）：生成/刷新词典文件并落盘模式选择。
	 * 不碰 Various Complements 的任何配置文件。
	 */
	async enableVcManualIntegration(): Promise<void> {
		this.settings.vcIntegrationMode = "manual";
		await this.saveSettings();
		await this.writeVcDictionary();
	}

	/**
	 * 自动配置模式（M13，见方案 §5.7/§5.9）：探测 → 写入 VC 配置（分层防御）→ 落盘模式 →
	 * reload 命令调用与兜底。校验失败时**不写入** "auto"，模式保持原值，由设置面板重绘复位。
	 */
	async enableVcAutoIntegration(): Promise<void> {
		const t = this.messages();
		const path = this.vcDictionaryFilePath();
		const result = await enableAutoIntegration(this.app, path);
		if (result.outcome === "ok") {
			this.settings.vcIntegrationMode = "auto";
			await this.saveSettings();
			await this.writeVcDictionary();
			new Notice(t.noticeVcAutoWriteSuccess);
			const reloaded = await tryReloadVcDictionaries(this.app);
			if (!reloaded) {
				// 写入成功但 reload 失败：独立提示，不能与「写入失败」混为一谈。
				new Notice(t.noticeVcReloadFailed);
			}
			return;
		}
		if (result.outcome === "invalid-shape") {
			new Notice(t.noticeVcAutoWriteInvalidShape);
			return; // 设置保持不变（面板下拉由 display() 重绘复位）。
		}
		new Notice(t.noticeVcAutoWriteNotInstalled); // not-installed / disabled-and-no-file
	}

	/**
	 * 切回「不联动」（M13，见方案 §5.10）：停止后续词典文件维护。
	 * **不删除**已生成的词典文件、**不撤销**已写入 VC 的配置（v1 明确不做反向清理——
	 * 「这个值当初是不是我们改的」这类状态追踪复杂度与收益不成比例）。
	 */
	async setVcIntegrationOff(): Promise<void> {
		this.settings.vcIntegrationMode = "off";
		await this.saveSettings();
		if (this.vcDictionaryTimer !== null) {
			window.clearTimeout(this.vcDictionaryTimer);
			this.vcDictionaryTimer = null;
		}
		// 清掉写盘缓存：用户可能在关闭期间手动删除/改动词典文件，下次开启必须重新落盘。
		this.lastVcDictionaryJson = null;
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
		if (rule.template === NO_NUMBERING_TEMPLATE) {
			// 「不编号」伪模板（M12，testplan K15）：该路径明确关闭编号——文件夹级的 frontmatter
			// `false`。伪模板参与具体度解析并可胜出，故能压过更泛的根规则；已有编号冻结不动。
			return null;
		}
		return this.templateStore.get(rule.template) ?? null;
	}

	/**
	 * 某文件解析出的规则是否为「不编号」伪模板（M12，testplan K15）。
	 * 供手动命令区分「路径设为不编号」与「未匹配任何规则」两种无模板情形，给出不误导的提示。
	 */
	private resolvesToNoNumbering(filePath: string | undefined | null): boolean {
		if (!filePath) {
			return false;
		}
		const rule = resolvePathRule(this.settings.pathRules, filePath);
		return rule?.template === NO_NUMBERING_TEMPLATE;
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
		// 已交还所有权（M12「固化编号并交还所有权」）：**硬闸，必须在 frontmatter 判断之前**。
		// `fm:true` 的文件本就绕开全局开关，若让它在此闸之后被检查，固化后一编辑就会在已成
		// 普通文本的编号上再叠一层新前缀 → 双重编号。想恢复接管走设置面板的「恢复接管」。
		if (this.settings.retired) {
			return false;
		}
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
	 * 在指定 document 上挂 copy/cut 出口净化监听（spec.md §2.8 copy/cut 端）。
	 * 主窗口与每个弹出窗口各挂一份；监听在**冒泡阶段**执行——CM6（编辑器路径）在更深的
	 * contentDOM 上已处理完毕，据 `defaultPrevented` 区分两条路径（见 {@link sanitizeClipboardEvent}）。
	 */
	private registerClipboardSanitizer(doc: Document): void {
		const handler = (evt: ClipboardEvent): void => {
			this.sanitizeClipboardEvent(evt, doc);
		};
		this.registerDomEvent(doc, "copy", handler);
		this.registerDomEvent(doc, "cut", handler);
	}

	/**
	 * copy/cut 出口净化（spec.md §2.8）：选区含 WJ 才介入，两条路径——
	 * - **已被接管**（编辑器路径：CM6 已 `setData("text/plain")` + `preventDefault()`，剪切的
	 *   选区删除也已完成）：净化覆写 `text/plain`（已写入的 `text/html` 一并剥 WJ），并把
	 *   `规范化(净化文本) → 原文` 记入内存 LRU 供粘贴回还原。不改 `defaultPrevented`、不删其他
	 *   格式，对 CM6 与其他插件最小侵入。
	 * - **未被接管**（阅读模式等原生默认复制）：按 DOM 选区自构造净化 payload（`text/plain` +
	 *   保留富文本的 `text/html`）后 `preventDefault()`。**此路不记 LRU**：渲染文本不含 `##`
	 *   标记，粘贴回编辑器构不成标题行，无 O9 风险。
	 * 降级默认值：任一步缺失 / 抛错一律不介入，剪贴板维持现状（等于本功能不存在）。
	 */
	private sanitizeClipboardEvent(evt: ClipboardEvent, doc: Document): void {
		const data = evt.clipboardData;
		if (!data) {
			return;
		}
		try {
			if (evt.defaultPrevented) {
				const original = data.getData("text/plain");
				if (!original.includes(WORD_JOINER)) {
					return;
				}
				const html = data.getData("text/html");
				data.setData("text/plain", this.clipboardCache.record(original));
				if (html.includes(WORD_JOINER)) {
					data.setData("text/html", stripWordJoinersFromHtml(html));
				}
				return;
			}
			const selection = doc.defaultView?.getSelection() ?? null;
			const text = selection ? selection.toString() : "";
			if (!selection || !text.includes(WORD_JOINER)) {
				return;
			}
			const html = renderSelectionHtml(doc, selection);
			data.setData("text/plain", stripWordJoiners(text));
			if (html) {
				data.setData("text/html", stripWordJoinersFromHtml(html));
			}
			evt.preventDefault();
		} catch {
			/* 任一步失败：不介入、维持现状（spec §2.8 降级默认值）。 */
		}
	}

	/**
	 * paste 端回程还原（spec.md §2.8）：全部判断**同步**完成，任一守卫不过即放行原生粘贴管线
	 * （零影响）——依次：他人已 `preventDefault` / 无文本 / LRU 未命中（外部内容或改动过、过期，
	 * 当新内容处理）/ 目标文件编号未生效（全局关、frontmatter `false`、无模板命中——此时没有
	 * 编号引擎兜底，还原反而把 WJ 重新引入用户声明「别碰」的文件；引擎不跑也不存在双重编号）/
	 * 多光标（原生多光标粘贴有按行分配语义，不模仿）。全过 → 接管并整段插入原文：WJ 完好、
	 * 编号仍是「被认领」状态，后续防抖重编正常改写序号，不产生 O9 双重编号。
	 */
	private restoreSanitizedPaste(
		evt: ClipboardEvent,
		editor: Editor,
		info: MarkdownView | MarkdownFileInfo,
	): void {
		if (evt.defaultPrevented) {
			return;
		}
		try {
			const text = evt.clipboardData?.getData("text/plain") ?? "";
			if (!text) {
				return;
			}
			const original = this.clipboardCache.lookup(text);
			if (original === null) {
				return;
			}
			if (
				!info.file ||
				!this.shouldAutoTrigger(editor.getValue()) ||
				!this.getTemplateForFile(info.file.path)
			) {
				return;
			}
			if (editor.listSelections().length > 1) {
				return;
			}
			evt.preventDefault();
			editor.replaceSelection(original);
		} catch {
			/* 任一步失败：放行原生粘贴管线（spec §2.8 降级默认值）。 */
		}
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
	 * M13：初始全量扫描。**必须走 HeadingIndex.loadInitial**（一次排序），不能循环调用 setFile
	 * （O((N·H)²) 退化，见 headingindex.ts）。按批让出主线程，避免大 vault 长时间阻塞 UI；
	 * 单文件读取失败静默跳过，不阻断整体扫描。
	 */
	private async buildInitialHeadingIndex(): Promise<void> {
		if (!this.settings.headingLinkSuggestEnabled) {
			return;
		}
		const files = this.app.vault.getMarkdownFiles(); // 既有先例：main.ts 批量重编号同款取法
		const batch: Array<{ path: string; basename: string; content: string }> = [];
		for (let i = 0; i < files.length; i++) {
			const f = files[i];
			try {
				batch.push({
					path: f.path,
					basename: f.basename,
					content: await this.app.vault.cachedRead(f),
				});
			} catch {
				/* 单文件读取失败：跳过，不阻断整体扫描 */
			}
			if ((i + 1) % INITIAL_SCAN_BATCH_SIZE === 0) {
				await new Promise((resolve) => window.setTimeout(resolve, 0)); // 让出主线程
			}
		}
		this.headingIndex.loadInitial(batch);
		if (this.headingIndex.isTruncated) {
			// 一次性告知，不做静默丢弃：默认开启的功能在超大 vault 下部分失效却不提示，
			// 用户会把它当 bug 报告。
			new Notice(this.messages().noticeHeadingIndexTruncated(this.headingIndex.size));
		}
	}

	/** M13：单文件增量索引（新建/修改后调用）。读取失败静默忽略，下次 modify 事件会重试。 */
	private async indexSingleFile(f: TFile): Promise<void> {
		if (!this.settings.headingLinkSuggestEnabled) {
			return;
		}
		try {
			this.headingIndex.setFile(f.path, f.basename, await this.app.vault.cachedRead(f));
		} catch {
			/* 忽略：下次 modify 事件会重试 */
		}
		this.scheduleVcDictionaryWrite();
	}

	/**
	 * M13：与 scheduleRenumber 同构的按文件去抖，独立维护——覆盖「编辑器已改但尚未落盘」的
	 * 新鲜度窗口（vault.on("modify") 只在落盘后才触发）：用户刚打完一个新标题，几秒内就能搜到。
	 */
	private scheduleHeadingIndexUpdate(
		editor: Editor,
		info: MarkdownView | MarkdownFileInfo,
	): void {
		const file = info.file;
		if (!file || !this.settings.headingLinkSuggestEnabled) {
			return;
		}
		const path = file.path;
		const existing = this.headingIndexTimers.get(path);
		if (existing !== undefined) {
			window.clearTimeout(existing);
		}
		const timer = window.setTimeout(() => {
			this.headingIndexTimers.delete(path);
			if (info.file?.path !== path) {
				return; // 与 scheduleRenumber 同一条 J15 教训：该叶子已切到别的文件，本轮作废
			}
			this.headingIndex.setFile(path, file.basename ?? linkBasename(path), editor.getValue());
			this.scheduleVcDictionaryWrite();
		}, this.settings.debounceDelay); // 复用已有防抖延迟设置，不新增设置项
		this.headingIndexTimers.set(path, timer);
	}

	/**
	 * M13：VC 词典重写（全局 3000ms 节流，见 vcintegration.ts §5.8）——重写一个可能几千条目的
	 * JSON 文件比更新内存索引昂贵得多，没必要跟着每次小改动都写盘。「不联动」时完全不生成/维护。
	 */
	private scheduleVcDictionaryWrite(): void {
		if (this.settings.vcIntegrationMode === "off" || !this.settings.headingLinkSuggestEnabled) {
			return;
		}
		if (this.vcDictionaryTimer !== null) {
			window.clearTimeout(this.vcDictionaryTimer);
		}
		this.vcDictionaryTimer = window.setTimeout(() => {
			this.vcDictionaryTimer = null;
			void this.writeVcDictionary();
		}, VC_DICTIONARY_THROTTLE_MS);
	}

	/**
	 * M13：把当前索引全量写成 VC 词典 JSON（手动/自动模式共用）。
	 *
	 * **内容未变不写盘**（1.0.27 轻量改进）：词典在 .obsidian 内、随 iCloud 等同步整个 vault，
	 * 每次全量重写都会触发整文件重新上传——内存缓存上次写出的字符串，相同则跳过
	 * `adapter.write`（标题无变化时同步零流量）。写失败静默，下次索引变更会重试。
	 */
	private async writeVcDictionary(): Promise<void> {
		const { json, truncated, total } = buildVcDictionaryJson(this.headingIndex.allEntries());
		if (json === this.lastVcDictionaryJson) {
			return; // 内容未变：不写盘（避免 iCloud/同步无谓上传）
		}
		this.lastVcDictionaryJson = json;
		try {
			await this.app.vault.adapter.write(this.vcDictionaryFilePath(), json);
		} catch {
			/* 写入失败静默忽略：下一次索引变更会重试 */
		}
		if (truncated && !this.vcTruncationNoticed) {
			// 词典条数上限（20,000）截断：一次性告知，不做静默丢弃。
			this.vcTruncationNoticed = true;
			new Notice(this.messages().noticeVcDictionaryTruncated(total));
		}
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
	 *
	 * **迁移守卫提示的收起时机**（testplan J13）：函数最前面**无条件**收起「不是本次打开这个
	 * 文件」的守卫提示——不管后面几步是否提前 return（全局开关关 / 无模板等），用户已经切到别的
	 * 文件这件事本身就该让上一条提示消失，否则屏幕上会留一条指向另一篇笔记的孤儿提示，被读成
	 * 在说眼前这篇（1.0.19 真机反馈的症状之一）。
	 *
	 * ★ **判断依据是「这个文件的内容」，不是「编辑器缓冲区里的内容」**（1.0.21，第四轮真机反馈
	 * 才定位对，testplan J15）：`file-open` 触发时 Obsidian 已把 `view.file` 换成新文件，**但
	 * 编辑器里显示的还是上一篇**，而且实测**滞后不止一个事件循环**——1.0.20 试过推迟一个宏任务
	 * 再读，仍然拿到上一篇的内容。用户复现得很干净：a、b 正常，C 含外来编号，`a → C` 不弹
	 * （读到的是 a 的干净内容）、`C → b` 反而弹且没什么可清理（读到的是 C 的脏内容、却把提示挂在
	 * b 上）——**编辑器内容正好落后一个文件**。
	 *
	 * 故不再读编辑器，改用 `vault.cachedRead(file)`：它按 `TFile` 取该文件自己的内容，与编辑器
	 * 换没换到位**完全无关**，是时序无关的判据。这也正是用户提的诉求——「只检测当前打开的
	 * 文件，然后立马弹出提示」。
	 *
	 * **写入侧（真的重排）另外把关**：`applyRenumber` 必须通过编辑器写，所以只有在编辑器确实
	 * 已经显示这个文件、且其内容与刚读到的文件内容**一致**时才动手；不一致说明编辑器尚未换到位
	 * （或有未落盘改动），本轮跳过写入——**宁可这一轮不重排，也不能把 A 的编号写进 B**
	 * （1.0.20 记录的那个潜在数据损坏，这里才真正堵死）。用户随后的第一次编辑会经防抖路径补上。
	 */
	private renumberOnOpen(file: TFile): void {
		this.dismissGuardNoticeUnlessFor(file.path);
		void this.app.vault
			.cachedRead(file)
			.then((content) => {
				this.renumberOnOpenSettled(file, content);
			})
			.catch(() => {
				/* 读取失败：本轮不判断也不写入，交给后续编辑触发的防抖路径。 */
			});
	}

	/**
	 * {@link renumberOnOpen} 读到**该文件自己的内容**之后的实际动作。
	 *
	 * @param content `vault.cachedRead(file)` 的结果——权威、与编辑器换没换到位无关。
	 */
	private renumberOnOpenSettled(file: TFile, content: string): void {
		// 异步读盘期间用户可能又切走了：以「当前活动文件」为准，不是本次打开的这个就整轮作废。
		if (this.app.workspace.getActiveFile?.()?.path !== file.path) {
			return;
		}
		if (!this.shouldAutoTrigger(content)) {
			return;
		}
		const template = this.getTemplateForFile(file.path);
		if (!template) {
			return;
		}
		// 守卫与提示都基于文件自身内容——这一步不碰编辑器，故不受换页时序影响。
		if (this.guardForeignNumbering(file.path, content)) {
			return;
		}
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || view.file?.path !== file.path) {
			return; // 活动视图与本次打开的文件不一致（如后台/快速切换）时不强行处理。
		}
		const editor = view.editor;
		if (!editor || editor.getValue() !== content) {
			return; // 编辑器尚未换到位 / 有未落盘改动：本轮只判断不写入（见上方 JSDoc）。
		}
		this.applyRenumber(editor, template, view.file);
	}

	/**
	 * 迁移守卫（**仅自动路径**，testplan J10/J13/J14，见 spec.md §3.10 相邻讨论）：若本文件疑似含
	 * 外来编号且插件从未接触过它（{@link hasUnclaimedForeignNumbering}），跳过本次自动写入并提示
	 * 用户——否则会在外来编号前叠加本插件自己的编号（`## 1 红米` → `## 1 1 红米`），观感上与 bug
	 * 无异。**手动命令**（立即重新编号 / 清除编号 / 清理外来编号）不查此函数，绕过一切开关照常
	 * 执行，与既有「Renumber now 绕过一切开关」原则一致。
	 *
	 * **提示的可见性由 {@link showForeignNumberingGuardNotice} 统一裁决**（只为当前活动文件弹、
	 * 同一文件至多一条）——本函数每次命中都调用它，不在这里做「上次是不是同一个文件」之类的
	 * 推断：那种推断依赖调用方是谁（`file-open` / 防抖 / 批量刷新），而调用方恰恰不保证对应
	 * 用户眼前那篇。
	 *
	 * 内容已不再命中（用户自己清理干净、或跑过清理命令）时**主动收起**该文件那条提示，避免留下
	 * 一条已经不成立的告警。
	 *
	 * Notice 可点击（{@link showForeignNumberingGuardNotice}）：打开预览确认框逐条列出「现状 →
	 * 清理后」对照（J14）——清理命令与本守卫共享同一误伤面（如 `## API 设计`），无预览的一键执行
	 * 等于吃用户内容，不能做。
	 *
	 * @returns 是否命中守卫（命中即调用方应跳过本次 {@link applyRenumber}）。
	 */
	private guardForeignNumbering(path: string, content: string): boolean {
		if (!hasUnclaimedForeignNumbering(content)) {
			this.dismissGuardNotice(path);
			return false;
		}
		this.showForeignNumberingGuardNotice(path);
		return true;
	}

	/** 收起指定文件的守卫提示（若屏幕上那条正是它）。 */
	private dismissGuardNotice(path: string): void {
		if (this.activeGuardNotice?.path === path) {
			this.activeGuardNotice.notice.hide();
			this.activeGuardNotice = null;
		}
	}

	/** 收起守卫提示，除非它说的正是 `path`（用户切到别的文件时用）。 */
	private dismissGuardNoticeUnlessFor(path: string): void {
		if (this.activeGuardNotice && this.activeGuardNotice.path !== path) {
			this.activeGuardNotice.notice.hide();
			this.activeGuardNotice = null;
		}
	}

	/**
	 * 迁移守卫命中时弹出的可点击 Notice（testplan J14）：正文之外附一段可点击文字，点击后打开
	 * {@link openForeignNumberingCleanupModal} 的清理预览确认框。
	 *
	 * 用 `createFragment` 构造消息体——`Notice` 的 `message` 参数原生支持 `DocumentFragment`
	 * （Obsidian 官方 API），无需依赖 `noticeEl` 内部结构拼按钮。`duration` 传 0（不自动消失，
	 * 停留到用户点击或手动关闭）：默认几秒钟的自动消失时间不够用户看清并点击。
	 *
	 * `createFragment` 是 Obsidian 运行时注入的**全局函数**（`obsidian.d.ts` 声明在
	 * `declare global` 里，不是模块具名导出），故不出现在文件顶部的 `from "obsidian"` 导入列表——
	 * 与 `createEl`/`createDiv`/`createSpan` 同类，直接按全局标识符调用。`tests/dev_tests/obsidian-mock.ts`
	 * 在加载时把同名替身挂到 `globalThis`，供单测环境（无真实 Obsidian/DOM 运行时）下使用。
	 */
	private showForeignNumberingGuardNotice(path: string): void {
		// ① 只为用户当前正看着的文件发声（见 activeGuardNotice 注释）：防抖计时器可能在用户已经
		//    切走之后才到期，批量刷新更是遍历全部叶子——为看不见的文件弹提示，用户只会把它读成
		//    在说眼前这篇，点进去又发现「没什么可清理」（1.0.19 真机反馈的正是这条链路）。
		if (this.app.workspace.getActiveFile?.()?.path !== path) {
			return;
		}
		// ② 同一文件已有一条在屏幕上：不重建。Notice 是 duration:0 不自动消失的，用户在这个文件里
		//    持续打字会让防抖反复到期，每次都重建会闪烁、且把用户正要点的那条抽掉。
		if (this.activeGuardNotice?.path === path) {
			return;
		}
		this.activeGuardNotice?.notice.hide();

		const t = this.messages();
		let link!: HTMLAnchorElement;
		const frag = createFragment((el) => {
			el.appendText(`${t.noticeForeignNumberingGuard} `);
			link = el.createEl("a", {
				text: t.noticeForeignNumberingGuardAction,
				href: "#",
				cls: "ah-foreign-guard-link",
			});
		});
		const notice = new Notice(frag, 0);
		link.addEventListener("click", (evt) => {
			evt.preventDefault();
			this.dismissGuardNotice(path);
			this.openForeignNumberingCleanupModal(path);
		});
		this.activeGuardNotice = { path, notice };
	}

	/**
	 * 打开「疑似外来编号」清理预览确认框（testplan J14，迁移守卫 Notice 的点击入口）：按 `path`
	 * 在当前打开的 Markdown 叶子里重新定位实时编辑器与内容——不复用告警那一刻捕获的引用，因为
	 * Notice 常驻到用户点击（{@link showForeignNumberingGuardNotice} 的 `duration: 0`），期间内容
	 * 可能已变化，该叶子也可能已切换到别的文件。找不到（文件已不在任何标签页）则提示改为重新打开。
	 *
	 * 确认框逐条可勾选（testplan J17）：预览与「确认清理」执行复用同一份计算
	 * （{@link computeForeignCleanupPreview}），保证「用户看到的」与「实际发生的」逐条一致。
	 */
	private openForeignNumberingCleanupModal(path: string): void {
		const found = this.markdownContextForPath(path);
		if (!found) {
			new Notice(this.messages().noticeForeignGuardFileNotOpen);
			return;
		}
		const { editor, ctx } = found;
		const content = editor.getValue();
		const candidates = previewForeignNumberingCleanup(content);
		if (candidates.length === 0) {
			// 告警之后、点击之前用户已自行清理或改动内容，已无可清理项。
			new Notice(this.messages().noticeNoForeign);
			return;
		}
		new ForeignNumberingCleanupModal(
			this.app,
			this.messages(),
			candidates.map((c) => ({ lineIndex: c.lineIndex, before: c.before })),
			(keepLines) => this.computeForeignCleanupPreview(content, path, keepLines)?.items ?? [],
			(keepLines) => this.applyForeignCleanupSelection(editor, ctx, path, keepLines),
		).open();
	}

	/**
	 * 计算「清理外来编号」确认框在给定勾选状态下的完整结果（testplan J17）：勾选（默认）的标题
	 * 剥掉外来编号后套用当前模板全新编号；取消勾选的保留原文，模板编号仍会照常叠加在前面（WJ +
	 * 前缀，观感为双重编号，与插件对"未接管标题"的既有语义一致，见 {@link hasUnclaimedForeignNumbering}
	 * 相邻讨论）。
	 *
	 * 确认框每次勾选变化、以及点击"确认清理"执行时都调用本函数——**同一份计算**，不会出现预览说
	 * 改 A、实际却改了 B 的落差。之所以要整份重算而不是零散拼接两种预先算好的文本，是因为白名单
	 * `subtree` 匹配依据标题文本判豁免：某条外来编号是否被清理会改变它自身乃至子孙标题是否被套用
	 * 编号，静态缓存两个变体没法正确反映这种联动。
	 *
	 * @returns 模板未命中（理论不可达——能打开确认框说明当时已经命中过模板）时返回 `null`。
	 */
	private computeForeignCleanupPreview(
		content: string,
		path: string,
		keepLines: ReadonlySet<number>,
	): { items: ForeignNumberingPreviewItem[]; finalContent: string } | null {
		const template = this.getTemplateForFile(path);
		if (!template) {
			return null;
		}
		const stripped = clearForeignNumberingContent(content, { keepLines });
		const { prefixes, suffixes } = this.strippableAffixes();
		const finalContent = renumberContent(stripped, template, {
			strippablePrefixes: prefixes,
			strippableSuffixes: suffixes,
		});
		const finalLines = finalContent.split("\n");
		const items = previewForeignNumberingCleanup(content).map((c) => ({
			lineIndex: c.lineIndex,
			before: c.before,
			after: finalLines[c.lineIndex],
		}));
		return { items, finalContent };
	}

	/**
	 * 「清除当前文件编号」命令（**手动路径**，见 spec.md §3.10）：剥离当前文件所有标题的编号
	 * 前缀（全样式并集剥离器，独立于模板），以单一事务写回。绕过防抖与开关（与「立即重新编号」对称）。
	 *
	 * **1.0.15 起顺带暂停该文件**（spec.md §3.19，testplan H13）：此前本命令只取消当前那一个待处理
	 * 防抖计时器，下一次按键即重新 `scheduleRenumber` 把编号编回去——只要「全局自动编号」开着，
	 * 它**永远不可能产生持久效果**。故当该文件仍会被自动重编号时，把 frontmatter
	 * `obsidian-auto-headings: false` **并进同一事务**（一次撤销整体回退）。反之（全局关且非
	 * `fm:true`、或路径规则解析为「不编号」）不写——不为一个不存在的问题往用户文件里塞属性。
	 * 恢复走「立即重新编号」（{@link runImmediateRenumber}）。
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

		// 仅当该文件**确实**会被自动重编号时才暂停：门控与自动路径完全一致（够格触发 + 命中模板）。
		const pause =
			this.shouldAutoTrigger(newContent) && this.getTemplateForFile(path)
				? planPauseFileSwitch(newContent)
				: null;
		const extra = pause ? [this.switchEditToChange(oldContent, pause)] : [];

		if (this.writeLineDiff(editor, oldContent, newContent, extra)) {
			// Backlink 同步：清除编号也改写了标题文本（去掉前缀），更新别处指向它的内部链接。
			// 传 newContent 而非编辑器现值：frontmatter 那几行不含标题，对快照（仅 level+text）无影响。
			this.syncAndSnapshot(ctx.file, newContent, fold.renames, fold.selfCount);
		}
		const m = this.messages();
		new Notice(pause ? m.noticeClearedAndPaused : m.noticeCleared);
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

		if (this.writeLineDiff(editor, oldContent, newContent)) {
			// Backlink 同步：清理外来编号也改写了标题文本，更新别处指向它的内部链接。
			this.syncAndSnapshot(ctx.file, newContent, fold.renames, fold.selfCount);
		}
		new Notice(this.messages().noticeForeignCleared);
	}

	/**
	 * 「清理外来编号」确认框点击「确认清理」后的执行路径（testplan J17，逐条勾选驱动，见
	 * {@link ForeignNumberingCleanupModal}）：勾选的标题剥掉外来编号、取消勾选的原样保留原文——
	 * 两者随后都在**同一次点击、同一事务**里立即套用当前模板编号（{@link computeForeignCleanupPreview}），
	 * 不必等下一次防抖触发。
	 *
	 * 与既有全量命令 {@link runClearForeignNumbering} 是两条独立路径，互不影响：后者只剥离、不立即
	 * 套模板（留给下一次防抖自动补上），本方法是确认框专属的"立即生效"语义——写入后全文必含至少
	 * 一个 WJ，迁移守卫此后不会再对本文件命中（见 {@link hasUnclaimedForeignNumbering} 判定条件①），
	 * 不存在"取消勾选的几条下一轮又被拦一次"的问题。
	 */
	private applyForeignCleanupSelection(
		editor: Editor,
		ctx: MarkdownView | MarkdownFileInfo,
		path: string,
		keepLines: ReadonlySet<number>,
	): void {
		const existing = this.debounceTimers.get(path);
		if (existing !== undefined) {
			window.clearTimeout(existing);
			this.debounceTimers.delete(path);
		}

		const oldContent = editor.getValue();
		const preview = this.computeForeignCleanupPreview(oldContent, path, keepLines);
		if (!preview) {
			return; // 理论不可达：能打开确认框说明当时已经命中过模板。
		}
		let newContent = preview.finalContent;
		if (newContent === oldContent) {
			new Notice(this.messages().noticeNoForeign);
			return;
		}

		const fold = this.foldSelfBacklinks(ctx.file, oldContent, newContent);
		newContent = fold.content;

		if (this.writeLineDiff(editor, oldContent, newContent)) {
			this.syncAndSnapshot(ctx.file, newContent, fold.renames, fold.selfCount);
		}
		const cleanedCount = preview.items.filter((i) => !keepLines.has(i.lineIndex)).length;
		const keptCount = preview.items.length - cleanedCount;
		new Notice(this.messages().noticeForeignCleanupApplied(cleanedCount, keptCount));
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
	 * 「固化编号并交还所有权（全库）」（M12，见 spec.md §3.18，testplan H9–H12）。
	 * 由 SettingsTab 的 FreezeVaultModal 在二次确认后调用。
	 *
	 * 与 {@link clearAllVaultNumbering} 相反：**编号原样留下**（成为普通文本），只把插件的
	 * 所有权标记全部移除，并让插件停止接管。给「我喜欢现在的编号，但不想再被插件管着」
	 * 以及「准备卸载但要留住编号成果」的用户一条干净的离场路。
	 *
	 * **为什么是全文级剥离而不是只处理标题行**：`backlinks.ts` 的 `displayAnchor` 刻意把 WJ
	 * 写进 `[[file#⁠1 ⁠标题]]`（Obsidian 锚点解析按字节比对、不剥 WJ）。只剥标题行会让链接侧
	 * 仍带 WJ、与标题字节对不上，**全库内链集体断链**。两侧同步归零链接才继续可解析。
	 *
	 * **不可逆（对插件而言）**：按标记契约「无 WJ ⇒ 插件从未碰过」，固化之后插件自己也再认不出
	 * 那些编号是它写的。想恢复接管需先跑「清理非本插件的标题编号」——这条路由既有的
	 * {@link guardForeignNumbering} 兜着，不必新建机制。
	 *
	 * **不在 Obsidian 编辑历史内（vault.modify 无撤销），确认框已提示建议备份。**
	 */
	async freezeVaultNumbering(): Promise<void> {
		// 先落盘「已离场」再动文件：中途异常也不会留下「标记已剥、插件却还在编号」的坏状态
		// （那会立刻把普通文本编号叠成双重编号）。
		this.settings.retired = true;
		await this.saveSettings();
		this.settingTab?.display();

		this.vaultClearInProgress = true;
		for (const timer of this.debounceTimers.values()) {
			window.clearTimeout(timer);
		}
		this.debounceTimers.clear();
		try {
			const files = this.app.vault.getMarkdownFiles();
			let count = 0;
			for (const file of files) {
				const content = await this.app.vault.read(file);
				const frozen = stripWordJoiners(content);
				if (frozen !== content) {
					await this.app.vault.modify(file, frozen);
					count++;
				}
			}
			// 快照直接清空：插件已离场，改名表基线不再有意义（与清库的「刷新」不同）。
			this.headingSnapshots.clear();
			new Notice(this.messages().noticeFrozenVault(count));
		} finally {
			this.vaultClearInProgress = false;
		}
	}

	/** 恢复接管（撤销「已离场」状态）：只翻开关，不回写任何文件——编号已是普通文本，收不回来了。 */
	async resumeFromRetired(): Promise<void> {
		this.settings.retired = false;
		await this.saveSettings();
		this.settingTab?.display();
		new Notice(this.messages().noticeResumed);
	}

	/** 某条路径规则**按路径模式**命中的全部 Markdown 文件（批量重编号的作用域，M12/K16）。 */
	matchedMarkdownFiles(rule: PathRule): TFile[] {
		return this.app.vault.getMarkdownFiles().filter((f) => ruleMatches(rule.pattern, f.path));
	}

	/**
	 * 批量重编号（M12，testplan K16）：对 `rule` 路径模式命中的全部 Markdown 文件重编号，
	 * 由路径规则表格的行内按钮经确认对话框调用（见 `PathRules.ts`）。
	 *
	 * - **每个文件用它自己解析出的模板**（{@link getTemplateForFile}，与自动路径一致）——点根规则
	 *   的批量按钮不会把根模板强加给已被更具体子规则接管的文件；解析为「不编号」/无模板者跳过。
	 * - 跳过 frontmatter `false` 与含未接管外来编号的文件（{@link guardForeignNumbering} 同源判据）：
	 *   批量是一次作用于大量文件的操作，尊重文件级显式关闭与迁移守卫，不同于单文件手动命令的
	 *   「绕过一切开关」。
	 * - 已打开的文件走编辑器单一事务（可撤销，且避免 `vault.process` 读到未落盘编辑器内容的竞态，
	 *   见 {@link foldSelfBacklinks} 的根因说明）；未打开的走 `vault.process`（无撤销，确认框已提示）。
	 * - Backlink 同步照常（同文件内链折进主写回、跨文件改写），改写总数**汇总为一条** Notice
	 *   （{@link syncBacklinksCounted}），避免一次批量弹出几十条「已更新链接」。
	 */
	async batchRenumberRule(rule: PathRule): Promise<void> {
		const m = this.messages();
		const files = this.matchedMarkdownFiles(rule);
		if (files.length === 0) {
			new Notice(m.noticeBatchNoMatch);
			return;
		}
		// path → editor 映射：已打开的文件走编辑器通道。
		const editors = new Map<string, Editor>();
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view as unknown as {
				editor?: Editor;
				file?: { path: string } | null;
			};
			if (view.editor && view.file?.path) {
				editors.set(view.file.path, view.editor);
			}
		}
		let changed = 0;
		let unchanged = 0;
		let skipped = 0;
		let links = 0;
		for (const file of files) {
			const template = this.getTemplateForFile(file.path);
			if (!template) {
				skipped++; // 解析为「不编号」伪模板，或无可用模板（如更具体规则引用已失效模板）。
				continue;
			}
			const editor = editors.get(file.path);
			const result = editor
				? await this.batchRenumberViaEditor(editor, file, template)
				: await this.batchRenumberViaVault(file, template);
			if (result.outcome === "skipped") {
				skipped++;
			} else if (result.outcome === "changed") {
				changed++;
			} else {
				unchanged++;
			}
			links += result.links;
		}
		new Notice(m.noticeBatchDone(changed, unchanged, skipped));
		await this.notifyBacklinkTotal(links);
	}

	/** 已打开文件的批量重编号通道：与 {@link applyRenumber} 同构，但 backlink Notice 交批量端汇总。 */
	private async batchRenumberViaEditor(
		editor: Editor,
		file: LinkTarget,
		template: Template,
	): Promise<{ outcome: "changed" | "unchanged" | "skipped"; links: number }> {
		const oldContent = editor.getValue();
		if (readFileSwitch(oldContent) === false || hasUnclaimedForeignNumbering(oldContent)) {
			return { outcome: "skipped", links: 0 };
		}
		const { prefixes, suffixes } = this.strippableAffixes();
		const fold = this.foldSelfBacklinks(
			file,
			oldContent,
			renumberContent(oldContent, template, {
				strippablePrefixes: prefixes,
				strippableSuffixes: suffixes,
			}),
		);
		const wrote = this.writeLineDiff(editor, oldContent, fold.content);
		this.headingSnapshots.set(file.path, snapshotHeadings(fold.content));
		const links = await this.syncBacklinksCounted(file, fold.renames, fold.selfCount);
		return { outcome: wrote ? "changed" : "unchanged", links };
	}

	/** 未打开文件的批量重编号通道：`vault.process` 原子读改写（守卫命中时原样返回、不写入）。 */
	private async batchRenumberViaVault(
		file: TFile,
		template: Template,
	): Promise<{ outcome: "changed" | "unchanged" | "skipped"; links: number }> {
		// 结果经对象属性带出闭包（TS 的流分析不追踪闭包内赋值，直接用局部 let 会误判比较恒假）。
		const box: {
			outcome: "changed" | "unchanged" | "skipped";
			renames: HeadingRename[];
			selfCount: number;
			content: string;
		} = { outcome: "unchanged", renames: [], selfCount: 0, content: "" };
		await this.app.vault.process(file, (content) => {
			if (readFileSwitch(content) === false || hasUnclaimedForeignNumbering(content)) {
				box.outcome = "skipped";
				return content;
			}
			const { prefixes, suffixes } = this.strippableAffixes();
			const fold = this.foldSelfBacklinks(
				file,
				content,
				renumberContent(content, template, {
					strippablePrefixes: prefixes,
					strippableSuffixes: suffixes,
				}),
			);
			box.renames = fold.renames;
			box.selfCount = fold.selfCount;
			box.content = fold.content;
			box.outcome = fold.content === content ? "unchanged" : "changed";
			return fold.content;
		});
		if (box.outcome === "skipped") {
			return { outcome: "skipped", links: 0 };
		}
		this.headingSnapshots.set(file.path, snapshotHeadings(box.content));
		const links = await this.syncBacklinksCounted(file, box.renames, box.selfCount);
		return { outcome: box.outcome, links };
	}

	/**
	 * 取「当前活动 Markdown 文件」的编辑器与上下文，供设置面板**敏感操作 TAB** 的两个单文件清除
	 * 入口使用。设置面板是模态层，`getActiveViewOfType(MarkdownView)` 可能返回 `null`（N1 同源），
	 * 故回退到「按 `getActiveFile()` 在打开的 markdown 叶子里找同路径视图」（{@link markdownContextForPath}）。
	 * 找不到返回 `null`。
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
		return this.markdownContextForPath(active.path);
	}

	/**
	 * 在当前打开的全部 Markdown 叶子中按**路径**（而非「当前活动文件」）查找编辑器与上下文
	 * （testplan J14，供迁移守卫 Notice 点击时重新定位实时内容）。与 {@link activeMarkdownContext}
	 * 的区别：后者只关心「活动」文件，本函数不要求该文件处于活动标签页，只要它在任意已打开的
	 * 叶子里即可命中——Notice 常驻到用户点击，点击时活动标签页很可能已经切换到别的文件。
	 */
	private markdownContextForPath(path: string): { editor: Editor; ctx: MarkdownFileInfo } | null {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view as unknown as MarkdownFileInfo & { editor?: Editor };
			if (view.editor && view.file?.path === path) {
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
		// M13：新字段缺省兜底——标题链接建议默认开（默认能力）；VC 联动默认不联动
		// （不能因为基础功能默认开就顺带默认开联动，需用户在设置面板显式选择）。
		if (typeof merged.headingLinkSuggestEnabled !== "boolean") {
			merged.headingLinkSuggestEnabled = true;
		}
		if (merged.vcIntegrationMode !== "manual" && merged.vcIntegrationMode !== "auto") {
			merged.vcIntegrationMode = "off";
		}
		// 迁移：历史独立开关 `backlinkStandaloneTrigger`（0.7.8–1.0.8，CR-18）已并入 `updateBacklinks`
		// （1.0.9 起单开关全局生效，与是否命中编号模板无关）；旧字段不再读取，随迁移一并清理。
		delete merged.backlinkStandaloneTrigger;
		// 迁移：历史开关 `sanitizeClipboard`（1.0.10–1.0.15）自 1.0.16 移除——净化是插件的固有承诺
		// 而非可选项（spec §2.8「无开关」）。旧值一律不再读取：曾显式关掉的用户升级后同样恒净化，
		// 键随迁移删除，下次 saveSettings 即从 data.json 消失。
		delete merged.sanitizeClipboard;
		this.settings = merged as unknown as AutoHeadingsSettings;
		this.settings.debounceDelay = clampDebounceDelay(this.settings.debounceDelay);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * 实时编辑触发（**自动路径**）：常规编号路径（{@link shouldAutoTrigger} + 模板命中）或
	 * Backlink 独立触发路径（{@link shouldBacklinkStandaloneTrigger}，CR-18）**至少一条**够格
	 * 才安排该文件的防抖计时器；到期后再次校验资格，优先走常规编号路径（含其内置的 backlink
	 * 同步），本轮未处理（无模板命中 / 不够格自动触发编号）时才尝试独立触发——避免同一次改动被
	 * 处理两遍。计时器以文件路径为单位互相独立。
	 */
	private scheduleRenumber(editor: Editor, info: MarkdownView | MarkdownFileInfo): void {
		const file = info.file;
		if (!file) {
			return;
		}
		const content = editor.getValue();
		if (!this.shouldAutoTrigger(content) && !this.shouldBacklinkStandaloneTrigger()) {
			return; // 两条路径都不够格：不安排任何更新。
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
			// 该叶子在这 300ms 内已切到别的文件（同一个 MarkdownView / Editor 实例会被复用来
			// 显示新文件）：本轮整个作废（1.0.20，testplan J15）。否则会拿新文件的内容去跑
			// 「安排这轮时那个文件」的逻辑——轻则为看不见的文件弹提示，重则把编号写错文件。
			if (info.file?.path !== path) {
				return;
			}
			// 计时器到期时再次校验（其间用户可能改了开关或 frontmatter）。
			const value = editor.getValue();
			if (this.shouldAutoTrigger(value)) {
				const template = this.getTemplateForFile(path);
				if (template) {
					if (!this.guardForeignNumbering(path, value)) {
						// 自动路径**才**保护光标所在行（J11）：手动命令与打开/改模板即时重排都要整文
						// 重排，否则「立即重新编号」会漏掉光标那一行、打开文件时首行标题永远编不上。
						this.applyRenumber(editor, template, file, {
							protectLine: editor.getCursor?.()?.line,
						});
					}
					return; // 常规路径本轮已处理（或命中外来编号守卫暂缓）：不再尝试独立触发。
				}
			}
			// 常规编号路径本轮未处理（无可用模板 / 不够格自动触发编号）：尝试 Backlink 独立触发
			// （CR-18，见 spec.md §3.12）——只同步链接，从不写入编号前缀。
			if (this.shouldBacklinkStandaloneTrigger()) {
				this.applyBacklinkStandaloneSync(editor, file);
			}
		}, this.settings.debounceDelay);

		this.debounceTimers.set(path, timer);
	}

	/**
	 * Backlink 独立触发是否应进行（CR-18，见 spec.md §3.12「独立于编号模板的触发」）：**不**要求
	 * {@link getTemplateForFile} 命中——即便文件无可用模板、或全局自动编号关闭且该文件未 frontmatter
	 * 强制开启，只要 `updateBacklinks` 开着，仍应检测标题文本改写并同步引用链接（1.0.9 起单开关
	 * 全局生效，不再需要额外的独立触发 opt-in）。
	 *
	 * **1.0.15 起不再因 frontmatter `false` 退出**（testplan I8）：`fm:false` 的含义收窄为「该文件
	 * 不自动**编号**」，与「改名不断链」正交——后者是全局能力，任何时候都该同步。这条收窄是必要的：
	 * 自 1.0.15 起「清除当前文件编号」会写 `fm:false` 来真正止住重编号（{@link runClearNumbering}），
	 * 若链接同步跟着停，等于用一次清除编号换掉了插件的第一价值。要彻底静默请关 `updateBacklinks`。
	 *
	 * 清除全库进行中同样压制（`vaultClearInProgress`）：批量写回会触发已打开文件的 `editor-change`，
	 * 不压制的话每个文件都会被独立触发放大处理一遍。
	 */
	private shouldBacklinkStandaloneTrigger(): boolean {
		if (!this.settings.updateBacklinks) {
			return false;
		}
		return !this.vaultClearInProgress;
	}

	/**
	 * Backlink 独立触发路径的实际执行（CR-18）：**跳过 `renumberContent`**，只复用既有
	 * `headingSnapshots` 快照基线判断"标题文本是否改写"（{@link foldSelfBacklinks} 内部对照基线，
	 * 传入的 `oldContent`/`newContent` 相同不影响改名判定），命中即走同文件内链折叠写回；无论本轮
	 * 是否检出改名，末尾都无条件调用 {@link syncAndSnapshot}——与 {@link applyRenumber} 对称，既
	 * 播种/刷新快照基线（首次触发时该文件可能还没有基线，见文件打开事件），也同步别的引用文件。
	 * 本方法从不写入任何编号前缀。
	 */
	private applyBacklinkStandaloneSync(editor: Editor, target: LinkTarget): void {
		const content = editor.getValue();
		const fold = this.foldSelfBacklinks(target, content, content);
		this.writeLineDiff(editor, content, fold.content); // 仅同文件内链折叠需要写回，编号本身不变。
		this.syncAndSnapshot(target, fold.content, fold.renames, fold.selfCount);
	}

	/**
	 * 「立即重新编号」命令（**手动路径**，见 spec.md §3.1）：绕过防抖、绕过「全局自动编号」开关
	 * 与 frontmatter `false`，仅受「能否命中模板」约束；命中不到模板时弹 Notice 反馈。
	 *
	 * **1.0.15 起顺带恢复接管**（spec.md §3.19，testplan H15）：若该文件的 frontmatter 开关正是
	 * `false`，本命令在同一事务里把它移除——与「清除当前文件编号」的暂停构成对称闭环。只认
	 * `false`，`true`（文件级强制 opt-in）不在本命令管辖范围内。
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
			// 区分「路径设为不编号」与「未匹配任何规则」（K15）：前者是用户的明确配置，不该提示成后者。
			const m0 = this.messages();
			new Notice(
				this.resolvesToNoNumbering(path) ? m0.noticeNoNumberingRule : m0.noticeNoRule,
			);
			return;
		}

		const m = this.messages();
		const content = editor.getValue();
		const resume = planResumeFileSwitch(content);
		const changed = this.applyRenumber(editor, template, ctx.file, {
			extraChanges: resume ? [this.switchEditToChange(content, resume)] : [],
		});
		new Notice(
			resume ? m.noticeRenumberedAndResumed : changed ? m.noticeRenumbered : m.noticeNoChange,
		);
	}

	/**
	 * 按行比较 `oldContent`/`newContent`，把有变化的行合并进**单一** `editor.transaction` 写回。
	 * 抽出复用点：清除编号 / 清理外来编号 / 编号写入 / Backlink 独立触发（{@link applyBacklinkStandaloneSync}）
	 * 四处都要「整文件按行 diff 后单一事务写回」，逻辑完全一致，只是触发源不同——整文件重写永不
	 * 增删行，故按行索引逐行比较即可定位变化，多处行替换合并为一条撤销记录。
	 *
	 * @param extraChanges 额外并入本次事务的变更（目前仅 frontmatter 单文件开关的增删，见
	 * {@link switchEditToChange}）。它们**会**改变行数，故不能走上面的逐行比对，只能由调用方按
	 * 原文档坐标直接给出；CM6 的变更集一律相对原文档计算，与行替换互不干扰。
	 * @param selection 随本次事务显式设置的光标 / 选区（见 {@link cursorSelectionForEmptyHeading}）；
	 * 缺省时不覆盖，交给 CM6 按插入点做默认位置映射。
	 * @returns 是否实际发生了写入（无任何变更时为 `false`，不发起空事务）。
	 */
	private writeLineDiff(
		editor: Editor,
		oldContent: string,
		newContent: string,
		extraChanges: EditorChange[] = [],
		selection?: EditorRangeOrCaret,
	): boolean {
		const changes: EditorChange[] = [];
		if (newContent !== oldContent) {
			const oldLines = oldContent.split("\n");
			const newLines = newContent.split("\n");
			for (let i = 0; i < newLines.length; i++) {
				if (oldLines[i] !== newLines[i]) {
					changes.push(this.lineChange(i, oldLines[i], newLines[i]));
				}
			}
		}
		changes.push(...extraChanges);
		if (changes.length === 0) {
			return false;
		}
		editor.transaction(selection ? { changes, selection } : { changes });
		return true;
	}

	/**
	 * 把一行的新旧文本折算成**只覆盖真正变化的那一段**的变更（掐掉两端的公共前后缀），而不是
	 * 整行替换。
	 *
	 * **为什么必须最小化**（1.0.23）：自 `preserveCursorLineTrailingSpace` 不再整行冻结起，光标
	 * 所在行会在用户正敲字时被改写。整行替换的变更范围**覆盖光标位置**，CM6 无从知道光标该落在
	 * 替换文本的哪里，只能甩到一端——用户正在行尾打字，光标却被扔走，这是换一种形式的「抢键盘」。
	 * 编号前缀落在行首、用户光标通常在行尾，掐掉公共后缀后变更范围与光标天然不重叠，位置映射
	 * 自然保住（也顺带缩小了 J6 「编号写回不该移动光标/打乱选区」的暴露面）。
	 *
	 * 边界只有一处需要当心：切点不能落在代理对（surrogate pair）中间——emoji 标题很常见，从中间
	 * 切开会产生半个码位的坐标。故两端切点各回退一格避开。文本内容本身不受影响：无论切在哪，
	 * 「公共前缀 + 中段 + 公共后缀」拼回来都逐字节等于新行。
	 */
	private lineChange(line: number, oldLine: string, newLine: string): EditorChange {
		const max = Math.min(oldLine.length, newLine.length);
		let head = 0;
		while (head < max && oldLine[head] === newLine[head]) {
			head++;
		}
		// 回退避免切在代理对中间（高位代理后面必须跟着它的低位）。
		if (head > 0 && isHighSurrogate(oldLine.charCodeAt(head - 1))) {
			head--;
		}
		let tail = 0;
		while (
			tail < max - head &&
			oldLine[oldLine.length - 1 - tail] === newLine[newLine.length - 1 - tail]
		) {
			tail++;
		}
		if (tail > 0 && isLowSurrogate(oldLine.charCodeAt(oldLine.length - tail))) {
			tail--;
		}
		return {
			from: { line, ch: head },
			to: { line, ch: oldLine.length - tail },
			text: newLine.slice(head, newLine.length - tail),
		};
	}

	/**
	 * 把 {@link SwitchEdit}（整行级的插入 / 替换 / 删除）翻译成一条编辑器变更。
	 *
	 * 删除到文件末尾时无法用「下一行的第 0 列」表示终点（那一行不存在），改用最后一行的行尾坐标夹紧。
	 */
	private switchEditToChange(oldContent: string, edit: SwitchEdit): EditorChange {
		const lines = oldContent.split("\n");
		const text = edit.lines.length > 0 ? `${edit.lines.join("\n")}\n` : "";
		const endLine = edit.startLine + edit.removedLines;
		const to =
			endLine < lines.length
				? { line: endLine, ch: 0 }
				: { line: lines.length - 1, ch: lines[lines.length - 1].length };
		return { from: { line: edit.startLine, ch: 0 }, to, text };
	}

	/**
	 * 用给定模板对编辑器执行一次重新编号，并以**单一事务**写回变化的行。
	 *
	 * 本方法只做「剥旧前缀 + 按模板写新前缀」的机械动作，**不**再判定开关 / frontmatter / 模板命中
	 * （这些由调用方按自动 / 手动路径分别判定，见 {@link scheduleRenumber} / {@link runImmediateRenumber}）。
	 *
	 * @param target 当前文件（用于 Backlink 同步取反向链接 / basename）；缺省则不同步链接。
	 * @param opts `protectLine` 见 {@link preserveLine}（仅自动路径传）；`extraChanges` 并入同一
	 * 事务的额外变更（目前仅「立即重新编号」顺带移除 frontmatter 暂停开关）。
	 * @returns 是否实际写入了改动。
	 */
	private applyRenumber(
		editor: Editor,
		template: Template,
		target?: LinkTarget | null,
		opts: { protectLine?: number; extraChanges?: EditorChange[] } = {},
	): boolean {
		const oldContent = editor.getValue();

		const { prefixes, suffixes } = this.strippableAffixes();
		let newContent = renumberContent(oldContent, template, {
			strippablePrefixes: prefixes,
			strippableSuffixes: suffixes,
		});
		// 光标所在行保护**必须在折叠自链接之前**：保护改动的是最终落盘内容，改名表与快照都得基于
		// 它算，否则会据一份并未真正写入的内容去改写内链 / 记快照。
		if (opts.protectLine !== undefined) {
			newContent = this.preserveCursorLineTrailingSpace(
				oldContent,
				newContent,
				opts.protectLine,
			);
		}
		// 同文件内链先折进 newContent，随本次事务一并写回（见 foldSelfBacklinks）；即便编号本身
		// 未变（M14 纯文本改名）也要折，写回时的行级 diff 会自然识别出这一变化并写回。
		const fold = this.foldSelfBacklinks(target, oldContent, newContent);
		newContent = fold.content;
		const selection = this.cursorSelectionForEmptyHeading(
			oldContent,
			newContent,
			opts.protectLine,
		);
		const changed = this.writeLineDiff(
			editor,
			oldContent,
			newContent,
			opts.extraChanges,
			selection,
		);
		// Backlink 同步 + 快照刷新：**即便本轮编号没改动任何行也要做**（M14）——用户可能在上个
		// 同步点之后改了标题正文（编号不变），只有对照快照基线才看得见这类改名。
		this.syncAndSnapshot(target, newContent, fold.renames, fold.selfCount);
		return changed;
	}

	/**
	 * 把用户在光标所在行**刚敲下、尚未敲完**的行尾空白补回 `newContent`——「别在用户正敲字的那一
	 * 行下手」。
	 *
	 * **动机**（testplan J11）：`stripPrefix` 会把标题文本的行尾空白归一化掉（`strip.ts` 的
	 * `\s+$`，这是幂等所必需的）。但自动路径此前没有任何光标守卫，用户在标题末尾敲一个空格、
	 * 停顿超过防抖时长，那个空格就被静默吃掉，接着打的字直接贴上去——观感是插件在跟自己抢键盘。
	 *
	 * **保护手段的演进**：
	 * 1. 1.0.15 初版把光标所在行的改动**整行**剔出事务，等光标移开后的下一次触发再补。
	 * 2. 1.0.23 一度改为「层级相对快照变了就不冻结」，想让改标题层级能立刻生效——真机反馈证明
	 *    不够，同版内即被换掉。
	 * 3. **1.0.23 最终彻底换掉冻结这个手段**：只把行尾空白补回去，其余照常写入。
	 *
	 * 换掉的理由是前两版**都在用整行冻结去解决一个只关乎行尾空白的问题**，代价是"该编的号也不
	 * 编"，而解除冻结依赖的「光标移开后的下一次触发」根本不成立——移动光标**不触发任何事件**
	 * （自动路径只挂 `editor-change`），用户必须再编辑一次才会补上。真机反馈的两种症状同源：
	 * 改层级后等不到新编号（层级判据挡住了这一种）、**新敲出的标题不编号除非按 Enter**
	 * （层级判据挡不住：新增标题会让标题数量相对快照变化，逐位对照的前提被打破而走保守分支）。
	 *
	 * 现在的判据不再需要任何快照或历史推断——**只看这一行现在有没有用户刚敲的行尾空白**：有就补
	 * 回去，编号照常写。幂等性天然成立：补回后的行与上一轮落盘内容逐字节相同，下一轮算出同样结果
	 * 即无改动可写；光标移开后那一轮不再补，空白按既有归一化规则清掉。
	 *
	 * 与 {@link writeLineDiff} 的最小范围改写配套——编号前缀落在行首、用户光标在行尾，两处互不
	 * 重叠，本轮写入不会打断用户正在敲的位置。
	 *
	 * 返回值随后被 {@link syncAndSnapshot} 用作快照基线，所以快照记的始终是**真正落盘的内容**，
	 * 不会因为「算出来改了、实际没写」而在下一轮识别出一个幻影改名（行尾空白不进快照——
	 * {@link parseHeadings} 的 `text` 字段本就去尾空白，故补回空白也不会造成幻影改名）。
	 */
	private preserveCursorLineTrailingSpace(
		oldContent: string,
		newContent: string,
		line: number,
	): string {
		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");
		// 整文重排永不增删行；行数不一致说明前提被打破，此时不做保护（宁可少保护，不可错位）。
		if (line < 0 || line >= newLines.length || oldLines.length !== newLines.length) {
			return newContent;
		}
		const trailing = /\s+$/.exec(oldLines[line])?.[0];
		if (!trailing) {
			return newContent; // 用户没在这行留下行尾空白 → 无需干预。
		}
		// 编号前缀以不可见的 WORD_JOINER 哨兵收尾（标题文本为空时，它就是这一行字面上的最后一个
		// 字符，见 {@link buildPrefix}）。直接 `endsWith` 会被这个哨兵挡住、误判成"新内容没有这段
		// 行尾空白"而重复补一份，叠成两个空格——去掉尾部哨兵后再比较，只看真正的可见字符
		// （用户实机反馈，2026-08-10，testplan J21）。
		const visibleTail = newLines[line].replace(new RegExp(`${WORD_JOINER}+$`), "");
		if (visibleTail.endsWith(trailing)) {
			return newContent; // 本轮压根没动这行的行尾 → 无需干预。
		}
		newLines[line] += trailing;
		return newLines.join("\n");
	}

	/**
	 * 光标所在行若被本轮重排为**刚生成、标题仍为空**的编号标题行（如快捷键刚把空行 / 半成品行
	 * 转成标题），显式把光标钉在该行末尾（编号写完之后），不再交给 CM6 按插入点默认映射。
	 *
	 * **动机**（testplan J21，用户实机反馈，2026-08-10）：这种情形下新旧内容在该行的差异是**纯
	 * 追加**——旧内容整体是新内容的前缀（`## ` → `## 1.1 `），{@link lineChange} 算出的插入点与
	 * 光标恰好落在同一坐标。CM6 对"插入点=光标位置"的默认关联是**光标留在插入文本之前**，于是
	 * 编号写完后光标反倒卡在数字前面，用户接着打的字会插到编号中间。
	 *
	 * 只在"标题仍为空"时介入——已有标题正文的行，用户光标通常在正文末尾、插入点在其前，CM6 的
	 * 默认映射本就正确（{@link lineChange} 头部注释所述），不需要（也不该）覆盖，以免打断正在
	 * 编辑中间位置的用户光标。
	 *
	 * 判定"标题仍为空"不依赖模板细节：{@link buildPrefix} 永远以不可见的 WORD_JOINER 收尾、紧接
	 * 标题正文；标题为空时它就是整行字面上的最后一个字符，`text.endsWith(WORD_JOINER)` 因此是与
	 * 模板前缀 / 后缀 / 分隔符风格无关的通用判据。
	 *
	 * @returns 该行本轮无变化、非标题、或标题已有正文时返回 `undefined`（不覆盖光标）；否则返回
	 * 落在该行末尾的插入符选区，供 {@link writeLineDiff} 随写回事务一并设置。
	 */
	private cursorSelectionForEmptyHeading(
		oldContent: string,
		newContent: string,
		protectLine: number | undefined,
	): EditorRangeOrCaret | undefined {
		if (protectLine === undefined) {
			return undefined;
		}
		const oldLines = oldContent.split("\n");
		const newLines = newContent.split("\n");
		if (
			protectLine < 0 ||
			protectLine >= newLines.length ||
			oldLines.length !== newLines.length
		) {
			return undefined;
		}
		if (oldLines[protectLine] === newLines[protectLine]) {
			return undefined; // 该行本轮未变，不干预用户当前光标/选区。
		}
		const heading = parseHeadings(newContent).find((h) => h.lineIndex === protectLine);
		if (!heading || !heading.text.endsWith(WORD_JOINER)) {
			return undefined;
		}
		return { from: { line: protectLine, ch: newLines[protectLine].length } };
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
		const total = await this.syncBacklinksCounted(target, renames, selfCount);
		await this.notifyBacklinkTotal(total);
	}

	/**
	 * {@link syncBacklinks} 的计数核心（不弹 Notice，返回改写的链接总数）：批量重编号（M12，
	 * testplan K16）逐文件调用本方法并**汇总成一条** Notice，避免一次批量弹出几十条「已更新链接」。
	 */
	private async syncBacklinksCounted(
		target: LinkTarget | null | undefined,
		renames: HeadingRename[],
		selfCount: number,
	): Promise<number> {
		if (!this.settings.updateBacklinks || !target?.path || renames.length === 0) {
			return 0;
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
		return total;
	}

	/**
	 * Backlink 改写总数的统一 Notice 出口：单文件路径由 {@link syncBacklinks} 调用，批量重编号
	 * 汇总后调用一次。`total ≤ 0` 时静默。
	 */
	private async notifyBacklinkTotal(total: number): Promise<void> {
		if (total <= 0) {
			return;
		}
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

/** Backlink 同步所需的最小目标文件形状（真实为 Obsidian `TFile`，测试可传同形对象）。 */
interface LinkTarget {
	path: string;
	basename?: string;
}

/** UTF-16 高位代理（代理对的前一半），见 `lineChange` 的切点回退。 */
function isHighSurrogate(code: number): boolean {
	return code >= 0xd800 && code <= 0xdbff;
}

/** UTF-16 低位代理（代理对的后一半），见 `lineChange` 的切点回退。 */
function isLowSurrogate(code: number): boolean {
	return code >= 0xdc00 && code <= 0xdfff;
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

/**
 * 把 DOM 选区各 Range 的内容序列化为 HTML 字符串——阅读模式原生默认复制会同时写入富文本，
 * 我们接管后照样提供（剥 WJ 后），复制到 Word 等富文本目标不丢格式（spec.md §2.8 copy/cut 端）。
 */
function renderSelectionHtml(doc: Document, selection: Selection): string {
	const container = doc.createElement("div");
	for (let i = 0; i < selection.rangeCount; i++) {
		container.appendChild(selection.getRangeAt(i).cloneContents());
	}
	return container.innerHTML;
}
