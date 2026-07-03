import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import type { Messages } from "../../i18n";
import {
	analyzeWhitelist,
	filterSortWhitelist,
	type Template,
	type WhitelistEntry,
	type WhitelistSortMode,
} from "../../numbering";

/** 白名单匹配方式分段控件的固定遍历顺序。 */
const MATCH_ORDER: WhitelistEntry["match"][] = ["exact", "partial", "subtree"];

/** 分段控件上各匹配方式的符号（语言无关；含义由 tooltip 双语文案承担，见 testplan L17）。 */
const MATCH_ICON: Record<WhitelistEntry["match"], string> = {
	exact: "=",
	partial: "≈",
	subtree: "▸",
};

/** 命中标题 tooltip 最多列出的条数，其余截断为计数（testplan L19）。 */
const MATCH_TOOLTIP_MAX = 8;

/** 取白名单匹配方式在当前语言下的文案（分段控件 tooltip 用）。 */
function matchLabel(match: WhitelistEntry["match"], t: Messages): string {
	switch (match) {
		case "exact":
			return t.matchExact;
		case "partial":
			return t.matchPartial;
		case "subtree":
			return t.matchSubtree;
	}
}

/**
 * 渲染某模板的白名单编辑器（模板级配置，见 spec.md §3.7）。
 *
 * - 顶部输入框：键入词语后按 Enter 添加为一枚条目（默认「全部匹配」）；完全相同的 (词语, 匹配方式)
 *   自动去重。
 * - 搜索 + 排序工具栏（M8 批次 1，testplan L14/L15）：搜索框即时过滤行（与命中判定同一套归一化）；
 *   排序下拉在 添加顺序 / A–Z / 匹配方式 间切换。二者均为**纯视图层**、不改存储数组，状态挂在
 *   SettingsTab 上跨重绘保持；键入只重绘行区域（整页重绘会丢输入焦点）。
 * - **行布局**（0.7.16，testplan L16–L19）：每条一行 = 词语（点击行内编辑）+ 匹配方式**分段控件**
 *   （`=` 全部 / `≈` 部分 / `▸` 子树，单击切换、选中高亮、tooltip 双语）+ 命中数角标（tooltip 列出
 *   命中标题）+ ⚠ 含子标题告警 + ✕ 删除；删除 / 改匹配按**原始下标**回查，过滤排序视图下不错位。
 * - 底部针对**当前活动文件**实时列出「本白名单将豁免的标题」（命中数 + 标题清单）。
 */
