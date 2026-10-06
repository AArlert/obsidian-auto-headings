/**
 * 国际化（i18n，Milestone 6）：设置面板、命令名与 Notice 的**中英双语**文案。
 *
 * 设计：
 * - {@link Lang} 仅含已落地的两种语言（`zh` / `en`）；用户可在设置里选「自动 / 中文 / English」
 *   （{@link LangSetting}），「自动」由 {@link detectObsidianLang} 跟随 Obsidian 界面语言。
 * - {@link Messages} 是**全部文案**的扁平接口：纯字符串直接给值，需插值的（如范围、计数）给函数。
 *   两套实现 {@link zh} / {@link en} 形状完全一致，由 TypeScript 保证不漏键。
 * - 文案是**界面字符串**，不翻译用户数据（模板名「默认」、白名单词条等保持原样）。
 *
 * 仓库守则要求注释 / 文档用简体中文；面向用户的字符串则按所选语言呈现，故本文件**同时**含中英文案。
 */

import { getLanguage } from "obsidian";

/** 已落地的界面语言。 */
export type Lang = "zh" | "en";

/** 语言设置项：`auto` 跟随 Obsidian 界面语言，其余为显式锁定。 */
export type LangSetting = "auto" | Lang;

/** 语言设置的默认值：自动（跟随 Obsidian）。 */
export const DEFAULT_LANG_SETTING: LangSetting = "auto";

/**
 * 探测 Obsidian 的界面语言：走官方 {@link getLanguage}（1.8.7+，返回如 `en` / `zh` / `zh-TW`）。
 * 以 `zh` 前缀（含 `zh-TW` 等）判为中文，其余一律英文。
 * 调用失败（受限 / 异常环境）时回退英文（与 Obsidian 默认界面一致）。
 */
export function detectObsidianLang(): Lang {
	try {
		return getLanguage().toLowerCase().startsWith("zh") ? "zh" : "en";
	} catch {
		return "en";
	}
}

/** 将语言设置解析为具体语言：显式 `zh`/`en` 原样返回；`auto`/缺失走 {@link detectObsidianLang}。 */
export function resolveLang(setting: LangSetting | undefined): Lang {
	if (setting === "zh" || setting === "en") {
		return setting;
	}
	return detectObsidianLang();
}

/** 全部界面文案的接口（纯字符串直接给值，需插值者给函数）。 */
export interface Messages {
	// —— 设置页 TAB（M7 多 TAB 重构）——
	tabGeneral: string;
	tabTemplates: string;
	tabDanger: string;
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
	/** VC 启用时的让路策略（1.0.29）。 */
	vcCoexistName: string;
	vcCoexistDesc: string;
	vcCoexistYield: string;
	vcCoexistOwn: string;
	/** 选了让路但词典联动还没开：此时不会真让路，如实告知当前由本插件接管（1.0.31）。 */
	vcCoexistFallbackHint: string;

	// —— 设置面板分区标题（1.0.29）——
	sectionNumbering: string;
	sectionLinking: string;
	sectionSuggest: string;
	/** 「标题链接建议」分区的一句话导语：先说独立可用，再说什么时候才需要关心 VC 那两项。 */

	// —— Various Complements 联动（M13）——
	vcModeName: string;
	vcModeDesc: string;
	vcModeOff: string;
	vcModeManual: string;
	vcModeAuto: string;
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

	// —— 模板编辑面板 ——
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

	// —— 敏感操作（M7 多 TAB：三个清除入口 + ⚠ 说明）——
	dangerHeading: string;
	dangerExpandHint: string;
	dangerIntro: string;
	clearFileName: string;
	clearFileDesc: string;
	clearFileBtn: string;
	clearForeignName: string;
	clearForeignDesc: string;
	clearForeignBtn: string;
	clearVaultName: string;
	clearVaultDesc: string;
	clearVaultBtn: string;
	/** 固化编号并交还所有权（M12，敏感操作 TAB 第 4 项）。 */
	freezeVaultName: string;
	freezeVaultDesc: string;
	freezeVaultBtn: string;
	/** 已离场状态的提示条与「恢复接管」按钮（全局设置 TAB）。 */
	retiredBannerTitle: string;
	retiredBannerBody: string;
	resumeBtn: string;

	// —— 关于 ——
	aboutVersionLabel: string;
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
	confirmClearVault: string;

	// 固化编号（交还所有权）对话框
	freezeVaultModalTitle: string;
	freezeVaultModalBody: string;
	confirmFreezeVault: string;

	// 疑似外来编号清理预览对话框（迁移守卫 Notice 点击入口，testplan J14）
	foreignGuardModalTitle: string;
	foreignGuardModalBody: (count: number) => string;
	foreignGuardModalConfirm: string;
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
	noticeForeignNumberingGuard: string;
	/** 仅显示文件过半标题带手写编号、不显示虚拟编号时的提示（M14）。 */
	noticeForeignNumberingGuardVirtual: string;
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
	/** 卡片三行效果预览的示例标题。 */
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
	/** 白名单页顶部图例（testplan L42）。 */
	wlLegendIntro: string;
	wlLegendExact: string;
	wlLegendPartial: string;
	wlLegendSubtree: string;
}

