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
	sectionSuggestDesc: string;

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

	// —— 模板区 ——
	templatesHeading: string;
	templatesDesc: string;
	addTemplate: string;
	defaultTemplateDesc: string;
	collapseTooltip: string;
	editTooltip: string;
	deleteBtn: string;
	defaultCannotDelete: string;

	// —— 模板编辑面板 ——
	templateNameName: string;
	templateNameDesc: string;
	topLevelName: string;
	topLevelDesc: string;
	bottomLevelName: string;
	bottomLevelDesc: string;
	startIndexName: string;
	startIndexDesc: string;
	ancestorName: string;
	ancestorDesc: string;
	ancestorSelf: string;
	ancestorArabic: string;

	/** 级别格式子框标题（0.7.17，H1–H6 网格容器）。 */
	levelFormatHeading: string;

	// 网格表头与占位符
	colLevel: string;
	colPrefix: string;
	colNumeral: string;
	colNumberSep: string;
	colSuffix: string;
	colTitleSep: string;
	colInherit: string;
	colInheritDepth: string;
	colPreview: string;
	inheritDepthAll: string;
	inheritDepthTooltip: string;
	phPrefix: string;
	phSuffix: string;
	phSpace: string;
	previewInactive: string;
	previewHeadingWord: string;

	// 跳级占位
	skipFillName: string;
	skipFillDesc: string;
	skipFillFill: string;
	skipFillDrop: string;
	skipFillNone: string;
	placeholderName: string;
	placeholderDesc: string;

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
	whitelistName: string;
	whitelistDesc: string;
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
	noticeForeignNumberingGuard: string;
	/** 迁移守卫 Notice 里的可点击文案（点击打开清理预览确认框，J14）。 */
	noticeForeignNumberingGuardAction: string;
	/** 点击迁移守卫 Notice 时，该文件已不在任何已打开的标签页中。 */
	noticeForeignGuardFileNotOpen: string;
}

