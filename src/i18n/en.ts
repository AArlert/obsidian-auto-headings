// en 语言文案表（从原 i18n.ts 按语言拆出）。
import type { Messages } from "./types";

/** English copy. */
const en: Messages = {
	tabGeneral: "General",
	tabTemplates: "Paths & templates",
	tabMaintenance: "Maintenance",
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

	headingLinkSuggestName: "Suggest heading links as you type",
	headingLinkSuggestDesc: "Suggest vault headings matching what you type; Tab inserts a link.",
	headingSuggestThisFile: "(this file)",
	noticeHeadingIndexTruncated: (indexed) =>
		`Vault too large: heading index built partially (${indexed} headings indexed); suggestions work within the indexed range.`,
	vcTargetName: "Show suggestions in",
	vcTargetDesc: "This plugin's popup covers VC's; with VC, headings join VC's popup.",
	vcTargetPlugin: "This plugin's popup",
	vcTargetVc: "Various Complements' popup",

	sectionInterface: "Interface",
	sectionNumbering: "Auto-numbering",
	sectionLinking: "Link maintenance",
	sectionSuggest: "Heading link suggestions",
	sectionNoteEntry: "Menus",
	headingMenuName: "Heading menu",
	headingMenuDesc:
		"Right-click the arrow left of a heading: change level, skip numbering, copy link.",
	statusBarMenuName: "Status bar menu",
	statusBarMenuDesc:
		"Status bar shows this note's numbering state; click to switch auto-numbering or template.",

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
		'Write VC settings: dictionary path + "Custom dictionary complement" + trigger threshold of at least 2 characters',
		'Clear VC\'s "Displayed text suffix" (global: affects your other custom dictionaries too)',
		'Raise VC\'s "Max number of suggestions" to at least 10 (global; only raised, never lowered)',
		"Reload VC dictionaries after writing (failure is reported separately)",
	],
	vcDescriptionOffHint: "VC hides the candidate source line (Description on suggestion: None).",
	vcOffConfirmTitle: "Stop dictionary integration",
	vcOffConfirmBody:
		"The heading dictionary will no longer be updated. Various Complements still loads it — remove it from VC too? If kept, VC keeps using this stale dictionary (renamed headings may insert broken links).",
	vcOffKeepButton: "Keep",
	vcOffRemoveButton: "Remove from VC",
	vcStaleDictName: "VC still loads the old heading dictionary",
	vcStaleDictDesc: "It is no longer updated; renamed headings may insert broken links.",
	vcStaleDictRemoveButton: "Remove",
	noticeVcDictRemoved: "Removed this plugin's heading dictionary from Various Complements.",
	noticeVcDictRemoveFailed:
		"Couldn't read Various Complements' settings. Please remove this dictionary path in VC's settings manually.",
	vcAutoConfirmButton: "Confirm & configure",
	vcAutoManualButton: "Manual setup",
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
	pathColPattern: "Path",
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
	pathColMode: "Numbering",
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

	clearVaultName: "Clear numbering in the whole vault",
	clearVaultDesc: "Remove this plugin's numbering from every note and turn off auto-numbering.",
	clearVaultBtn: "Clear vault numbering…",
	freezeVaultName: "Freeze numbering and release ownership",
	freezeVaultDesc: "Keep the numbers, drop the invisible markers, stop auto-numbering.",
	freezeVaultBtn: "Freeze numbering…",
	retiredBannerTitle: "The plugin has released ownership of your numbering",
	retiredBannerBody:
		"Your numbers remain as ordinary text and the plugin is currently doing no automatic numbering. To hand control back: press the button below, then run “Clean foreign numbering” on the affected files, or existing numbers get stacked with a fresh prefix.",
	resumeBtn: "Resume managing numbering",

	aboutLinkRepo: "GitHub repository",
	aboutLinkIssues: "Report an issue",

	aboutCreditsHeading: "Credits",
	aboutCreditsIntro: "Development drew on ideas from these open-source plugins.",
	aboutCreditPathSuggest: "Folder / file suggestions and matching for path input",
	aboutCreditBacklinks: "The original reference for backlink sync",
	aboutCreditWordJoiner: "The original reference for marking numbers with invisible characters",

	defaultTemplateDisplay: "Default",

	delModalTitle: (name) => `Delete template "${name}"`,
	delModalBody: (count) => `The following ${count} path rule(s) use this template:`,
	delModalEmptyPath: "(empty path)",
	delModalRedirect: "After deletion, these rules use",
	delModalDeleteRules: "Delete these rules",
	cancel: "Cancel",
	confirmDelete: "Confirm delete",

	clearVaultModalTitle: "Clear vault numbering",
	clearVaultTurnOffAuto: "Also turn off auto-numbering",
	clearVaultTurnOffAutoHint: "(so numbers are not added right back)",
	clearVaultModalBody:
		"First turns OFF global auto-numbering, then strips this plugin's prefixes from every Markdown file, restoring bare headings (links update too when “Sync internal links (backlinks)” is on). NOT in Obsidian's undo history — back up first. Continue?",
	confirmClearVault: "Confirm clear vault",

	freezeVaultModalTitle: "Freeze numbering and release ownership",
	freezeVaultModalBody:
		"Confirming: (1) your numbers are kept as-is, becoming ordinary text; (2) the invisible markers (U+2060) are removed vault-wide — including inside link anchors, so [[note#heading]] still resolves; (3) the plugin stops all automatic numbering (overrides frontmatter); (4) NOT in undo history — back up first; (5) to take over again later, run “Clean foreign numbering” first, or a fresh prefix gets stacked on top. Continue?",
	confirmFreezeVault: "Confirm freeze and release",

	foreignGuardModalTitle: "Possible non-plugin numbering",
	foreignGuardModalBody: (count) =>
		`The following ${count} heading(s) look numbered, but the plugin can't be sure you wrote them yourself ("API design", "TODO list", etc. can false-positive). All are checked by default; unchecking one keeps its text as-is (the plugin will still add its own numbering):`,
	foreignGuardItemToggle: (before) => `Clean up foreign numbering in "${before}"`,
	foreignGuardSearchPlaceholder: "Search headings…",
	foreignGuardSearchEmpty: "No matching headings",

	cmdToggle: "Toggle global auto-numbering",
	cmdRenumber: "Renumber current note",
	cmdClear: "Clear numbering in current note",
	cmdClearForeign: "Clear non-plugin heading numbering in current note",
	cmdClearStale: "Clear leftover numbering in current note (display-only mode)",
	cmdCopyOutline: "Copy numbered outline",
	cmdCopySectionLink: "Copy current section link",
	cmdCopySectionEmbed: "Copy current section embed link",
	cmdToggleHeadingSkip: "Skip / restore numbering for heading at cursor",
	cmdPromoteSection: "Promote current section",
	cmdDemoteSection: "Demote current section",
	cmdPromoteHeading: "Promote current heading (without subheadings)",
	cmdDemoteHeading: "Demote current heading (without subheadings)",
	cmdChooseNoteTemplate: "Choose template for current note…",
	cmdToggleNoteAuto: "Toggle auto-numbering for current note",
	menuToggleSkip: "Skip numbering for this heading",
	menuToggleSkipTree: "Skip numbering for the whole section (with sub-headings)",
	menuCopySectionEmbed: "Copy section embed",
	cmdToggleSectionSkip: "Skip / restore numbering for the whole section at cursor",
	menuCopySectionLink: "Copy section link",
	menuAdjustHeading: "Set this heading's level",
	menuAdjustSection: "Set section level (with subheadings)",
	menuNoteSettings: "Numbering settings for this note…",
	menuBack: "Back",
	handleHint: "Drag to move the section · right-click for menu",
	handleHintReading: "Right-click for menu",
	menuHandleLabel: (text, level) => `${text} · H${level}`,
	noticeSectionShiftOutOfRange:
		"A heading in this section would leave levels 1–6; nothing changed",
	noticeNoteTemplateNoRule:
		"No numbering is enabled for this note's path; add a path rule in settings first",
	noticeNoteTemplateSet: (name) => `This note now uses template "${name}"`,
	noticeNoteAutoOn: "This note is set to always auto-number",
	noticeNoteAutoOff: "This note is set to not auto-number",
	noticeNoTemplates: "No templates available",
	chooseTemplatePlaceholder: "Choose a template for this note…",
	chooseTemplateFollowRule: "(Follow path rule — clear this note's override)",
	noticeNoteTemplateCleared: "This note now follows its path rule's template",
	statusModeWrite: "Write",
	statusModeVirtual: "Display only",
	statusNoNumbering: "Not numbered",
	statusPausedByNote: "Paused for note",
	statusLabel: (mode, template) => `${mode} · ${template}`,
	statusMenuRule: (path) => `Matching rule: ${path}`,
	statusMenuNoRule: "No path rule matches",
	statusMenuAutoFollow: "Auto-numbering: follow global",
	statusMenuAutoOn: "Auto-numbering: always for this note",
	statusMenuAutoOff: "Auto-numbering: never for this note",
	statusMenuChangeTemplate: "Change template…",
	statusMenuRenumber: "Renumber now",
	statusMenuCopyOutline: "Copy numbered outline",
	statusMenuClearStale: "Clear leftover numbering",
	statusMenuCleanForeign: "Clean up handwritten numbering…",
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
	noticeSectionEmbedCopied: (label) => `Copied embed link: ${label}`,
	noticeForeignNumberingGuardAction: "Review and clean up",
	noticeForeignGuardFileNotOpen: "This file is no longer open in any tab; reopen it to clean up",
	pathNoMatchHint: "Notes that match no rule are not numbered.",
	activeRuleTooltip: "The current note uses this rule",
	moreActionsTooltip: "More actions",
	templateBuiltinTag: "Built-in",
	templateCardUsage: (rules, whitelist) =>
		`Used by ${rules} ${rules === 1 ? "rule" : "rules"} · ${whitelist} whitelist ${whitelist === 1 ? "entry" : "entries"}`,
	editBtn: "Edit",
	templateActionsTooltip: "Template actions",
	cardSampleTitles: ["Document title", "Overview", "Background", "Details", "Key point", "Notes"],
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
	editorQuickApply: "Quick apply",
	editorHistory: "History",
	quickRecentHeading: "Recently used styles",
	quickPresetHeading: "Common numbering schemes",
	quickNoRecent: "No saved styles yet",
	presetDecimal: "Decimal · 1 / 1.1 / 1.1.1",
	presetChapter: "Chapters · 第一章 / 第一节",
	presetOfficial: "Official · 一、/（一）/ 1.",
	presetLegal: "Legal · 第一编 / 第一章 / 第一条",
	presetOutline: "Outline · I. / A. / 1.",
	historyTitle: (name) => `Style history of "${name}"`,
	historyEmpty:
		"No history yet — closing the editor after a style change leaves a snapshot here.",
	historyRestore: "Restore",
	historyCurrent: "Same as current",
	wlLegendIntro: "Matching headings are not numbered and take no number:",
	wlLegendExact: "exact",
	wlLegendPartial: "contains the word",
	wlLegendSubtree: "whole section exempt, numbering resumes after",
	maintVaultHeading: "Whole vault",
	maintVaultMeta: "Can't be undone — back up first",
	noticeStaleNotVirtual: "This note isn't in display-only mode, so it has no leftover numbering.",
	confirmWordPrompt: (word) => `Type "${word}" to confirm`,
	clearVaultWord: "clear",
	freezeVaultWord: "freeze",
	aboutDescription:
		"Numbers headings from templates — display only or written into the note — and keeps links in sync when headings change.",
	foreignGuardSelectAll: "Select all",
	foreignGuardSelected: (selected, total) => `${selected} of ${total} selected`,
	foreignGuardUndoHint: "Changes to this note can be undone with Ctrl+Z",
	foreignGuardConfirmCount: (count) => `Clean up ${count}`,
	noticeForeignGuardCount: (count, virtual) =>
		`${count} ${count === 1 ? "heading looks" : "headings look"} hand-numbered here, so numbers were ${virtual ? "not shown" : "not added"} this time.`,
};

export default en;
