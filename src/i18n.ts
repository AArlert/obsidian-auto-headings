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
 * 探测 Obsidian 的界面语言：走官方 {@link getLanguage}（1.8.0+，返回如 `en` / `zh` / `zh-TW`）。
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
	colPreview: string;
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

	// —— 关于 ——
	aboutVersionLabel: string;
	aboutLinkRepo: string;
	aboutLinkIssues: string;

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
	noticeClearedVault: (count: number) => string;
	noticeNoRule: string;
	noticeRenumbered: string;
	noticeNoChange: string;
	noticeNoForeign: string;
	noticeForeignCleared: string;
	noticeBacklinksUpdated: (count: number) => string;
	noticeBacklinksIntro: string;
	noticeNoActiveFile: string;
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
	languageChangeHint: "命令名称将在下次重载插件后更新为新语言。",

	autoNumberName: "全局自动编号",
	autoNumberDesc:
		"开启后编辑文件即自动为标题编号；关闭后仍可按文件用 frontmatter 强制开启，或用「立即重新编号」命令手动触发。",

	debounceName: "防抖延迟",
	debounceDesc: (min, max, def) =>
		`编辑停顿后多少毫秒触发自动编号。范围 ${min}–${max} ms，默认 ${def} ms。`,
	resetTooltip: (def) => `恢复默认 ${def} ms`,

	updateBacklinksName: "同步内部链接（Backlink）",
	updateBacklinksDesc:
		"标题被编号 / 清除改写后，自动更新其它文件里指向它的内部链接（如 [[文件#标题]]），避免断链；注意会修改引用文件、改动不在其撤销历史内。",

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
		`该路径已被第 ${otherRow} 条规则使用，不能与不同模板重复关联同一路径；请先修改或删除其中一条。`,

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
	topLevelDesc: "从这一级开始编号：比它浅的标题不编号、也不会被改写（默认 H2，H1 作标题/分节）。",
	bottomLevelName: "结束编号层级",
	bottomLevelDesc:
		"编号到这一级为止：更深的标题不编号（须 ≥ 起始层级，配合起始层级可只编号 H2–H4 这样的区间）。",
	startIndexName: "起始编号数字",
	startIndexDesc:
		"首个编号标题从这个数字起，仅作用于首段（默认 1；设 0 得 0.1.1，更深层级仍从 1 起）。",
	ancestorName: "祖先序号渲染",
	ancestorDesc:
		"继承前级时祖先段的样式：「各自样式」每个祖先套用自身样式；「统一阿拉伯」祖先一律阿拉伯、仅当前级套自身样式（适合中文书）。",
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
	colPreview: "预览",
	phPrefix: "前缀",
	phSuffix: "后缀",
	phSpace: "空格",
	previewInactive: "（不编号）",
	previewHeadingWord: "标题",

	skipFillName: "跳级缺失层级",
	skipFillDesc:
		"标题跳级（如 H3 后直接跟 H5）时：补占位符（H5 得四段）、省略缺失段（H5 与 H4 同形）、或该标题完全不编号（保持原样，适合把深层标题当小标题用）。",
	skipFillFill: "补位",
	skipFillDrop: "不补位（省略该段）",
	skipFillNone: "不编号（保持原样）",
	placeholderName: "占位字符",
	placeholderDesc:
		"补位时填入缺失段的数字（如 0 得 1.1.0.1）；仅限数字以确保编号可被干净剥离，留空按 0 处理。",

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
		"命中的标题不编号、不占号；「全部」完全相等、「部分」包含该词、「子树」整块豁免且块后编号重新开始（如附录后的新章节）。",
	wlInputPlaceholder: "输入词语后按 Enter 添加…",
	wlFilterPlaceholder: "搜索条目…",
	wlSortAdded: "按添加顺序",
	wlSortAz: "按字母 A–Z",
	wlSortMatch: "按匹配方式",
	wlFilterNoMatch: "（没有匹配搜索词的条目）",
	wlEmpty: "还没有条目——在上方输入词语按 Enter 添加，命中的标题将不被编号。",
	wlEditTitle: "点击编辑词语",
	wlChipWarnTitle:
		"命中的标题下还有子标题，子标题不会被豁免、会错挂到上一已编号祖先。建议改用「子树」整块豁免。",
	wlPreviewNoFile: "（打开一个含标题的 Markdown 文件以预览本白名单的命中）",
	wlPreviewNone: "当前文件无标题被本白名单豁免。",
	wlPreviewSome: (count, titles) => `当前文件将豁免 ${count} 个标题：${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ 当前文件按路径规则实际使用模板「${appliedName}」，不是正在编辑的这个模板；下方预览仅为「假如本文件用此模板」的假设，实际编号以「${appliedName}」的白名单为准。`,
	wlPreviewNoTemplate:
		"⚠ 当前文件未命中任何路径规则（无可用模板），不会被自动编号；下方预览仅为假设。",

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
		"剥离全库所有 Markdown 文件中本插件写入的编号前缀（不在撤销历史内，建议先备份）；确认后会先关闭「全局自动编号」再清除，避免一编辑又被编回去，需要时可再手动开启。",
	clearVaultBtn: "清除全库编号…",

	aboutVersionLabel: "版本",
	aboutLinkRepo: "GitHub 仓库",
	aboutLinkIssues: "反馈问题（Issues）",

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
		"这将先关闭「全局自动编号」，再从全库所有 Markdown 文件中剥离本插件写入的编号前缀，把标题还原为裸标题。此操作通过 Vault API 写回、不在 Obsidian 撤销历史内，建议先备份。确认继续？",
	confirmClearVault: "确认清除全库",

	cmdToggle: "切换全局自动编号（全局）",
	cmdRenumber: "立即重新编号（当前文件）",
	cmdClear: "清除当前文件编号",
	cmdClearForeign: "清理非本插件的标题编号（当前文件）",

	noticeEnabled: "已启用全局自动编号",
	noticeDisabled: "已禁用全局自动编号",
	noticeNothingToClear: "当前文件无可清除的编号前缀",
	noticeCleared: "已清除编号",
	noticeClearedVault: (count) => `已清除全库编号（共修改 ${count} 个文件）`,
	noticeNoRule: "当前文件未匹配任何路径规则，无法编号",
	noticeRenumbered: "已重新编号",
	noticeNoChange: "无需改动",
	noticeNoForeign: "当前文件无可清理的外来编号",
	noticeForeignCleared: "已清理非本插件的标题编号",
	noticeBacklinksUpdated: (count) => `已更新 ${count} 处内部链接`,
	noticeBacklinksIntro:
		"Auto Headings 已自动更新了其它文件里指向本文件标题的内部链接（避免断链）。这些改动不在被改文件的撤销历史内；不需要此功能可在 设置 → 全局设置 关闭「同步内部链接」。本提示只出现一次。",
	noticeNoActiveFile: "没有打开的 Markdown 文件",
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
	languageChangeHint: "Command names update to the new language after the plugin is reloaded.",

	autoNumberName: "Global auto-numbering",
	autoNumberDesc:
		'When on, headings are numbered automatically as you edit; when off, you can still force single files on via frontmatter or trigger manually with "Renumber now".',

	debounceName: "Debounce delay",
	debounceDesc: (min, max, def) =>
		`How many milliseconds after you stop editing before auto-numbering runs. Range ${min}–${max} ms, default ${def} ms.`,
	resetTooltip: (def) => `Reset to default ${def} ms`,

	updateBacklinksName: "Sync internal links (backlinks)",
	updateBacklinksDesc:
		"When numbering rewrites a heading, automatically update internal links in other files that point to it (e.g. [[file#heading]]) so they don't break; note this modifies the referencing files outside their undo history.",

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
		`This path is already used by rule #${otherRow}; two rules can't map the same path to different templates. Edit or delete one of them first.`,

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
		"The shallowest heading level to number: shallower headings are neither numbered nor rewritten (default H2, so H1 acts as the title/section).",
	bottomLevelName: "End level",
	bottomLevelDesc:
		"The deepest heading level to number: deeper headings are left alone (must be ≥ the Start level; combine to number a range like H2–H4).",
	startIndexName: "Start number",
	startIndexDesc:
		"The number the first numbered heading starts from; applies to the first segment only (default 1; 0 gives 0.1.1, deeper levels still start at 1).",
	ancestorName: "Ancestor numeral rendering",
	ancestorDesc:
		'How ancestor segments render when inheriting: "Own style" uses each ancestor\'s own style; "All Arabic" renders ancestors as Arabic and only the current level in its own style (suited to Chinese books).',
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
	colPreview: "Preview",
	phPrefix: "Prefix",
	phSuffix: "Suffix",
	phSpace: "Space",
	previewInactive: "(not numbered)",
	previewHeadingWord: "Heading",

	skipFillName: "Skipped levels",
	skipFillDesc:
		"When headings skip a level (e.g. H5 right after H3): fill the missing segment with the placeholder (H5 gets four segments), drop it (H5 matches H4's shape), or leave the heading unnumbered entirely (for deep headings used as styled labels).",
	skipFillFill: "Fill",
	skipFillDrop: "Drop (omit the segment)",
	skipFillNone: "Don't number (leave as-is)",
	placeholderName: "Placeholder",
	placeholderDesc:
		"The digits used to fill a missing level (e.g. 0 gives 1.1.0.1); digits-only keeps numbering cleanly strippable, empty is treated as 0.",

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
		"Matched headings are not numbered and take no counter slot; Exact = fully equal, Partial = contains the word, Subtree = the whole block is exempt and numbering restarts after it (like chapters after an appendix).",
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
		"The matched heading has child headings; the children stay numbered and would attach to the previous numbered ancestor. Use “Subtree” to exempt the whole block.",
	wlPreviewNoFile: "(Open a Markdown file with headings to preview this whitelist's matches.)",
	wlPreviewNone: "No heading in the current file is exempted by this whitelist.",
	wlPreviewSome: (count, titles) =>
		`This whitelist will exempt ${count} heading(s) in the current file: ${titles}`,
	wlPreviewOtherTemplate: (appliedName) =>
		`⚠ By the path rules, the current file actually uses template "${appliedName}", not the one you're editing. The preview below is hypothetical ("if this file used this template"); actual numbering follows "${appliedName}"'s whitelist.`,
	wlPreviewNoTemplate:
		"⚠ The current file matches no path rule (no template applies), so it won't be auto-numbered. The preview below is hypothetical.",

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
		"Strip the numbering prefixes this plugin wrote from every Markdown file in the vault (NOT in undo history — back up first). Confirming first turns OFF global auto-numbering so edits don't re-number cleared files; re-enable it manually when wanted.",
	clearVaultBtn: "Clear vault numbering…",

	aboutVersionLabel: "Version",
	aboutLinkRepo: "GitHub repository",
	aboutLinkIssues: "Report an issue",

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
		"This will first turn OFF global auto-numbering, then strip the numbering prefixes this plugin wrote from every Markdown file in the vault, restoring bare headings. It writes back via the Vault API and is NOT in Obsidian's undo history — back up first. Continue?",
	confirmClearVault: "Confirm clear vault",

	cmdToggle: "Toggle global auto-numbering (global)",
	cmdRenumber: "Renumber now (current file)",
	cmdClear: "Clear numbering in current file",
	cmdClearForeign: "Clear non-plugin heading numbering (current file)",

	noticeEnabled: "Global auto-numbering enabled",
	noticeDisabled: "Global auto-numbering disabled",
	noticeNothingToClear: "No numbering prefix to clear in the current file",
	noticeCleared: "Numbering cleared",
	noticeClearedVault: (count) => `Vault numbering cleared (${count} file(s) changed)`,
	noticeNoRule: "The current file matches no path rule; cannot number it",
	noticeRenumbered: "Renumbered",
	noticeNoChange: "No change needed",
	noticeNoForeign: "No foreign (non-plugin) numbering to clear in the current file",
	noticeForeignCleared: "Cleared non-plugin heading numbering",
	noticeBacklinksUpdated: (count) => `Updated ${count} internal link(s)`,
	noticeBacklinksIntro:
		"Auto Headings just updated internal links in other files that point to headings in this file (so they don't break). Those edits are NOT in the modified files' undo history; you can turn off \"Sync internal links\" under Settings → General. This notice appears only once.",
	noticeNoActiveFile: "No open Markdown file",
};

/** 取某语言的文案表。 */
export function getMessages(lang: Lang): Messages {
	return lang === "en" ? en : zh;
}
