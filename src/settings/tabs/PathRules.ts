import { Menu, Notice, Setting, setIcon } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import type { Messages } from "../../i18n";
import {
	autocompleteFolderSlash,
	findDuplicatePatternIndex,
	hasRootRule,
	NO_NUMBERING_TEMPLATE,
	resolvePathRule,
	ruleMode,
	type PathCandidate,
	type PathRule,
} from "../../pathrules";
import { cloneRules, isQuietTransition } from "../../virtual/modeSwitch";
import { DEFAULT_TEMPLATE_NAME } from "../../templates/schema";
import { closeAllPathSuggestPopups, type PathSuggestLabels, PathSuggestPopup } from "./PathSuggest";
import { BatchRenumberModal, ModeTransitionModal } from "./PathRuleModals";

/** 分层浏览模式的提示文案，从当前语言的 `t` 里挑出对应键（见 `PathSuggest.ts` `PathSuggestLabels`）。 */
function suggestLabelsOf(t: Messages): PathSuggestLabels {
	return {
		emptyFolder: t.pathSuggestEmptyFolder,
		backTooltip: t.pathSuggestBackTooltip,
		descendTooltip: t.pathSuggestDescendTooltip,
		selectHereTooltip: t.pathSuggestSelectHereTooltip,
	};
}

/**
 * 把设置项标题行右侧的按钮渲染成「图标 + 文字」（1.2.2：「添加规则」「新增模板」挪到各自标题行右侧，
 * 普通按钮，见 testplan L32 / L34）。
 */
export function decorateHeadingButton(
	buttonEl: HTMLButtonElement,
	icon: string,
	text: string,
): void {
	buttonEl.empty();
	buttonEl.addClass("ah-heading-btn");
	setIcon(buttonEl.createSpan({ cls: "ah-heading-btn-icon" }), icon);
	buttonEl.createSpan({ text });
}

/**
 * 「路径模板」TAB 的**路径规则**分区（见 spec.md §3.8）：可视化表格（路径模式 → 模板 → 模式），
 * 可增删、可拖拽排序、可纵向滚动；顶部在「无 `/` 根规则且全局自动编号=开」时显示兜底缺失提示条与
 * 快捷添加按钮。
 *
 * 1.2.2 视觉更新（testplan L32 / L33 / L13）：去掉行号列，原位置放「当前笔记圆点」（活动笔记实际
 * 解析到的那条规则）；「添加规则」挪到标题行右侧；表下一行灰字说明未命中的笔记不编号；窄屏
 * （≤ 480px）每条规则两行，批量重编号与删除收进 ⋯ 菜单（布局由 styles.css 的媒体查询切换）。
 *
 * 路径输入接建议弹窗（`PathSuggest.ts`，testplan K13/K14，参考 numeroflip/obsidian-auto-template-trigger
 * 的文件夹建议交互）：输入框为空时分层浏览（从根逐层点击文件夹下钻），有输入时模糊匹配 vault 内
 * 全部文件夹 / 文件；选中文件夹自动带尾斜杠。手动输入不经弹窗时也有 {@link autocompleteFolderSlash}
 * 兜底补全，避免「填文件夹名漏打尾斜杠→被当成对一个不存在的文件的精确匹配规则→该文件夹下文件
 * 仍套用旧规则」这一用户报告过的 bug。
 */
