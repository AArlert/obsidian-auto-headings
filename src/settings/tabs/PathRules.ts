import { Notice, Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { findDuplicatePatternIndex, hasRootRule, type PathRule } from "../../pathrules";
import { DEFAULT_TEMPLATE_NAME } from "../../templates/schema";

/**
 * 「路径与模板」TAB 的**路径规则**分区（见 spec.md §3.8）：可视化表格（路径模式 → 模板），
 * 可增删、可拖拽排序、可滚动（移动端横向滚动）；顶部在「无 `/` 根规则且全局自动编号=开」时
 * 显示兜底缺失提示条与快捷添加按钮。
 */
export function renderPathRules(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
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

	// 路径模式输入（接**分层** datalist 补全 + 行内清空按钮）。
	const patternCell = row.createDiv({ cls: "ah-path-cell ah-path-pattern-cell" });
	const input = patternCell.createEl("input", { type: "text", cls: "ah-text-input" });
	input.value = rule.pattern;
	input.placeholder = t.pathInputPlaceholder;

	// 每行独立的 datalist，随输入分层更新（输入 `/` 先给根 + 第一层，逐层展开）。
	const datalist = patternCell.createEl("datalist") as HTMLDataListElement;
	datalist.id = `ah-path-suggest-${index}`;
	input.setAttr("list", datalist.id);
	updatePathDatalist(tab, datalist, input.value);
	input.addEventListener("input", () => updatePathDatalist(tab, datalist, input.value));

	const commitPattern = async () => {
		const previous = rule.pattern;
		rule.pattern = input.value.trim();
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
	input.addEventListener("blur", () => void commitPattern());
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			input.blur();
		}
	});

	// 清空此路径的小按钮（只清空输入框文本，不删除整条规则）。
	const clearBtn = patternCell.createEl("span", {
		cls: "ah-input-clear",
		text: "✕",
	});
	clearBtn.setAttr("aria-label", t.clearInputTooltip);
	clearBtn.title = t.clearInputTooltip;
	clearBtn.addEventListener("click", () => {
		input.value = "";
		updatePathDatalist(tab, datalist, "");
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
	select.addEventListener("change", async () => {
		rule.template = select.value;
		await plugin.saveSettings();
		plugin.renumberActiveFile();
	});

	// 删除整条规则（无背景的 ✕，不再是被椭圆按钮包住的样式）。
	const delCell = row.createDiv({ cls: "ah-path-cell" });
	const del = delCell.createEl("span", { cls: "ah-path-del", text: "✕" });
	del.setAttr("aria-label", t.deleteRuleTooltip);
	del.title = t.deleteRuleTooltip;
	del.addEventListener("click", async () => {
		rules.splice(index, 1);
		await plugin.saveSettings();
		plugin.renumberActiveFile();
		tab.display();
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
	row.addEventListener("drop", async (e) => {
		e.preventDefault();
		row.removeClass("ah-path-dragover");
		const from = Number(e.dataTransfer?.getData("text/plain"));
		if (!Number.isInteger(from) || from === index) {
			return;
		}
		const [moved] = rules.splice(from, 1);
		rules.splice(index, 0, moved);
		await plugin.saveSettings();
		plugin.renumberActiveFile();
		tab.display();
	});
}

/**
 * **分层**填充路径补全 `<datalist>`：仅列出当前输入所在目录的**直接子项**（输入 `/` 先给根与
 * 第一层文件夹/文件，选定某文件夹后再出现其下一层），避免一次抛出全库路径让用户无从选择。
 *
 * 实现：取输入里最后一个 `/` 之前的部分为「基目录」`base`，列出 `path` 恰好落在 `base` 下一层
 * 的文件夹（以 `/` 结尾）与文件；根（`base===""`）下额外补一个 `/` 选项。最多 50 项防溢出。
 */
function updatePathDatalist(
	tab: AutoHeadingsSettingTab,
	datalist: HTMLDataListElement,
	inputValue: string,
): void {
	datalist.empty();
	const slash = inputValue.lastIndexOf("/");
	const base = slash >= 0 ? inputValue.slice(0, slash + 1) : "";

	const vault = tab.plugin.app.vault as unknown as {
		getAllLoadedFiles?: () => Array<{ path: string; children?: unknown }>;
	};
	const all = vault.getAllLoadedFiles?.() ?? [];

	const options: string[] = [];
	if (base === "") {
		options.push("/"); // 根规则始终可选。
	}
	for (const f of all) {
		if (!f.path || f.path === "/") {
			continue;
		}
		// 仅取 base 的直接子项：path 须以 base 开头，且剩余部分不含更深的 `/`。
		if (!f.path.startsWith(base)) {
			continue;
		}
		const rest = f.path.slice(base.length);
		if (rest === "" || rest.includes("/")) {
			continue;
		}
		const isFolder = Array.isArray(f.children);
		options.push(isFolder ? `${f.path}/` : f.path);
	}

	for (const value of options.slice(0, 50)) {
		datalist.createEl("option", { value });
	}
}