/** 简体中文文案。 */
const zh: Messages = {
	tabGeneral: "全局设置",
	tabTemplates: "路径模板",
	tabDanger: "编号维护",
	tabAbout: "关于插件",

	languageName: "语言",
	languageDesc: "设置面板与命令的显示语言。",
	langAuto: "自动（跟随 Obsidian）",
	langZh: "中文",
	langEn: "English",
	languageChangeHint: "命令名在重载插件后更新为新语言。",

	autoNumberName: "全局自动编号",
	autoNumberDesc: "编辑时自动为标题编号；关闭后可用「立即重新编号」手动触发。",

	debounceName: "防抖延迟",
	debounceDesc: (min, max, def) => `停止输入多久后自动编号（${min}–${max} ms，默认 ${def}）。`,
	resetTooltip: (def) => `恢复默认 ${def} ms`,

	updateBacklinksName: "同步内部链接（Backlink）",
	updateBacklinksDesc: "标题文字改变时，自动更新其他笔记里指向它的链接。",

	headingLinkSuggestName: "标题链接建议",
	headingLinkSuggestDesc: "打字时弹出匹配的标题，选中即插入指向它的链接。",
	headingSuggestThisFile: "（本文件）",
	noticeHeadingIndexTruncated: (indexed) =>
		`vault 过大，标题索引未完整构建（已索引 ${indexed} 个）；建议功能在已索引范围内可用。`,
	vcCoexistName: "Various Complements 启用时",
	vcCoexistDesc: "两个插件共用一个建议框，只能留一个。",
	vcCoexistYield: "让路给 Various Complements（推荐）",
	vcCoexistOwn: "本插件优先（会盖住 VC 的建议框）",
	vcCoexistFallbackHint: "词典联动未开启，目前仍由本插件接管建议框。",

	sectionNumbering: "自动编号",
	sectionLinking: "链接维护",
	sectionSuggest: "标题链接建议",

	vcModeName: "Various Complements 联动",
	vcModeDesc: "把标题索引导出为 VC 的自定义词典。",
	vcModeOff: "不联动",
	vcModeManual: "手动配置",
	vcModeAuto: "自动配置",
	vcNotInstalledNotice:
		"未检测到 Various Complements（未安装或未启用），自动配置已取消；请先安装并启用，或改用「手动配置」。",
	vcDictionaryPathLabel: "词典文件路径",
	vcCopyPathButton: "复制路径",
	noticeVcPathCopied: "词典文件路径已复制。",
	vcManualConfirmTitle: "开启手动联动",
	vcManualConfirmBody:
		"将在插件目录生成/维护标题词典文件，不改 VC 任何配置。复制路径，粘贴到 VC 的「Custom dictionary paths」并启用「Custom dictionary complement」；建议清空「Displayed text suffix」，否则候选显示为「标题 => ...」。",
	vcManualConfirmButton: "生成词典文件",
	vcAutoConfirmTitle: "开启自动联动",
	vcAutoConfirmBody:
		"将生成标题词典并自动配置 VC（全程安全校验，写不了即放弃，不改动现有配置）。确认继续？",
	vcAutoConfirmPoints: [
		"生成/维护标题词典（上限 2 万条，超出截断）",
		"写 VC 配置：词典路径 + 开「自定义词典补全」+ 触发阈值 1 字符",
		"清空 VC「补全候选显示后缀」（全局项，其它词典候选同样生效）",
		"VC「建议框最多显示条数」抬到至少 10（全局项，只抬不降）",
		"写入后自动重载 VC 词典（失败会另行提示）",
	],
	vcDescriptionOffHint: "VC 关闭了候选来源行（Description on suggestion 为 None）。",
	vcAutoConfirmButton: "确认并自动配置",
	noticeVcAutoWriteSuccess: "已自动配置 Various Complements 联动。",
	noticeVcAutoWriteInvalidShape:
		"VC 配置格式与预期不符，已放弃自动写入（未改动其配置）；请改用「手动配置」或检查其配置文件。",
	noticeVcAutoWriteNotInstalled:
		"未能自动配置 VC（未安装 / 未启用 / 数据文件缺失）；请先安装并启用，或改用「手动配置」。",
	noticeVcReloadFailed:
		"词典与 VC 配置已写入，但自动重载词典失败；请手动执行 VC 的「Reload custom dictionaries」命令（或重启 Obsidian）。",
	noticeVcDictionaryTruncated: (total) =>
		`标题总数（${total}）超过词典条数上限，词典已截断；建议功能在已收录范围内可用。`,

	pathRulesHeading: "路径规则",
	pathRulesDesc:
		"把路径映射到模板：文件夹规则以「/」结尾、「/」根规则即全局默认，最具体的规则优先。",
	pathNoRootWarn: "⚠ 无根路径规则（/），「全局自动编号」开启时不命中任何规则的文件将不被编号。",
	addRootRule: "+ 添加 / 根规则",
	addRule: "添加规则",
	pathColPattern: "路径模式",
	pathColTemplate: "模板",
	pathEmpty: "（暂无规则；添加一条「/」根规则即对全库生效）",
	pathInputPlaceholder: "如 Projects/ 或 读书笔记/深度工作.md 或 /",
	templateMissingSuffix: (name) => `${name}（已失效）`,
	clearInputTooltip: "清空此路径",
	deleteRuleTooltip: "删除此规则",
	dragHandleTooltip: "拖动以排序",
	pathDuplicateWarn: (otherRow) =>
		`该路径已被第 ${otherRow} 条规则占用；一条路径只能关联一个模板，请先修改或删除其中一条。`,
	pathSuggestEmptyFolder: "（此文件夹为空）",
	pathSuggestBackTooltip: "返回上一级",
	pathSuggestDescendTooltip: "查看子项",
	pathSuggestSelectHereTooltip: "选中当前层级",
	pathTemplateNone: "不编号",
	batchRenumberTooltip: "批量重编号：对该规则命中的全部文件重新编号",
	batchRenumberNoneTooltip: "该规则已设为「不编号」，无可批量编号的内容",
	batchModalTitle: "批量重编号",
	batchModalBody: (pattern, count) =>
		`按各自生效模板重新编号匹配「${pattern}」的 ${count} 个文件；` +
		"「不编号」、frontmatter 关闭或含未接管外来编号的文件自动跳过。已打开的文件可撤销，未打开的直接改写。",
	batchModalConfirm: "重新编号",
	batchModalCancel: "取消",
	pathColMode: "模式",
	pathModeWrite: "写入文件",
	pathModeVirtual: "仅显示",
	pathModeTooltip:
		"写入文件：编号写进笔记，外部编辑器、GitHub、Publish 里也能看到。仅显示：编号只在 Obsidian 里显示，笔记内容一个字都不改。",
	batchRenumberVirtualTooltip: "该规则为「仅显示」，编号不写入文件，无需批量编号",
	modeModalTitle: "编号模式变更",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`有 ${count} 个文件里有本插件写入的编号，改动后插件不再往这些文件写编号` +
		`（${toVirtual} 个改为仅显示，${toNone} 个不再编号）。`,
	modeModalClearLabel:
		"清除这些文件里本插件写入的编号（手写编号不受影响）。不勾选则保留现有编号，改为仅显示的文件会提示有旧编号残留。",
	modeModalEntering: (count) => `有 ${count} 个文件将从「仅显示」改为「写入文件」。`,
	modeModalWriteLabel:
		"立即给这些文件写入编号（不勾选则在下次编辑时写入；已打开的文件会马上更新）",
	modeModalConfirm: "确认",
	noticeModeCleared: (count) => `已清除 ${count} 个文件中本插件写入的编号`,

	templatesHeading: "模板",
	templatesDesc: "定义各级标题的编号格式与白名单；哪个文件用哪个模板由上方「路径规则」决定。",
	addTemplate: "新增模板",
	deleteBtn: "删除",

	topLevelName: "起始编号层级",
	bottomLevelName: "结束编号层级",
	ancestorSelf: "各自样式（1.a.①）",
	ancestorArabic: "统一阿拉伯（一 / 1.1）",

	colLevel: "级别",
	colPrefix: "前缀",
	colNumeral: "序号",
	colNumberSep: "序号间隔符",
	colSuffix: "后缀",
	colTitleSep: "标题间隔符",
	colPreview: "预览",
	inheritDepthAll: "全部",
	previewHeadingWord: "标题",

	skipFillFill: "补位",
	skipFillDrop: "不补位（省略该段）",
	skipFillNone: "不编号（保持原样）",

	numeralArabic: "1, 2, 3",
	numeralCjk: "一, 二, 三",
	numeralCircled: "①, ②, ③",
	numeralLowerAlpha: "a, b, c",
	numeralUpperAlpha: "A, B, C",
	numeralLowerRoman: "i, ii, iii",
	numeralUpperRoman: "I, II, III",

	matchExact: "全部",
	matchPartial: "部分",
	matchSubtree: "子树",

	wlInputPlaceholder: "输入词语后按 Enter 添加…",
	wlFilterPlaceholder: "搜索条目…",
	wlSortAdded: "按添加顺序",
	wlSortAz: "按字母 A–Z",
	wlSortMatch: "按匹配方式",
	wlFilterNoMatch: "（没有匹配搜索词的条目）",
	wlEmpty: "还没有条目——在上方输入词语按 Enter 添加，命中的标题将不被编号。",
	wlEditTitle: "点击编辑词语",
	wlChipWarnTitle:
		"命中标题下还有子标题时，子标题不会豁免、会错挂到上一已编号祖先；建议改用「子树」。",
	wlPreviewNoFile: "（打开一个含标题的 Markdown 文件以预览本白名单的命中）",
	wlPreviewNone: "当前文件无标题被本白名单豁免。",
	wlPreviewSome: (count, titles) => `当前文件将豁免 ${count} 个标题：${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ 当前文件实际使用模板「${appliedName}」，不是正在编辑的这个；下方预览仅为假设。`,
	wlPreviewNoTemplate: "⚠ 当前文件未命中任何路径规则，不会被自动编号；下方预览仅为假设。",

	dangerHeading: "危险区域",
	dangerExpandHint: "（点击展开）",
	dangerIntro:
		"⚠ 以下操作会改写文件内容，其中「清除全库」不在 Obsidian 撤销历史内——操作前请确认或先备份。",
	clearFileName: "清除当前文件编号",
	clearFileDesc: "剥离当前文件所有标题的编号前缀（含手写样式），与同名命令等价。",
	clearFileBtn: "清除当前文件",
	clearForeignName: "清理非本插件编号",
	clearForeignDesc: "只剥当前文件里非本插件写入的手写 / 外来编号，保留本插件的编号。",
	clearForeignBtn: "清理外来编号",
	clearVaultName: "清除全库编号",
	clearVaultDesc:
		"剥离全库中本插件写入的编号前缀（不在撤销历史内，建议先备份）；确认后先关闭「全局自动编号」再清除，避免清完又被编回去（「同步内部链接（Backlink）」开着时链接一并更新）。",
	clearVaultBtn: "清除全库编号…",
	freezeVaultName: "固化编号并交还所有权（全库）",
	freezeVaultDesc:
		"保留现有编号、只移除不可见标记，此后插件停止一切自动编号。适合「想留住编号但不想再被管」或准备卸载；不可逆、不在撤销历史内，建议先备份。注意：「仅显示」模式的编号本来就不在文件里，固化后会随之消失。",
	freezeVaultBtn: "固化编号并交还所有权…",
	retiredBannerTitle: "插件已交还编号所有权",
	retiredBannerBody:
		"编号已保留为普通文本，插件当前不做任何自动编号。恢复接管：点下面按钮，再对相关文件跑「清理非本插件的标题编号」；否则现有编号会被当外来编号，叠成双重编号。",
	resumeBtn: "恢复接管",

	aboutVersionLabel: "版本",
	aboutLinkRepo: "GitHub 仓库",
	aboutLinkIssues: "反馈问题（Issues）",

	aboutCreditsHeading: "鸣谢",
	aboutCreditsIntro: "开发过程中参考了以下开源插件的实现思路，在此致谢：",
	aboutCreditPathSuggest:
		"路径输入的文件夹/文件建议弹窗与匹配思路；本插件补充了「文件级精确规则」与漏打尾斜杠时的自动补全。",
	aboutCreditBacklinks:
		"Backlink 同步的最初参考（反查引用方 + 重写锚点）；本插件补充 Wikilink 别名/嵌入与 Markdown 链接，升级为编号与文本全覆盖同步。",
	aboutCreditWordJoiner:
		"用不可见 Word Joiner 标记编号边界的最初参考；本插件升级为「首尾双哨兵」，可自愈残缺前缀。",

	defaultTemplateDisplay: "默认",

	delModalTitle: (name) => `删除模板「${name}」`,
	delModalBody: (count) => `以下 ${count} 条路径规则正在使用此模板：`,
	delModalEmptyPath: "（空路径）",
	delModalRedirect: "删除后这些规则改用",
	delModalDeleteRules: "删除这些规则",
	cancel: "取消",
	confirmDelete: "确认删除",

	clearVaultModalTitle: "清除全库编号",
	clearVaultModalBody:
		"将先关闭「全局自动编号」，再从全库剥离本插件写入的编号前缀，还原为裸标题（「同步内部链接（Backlink）」开着时链接一并更新）。不在撤销历史内，建议先备份。确认继续？",
	confirmClearVault: "确认清除全库",

	freezeVaultModalTitle: "固化编号并交还所有权（全库）",
	freezeVaultModalBody:
		"确认后：① 全库编号原样保留为普通文本；② 移除全部不可见标记（含链接锚点内的，[[笔记#标题]] 仍可解析）；③ 插件停止一切自动编号（凌驾于 frontmatter 开关）；④ 不在撤销历史内，建议先备份；⑤ 恢复接管前须先跑「清理非本插件的标题编号」，否则会叠成双重编号。确认继续？",
	confirmFreezeVault: "确认固化并交还",

	foreignGuardModalTitle: "疑似非本插件的编号",
	foreignGuardModalBody: (count) =>
		`以下 ${count} 处标题看起来带编号，但无法确认是否你手写（如「API 设计」「TODO 清单」可能误判）。默认全勾清理；取消勾选则保留原文，插件仍会按模板加上自己的编号：`,
	foreignGuardModalConfirm: "确认清理",
	foreignGuardItemToggle: (before) => `清理「${before}」的外来编号`,
	foreignGuardSearchPlaceholder: "搜索标题…",
	foreignGuardSearchEmpty: "没有匹配的标题",

	cmdToggle: "切换全局自动编号（全局）",
	cmdRenumber: "立即重新编号（当前文件）",
	cmdClear: "清除当前文件编号",
	cmdClearForeign: "清理非本插件的标题编号（当前文件）",
	cmdClearStale: "清除本文件残留的插件编号（仅显示模式）",
	cmdCopyOutline: "复制编号大纲",
	cmdCopySectionLink: "复制当前小节链接",
	noticeStaleCleared: "已清除本插件写入的旧编号，手写编号保持不动",
	noticeNoStaleNumbering: "本文件没有本插件写入的旧编号",
	virtualStaleTooltip:
		"文件里还留着本插件以前写入的编号（导出、Publish、外部编辑器会看到它）。可用命令「清除本文件残留的插件编号」清掉",

	noticeEnabled: "已启用全局自动编号",
	noticeDisabled: "已禁用全局自动编号",
	noticeNothingToClear: "当前文件无可清除的编号前缀",
	noticeCleared: "已清除编号",
	noticeClearedAndPaused:
		"已清除编号并暂停本文件的自动编号（属性 obsidian-auto-headings: false）；跑「立即重新编号」即可恢复接管。",
	noticeRenumberedAndResumed: "已重新编号，并恢复本文件的自动编号",
	noticeClearedVault: (count) => `已清除全库编号（共修改 ${count} 个文件）`,
	noticeFrozenVault: (count) =>
		`已固化编号并交还所有权（修改 ${count} 个文件）；编号保留为普通文本，插件停止自动编号`,
	noticeResumed: "已恢复接管；若文件里留有固化过的编号，请先跑「清理非本插件的标题编号」",
	noticeNoRule: "当前文件未匹配任何路径规则，无法编号",
	noticeNoNumberingRule: "当前文件所在路径已设为「不编号」",
	noticeVirtualModeFile: "当前文件为「仅显示」模式：编号只在 Obsidian 里显示，不写入文件",
	noticeBatchNoMatch: "该规则当前未命中任何 Markdown 文件",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`批量重编号完成：改写 ${changed} 个，无变化 ${unchanged} 个，跳过 ${skipped} 个`,
	noticeRenumbered: "已重新编号",
	noticeNoChange: "无需改动",
	noticeNoForeign: "当前文件无可清理的外来编号",
	noticeForeignCleared: "已清理非本插件的标题编号",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `已处理：清理 ${cleaned} 条，保留原文并加上编号 ${kept} 条`
			: `已清理非本插件的标题编号（${cleaned} 条）`,
	noticeBacklinksUpdated: (count) => `已更新 ${count} 处内部链接`,
	noticeBacklinksIntro:
		"已自动更新其它文件里指向本文件标题的内部链接（避免断链；改动不在被改文件的撤销历史内）。不需要可在 设置 → 全局设置 关闭；本提示只出现一次。",
	noticeNoActiveFile: "没有打开的 Markdown 文件",
	noticeNoHeadings: "当前文件没有标题",
	noticeOutlineCopied: (count) => `已复制编号大纲（${count} 个标题）`,
	noticeCopyFailed: "复制到剪贴板失败",
	noticeSectionLinkCopied: (label) => `已复制链接：${label}`,
	noticeForeignNumberingGuard:
		"这些标题看起来带编号，但插件不确定是不是你自己写的，已跳过本次自动编号。",
	noticeForeignNumberingGuardAction: "点击查看并清理",
	noticeForeignNumberingGuardVirtual:
		"这篇笔记的标题大多已经带着编号，插件不确定是不是你自己写的，为免出现两套数字，暂不显示编号。",
	noticeForeignGuardFileNotOpen: "该文件已不在任何标签页中，请重新打开后再清理",
	pathNoMatchHint: "没有任何规则命中的笔记不编号。",
	activeRuleTooltip: "当前笔记使用这条规则",
	moreActionsTooltip: "更多操作",
	templateBuiltinTag: "内置",
	templateCardUsage: (rules, whitelist) => `用于 ${rules} 条规则 · 白名单 ${whitelist} 项`,
	editBtn: "编辑",
	templateActionsTooltip: "模板操作",
	cardSampleTitles: ["概述", "背景", "细节"],
	editorKicker: "编辑模板",
	renameTemplateTooltip: "重命名模板",
	editorTabFormat: "格式",
	editorTabWhitelist: "白名单",
	rangeLabel: "编号范围",
	rangeTo: "至",
	startIndexLabel: "起始编号数字",
	startIndexHint: "设为 0 可得 0.1、0.2……",
	moreRulesLabel: "更多规则",
	ancestorLabel: "上级编号的写法",
	skipLabel: "标题跳级时",
	placeholderLabel: "占位字符",
	colParents: "上级编号",
	inheritNone: "不带",
	inheritLevels: (n) => `${n} 级`,
	outOfRangeBefore: (top) => `不在编号范围内（编号从 H${top} 开始）`,
	outOfRangeAfter: (bottom) => `不在编号范围内（编号到 H${bottom} 为止）`,
	previewTitle: "预览",
	previewSample: "示例",
	previewCurrent: "当前笔记",
	previewNoHeadings: "这篇笔记还没有标题。",
	previewTagWhitelist: "白名单",
	previewTagSkip: "跳过",
	previewTagUnnumbered: "不编号",
	previewSampleWords: ["文档标题", "概述", "背景", "动机", "细节", "补充", "方法", "结论"],
	footerImpact: (rules, notes, writeNotes) =>
		`修改即时生效 · 影响 ${rules} 条规则下的 ${notes} 篇笔记，其中 ${writeNotes} 篇写入文件。`,
	footerUnused: "修改即时生效 · 还没有路径规则使用这个模板。",
	footerWhitelist: "修改即时生效 · 单击词语即可改写。",
	doneBtn: "完成",
	wlLegendIntro: "命中的标题不编号、不占序号：",
	wlLegendExact: "完全相同",
	wlLegendPartial: "包含该词",
	wlLegendSubtree: "整节豁免，之后重新编号",
};