/** 简体中文文案。 */
const zh: Messages = {
	tabGeneral: "全局设置",
	tabTemplates: "路径模板",
	tabDanger: "敏感操作",
	tabAbout: "关于",

	languageName: "语言",
	languageDesc: "设置面板与命令的显示语言。「自动」跟随 Obsidian 界面语言。",
	langAuto: "自动（跟随 Obsidian）",
	langZh: "中文",
	langEn: "English",
	languageChangeHint: "命令名在重载插件后更新为新语言。",

	autoNumberName: "全局自动编号",
	autoNumberDesc:
		"编辑文件时自动为标题编号。关闭后可用「立即重新编号」命令手动触发（或经 frontmatter 按文件强制开启）。",

	debounceName: "防抖延迟",
	debounceDesc: (min, max, def) => `编辑停顿 ${min}–${max} ms 后触发自动编号（默认 ${def} ms）。`,
	resetTooltip: (def) => `恢复默认 ${def} ms`,

	updateBacklinksName: "同步内部链接（Backlink）",
	updateBacklinksDesc:
		"标题文字改动时，自动更新其它文件里指向它的内部链接（如 [[文件#标题]]），避免断链。与编号无关、全局生效；改动不在引用文件的撤销历史内。",

	headingLinkSuggestName: "标题链接建议",
	headingLinkSuggestDesc:
		"打字匹配库内标题即弹建议，接受后替换为指向该标题的链接。完全自带、默认开启；关闭后不构建标题索引，内存/CPU 成本归零。",
	headingSuggestThisFile: "（本文件）",
	noticeHeadingIndexTruncated: (indexed) =>
		`vault 过大，标题索引未完整构建（已索引 ${indexed} 个）；建议功能在已索引范围内可用。`,
	vcCoexistName: "Various Complements 启用时",
	vcCoexistDesc:
		"两插件共用同一个建议框，只能留一个。默认让路给 VC：配合词典联动，两边候选同框可见（最完整）。**仅当词典联动开启时才真让路**，否则仍由本插件接管。VC 未安装/未启用时本项无效。",
	vcCoexistYield: "让路给 Various Complements（推荐）",
	vcCoexistOwn: "本插件优先（会盖住 VC 的建议框）",
	vcCoexistFallbackHint:
		"当前仍由本插件接管：词典联动未开启，VC 词典里没有标题，让路会什么都看不到。开启联动后即真让路。",

	sectionNumbering: "自动编号",
	sectionLinking: "链接维护",
	sectionSuggest: "标题链接建议",
	sectionSuggestDesc:
		"打字即出标题链接，不依赖其它插件。只有装了 Various Complements 才需要关心下面两项。",

	vcModeName: "Various Complements 联动",
	vcModeDesc:
		"把标题索引导出为 VC 自定义词典，让标题候选出现在 VC 的建议框里（合并两边候选的唯一官方入口）。没装 VC 用不上；默认关闭、开启需显式确认、关闭时零写入。",
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
	vcDescriptionOffHint:
		"VC 的「Description on suggestion」为 None，候选下方的来源路径行不显示（同名标题仍可凭括号里的文件名区分）。VC 全局显示偏好，本插件不代改。",
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
	addRule: "+ 添加规则",
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

	templatesHeading: "模板",
	templatesDesc: "定义各级标题的编号格式与白名单；哪个文件用哪个模板由上方「路径规则」决定。",
	addTemplate: "+ 新增模板",
	defaultTemplateDesc: "内置默认模板，不可删除；可编辑。",
	collapseTooltip: "折叠",
	editTooltip: "编辑",
	deleteBtn: "删除",
	defaultCannotDelete: "默认模板不可删除",

	templateNameName: "模板名称",
	templateNameDesc: "重命名后将自动更新对应的模板文件与引用它的路径规则。",
	topLevelName: "起始编号层级",
	topLevelDesc: "从这一级开始编号，更浅的标题不动（默认 H2，H1 作标题/分节）。",
	bottomLevelName: "结束编号层级",
	bottomLevelDesc:
		"编号到这一级为止，更深的标题不动；须 ≥ 起始层级（两者配合可只编号 H2–H4 区间）。",
	startIndexName: "起始编号数字",
	startIndexDesc: "首个编号标题从该数字起，仅作用于首段（默认 1，设 0 得 0.1.1）。",
	ancestorName: "祖先序号渲染",
	ancestorDesc:
		"继承时祖先段的样式：「各自样式」每个祖先套自身样式；「统一阿拉伯」祖先一律阿拉伯、仅当前级套自身样式（适合中文书）。",
	ancestorSelf: "各自样式（1.a.①）",
	ancestorArabic: "统一阿拉伯（一 / 1.1）",

	levelFormatHeading: "级别格式",
	colLevel: "级别",
	colPrefix: "前缀",
	colNumeral: "序号",
	colNumberSep: "序号间隔符",
	colSuffix: "后缀",
	colTitleSep: "标题间隔符",
	colInherit: "继承前级",
	colInheritDepth: "继承级数",
	colPreview: "预览",
	inheritDepthAll: "全部",
	inheritDepthTooltip: "最多继承多少个前级；不会越过起始编号层级。",
	phPrefix: "前缀",
	phSuffix: "后缀",
	phSpace: "空格",
	previewInactive: "（不编号）",
	previewHeadingWord: "标题",

	skipFillName: "跳级缺失层级",
	skipFillDesc: "标题跳级（如 H3 后跟 H5）时：补占位符、省略缺失段、或该标题不编号（保持原样）。",
	skipFillFill: "补位",
	skipFillDrop: "不补位（省略该段）",
	skipFillNone: "不编号（保持原样）",
	placeholderName: "占位字符",
	placeholderDesc:
		"补位时填入缺失段的数字（如 0 得 1.1.0.1）；仅限数字、留空按 0，确保编号可干净剥离。",

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

	whitelistName: "白名单",
	whitelistDesc:
		"命中的标题不编号、不占号：「全部」完全相等、「部分」包含该词、「子树」整块豁免且之后编号重新开始。",
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
		"剥离全库中本插件写入的编号前缀（不在撤销历史内，建议先备份）；确认后先关闭「全局自动编号」再清除，避免清完又被编回去。",
	clearVaultBtn: "清除全库编号…",
	freezeVaultName: "固化编号并交还所有权（全库）",
	freezeVaultDesc:
		"**保留**现有编号、只移除不可见标记，此后插件停止一切自动编号。适合「想留住编号但不想再被管」或准备卸载；不可逆、不在撤销历史内，建议先备份。",
	freezeVaultBtn: "固化编号并交还所有权…",
	retiredBannerTitle: "插件已交还编号所有权",
	retiredBannerBody:
		"编号已保留为普通文本，插件当前**不做任何自动编号**。恢复接管：点下面按钮，再对相关文件跑「清理非本插件的标题编号」；否则现有编号会被当外来编号，叠成双重编号。",
	resumeBtn: "恢复接管",

	aboutVersionLabel: "版本",
	aboutLinkRepo: "GitHub 仓库",
	aboutLinkIssues: "反馈问题（Issues）",

	aboutCreditsHeading: "鸣谢",
	aboutCreditsIntro: "开发过程中参考了以下开源插件的实现思路，在此致谢：",
	aboutCreditPathSuggest:
		"路径输入的文件夹/文件建议弹窗与匹配思路；本插件补充了「文件级精确规则」与漏打尾斜杠时的自动补全。",
	aboutCreditBacklinks:
		"Backlink 同步的最初参考（反查引用方 + 重写锚点）；本插件补充别名/嵌入解析，升级为编号与文本全覆盖同步。",
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
		"将先关闭「全局自动编号」，再从全库剥离本插件写入的编号前缀，还原为裸标题。不在撤销历史内，建议先备份。确认继续？",
	confirmClearVault: "确认清除全库",

	freezeVaultModalTitle: "固化编号并交还所有权（全库）",
	freezeVaultModalBody:
		"确认后：① 全库编号**原样保留**为普通文本；② 移除全部不可见标记（含链接锚点内的，[[笔记#标题]] 仍可解析）；③ 插件**停止一切自动编号**（凌驾于 frontmatter 开关）；④ 不在撤销历史内，建议先备份；⑤ 恢复接管前须先跑「清理非本插件的标题编号」，否则会叠成双重编号。确认继续？",
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
	noticeForeignNumberingGuard:
		"这些标题看起来带编号，但插件不确定是不是你自己写的，已跳过本次自动编号。",
	noticeForeignNumberingGuardAction: "点击查看并清理",
	noticeForeignGuardFileNotOpen: "该文件已不在任何标签页中，请重新打开后再清理",
};