export function renderPathRules(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	// 每次重渲染前先清场：旧行的建议弹窗挂在 activeDocument.body 上，不随本函数的容器一起被清空。
	closeAllPathSuggestPopups();

	const t = tab.t;
	const plugin = tab.plugin;
	const rules = plugin.settings.pathRules;

	new Setting(containerEl)
		.setName(t.pathRulesHeading)
		.setHeading()
		.addButton((btn) => {
			decorateHeadingButton(btn.buttonEl, "plus", t.addRule);
			btn.onClick(async () => {
				// 新规则的模式跟随根规则（M14）：新装用户根规则是「仅显示」，新加的文件夹规则若默认写入，
				// 一填路径就会开始往文件里写编号，违背他们没做过的选择。路径为空时不匹配任何文件，直接存。
				const root = rules.find((r) => r.pattern.trim() === "/");
				rules.push({
					pattern: "",
					template: DEFAULT_TEMPLATE_NAME,
					...(root && ruleMode(root) === "virtual" ? { mode: "virtual" as const } : {}),
				});
				await plugin.saveSettings();
				tab.display();
			});
		});
	containerEl.createEl("p", { cls: "ah-section-desc", text: t.pathRulesDesc });

	// —— 兜底缺失提示条 ——
	if (!hasRootRule(rules) && plugin.settings.autoNumber) {
		const warn = containerEl.createDiv({ cls: "ah-path-warn" });
		warn.createSpan({ text: t.pathNoRootWarn });
		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText(t.addRootRule)
				.setCta()
				.onClick(async () => {
					await commitRules(tab, [
						{ pattern: "/", template: DEFAULT_TEMPLATE_NAME },
						...cloneRules(rules),
					]);
				}),
		);
	}

	// —— 规则表格（可滚动；表头 sticky、无底色，只留浅色列名）——
	const table = containerEl.createDiv({ cls: "ah-path-table" });
	const head = table.createDiv({ cls: "ah-path-row ah-path-head" });
	for (const [label, cls] of [
		["", "ah-path-c-handle"],
		["", "ah-path-c-dot"],
		[t.pathColPattern, "ah-path-c-pattern"],
		[t.pathColTemplate, "ah-path-c-template"],
		[t.pathColMode, "ah-path-c-mode"],
		["", "ah-path-c-actions"],
	]) {
		head.createDiv({ cls: `ah-path-cell ${cls}`, text: label });
	}

	if (rules.length === 0) {
		table.createEl("p", { cls: "ah-section-desc", text: t.pathEmpty });
	}

	// 当前笔记实际解析到的规则（与编号判定同一口径），在它那一行画圆点。
	const activePath = plugin.activeNotePath();
	const activeRule = activePath ? resolvePathRule(rules, activePath) : null;
	rules.forEach((rule, index) => {
		renderPathRuleRow(tab, table, rule, index, rule === activeRule);
	});

	containerEl.createEl("p", { cls: "ah-path-hint", text: t.pathNoMatchHint });
}

/**
 * 渲染单条路径规则行：拖拽手柄 + 当前笔记圆点 + 路径输入（含清空）+ 模板下拉 + 模式下拉 +
 * 行尾操作（桌面：批量重编号 / 删除；窄屏：⋯ 菜单）。
 */
