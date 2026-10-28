// i18n 类型：语言代码与全部界面文案接口 Messages。

/** 已落地的界面语言：简体中文 / 英文为完整基准；其余为可缺省的社区式翻译（缺键回落英文）。 */
export type Lang = "zh" | "en" | "zh-TW" | "ja" | "es" | "fr" | "de" | "ru" | "ko" | "pt-BR";

/** 非完整语言（`Partial<Messages>`，缺键回落英文）。 */
export type PartialLang = Exclude<Lang, "zh" | "en">;

/** 全部界面文案的接口（纯字符串直接给值，需插值者给函数）。 */
export interface Messages {
	// —— 设置页 TAB（M7 多 TAB 重构）——
	tabGeneral: string;
	tabTemplates: string;
	tabMaintenance: string;
	tabAbout: string;

	// —— 语言设置 ——
	languageName: string;
	languageDesc: string;
	langAuto: string;
	langZh: string;
	langEn: string;
	languageChangeHint: string;

	// —— 全局自动编号 ——
	autoNumberName: string;
	autoNumberDesc: string;

	// —— 防抖延迟 ——
	debounceName: string;
	debounceDesc: (min: number, max: number, def: number) => string;
	resetTooltip: (def: number) => string;

	// —— Backlink 同步 ——
	updateBacklinksName: string;
	updateBacklinksDesc: string;

	// —— 标题链接建议（M13）——
	headingLinkSuggestName: string;
	headingLinkSuggestDesc: string;
	/** renderSuggestion 里「本文件」标签（目标标题在当前文件内时替代路径显示）。 */
	headingSuggestThisFile: string;
	/** 标题索引因 vault 规模过大未完整构建时的一次性 Notice。 */
	noticeHeadingIndexTruncated: (indexed: number) => string;
	/**
	 * 装了 VC 时标题建议显示在哪（2026-10-18 用户定：一个选择取代原「VC 启用时」+「VC 联动」两个下拉）。
	 * 本插件的建议框 = 不写 VC 词典、本插件的框排在 VC 前面；VC 的建议框 = 写进 VC 词典、本插件让路。
	 */
	vcTargetName: string;
	vcTargetDesc: string;
	vcTargetPlugin: string;
	vcTargetVc: string;

	// —— 设置面板分区标题（1.0.29）——
	/** 全局设置「语言」所在分区的标题（未发版，L50）。 */
	sectionInterface: string;
	sectionNumbering: string;
	sectionLinking: string;
	sectionSuggest: string;
	sectionNoteEntry: string;
	headingMenuName: string;
	headingMenuDesc: string;
	statusBarMenuName: string;
	statusBarMenuDesc: string;

	// —— Various Complements 联动（M13）——
	/** 自动配置前置探测未检测到 VC 时的提示。 */
	vcNotInstalledNotice: string;
	vcDictionaryPathLabel: string;
	vcCopyPathButton: string;
	noticeVcPathCopied: string;
	vcManualConfirmTitle: string;
	vcManualConfirmBody: string;
	vcManualConfirmButton: string;
	vcAutoConfirmTitle: string;
	vcAutoConfirmBody: string;
	vcAutoConfirmButton: string;
	/** 自动配置确认框里的「手动配置」：不想让插件改 VC 设置时自己填词典路径。 */
	vcAutoManualButton: string;
	noticeVcAutoWriteSuccess: string;
	/** schema 校验失败、已整体放弃自动写入（未改动 VC 配置）时的提示。 */
	noticeVcAutoWriteInvalidShape: string;
	/** 自动写入路径不可用（未安装 / 未启用 / 数据文件缺失）时的提示。 */
	noticeVcAutoWriteNotInstalled: string;
	/** 写入成功但 reload 命令调用失败，需用户手动执行或重启。 */
	noticeVcReloadFailed: string;
	/** VC 词典条数超上限截断时的一次性 Notice。 */
	noticeVcDictionaryTruncated: (total: number) => string;
	/** 自动配置确认框的要点列表（Modal 里渲染为 ul）。 */
	vcAutoConfirmPoints: string[];
	/** VC 的 descriptionOnSuggestion 设为 None 时，来源路径行不显示的只读提示（1.0.32）。 */
	vcDescriptionOffHint: string;
	/** 切回「不联动」时 VC 仍挂着本插件词典：问要不要一并移除（testplan Q35）。 */
	vcOffConfirmTitle: string;
	vcOffConfirmBody: string;
	vcOffKeepButton: string;
	vcOffRemoveButton: string;
	/** 「不联动」但 VC 仍挂着本插件的旧词典：面板提示 + 移除按钮（testplan Q36）。 */
	vcStaleDictName: string;
	vcStaleDictDesc: string;
	vcStaleDictRemoveButton: string;
	noticeVcDictRemoved: string;
	noticeVcDictRemoveFailed: string;