export function renderWhitelistEditor(
	tab: AutoHeadingsSettingTab,
	panel: HTMLElement,
	template: Template,
): void {
	const t = tab.t;
	const plugin = tab.plugin;
	const section = panel.createDiv({ cls: "ah-whitelist" });

	new Setting(section).setName(t.whitelistName).setDesc(t.whitelistDesc);

	// —— 添加输入框 ——
	const inputRow = section.createDiv({ cls: "ah-wl-input-row" });
	const input = inputRow.createEl("input", { type: "text", cls: "ah-wl-input" });
	input.placeholder = t.wlInputPlaceholder;
	const addEntry = async () => {
		const text = input.value.trim();
		if (text === "") {
			return;
		}
		// 去重：完全相同的 (词语, 匹配方式=全部) 不重复添加。
		const exists = template.whitelist.some((e) => e.text === text && e.match === "exact");
		if (!exists) {
			template.whitelist.push({ text, match: "exact" });
			await plugin.templateStore.save(template);
			plugin.renumberActiveFile();
		}
		input.value = "";
		tab.display();
	};
	input.addEventListener("keydown", (e) => {
		// IME 组合中的 Enter 是「确认候选词」，不是提交（testplan L25）。
		if (e.key === "Enter" && !e.isComposing) {
			e.preventDefault();
			void addEntry();
		}
	});

	// —— 搜索 + 排序工具栏容器（M8 批次 1）。先占 DOM 位（在行列表之上），
	// 控件与事件在 renderRows 定义之后填充（事件回调引用它）。——
	const toolbarEl = section.createDiv({ cls: "ah-wl-toolbar" });

	// —— 已有条目（行列表）——
	const affixes = plugin.strippableAffixes();
	const headings = plugin.currentFileHeadings();
	const analysis = analyzeWhitelist(headings, template, {
		strippablePrefixes: affixes.prefixes,
		strippableSuffixes: affixes.suffixes,
	});
	const rowsEl = section.createDiv({ cls: "ah-wl-rows" });

	/** 提交条目改动并整页重绘（保存模板 + 立即重编当前文件）。 */
	const commit = async () => {
		await plugin.templateStore.save(template);
		plugin.renumberActiveFile();
		tab.display();
	};

	/** 按当前搜索 / 排序（纯视图，携带原始下标）重绘行区域。 */
	const renderRows = () => {
		rowsEl.empty();
		if (template.whitelist.length === 0) {
			rowsEl.createEl("span", { cls: "ah-section-desc", text: t.wlEmpty });
			return;
		}
		const views = filterSortWhitelist(template.whitelist, tab.wlFilter, tab.wlSort);
		if (views.length === 0) {
			rowsEl.createEl("span", { cls: "ah-section-desc", text: t.wlFilterNoMatch });
			return;
		}
		views.forEach(({ entry, index }) => {
			const hit = analysis.perEntry[index];
			const row = rowsEl.createDiv({ cls: "ah-wl-row" });

			// 词语（点击行内编辑，testplan L18）。
			const textEl = row.createEl("span", { cls: "ah-wl-row-text", text: entry.text });
			textEl.title = t.wlEditTitle;
			textEl.addEventListener("click", () => {
				const edit = document.createElement("input");
				edit.type = "text";
				edit.value = entry.text;
				edit.className = "ah-wl-input ah-wl-row-edit";
				textEl.replaceWith(edit);
				edit.focus();
				edit.select();
				let done = false; // Enter 触发 blur，防重复提交。
				const finish = async () => {
					if (done) {
						return;
					}
					done = true;
					const next = edit.value.trim();
					// 空、未变更、或与他条重复（同词语 + 匹配方式）：还原不写入。
					const dup = template.whitelist.some(
						(e, i) => i !== index && e.text === next && e.match === entry.match,
					);
					if (next === "" || next === entry.text || dup) {
						tab.display();
						return;
					}
					entry.text = next;
					await commit();
				};
				edit.addEventListener("blur", () => void finish());
				edit.addEventListener("keydown", (e) => {
					// IME 组合中的 Enter 是「确认候选词」，不触发提交（L25）。
					if (e.key === "Enter" && !e.isComposing) {
						e.preventDefault();
						edit.blur();
					} else if (e.key === "Escape") {
						e.preventDefault();
						done = true;
						tab.display();
					}
				});
			});

			// 匹配方式分段控件（三项常驻、单击切换、选中高亮，testplan L17）。
			const seg = row.createDiv({ cls: "ah-wl-seg" });
			MATCH_ORDER.forEach((m) => {
				const btn = seg.createEl("button", {
					cls: m === entry.match ? "ah-wl-seg-btn ah-wl-seg-active" : "ah-wl-seg-btn",
					text: MATCH_ICON[m],
				});
				btn.title = matchLabel(m, t);
				btn.addEventListener("click", async () => {
					if (entry.match === m) {
						return;
					}
					entry.match = m;
					await commit();
				});
			});

			// 命中数角标（tooltip 列出命中标题，超过上限截断加计数，testplan L19）。
			const count = row.createEl("span", {
				cls: "ah-wl-row-count",
				text: String(hit?.count ?? 0),
			});
			const matches = hit?.matches ?? [];
			if (matches.length > 0) {
				const shown = matches.slice(0, MATCH_TOOLTIP_MAX);
				const rest = matches.length - shown.length;
				count.title = shown.join("\n") + (rest > 0 ? `\n…(+${rest})` : "");
			}

			// ⚠ 含子标题告警（全部 / 部分命中却含子标题，应改用子树）。
			if (hit?.warnHasChildren) {
				const warn = row.createEl("span", { cls: "ah-wl-row-warn", text: "⚠" });
				warn.title = t.wlChipWarnTitle;
			}

			// ✕ 删除（按原始下标写回存储数组，过滤 / 排序视图下也删对条目）。
			const del = row.createEl("span", { cls: "ah-wl-row-del", text: "✕" });
			del.title = t.deleteBtn;
			del.addEventListener("click", async () => {
				template.whitelist.splice(index, 1);
				await commit();
			});
		});
	};

	// —— 填充工具栏（条目为空时不渲染控件，避免噪音）——
	if (template.whitelist.length > 0) {
		const filterInput = toolbarEl.createEl("input", {
			type: "text",
			cls: "ah-wl-input ah-wl-filter",
		});
		filterInput.placeholder = t.wlFilterPlaceholder;
		filterInput.value = tab.wlFilter;
		filterInput.addEventListener("input", (e) => {
			// IME 组合中的半截拼音不参与过滤（避免行列表闪烁，L25）；上屏后再过滤一次。
			if ((e as InputEvent).isComposing) {
				return;
			}
			tab.wlFilter = filterInput.value;
			renderRows();
		});
		filterInput.addEventListener("compositionend", () => {
			tab.wlFilter = filterInput.value;
			renderRows();
		});
		const sortSelect = toolbarEl.createEl("select", { cls: "dropdown ah-wl-sort" });
		const sortOptions: [WhitelistSortMode, string][] = [
			["added", t.wlSortAdded],
			["az", t.wlSortAz],
			["match", t.wlSortMatch],
		];
		sortOptions.forEach(([mode, label]) => {
			const opt = sortSelect.createEl("option", { value: mode, text: label });
			if (mode === tab.wlSort) {
				opt.selected = true;
			}
		});
		sortSelect.addEventListener("change", () => {
			tab.wlSort = sortSelect.value as WhitelistSortMode;
			renderRows();
		});
	}

	renderRows();

	// —— 模板不一致警示（修复 WL-int：预览用「正在编辑的模板」，但文件实际按路径规则解析到的
	// 可能是另一个模板；不提示会让「预览说豁免、文件却被编号」显得是 bug，见 testplan §3.3）——
	if (headings.length > 0) {
		const appliedTpl = plugin.getTemplateForFile(plugin.currentFilePath());
		if (!appliedTpl) {
			section.createEl("p", {
				cls: "ah-section-desc ah-wl-mismatch",
				text: t.wlPreviewNoTemplate,
			});
		} else if (appliedTpl.name !== template.name) {
			section.createEl("p", {
				cls: "ah-section-desc ah-wl-mismatch",
				text: t.wlPreviewOtherTemplate(tab.templateDisplayName(appliedTpl.name)),
			});
		}
	}

	// —— 当前文件实时命中预览 ——
	const preview = section.createEl("p", { cls: "ah-section-desc ah-wl-preview" });
	if (headings.length === 0) {
		preview.setText(t.wlPreviewNoFile);
	} else if (analysis.exempted.length === 0) {
		preview.setText(t.wlPreviewNone);
	} else {
		const titles = analysis.exempted.map((h) => h.text).join(" · ");
		preview.setText(t.wlPreviewSome(analysis.exempted.length, titles));
	}
}