function renderPathRuleRow(
	tab: AutoHeadingsSettingTab,
	table: HTMLElement,
	rule: PathRule,
	index: number,
	isActive: boolean,
): void {
	const t = tab.t;
	const plugin = tab.plugin;
	const rules = plugin.settings.pathRules;
	const row = table.createDiv({ cls: "ah-path-row" });

	// 拖拽手柄（**仅手柄可发起拖拽**，整行不再 draggable——否则会妨碍路径输入框的文本选择）。
	const handle = row.createDiv({ cls: "ah-path-cell ah-path-c-handle ah-path-handle" });
	setIcon(handle, "grip-vertical");
	handle.setAttr("draggable", "true");
	handle.setAttr("aria-label", t.dragHandleTooltip);
	handle.title = t.dragHandleTooltip;

	// 当前笔记圆点（取代原行号列，testplan L32）。
	const dotCell = row.createDiv({ cls: "ah-path-cell ah-path-c-dot" });
	if (isActive) {
		const dot = dotCell.createSpan({ cls: "ah-path-dot" });
		dot.setAttr("aria-label", t.activeRuleTooltip);
		dot.title = t.activeRuleTooltip;
	}

	// 路径模式输入（接建议弹窗 + 行内清空按钮）。
	const patternCell = row.createDiv({
		cls: "ah-path-cell ah-path-c-pattern ah-path-pattern-cell",
	});
	const input = patternCell.createEl("input", { type: "text", cls: "ah-text-input" });
	input.value = rule.pattern;
	input.placeholder = t.pathInputPlaceholder;

	const commitPattern = async () => {
		const previous = rule.pattern;
		const folderPaths = collectPathCandidates(tab)
			.filter((c) => c.isFolder)
			.map((c) => c.path);
		// 手动输入未选建议项时的兜底：填的是某个真实文件夹名却漏打尾斜杠，自动补全
		// （testplan K13）；已选自建议弹窗的路径已在 `selectSuggestion` 里补过，这里是幂等的。
		const next = autocompleteFolderSlash(input.value, folderPaths).trim();
		if (next === previous) {
			input.value = previous; // 没改（失焦也会触发）：不存盘、不弹切换确认框。
			return;
		}
		const after = cloneRules(rules);
		after[index].pattern = next;
		// 阻断保存：同一路径模式（归一化后）不允许被两条规则同时占用，否则命中哪条取决于
		// 「靠后者胜出」的内部兜底顺序，用户体验上等于随机（见 pathrules.ts findDuplicatePatternIndex）。
		const dupIndex = findDuplicatePatternIndex(after, index);
		if (dupIndex !== -1) {
			input.value = previous;
			new Notice(t.pathDuplicateWarn(dupIndex + 1));
			return;
		}
		input.value = next;
		await commitRules(tab, after); // 内含重新渲染（更新「兜底提示条」等）。
	};

	const suggest = new PathSuggestPopup(
		input,
		() => collectPathCandidates(tab),
		(candidate) => {
			input.value = candidate.isFolder ? `${candidate.path}/` : candidate.path;
			input.focus();
			void commitPattern();
		},
		suggestLabelsOf(t),
	);
	input.addEventListener("keydown", (e) => {
		if (suggest.handleKeydown(e)) {
			return; // 弹窗展开时，↑↓/Enter/Esc 交给弹窗自己处理（见 PathSuggest.ts）。
		}
		if (e.key === "Enter") {
			e.preventDefault();
			input.blur();
		}
	});
	input.addEventListener("blur", () => void commitPattern());

	// 清空此路径的小按钮（只清空输入框文本，不删除整条规则）。桌面端悬停 / 聚焦时才出现，
	// 触屏常显（styles.css，testplan L6）。
	const clearBtn = patternCell.createEl("span", { cls: "ah-input-clear" });
	setIcon(clearBtn, "x");
	clearBtn.setAttr("aria-label", t.clearInputTooltip);
	clearBtn.title = t.clearInputTooltip;
	// mousedown 先于输入框 blur：阻止默认行为，免得点 ✕ 时输入框先失焦把旧值提交一遍。
	clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
	clearBtn.addEventListener("click", () => {
		input.value = "";
		input.focus();
	});

	// 模板下拉（默认模板显示名随语言，存储值仍为固定名「默认」）。
	const tplCell = row.createDiv({ cls: "ah-path-cell ah-path-c-template" });
	const select = tplCell.createEl("select", { cls: "dropdown" });
	for (const tpl of plugin.templateStore.all()) {
		const opt = select.createEl("option", {
			value: tpl.name,
			text: tab.templateDisplayName(tpl.name),
		});
		if (tpl.name === rule.template) {
			opt.selected = true;
		}
	}
	// 「不编号」（M12，testplan K15）：1.3.0 起挪到右边的「模式」下拉（S23），数据仍是伪模板哨兵。
	// 这里只在规则处于「不编号」时放一个占位项并置灰，模板名没有意义。
	if (rule.template === NO_NUMBERING_TEMPLATE) {
		select.createEl("option", { value: NO_NUMBERING_TEMPLATE, text: "—" }).selected = true;
		select.disabled = true;
	}
	// 规则引用的模板已不存在（理论上不应发生）时，补一个失效项以免静默改投（伪模板不算失效）。
	if (rule.template !== NO_NUMBERING_TEMPLATE && !plugin.templateStore.has(rule.template)) {
		const opt = select.createEl("option", {
			value: rule.template,
			text: t.templateMissingSuffix(rule.template),
		});
		opt.selected = true;
	}
	select.addEventListener("change", () => {
		const after = cloneRules(rules);
		after[index].template = select.value;
		// 内含重绘：切到/切出「不编号」要同步置灰/恢复批量按钮（K16）与模式下拉框。
		void commitRules(tab, after);
	});

	// 编号模式下拉（M14，spec §3.22）：写入文件 / 仅显示。「不编号」规则没有编号可言，置灰。
	const modeCell = row.createDiv({ cls: "ah-path-cell ah-path-c-mode" });
	const modeSelect = modeCell.createEl("select", { cls: "dropdown" });
	modeSelect.title = t.pathModeTooltip;
	const modeOptions: Array<[string, string]> = [
		["write", t.pathModeWrite],
		["virtual", t.pathModeVirtual],
		["none", t.pathTemplateNone],
	];
	const currentMode = rule.template === NO_NUMBERING_TEMPLATE ? "none" : ruleMode(rule);
	for (const [value, text] of modeOptions) {
		const opt = modeSelect.createEl("option", { value, text });
		if (currentMode === value) {
			opt.selected = true;
		}
	}
	modeSelect.addEventListener("change", () => {
		const after = cloneRules(rules);
		const picked = modeSelect.value;
		if (picked === "none") {
			after[index].template = NO_NUMBERING_TEMPLATE;
		} else {
			// 从「不编号」切回时模板名已无从恢复，退回默认模板；用户可再在左边挑别的。
			if (after[index].template === NO_NUMBERING_TEMPLATE) {
				after[index].template = DEFAULT_TEMPLATE_NAME;
			}
			after[index].mode = picked === "virtual" ? "virtual" : "write";
		}
		void commitRules(tab, after);
	});

	// —— 行尾操作 ——
	// 批量重编号（M12，testplan K16）：确认对话框后对该规则命中的全部文件生效；「不编号」/
	// 「仅显示」规则没有要写进文件的编号，置灰并说明原因。
	const batchBlocked =
		rule.template === NO_NUMBERING_TEMPLATE
			? t.batchRenumberNoneTooltip
			: ruleMode(rule) === "virtual"
				? t.batchRenumberVirtualTooltip
				: null;
	const runBatch = () => {
		const count = plugin.matchedMarkdownFiles(rule).length;
		if (count === 0) {
			new Notice(t.noticeBatchNoMatch);
			return;
		}
		new BatchRenumberModal(plugin.app, t, rule.pattern, count, () => {
			void plugin.batchRenumberRule(rule);
		}).open();
	};
	const deleteRule = () => {
		const after = cloneRules(rules);
		after.splice(index, 1);
		void commitRules(tab, after);
	};

	const actions = row.createDiv({ cls: "ah-path-cell ah-path-c-actions" });
	// 桌面：两个图标按钮常驻。
	const batch = actions.createEl("span", { cls: "ah-path-icon-btn ah-path-batch" });
	setIcon(batch, "list-ordered");
	if (batchBlocked) {
		batch.addClass("ah-path-batch-disabled");
		batch.setAttr("aria-label", batchBlocked);
		batch.title = batchBlocked;
	} else {
		batch.setAttr("aria-label", t.batchRenumberTooltip);
		batch.title = t.batchRenumberTooltip;
		batch.addEventListener("click", runBatch);
	}
	const del = actions.createEl("span", { cls: "ah-path-icon-btn ah-path-del" });
	setIcon(del, "x");
	del.setAttr("aria-label", t.deleteRuleTooltip);
	del.title = t.deleteRuleTooltip;
	del.addEventListener("click", deleteRule);
	// 窄屏：同样两项收进 ⋯ 菜单（testplan L33；显隐由 styles.css 媒体查询切换）。
	const more = actions.createEl("span", { cls: "ah-path-icon-btn ah-path-more" });
	setIcon(more, "more-horizontal");
	more.setAttr("aria-label", t.moreActionsTooltip);
	more.addEventListener("click", (e) => {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(batchBlocked ?? t.batchRenumberTooltip)
				.setIcon("list-ordered")
				.setDisabled(batchBlocked !== null)
				.onClick(runBatch);
		});
		menu.addItem((item) => {
			item.setTitle(t.deleteRuleTooltip).setIcon("x").setWarning(true).onClick(deleteRule);
		});
		menu.showAtMouseEvent(e);
	});

	// —— 拖拽排序 ——
	// 拖拽**从手柄发起**（draggable 只设在手柄上）；行本身仍作放置目标（dragover / drop）。
	handle.addEventListener("dragstart", (e) => {
		e.dataTransfer?.setData("text/plain", String(index));
		row.addClass("ah-path-dragging");
	});
	handle.addEventListener("dragend", () => row.removeClass("ah-path-dragging"));
	row.addEventListener("dragover", (e) => {
		e.preventDefault();
		row.addClass("ah-path-dragover");
	});
	row.addEventListener("dragleave", () => row.removeClass("ah-path-dragover"));
	row.addEventListener("drop", (e) => {
		e.preventDefault();
		row.removeClass("ah-path-dragover");
		const from = Number(e.dataTransfer?.getData("text/plain"));
		if (!Number.isInteger(from) || from === index) {
			return;
		}
		const after = cloneRules(rules);
		const [moved] = after.splice(from, 1);
		after.splice(index, 0, moved);
		void commitRules(tab, after);
	});
}

