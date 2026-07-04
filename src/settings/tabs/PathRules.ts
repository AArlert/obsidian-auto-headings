import { Notice, Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import {
	autocompleteFolderSlash,
	findDuplicatePatternIndex,
	hasRootRule,
	type PathCandidate,
	type PathRule,
} from "../../pathrules";
import { DEFAULT_TEMPLATE_NAME } from "../../templates/schema";
import { closeAllPathSuggestPopups, PathSuggestPopup } from "./PathSuggest";

/**
 * 「路径与模板」TAB 的**路径规则**分区（见 spec.md §3.8）：可视化表格（路径模式 → 模板），
 * 可增删、可拖拽排序、可滚动（移动端横向滚动）；顶部在「无 `/` 根规则且全局自动编号=开」时
 * 显示兜底缺失提示条与快捷添加按钮。
 *
 * 路径输入接建议弹窗（`PathSuggest.ts`，testplan K13，参考 numeroflip/obsidian-auto-template-trigger
 * 的文件夹建议交互）：模糊匹配 vault 内全部文件夹 / 文件，选中文件夹自动带尾斜杠；手动输入不经
 * 弹窗时也有 {@link autocompleteFolderSlash} 兜底补全，避免「填文件夹名漏打尾斜杠→被当成对一个
 * 不存在的文件的精确匹配规则→该文件夹下文件仍套用旧规则」这一用户报告过的 bug。
 */
export function renderPathRules(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	// 每次重渲染前先清场：旧行的建议弹窗挂在 activeDocument.body 上，不随本函数的容器一起被清空。
	closeAllPathSuggestPopups();

	const t = tab.t;
	const plugin = tab.plugin;
	const rules = plugin.settings.pathRules;

	// 节头挂强化类：左侧强调色竖条 + 加大字号，与「模板」分区一眼可分（testplan L20）。
	new Setting(containerEl)
		.setName(t.pathRulesHeading)
		.setHeading()
		.settingEl.addClass("ah-section-head");
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
					rules.unshift({ pattern: "/", template: DEFAULT_TEMPLATE_NAME });
					await plugin.saveSettings();
					plugin.renumberActiveFile();
					tab.display();
				}),
		);
	}

	new Setting(containerEl).addButton((btn) =>
		btn.setButtonText(t.addRule).onClick(async () => {
			rules.push({ pattern: "", template: DEFAULT_TEMPLATE_NAME });
			await plugin.saveSettings();
			tab.display();
		}),
	);

	// —— 规则表格（可滚动；表头 sticky）——
	const table = containerEl.createDiv({ cls: "ah-path-table" });
	const head = table.createDiv({ cls: "ah-path-row ah-path-head" });
	for (const label of ["", "#", t.pathColPattern, t.pathColTemplate, ""]) {
		head.createDiv({ cls: "ah-path-cell", text: label });
	}

	if (rules.length === 0) {
		table.createEl("p", { cls: "ah-section-desc", text: t.pathEmpty });
	}

	rules.forEach((rule, index) => {
		renderPathRuleRow(tab, table, rule, index);
	});
}