	// —— 路径规则 ——
	pathRulesHeading: string;
	pathRulesDesc: string;
	pathNoRootWarn: string;
	addRootRule: string;
	addRule: string;
	pathColPattern: string;
	pathColTemplate: string;
	pathEmpty: string;
	pathInputPlaceholder: string;
	templateMissingSuffix: (name: string) => string;
	clearInputTooltip: string;
	deleteRuleTooltip: string;
	dragHandleTooltip: string;
	/** 阻断保存重复路径模式时的 Notice（M7 后续，见 pathrules.ts findDuplicatePatternIndex）。 */
	pathDuplicateWarn: (otherRow: number) => string;
	/** 路径建议弹窗分层浏览模式（testplan K14）：当前层空文件夹提示、返回上一级 / 下钻 / 选中当前层的 tooltip。 */
	pathSuggestEmptyFolder: string;
	pathSuggestBackTooltip: string;
	pathSuggestDescendTooltip: string;
	pathSuggestSelectHereTooltip: string;
	/** 「不编号」伪模板（M12，testplan K15）：模板下拉里的伪选项显示名。 */
	pathTemplateNone: string;
	/** 批量重编号（M12，testplan K16）：行内按钮 tooltip / 「不编号」行置灰 tooltip / 确认对话框文案。 */
	batchRenumberTooltip: string;
	batchRenumberNoneTooltip: string;
	batchModalTitle: string;
	batchModalBody: (pattern: string, count: number) => string;
	batchModalConfirm: string;
	batchModalCancel: string;
	/** M14 路径规则的编号模式列（spec §3.22）。 */
	pathColMode: string;
	pathModeWrite: string;
	pathModeVirtual: string;
	pathModeTooltip: string;
	batchRenumberVirtualTooltip: string;
	/** M14 模式切换确认框。 */
	modeModalTitle: string;
	modeModalLeaving: (count: number, toVirtual: number, toNone: number) => string;
	modeModalClearLabel: string;
	modeModalEntering: (count: number) => string;
	modeModalWriteLabel: string;
	modeModalConfirm: string;
	noticeModeCleared: (count: number) => string;

	// —— 模板区 ——
	templatesHeading: string;
	templatesDesc: string;
	addTemplate: string;
	deleteBtn: string;

	// —— 模板编辑弹窗（1.2.2 起；原行内编辑面板）——
	topLevelName: string;
	bottomLevelName: string;
	ancestorSelf: string;
	ancestorArabic: string;

	// 网格表头与占位符
	colLevel: string;
	colPrefix: string;
	colNumeral: string;
	colNumberSep: string;
	colSuffix: string;
	colTitleSep: string;
	colPreview: string;
	inheritDepthAll: string;
	previewHeadingWord: string;

	// 跳级占位
	skipFillFill: string;
	skipFillDrop: string;
	skipFillNone: string;

	// 序号样式下拉（值 → 标签）
	numeralArabic: string;
	numeralCjk: string;
	numeralCircled: string;
	numeralLowerAlpha: string;
	numeralUpperAlpha: string;
	numeralLowerRoman: string;
	numeralUpperRoman: string;

	// 白名单匹配方式（值 → 标签）
	matchExact: string;
	matchPartial: string;
	matchSubtree: string;