/** English copy. */
const en: Messages = {
	tabGeneral: "General",
	tabTemplates: "Paths & templates",
	tabDanger: "Maintenance",
	tabAbout: "About",

	languageName: "Language",
	languageDesc: "Display language for the settings panel and commands.",
	langAuto: "Auto (follow Obsidian)",
	langZh: "中文",
	langEn: "English",
	languageChangeHint: "Command names update after the plugin is reloaded.",

	autoNumberName: "Global auto-numbering",
	autoNumberDesc: 'Number headings as you edit; when off, use "Renumber now" instead.',

	debounceName: "Debounce delay",
	debounceDesc: (min, max, def) =>
		`How long after you stop typing to renumber (${min}–${max} ms, default ${def}).`,
	resetTooltip: (def) => `Reset to default ${def} ms`,

	updateBacklinksName: "Sync internal links (backlinks)",
	updateBacklinksDesc: "When a heading's text changes, update links to it in other notes.",

	headingLinkSuggestName: "Heading link suggestions",
	headingLinkSuggestDesc: "Suggest matching headings as you type; pick one to insert a link.",
	headingSuggestThisFile: "(this file)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Vault too large: heading index built partially (${indexed} headings indexed); suggestions work within the indexed range.`,
	vcCoexistName: "When Various Complements is enabled",
	vcCoexistDesc: "Both plugins share one suggestion popup, so only one can show it.",
	vcCoexistYield: "Yield to Various Complements (recommended)",
	vcCoexistOwn: "This plugin wins (hides VC's popup)",
	vcCoexistFallbackHint:
		"Dictionary integration is off, so this plugin still serves suggestions.",

	sectionNumbering: "Auto-numbering",
	sectionLinking: "Link maintenance",
	sectionSuggest: "Heading link suggestions",

	vcModeName: "Various Complements integration",
	vcModeDesc: "Export the heading index as a VC custom dictionary.",
	vcModeOff: "Off",
	vcModeManual: "Manual",
	vcModeAuto: "Automatic",
	vcNotInstalledNotice:
		"Various Complements not detected (not installed or not enabled); automatic configuration cancelled. Install and enable it, or use Manual mode.",
	vcDictionaryPathLabel: "Dictionary file path",
	vcCopyPathButton: "Copy path",
	noticeVcPathCopied: "Dictionary file path copied.",
	vcManualConfirmTitle: "Enable manual integration",
	vcManualConfirmBody:
		'A heading dictionary file will be generated and maintained in this plugin\'s folder (no VC setting is modified). Copy the path into VC\'s "Custom dictionary paths" and enable "Custom dictionary complement"; clearing VC\'s "Displayed text suffix" is recommended, otherwise candidates render as "heading => ...".',
	vcManualConfirmButton: "Generate dictionary",
	vcAutoConfirmTitle: "Enable automatic integration",
	vcAutoConfirmBody:
		"A heading dictionary will be generated and VC configured automatically (safety-checked; aborts without touching your VC settings if it can't write safely). Continue?",
	vcAutoConfirmPoints: [
		"Generate/maintain the heading dictionary (capped at 20,000 headings)",
		'Write VC settings: dictionary path + "Custom dictionary complement" + trigger threshold of 1 character',
		'Clear VC\'s "Displayed text suffix" (global: affects your other custom dictionaries too)',
		'Raise VC\'s "Max number of suggestions" to at least 10 (global; only raised, never lowered)',
		"Reload VC dictionaries after writing (failure is reported separately)",
	],
	vcDescriptionOffHint: "VC hides the candidate source line (Description on suggestion: None).",
	vcAutoConfirmButton: "Confirm & configure",
	noticeVcAutoWriteSuccess: "Various Complements integration configured automatically.",
	noticeVcAutoWriteInvalidShape:
		"VC's configuration shape did not match expectations; automatic write aborted (its settings untouched). Use Manual mode or inspect VC's config.",
	noticeVcAutoWriteNotInstalled:
		"Could not configure VC automatically (not installed / not enabled / data file missing); install and enable it, or use Manual mode.",
	noticeVcReloadFailed:
		'The dictionary and VC settings were written, but reloading VC dictionaries failed; run VC\'s "Reload custom dictionaries" command (or restart Obsidian).',
	noticeVcDictionaryTruncated: (total) =>
		`The total number of headings (${total}) exceeds the dictionary cap; the dictionary was truncated and works within the included range.`,

	pathRulesHeading: "Path rules",
	pathRulesDesc:
		'Map paths to templates: folder rules end with "/", the "/" root rule is the global default, and the most specific rule wins.',
	pathNoRootWarn:
		'⚠ No root path rule (/). With "Global auto-numbering" on, files that match no rule will not be numbered.',
	addRootRule: "+ Add / root rule",
	addRule: "Add rule",
	pathColPattern: "Path pattern",
	pathColTemplate: "Template",
	pathEmpty: '(No rules yet; add a "/" root rule to cover the whole vault.)',
	pathInputPlaceholder: "e.g. Projects/ or Notes/Deep Work.md or /",
	templateMissingSuffix: (name) => `${name} (missing)`,
	clearInputTooltip: "Clear this path",
	deleteRuleTooltip: "Delete this rule",
	dragHandleTooltip: "Drag to reorder",
	pathDuplicateWarn: (otherRow) =>
		`This path is already used by rule #${otherRow}; one path can map to only one template. Edit or delete one of them first.`,
	pathSuggestEmptyFolder: "(This folder is empty)",
	pathSuggestBackTooltip: "Go up one level",
	pathSuggestDescendTooltip: "View contents",
	pathSuggestSelectHereTooltip: "Select this level",
	pathTemplateNone: "No numbering",
	batchRenumberTooltip: "Batch renumber: renumber every file matched by this rule",
	batchRenumberNoneTooltip: "This rule is set to “No numbering” — nothing to renumber",
	batchModalTitle: "Batch renumber",
	batchModalBody: (pattern, count) =>
		`Renumbers ${count} Markdown file(s) matching “${pattern}”, each with its own effective template. ` +
		"Files set to “No numbering”, disabled via frontmatter, or holding unclaimed foreign numbering are skipped; " +
		"open files support undo, closed files are rewritten directly.",
	batchModalConfirm: "Renumber",
	batchModalCancel: "Cancel",
	pathColMode: "Mode",
	pathModeWrite: "Write to file",
	pathModeVirtual: "Display only",
	pathModeTooltip:
		"Write to file: numbers are written into the note and show up in external editors, GitHub and Publish. Display only: numbers are shown inside Obsidian and the note is never changed.",
	batchRenumberVirtualTooltip:
		"This rule is display-only — numbers are never written, nothing to renumber",
	modeModalTitle: "Numbering mode change",
	modeModalLeaving: (count, toVirtual, toNone) =>
		`${count} file(s) contain numbers written by this plugin, and the plugin will stop writing to them ` +
		`(${toVirtual} switch to display-only, ${toNone} to no numbering).`,
	modeModalClearLabel:
		"Remove the numbers this plugin wrote in these files (hand-written numbers are left alone). If unchecked, the numbers stay; display-only files will flag them as leftovers.",
	modeModalEntering: (count) =>
		`${count} file(s) will switch from display-only to write-to-file.`,
	modeModalWriteLabel:
		"Write numbers into these files now (otherwise on the next edit; open files update right away)",
	modeModalConfirm: "Confirm",
	noticeModeCleared: (count) => `Removed plugin-written numbers from ${count} file(s)`,

	templatesHeading: "Templates",
	templatesDesc:
		"Define the numbering format and whitelist per heading level; which file uses which template is decided by the Path rules above.",
	addTemplate: "New template",
	deleteBtn: "Delete",

	topLevelName: "Start level",
	bottomLevelName: "End level",
	ancestorSelf: "Own style (1.a.①)",
	ancestorArabic: "All Arabic (一 / 1.1)",

	colLevel: "Level",
	colPrefix: "Prefix",
	colNumeral: "Numeral",
	colNumberSep: "Number sep.",
	colSuffix: "Suffix",
	colTitleSep: "Title sep.",
	colPreview: "Preview",
	inheritDepthAll: "All",
	previewHeadingWord: "Heading",

	skipFillFill: "Fill",
	skipFillDrop: "Drop (omit the segment)",
	skipFillNone: "Don't number (leave as-is)",

	numeralArabic: "1, 2, 3",
	numeralCjk: "一, 二, 三",
	numeralCircled: "①, ②, ③",
	numeralLowerAlpha: "a, b, c",
	numeralUpperAlpha: "A, B, C",
	numeralLowerRoman: "i, ii, iii",
	numeralUpperRoman: "I, II, III",

	matchExact: "Exact",
	matchPartial: "Partial",
	matchSubtree: "Subtree",

	wlInputPlaceholder: "Type a word and press Enter to add…",
	wlFilterPlaceholder: "Filter entries…",
	wlSortAdded: "By added order",
	wlSortAz: "A–Z",
	wlSortMatch: "By match type",
	wlFilterNoMatch: "(No entries match the filter)",
	wlEmpty:
		"No entries yet — type a word above and press Enter; matched headings stay unnumbered.",
	wlEditTitle: "Click to edit",
	wlChipWarnTitle:
		"The matched heading has children; they stay numbered and would attach to the previous numbered ancestor. Use “Subtree” to exempt the whole block.",
	wlPreviewNoFile: "(Open a Markdown file with headings to preview this whitelist's matches.)",
	wlPreviewNone: "No heading in the current file is exempted by this whitelist.",
	wlPreviewSome: (count, titles) =>
		`This whitelist will exempt ${count} heading(s) in the current file: ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ By the path rules this file actually uses template "${appliedName}", not the one you're editing; the preview below is hypothetical.`,
	wlPreviewNoTemplate:
		"⚠ The current file matches no path rule and won't be auto-numbered; the preview below is hypothetical.",

	dangerHeading: "Danger zone",
	dangerExpandHint: "(click to expand)",
	dangerIntro:
		"⚠ The actions below rewrite file contents, and the vault-wide clear is NOT in Obsidian's undo history — confirm or back up first.",
	clearFileName: "Clear numbering in current file",
	clearFileDesc:
		"Strip all heading numbering prefixes (including hand-written styles) from the current file; same as the command of the same name.",
	clearFileBtn: "Clear current file",
	clearForeignName: "Clear non-plugin numbering",
	clearForeignDesc:
		"Strip only hand-written / foreign numbering in the current file, keeping the numbering this plugin wrote.",
	clearForeignBtn: "Clear foreign numbering",
	clearVaultName: "Clear numbering in the whole vault",
	clearVaultDesc:
		"Strip the prefixes this plugin wrote from every Markdown file (NOT in undo history — back up first). Confirming first turns OFF global auto-numbering so cleared files don't get re-numbered (links update too when “Sync internal links (backlinks)” is on).",
	clearVaultBtn: "Clear vault numbering…",
	freezeVaultName: "Freeze numbering and release ownership (entire vault)",
	freezeVaultDesc:
		"Keeps your numbers and removes only the plugin's invisible markers; the plugin then stops all automatic numbering. For “keep the numbers, drop the plugin” (e.g. before uninstalling). Irreversible and NOT in undo history — back up first. Note: numbers in display-only mode were never in the files, so they disappear after freezing.",
	freezeVaultBtn: "Freeze numbering and release ownership…",
	retiredBannerTitle: "The plugin has released ownership of your numbering",
	retiredBannerBody:
		"Your numbers remain as ordinary text and the plugin is currently doing no automatic numbering. To hand control back: press the button below, then run “Clean foreign numbering” on the affected files, or existing numbers get stacked with a fresh prefix.",
	resumeBtn: "Resume managing numbering",

	aboutVersionLabel: "Version",
	aboutLinkRepo: "GitHub repository",
	aboutLinkIssues: "Report an issue",

	aboutCreditsHeading: "Credits",
	aboutCreditsIntro: "Development referenced the following open-source plugins:",
	aboutCreditPathSuggest:
		"Folder/file suggestion popup and matching approach for path input; extended here with exact-file rules and automatic trailing-slash completion.",
	aboutCreditBacklinks:
		"Original reference for backlink sync (reverse-lookup references + rewrite anchors); extended here with Wikilink alias/embed parsing, Markdown links, and full coverage of number and text.",
	aboutCreditWordJoiner:
		'Original reference for marking numbering prefixes with an invisible Word Joiner boundary; upgraded here to a "double sentinel" scheme that self-heals damaged prefixes.',

	defaultTemplateDisplay: "Default",

	delModalTitle: (name) => `Delete template "${name}"`,
	delModalBody: (count) => `The following ${count} path rule(s) use this template:`,
	delModalEmptyPath: "(empty path)",
	delModalRedirect: "After deletion, these rules use",
	delModalDeleteRules: "Delete these rules",
	cancel: "Cancel",
	confirmDelete: "Confirm delete",

	clearVaultModalTitle: "Clear vault numbering",
	clearVaultModalBody:
		"First turns OFF global auto-numbering, then strips this plugin's prefixes from every Markdown file, restoring bare headings (links update too when “Sync internal links (backlinks)” is on). NOT in Obsidian's undo history — back up first. Continue?",
	confirmClearVault: "Confirm clear vault",

	freezeVaultModalTitle: "Freeze numbering and release ownership (entire vault)",
	freezeVaultModalBody:
		"Confirming: (1) your numbers are kept as-is, becoming ordinary text; (2) the invisible markers (U+2060) are removed vault-wide — including inside link anchors, so [[note#heading]] still resolves; (3) the plugin stops all automatic numbering (overrides frontmatter); (4) NOT in undo history — back up first; (5) to take over again later, run “Clean foreign numbering” first, or a fresh prefix gets stacked on top. Continue?",
	confirmFreezeVault: "Confirm freeze and release",

	foreignGuardModalTitle: "Possible non-plugin numbering",
	foreignGuardModalBody: (count) =>
		`The following ${count} heading(s) look numbered, but the plugin can't be sure you wrote them yourself ("API design", "TODO list", etc. can false-positive). All are checked by default; unchecking one keeps its text as-is (the plugin will still add its own numbering):`,
	foreignGuardModalConfirm: "Confirm cleanup",
	foreignGuardItemToggle: (before) => `Clean up foreign numbering in "${before}"`,
	foreignGuardSearchPlaceholder: "Search headings…",
	foreignGuardSearchEmpty: "No matching headings",

	cmdToggle: "Toggle global auto-numbering (global)",
	cmdRenumber: "Renumber now (current file)",
	cmdClear: "Clear numbering in current file",
	cmdClearForeign: "Clear non-plugin heading numbering (current file)",
	cmdClearStale: "Clear leftover plugin numbering in this file (display-only mode)",
	cmdCopyOutline: "Copy numbered outline",
	cmdCopySectionLink: "Copy current section link",
	noticeStaleCleared:
		"Removed the old numbers this plugin had written; hand-written numbers were left alone",
	noticeNoStaleNumbering: "This file has no numbers written by this plugin",
	virtualStaleTooltip:
		"This file still contains numbers the plugin wrote earlier (exports, Publish and external editors will show them). Run “Clear leftover plugin numbering in this file” to remove them",

	noticeEnabled: "Global auto-numbering enabled",
	noticeDisabled: "Global auto-numbering disabled",
	noticeNothingToClear: "No numbering prefix to clear in the current file",
	noticeCleared: "Numbering cleared",
	noticeClearedAndPaused:
		"Numbering cleared and auto-numbering paused for this note (property obsidian-auto-headings: false); run “Renumber now” to resume.",
	noticeRenumberedAndResumed: "Renumbered, and auto-numbering resumed for this note",
	noticeClearedVault: (count) => `Vault numbering cleared (${count} file(s) changed)`,
	noticeFrozenVault: (count) =>
		`Numbering frozen and ownership released (${count} file(s) changed); numbers stay as plain text, auto-numbering is off`,
	noticeResumed:
		"Now managing numbering again; if any frozen numbering is still in your files, run Clean foreign numbering first",
	noticeNoRule: "The current file matches no path rule; cannot number it",
	noticeNoNumberingRule: "This file's path is set to “No numbering”",
	noticeVirtualModeFile:
		"This file is in display-only mode: numbers are shown in Obsidian but never written to the file",
	noticeBatchNoMatch: "This rule currently matches no Markdown files",
	noticeBatchDone: (changed, unchanged, skipped) =>
		`Batch renumber done: ${changed} updated, ${unchanged} unchanged, ${skipped} skipped`,
	noticeRenumbered: "Renumbered",
	noticeNoChange: "No change needed",
	noticeNoForeign: "No foreign (non-plugin) numbering to clear in the current file",
	noticeForeignCleared: "Cleared non-plugin heading numbering",
	noticeForeignCleanupApplied: (cleaned, kept) =>
		kept > 0
			? `Done: cleaned ${cleaned}, kept ${kept} as-is with numbering added`
			: `Cleared non-plugin heading numbering (${cleaned})`,
	noticeBacklinksUpdated: (count) => `Updated ${count} internal link(s)`,
	noticeBacklinksIntro:
		"Auto Headings updated internal links in other files that point to headings in this file (so they don't break). Those edits are NOT in the modified files' undo history; turn off \"Sync internal links\" under Settings → General. Shown once.",
	noticeNoActiveFile: "No open Markdown file",
	noticeNoHeadings: "No headings in the current file",
	noticeOutlineCopied: (count) =>
		`Copied numbered outline (${count} heading${count === 1 ? "" : "s"})`,
	noticeCopyFailed: "Failed to copy to clipboard",
	noticeSectionLinkCopied: (label) => `Copied link: ${label}`,
	noticeForeignNumberingGuard:
		"These headings look numbered, but the plugin isn't sure you wrote that yourself — skipped auto-numbering this time.",
	noticeForeignNumberingGuardAction: "Click to review and clean up",
	noticeForeignNumberingGuardVirtual:
		"Most headings in this note already carry numbers the plugin can't confirm you wrote — numbers are hidden here to avoid showing two sets.",
	noticeForeignGuardFileNotOpen: "This file is no longer open in any tab; reopen it to clean up",
	pathNoMatchHint: "Notes that match no rule are not numbered.",
	activeRuleTooltip: "The current note uses this rule",
	moreActionsTooltip: "More actions",
	templateBuiltinTag: "Built-in",
	templateCardUsage: (rules, whitelist) =>
		`Used by ${rules} ${rules === 1 ? "rule" : "rules"} · ${whitelist} whitelist ${whitelist === 1 ? "entry" : "entries"}`,
	editBtn: "Edit",
	templateActionsTooltip: "Template actions",
	cardSampleTitles: ["Overview", "Background", "Details"],
	editorKicker: "Edit template",
	renameTemplateTooltip: "Rename template",
	editorTabFormat: "Format",
	editorTabWhitelist: "Whitelist",
	rangeLabel: "Range",
	rangeTo: "to",
	startIndexLabel: "Start at",
	startIndexHint: "Set 0 to get 0.1, 0.2…",
	moreRulesLabel: "More rules",
	ancestorLabel: "Parent numbers",
	skipLabel: "When a level is skipped",
	placeholderLabel: "Placeholder",
	colParents: "Parents",
	inheritNone: "None",
	inheritLevels: (n) => `${n} ${n === 1 ? "level" : "levels"}`,
	outOfRangeBefore: (top) => `Outside the numbering range (numbering starts at H${top})`,
	outOfRangeAfter: (bottom) => `Outside the numbering range (numbering stops at H${bottom})`,
	previewTitle: "Preview",
	previewSample: "Sample",
	previewCurrent: "Current note",
	previewNoHeadings: "This note has no headings yet.",
	previewTagWhitelist: "Whitelist",
	previewTagSkip: "Skipped",
	previewTagUnnumbered: "Not numbered",
	previewSampleWords: [
		"Document title",
		"Overview",
		"Background",
		"Motivation",
		"Details",
		"Notes",
		"Method",
		"Conclusion",
	],
	footerImpact: (rules, notes, writeNotes) =>
		`Changes apply immediately · affects ${notes} ${notes === 1 ? "note" : "notes"} under ${rules} ${rules === 1 ? "rule" : "rules"}, ${writeNotes} written to file.`,
	footerUnused: "Changes apply immediately · no path rule uses this template yet.",
	footerWhitelist: "Changes apply immediately · click a word to edit it.",
	doneBtn: "Done",
	wlLegendIntro: "Matching headings are not numbered and take no number:",
	wlLegendExact: "exact",
	wlLegendPartial: "contains the word",
	wlLegendSubtree: "whole section exempt, numbering resumes after",
};

/** 取某语言的文案表。 */
export function getMessages(lang: Lang): Messages {
	return lang === "en" ? en : zh;
}