/** 渲染单条路径规则行（拖拽手柄 + 行号 + 路径输入[含清空] + 模板下拉 + 删除）。 */
function renderPathRuleRow(
	tab: AutoHeadingsSettingTab,
	table: HTMLElement,
	rule: PathRule,
	index: number,
): void {
	const t = tab.t;
	const plugin = tab.plugin;
	const rules = plugin.settings.pathRules;
	const row = table.createDiv({ cls: "ah-path-row" });

	// 拖拽手柄（**仅手柄可发起拖拽**，整行不再 draggable——否则会妨碍路径输入框的文本选择）。
	const handle = row.createDiv({ cls: "ah-path-cell ah-path-handle", text: "⠿" });
	handle.setAttr("draggable", "true");
	handle.title = t.dragHandleTooltip;

	// 行号。
	row.createDiv({ cls: "ah-path-cell ah-path-index", text: String(index + 1) });

	// 路径模式输入（接建议弹窗 + 行内清空按钮）。
	const patternCell = row.createDiv({ cls: "ah-path-cell ah-path-pattern-cell" });
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
		rule.pattern = autocompleteFolderSlash(input.value, folderPaths).trim();
		// 阻断保存：同一路径模式（归一化后）不允许被两条规则同时占用，否则命中哪条取决于
		// 「靠后者胜出」的内部兜底顺序，用户体验上等于随机（见 pathrules.ts findDuplicatePatternIndex）。
		const dupIndex = findDuplicatePatternIndex(rules, index);
		if (dupIndex !== -1) {
			rule.pattern = previous;
			input.value = previous;
			new Notice(t.pathDuplicateWarn(dupIndex + 1));
			return;
		}
		input.value = rule.pattern;
		await plugin.saveSettings();
		plugin.renumberActiveFile();
		tab.display(); // 重新渲染以更新「兜底提示条」等。
	};

	const suggest = new PathSuggestPopup(
		input,
		() => collectPathCandidates(tab),
		(candidate) => {
			input.value = candidate.isFolder ? `${candidate.path}/` : candidate.path;
			input.focus();
			void commitPattern();
		},
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

	// 清空此路径的小按钮（只清空输入框文本，不删除整条规则）。
	const clearBtn = patternCell.createEl("span", {
		cls: "ah-input-clear",
		text: "✕",
	});
	clearBtn.setAttr("aria-label", t.clearInputTooltip);
	clearBtn.title = t.clearInputTooltip;
	clearBtn.addEventListener("click", () => {
		input.value = "";
		input.focus();
	});

	// 模板下拉（默认模板显示名随语言，存储值仍为固定名「默认」）。
	const tplCell = row.createDiv({ cls: "ah-path-cell" });
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
	// 规则引用的模板已不存在（理论上不应发生）时，补一个失效项以免静默改投。
	if (!plugin.templateStore.has(rule.template)) {
		const opt = select.createEl("option", {
			value: rule.template,
			text: t.templateMissingSuffix(rule.template),
		});
		opt.selected = true;
	}
	select.addEventListener("change", () => {
		rule.template = select.value;
		void plugin.saveSettings().then(() => {
			plugin.renumberActiveFile();
		});
	});

	// 删除整条规则（无背景的 ✕，不再是被椭圆按钮包住的样式）。
	const delCell = row.createDiv({ cls: "ah-path-cell" });
	const del = delCell.createEl("span", { cls: "ah-path-del", text: "✕" });
	del.setAttr("aria-label", t.deleteRuleTooltip);
	del.title = t.deleteRuleTooltip;
	del.addEventListener("click", () => {
		rules.splice(index, 1);
		void plugin.saveSettings().then(() => {
			plugin.renumberActiveFile();
			tab.display();
		});
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
		const [moved] = rules.splice(from, 1);
		rules.splice(index, 0, moved);
		void plugin.saveSettings().then(() => {
			plugin.renumberActiveFile();
			tab.display();
		});
	});
}

/**
 * 收集 vault 内全部文件夹 / 文件，转成建议弹窗用的候选列表（`PathSuggest.ts` 按输入模糊过滤 + 排序）。
 * 与旧版「分层 datalist」不同——不再局限于当前输入所在目录的直接子项，而是让模糊匹配 + 排序
 * 自己挑出相关项（参考 numeroflip/obsidian-auto-template-trigger 的 `FolderSuggest`）。
 */
function collectPathCandidates(tab: AutoHeadingsSettingTab): PathCandidate[] {
	const vault = tab.plugin.app.vault as unknown as {
		getAllLoadedFiles?: () => Array<{ path: string; children?: unknown }>;
	};
	const all = vault.getAllLoadedFiles?.() ?? [];
	// 根目录本身（`TFolder.path === ""`）恒可选，渲染 / 选中时按 `${path}/` 规则自然显示 `/`。
	const candidates: PathCandidate[] = [{ path: "", isFolder: true }];
	for (const f of all) {
		if (!f.path) {
			continue;
		}
		candidates.push({ path: f.path, isFolder: Array.isArray(f.children) });
	}
	return candidates;
}