	// 白名单编辑器
	wlInputPlaceholder: string;
	wlFilterPlaceholder: string;
	wlSortAdded: string;
	wlSortAz: string;
	wlSortMatch: string;
	wlFilterNoMatch: string;
	wlEmpty: string;
	/** 白名单词语的「点击编辑」tooltip（行内编辑，L18）。 */
	wlEditTitle: string;
	wlChipWarnTitle: string;
	wlPreviewNoFile: string;
	wlPreviewNone: string;
	wlPreviewSome: (count: number, titles: string) => string;
	/** 当前文件实际使用的模板 ≠ 正在编辑的模板时的警示（预览仅为假设）。 */
	wlPreviewOtherTemplate: (appliedName: string) => string;
	wlPreviewNoTemplate: string;

	// —— 编号维护 TAB（原「敏感操作」，1.2.2 改名重排）——
	clearVaultName: string;
	clearVaultDesc: string;
	clearVaultBtn: string;
	/** 固化编号并交还所有权（M12，编号维护 TAB「整个仓库」组）。 */
	freezeVaultName: string;
	freezeVaultDesc: string;
	freezeVaultBtn: string;
	/** 已离场状态的提示条与「恢复接管」按钮（全局设置 TAB）。 */
	retiredBannerTitle: string;
	retiredBannerBody: string;
	resumeBtn: string;

	// —— 关于 ——
	aboutLinkRepo: string;
	aboutLinkIssues: string;

	// —— 关于：鸣谢（开发中参考的开源插件）——
	aboutCreditsHeading: string;
	aboutCreditsIntro: string;
	aboutCreditPathSuggest: string;
	aboutCreditBacklinks: string;
	aboutCreditWordJoiner: string;

	// —— 默认模板显示名（文件名恒 default.json，显示名随语言）——
	defaultTemplateDisplay: string;

	// 删除模板对话框
	delModalTitle: (name: string) => string;
	delModalBody: (count: number) => string;
	delModalEmptyPath: string;
	delModalRedirect: string;
	delModalDeleteRules: string;
	cancel: string;
	confirmDelete: string;

	// 清除全库对话框
	clearVaultModalTitle: string;
	clearVaultModalBody: string;
	clearVaultTurnOffAuto: string;
	clearVaultTurnOffAutoHint: string;
	confirmClearVault: string;

	// 固化编号（交还所有权）对话框
	freezeVaultModalTitle: string;
	freezeVaultModalBody: string;
	confirmFreezeVault: string;

	// 疑似外来编号清理预览对话框（迁移守卫 Notice 点击入口，testplan J14）
	foreignGuardModalTitle: string;
	foreignGuardModalBody: (count: number) => string;
	/** 逐条勾选框的 aria-label，携带该标题现状文本以便读屏区分（J17）。 */
	foreignGuardItemToggle: (before: string) => string;
	/** 顶部搜索框占位符（J17）。 */
	foreignGuardSearchPlaceholder: string;
	/** 搜索无匹配时的提示（J17）。 */
	foreignGuardSearchEmpty: string;

	// —— 命令名（main.ts）——
	cmdToggle: string;
	cmdRenumber: string;
	cmdClear: string;
	cmdClearForeign: string;
	/** 「清除本文件残留编号」命令名（M14，只在仅显示文件里出现）。 */
	cmdClearStale: string;
	/** 「复制编号大纲」命令名（R 组，spec.md §A.11；写入 / 仅显示两种模式都可用）。 */
	cmdCopyOutline: string;
	/** 「复制当前小节链接」命令名（R 组；光标在第一个标题之前时不出现在命令面板）。 */
	cmdCopySectionLink: string;
	cmdCopySectionEmbed: string;
	/** 「插入目录」命令 / 右键菜单项（ah-toc 块，spec §3.25）。 */
	cmdInsertToc: string;