/** English copy. */
const en: Messages = {
	tabGeneral: "General",
	tabTemplates: "Paths & templates",
	tabDanger: "Sensitive actions",
	tabAbout: "About",

	languageName: "Language",
	languageDesc:
		'Display language for the settings panel and commands. "Auto" follows Obsidian\'s UI language.',
	langAuto: "Auto (follow Obsidian)",
	langZh: "中文",
	langEn: "English",
	languageChangeHint: "Command names update after the plugin is reloaded.",

	autoNumberName: "Global auto-numbering",
	autoNumberDesc:
		'Headings are numbered automatically as you edit. When off, trigger manually with "Renumber now" (or force files on via frontmatter).',

	debounceName: "Debounce delay",
	debounceDesc: (min, max, def) =>
		`Auto-numbering runs ${min}–${max} ms after you stop typing (default ${def} ms).`,
	resetTooltip: (def) => `Reset to default ${def} ms`,

	updateBacklinksName: "Sync internal links (backlinks)",
	updateBacklinksDesc:
		"When a heading's text changes, update internal links to it in other files (e.g. [[file#heading]]) so they don't break. Global and independent of numbering; edits land outside the referencing files' undo history.",

	headingLinkSuggestName: "Heading link suggestions",
	headingLinkSuggestDesc:
		"Typing a heading's text suggests matching vault headings; accept to replace your text with a link to it. Self-contained and on by default; when off, no heading index is built and memory/CPU cost drops to zero.",
	headingSuggestThisFile: "(this file)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Vault too large: heading index built partially (${indexed} headings indexed); suggestions work within the indexed range.`,
	vcCoexistName: "When Various Complements is enabled",
	vcCoexistDesc:
		"Both plugins share the single suggestion popup, so only one can win. Default: yield to VC — with the dictionary integration below, both sides' candidates appear in one popup (the most complete setup). **Yielding only takes effect while the dictionary integration is on**; otherwise this plugin keeps serving. No effect when VC is not installed or not enabled.",
	vcCoexistYield: "Yield to Various Complements (recommended)",
	vcCoexistOwn: "This plugin wins (hides VC's popup)",
	vcCoexistFallbackHint:
		"This plugin is still serving: the dictionary integration is off, so VC's dictionary holds no headings and yielding would leave you with nothing.",

	sectionNumbering: "Auto-numbering",
	sectionLinking: "Link maintenance",
	sectionSuggest: "Heading link suggestions",
	sectionSuggestDesc:
		"Heading links as you type, no other plugin required. The two settings below only matter if Various Complements is installed.",

	vcModeName: "Various Complements integration",
	vcModeDesc:
		"Export the heading index as a VC custom dictionary so heading candidates appear in VC's popup — the only official way to merge both sides. Not needed without VC; off by default, enabling requires explicit confirmation, and nothing is written while off.",
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
	vcDescriptionOffHint:
		"VC's \"Description on suggestion\" is None, so the source-path line under candidates is hidden (same-named headings can still be told apart by the file name in parentheses). Global VC display preference; this plugin won't change it.",
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
	addRule: "+ Add rule",
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

	templatesHeading: "Templates",
	templatesDesc:
		"Define the numbering format and whitelist per heading level; which file uses which template is decided by the Path rules above.",
	addTemplate: "+ New template",
	defaultTemplateDesc: "Built-in default template; cannot be deleted, but can be edited.",
	collapseTooltip: "Collapse",
	editTooltip: "Edit",
	deleteBtn: "Delete",
	defaultCannotDelete: "The default template cannot be deleted",

	templateNameName: "Template name",
	templateNameDesc:
		"Renaming automatically updates the matching template file and any path rules that reference it.",
	topLevelName: "Start level",
	topLevelDesc:
		"The shallowest level to number; shallower headings are left alone (default H2, so H1 acts as the title/section).",
	bottomLevelName: "End level",
	bottomLevelDesc:
		"The deepest level to number; deeper headings are left alone (must be ≥ Start level; combine both to number a range like H2–H4).",
	startIndexName: "Start number",
	startIndexDesc:
		"The number the first numbered heading starts from; first segment only (default 1; 0 gives 0.1.1).",
	ancestorName: "Ancestor numeral rendering",
	ancestorDesc:
		'How ancestor segments render when inheriting: "Own style" uses each ancestor\'s own style; "All Arabic" renders ancestors as Arabic, only the current level in its own style.',
	ancestorSelf: "Own style (1.a.①)",
	ancestorArabic: "All Arabic (一 / 1.1)",

	levelFormatHeading: "Level formats",
	colLevel: "Level",
	colPrefix: "Prefix",
	colNumeral: "Numeral",
	colNumberSep: "Number sep.",
	colSuffix: "Suffix",
	colTitleSep: "Title sep.",
	colInherit: "Inherit",
	colInheritDepth: "Inherit depth",
	colPreview: "Preview",
	inheritDepthAll: "All",
	inheritDepthTooltip:
		"The maximum number of preceding levels to inherit; never goes above the start level.",
	phPrefix: "Prefix",
	phSuffix: "Suffix",
	phSpace: "Space",
	previewInactive: "(not numbered)",
	previewHeadingWord: "Heading",

	skipFillName: "Skipped levels",
	skipFillDesc:
		"When headings skip a level (e.g. H5 right after H3): fill the missing segment, drop it, or leave the heading unnumbered.",
	skipFillFill: "Fill",
	skipFillDrop: "Drop (omit the segment)",
	skipFillNone: "Don't number (leave as-is)",
	placeholderName: "Placeholder",
	placeholderDesc:
		"The digit filling a missing level (e.g. 0 gives 1.1.0.1); digits-only keeps numbering cleanly strippable, empty = 0.",

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

	whitelistName: "Whitelist",
	whitelistDesc:
		"Matched headings are not numbered and take no counter slot: Exact = fully equal, Partial = contains the word, Subtree = whole block exempt, numbering restarts after it.",
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
		"Strip the prefixes this plugin wrote from every Markdown file (NOT in undo history — back up first). Confirming first turns OFF global auto-numbering so cleared files don't get re-numbered.",
	clearVaultBtn: "Clear vault numbering…",
	freezeVaultName: "Freeze numbering and release ownership (entire vault)",
	freezeVaultDesc:
		"**Keeps** your numbers and removes only the plugin's invisible markers; the plugin then stops all automatic numbering. For “keep the numbers, drop the plugin” (e.g. before uninstalling). Irreversible and NOT in undo history — back up first.",
	freezeVaultBtn: "Freeze numbering and release ownership…",
	retiredBannerTitle: "The plugin has released ownership of your numbering",
	retiredBannerBody:
		"Your numbers remain as ordinary text and the plugin is currently doing **no** automatic numbering. To hand control back: press the button below, then run **Clean foreign numbering** on the affected files, or existing numbers get stacked with a fresh prefix.",
	resumeBtn: "Resume managing numbering",

	aboutVersionLabel: "Version",
	aboutLinkRepo: "GitHub repository",
	aboutLinkIssues: "Report an issue",

	aboutCreditsHeading: "Credits",
	aboutCreditsIntro: "Development referenced the following open-source plugins:",
	aboutCreditPathSuggest:
		"Folder/file suggestion popup and matching approach for path input; extended here with exact-file rules and automatic trailing-slash completion.",
	aboutCreditBacklinks:
		"Original reference for backlink sync (reverse-lookup references + rewrite anchors); extended here with alias/embed parsing and full coverage of number and text.",
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
		"First turns OFF global auto-numbering, then strips this plugin's prefixes from every Markdown file, restoring bare headings. NOT in Obsidian's undo history — back up first. Continue?",
	confirmClearVault: "Confirm clear vault",

	freezeVaultModalTitle: "Freeze numbering and release ownership (entire vault)",
	freezeVaultModalBody:
		"Confirming: (1) your numbers are **kept as-is**, becoming ordinary text; (2) the invisible markers (U+2060) are removed vault-wide — **including inside link anchors**, so [[note#heading]] still resolves; (3) the plugin **stops all automatic numbering** (overrides frontmatter); (4) NOT in undo history — back up first; (5) to take over again later, run **Clean foreign numbering** first, or a fresh prefix gets stacked on top. Continue?",
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
	noticeForeignNumberingGuard:
		"These headings look numbered, but the plugin isn't sure you wrote that yourself — skipped auto-numbering this time.",
	noticeForeignNumberingGuardAction: "Click to review and clean up",
	noticeForeignGuardFileNotOpen: "This file is no longer open in any tab; reopen it to clean up",
};

/** 取某语言的文案表。 */
export function getMessages(lang: Lang): Messages {
	return lang === "en" ? en : zh;
}