/**
 * 提交一次路径规则变动（M14，spec §3.22「切换模式」）：先算出哪些文件会换模式，需要时弹切换确认框，
 * 确认后才替换设置、落盘，再按用户勾选清除 / 写入编号；取消则规则原样不动（重绘把界面还原）。
 * 没有文件受影响时直接生效，不打扰用户。
 */
async function commitRules(tab: AutoHeadingsSettingTab, after: PathRule[]): Promise<void> {
	const plugin = tab.plugin;
	const before = cloneRules(plugin.settings.pathRules);
	const plan = await plugin.planModeTransition(before, after);
	const apply = async (opts: { clear: boolean; write: boolean } | null): Promise<void> => {
		plugin.settings.pathRules = after;
		await plugin.saveSettings();
		if (opts) {
			await plugin.applyModeTransition(plan, opts);
		}
		plugin.renumberActiveFile();
		tab.display();
	};
	if (isQuietTransition(plan)) {
		await apply(null);
		return;
	}
	new ModeTransitionModal(
		plugin.app,
		tab.t,
		plan,
		(opts) => void apply(opts),
		() => tab.display(),
	).open();
}

/**
 * 收集 vault 内全部文件夹 / 文件，转成建议弹窗用的候选列表：输入框有内容时交给
 * `filterPathCandidates` 扁平模糊过滤 + 排序（参考 numeroflip/obsidian-auto-template-trigger 的
 * `FolderSuggest`），输入框为空时交给 `listImmediateChildren` 做分层浏览（testplan K14）。
 *
 * **不注入合成根候选**：参考实现 `FolderSuggest.getSuggestions` 用 `folder.path &&` 显式排除根
 * 目录——本插件早先手动 `push({path:"",isFolder:true})` 意图是让「/」可从下拉一键选中，但一旦
 * 该候选的路径恰好提交为 `/` 后再次聚焦，`filterPathCandidates` 的子串匹配会把它自己排除掉、
 * 转而只剩「路径字面含 `/`」的深层嵌套项，观感诡异（testplan K14）。根规则改由分层浏览模式的
 * 顶部 header（可点击选中当前层，根层即「/」）承接，不再经过扁平模糊匹配这条路径。
 */
function collectPathCandidates(tab: AutoHeadingsSettingTab): PathCandidate[] {
	const vault = tab.plugin.app.vault as unknown as {
		getAllLoadedFiles?: () => Array<{ path: string; children?: unknown }>;
	};
	const all = vault.getAllLoadedFiles?.() ?? [];
	const candidates: PathCandidate[] = [];
	for (const f of all) {
		if (!f.path) {
			continue;
		}
		candidates.push({ path: f.path, isFolder: Array.isArray(f.children) });
	}
	return candidates;
}