	// —— 笔记内入口（M16，spec §3.24）——
	cmdToggleHeadingSkip: string;
	cmdPromoteSection: string;
	cmdDemoteSection: string;
	cmdPromoteHeading: string;
	cmdDemoteHeading: string;
	cmdChooseNoteTemplate: string;
	cmdToggleNoteAuto: string;
	/** 右键菜单 / 标题手柄菜单项。 */
	menuToggleSkip: string;
	menuToggleSkipTree: string;
	menuCopySectionEmbed: string;
	cmdToggleSectionSkip: string;
	menuCopySectionLink: string;
	menuAdjustHeading: string;
	menuAdjustSection: string;
	menuNoteSettings: string;
	menuBack: string;
	/** 标题折叠箭头的悬停提示（拖动 / 右键）。 */
	handleHint: string;
	/** 阅读视图里折叠箭头的悬停提示：不能拖，只有右键菜单（S33）。 */
	handleHintReading: string;
	/** 标题手柄菜单标签行：编号 标题 · 级别。 */
	menuHandleLabel: (text: string, level: number) => string;
	noticeSectionShiftOutOfRange: string;
	noticeNoteTemplateNoRule: string;
	noticeNoteTemplateSet: (name: string) => string;
	noticeNoteAutoOn: string;
	noticeNoteAutoOff: string;
	noticeNoTemplates: string;
	chooseTemplatePlaceholder: string;
	chooseTemplateFollowRule: string;
	noticeNoteTemplateCleared: string;
	/** 状态栏「本篇」标签与菜单。 */
	statusModeWrite: string;
	statusModeVirtual: string;
	statusNoNumbering: string;
	statusPausedByNote: string;
	statusLabel: (mode: string, template: string) => string;
	statusMenuRule: (path: string) => string;
	statusMenuNoRule: string;
	statusMenuAutoFollow: string;
	statusMenuAutoOn: string;
	statusMenuAutoOff: string;
	statusMenuChangeTemplate: string;
	statusMenuRenumber: string;
	statusMenuCopyOutline: string;
	statusMenuClearStale: string;
	/** 本篇菜单「清理手写编号…」（未发版起由编号维护 TAB 搬来，S32）。 */
	statusMenuCleanForeign: string;
	/** 清除残留编号成功 / 没有残留时的提示（M14）。 */
	noticeStaleCleared: string;
	noticeNoStaleNumbering: string;
	/** 残留样式编号的悬停提示（M14）。 */
	virtualStaleTooltip: string;

	// —— Notice（main.ts）——
	noticeEnabled: string;
	noticeDisabled: string;
	noticeNothingToClear: string;
	noticeCleared: string;
	/** 清除编号并顺带写入 frontmatter 暂停开关（1.0.15，testplan H13）——必须说清「怎么恢复」。 */
	noticeClearedAndPaused: string;
	/** 「立即重新编号」顺带移除了 frontmatter 暂停开关（1.0.15，testplan H15）。 */
	noticeRenumberedAndResumed: string;
	noticeClearedVault: (count: number) => string;
	noticeFrozenVault: (count: number) => string;
	noticeResumed: string;
	noticeNoRule: string;
	/** 「立即重新编号」命中「不编号」伪模板时的专用提示（区别于「未匹配任何规则」，K15）。 */
	noticeNoNumberingRule: string;
	/** 对「仅显示」模式的文件执行「立即重新编号」时的说明（M14）。 */
	noticeVirtualModeFile: string;
	/** 批量重编号（K16）：命中 0 个文件 / 完成汇总。 */
	noticeBatchNoMatch: string;
	noticeBatchDone: (changed: number, unchanged: number, skipped: number) => string;
	noticeRenumbered: string;
	noticeNoChange: string;
	noticeNoForeign: string;
	noticeForeignCleared: string;
	/** 清理预览确认框「确认清理」后的结果汇总（J17：按勾选分别统计清理/保留条数）。 */
	noticeForeignCleanupApplied: (cleaned: number, kept: number) => string;
	noticeBacklinksUpdated: (count: number) => string;
	noticeBacklinksIntro: string;
	noticeNoActiveFile: string;
	/** 「复制编号大纲」命令（R1–R3）：当前文件没有标题时的提示，不动剪贴板。 */
	noticeNoHeadings: string;
	/** 「复制编号大纲」复制成功的提示，参数为复制的标题数。 */
	noticeOutlineCopied: (count: number) => string;
	/** 写入剪贴板失败（`navigator.clipboard.writeText` 抛错）的通用提示，两条复制命令共用。 */
	noticeCopyFailed: string;
	/** 「复制当前小节链接」复制成功的提示，参数为链接别名（无别名时为剥 WJ 的锚点，R4）。 */
	noticeSectionLinkCopied: (label: string) => string;
	noticeSectionEmbedCopied: (label: string) => string;
	/** 迁移守卫 Notice 里的可点击文案（点击打开清理预览确认框，J14）。 */
	noticeForeignNumberingGuardAction: string;
	/** 点击迁移守卫 Notice 时，该文件已不在任何已打开的标签页中。 */
	noticeForeignGuardFileNotOpen: string;
	// —— 1.2.2 视觉更新：路径规则表 / 模板卡片 / 模板编辑弹窗（spec Roadmap M15）——
	/** 规则表下方的灰字说明（testplan L32）。 */
	pathNoMatchHint: string;
	/** 当前笔记圆点的 tooltip。 */
	activeRuleTooltip: string;
	/** 窄屏规则行 ⋯ 按钮的 tooltip（testplan L33）。 */
	moreActionsTooltip: string;
	/** 默认模板卡片上的「内置」灰标（testplan L34）。 */
	templateBuiltinTag: string;
	/** 卡片底部用量：「用于 N 条规则 · 白名单 M 项」。 */
	templateCardUsage: (rules: number, whitelist: number) => string;
	/** 卡片「编辑」按钮。 */
	editBtn: string;
	/** 卡片 ⋯ 按钮的 tooltip。 */
	templateActionsTooltip: string;
	/** 卡片效果预览的示例标题（按 H1–H6 取）。 */
	cardSampleTitles: string[];
	/** 编辑弹窗标题区的小字（testplan L35）。 */
	editorKicker: string;
	renameTemplateTooltip: string;
	editorTabFormat: string;
	editorTabWhitelist: string;
	/** 格式页上方两行（testplan L36）。 */
	rangeLabel: string;
	rangeTo: string;
	startIndexLabel: string;
	startIndexHint: string;
	moreRulesLabel: string;
	ancestorLabel: string;
	skipLabel: string;
	placeholderLabel: string;
	/** 「上级编号」合并列（testplan L37）。 */
	colParents: string;
	inheritNone: string;
	inheritLevels: (n: number) => string;
	/** 不在编号范围内的级别（testplan L39）。 */
	outOfRangeBefore: (top: number) => string;
	outOfRangeAfter: (bottom: number) => string;
	/** 底部预览（testplan L40）。 */
	previewTitle: string;
	previewSample: string;
	previewCurrent: string;
	previewNoHeadings: string;
	previewTagWhitelist: string;
	previewTagSkip: string;
	previewTagUnnumbered: string;
	/** 示例笔记的标题词：[文档标题, 概述, 背景, 动机, 细节, 补充, 方法, 结论]。 */
	previewSampleWords: string[];
	/** 弹窗底部说明（testplan L41）。 */
	footerImpact: (rules: number, notes: number, writeNotes: number) => string;
	footerUnused: string;
	footerWhitelist: string;
	doneBtn: string;
	/** 模板编辑弹窗草稿式保存（M16，S22）与快速套用 / 历史（S20/S21）。 */
	editorQuickApply: string;
	editorHistory: string;
	quickRecentHeading: string;
	quickPresetHeading: string;
	quickNoRecent: string;
	presetDecimal: string;
	presetChapter: string;
	presetOfficial: string;
	presetLegal: string;
	presetOutline: string;
	historyTitle: (name: string) => string;
	historyEmpty: string;
	historyRestore: string;
	historyCurrent: string;
	/** 白名单页顶部图例（testplan L42）。 */
	wlLegendIntro: string;
	wlLegendExact: string;
	wlLegendPartial: string;
	wlLegendSubtree: string;
	maintVaultHeading: string;
	maintVaultMeta: string;
	noticeStaleNotVirtual: string;
	confirmWordPrompt: (word: string) => string;
	clearVaultWord: string;
	freezeVaultWord: string;
	aboutDescription: string;
	foreignGuardSelectAll: string;
	foreignGuardSelected: (selected: number, total: number) => string;
	foreignGuardUndoHint: string;
	foreignGuardConfirmCount: (count: number) => string;
	noticeForeignGuardCount: (count: number, virtual: boolean) => string;
	/** J25 / J26：外来编号守卫命中但没有可清理的条目（标题本身就是编号，如「第一章」）。 */
	noticeNumberOnlyGuard: (virtual: boolean) => string;
}
