import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import type { Messages } from "../../i18n";
import {
	type AncestorNumeral,
	normalizeAncestorNumeral,
	normalizeBottomLevel,
	normalizeStartIndex,
	normalizeTopLevel,
	type NumeralStyle,
	previewLevel,
	type Template,
} from "../../numbering";
import { LEVEL_KEYS, type LevelKey } from "../../templates/schema";
import { renderWhitelistEditor } from "./WhitelistEditor";

/** 序号样式下拉的固定遍历顺序。 */
const NUMERAL_ORDER: NumeralStyle[] = [
	"arabic",
	"cjk",
	"circled",
	"lower-alpha",
	"upper-alpha",
	"lower-roman",
	"upper-roman",
];

/** 取序号样式在当前语言下的下拉标签（含示例字形）。 */
function numeralLabel(style: NumeralStyle, t: Messages): string {
	switch (style) {
		case "arabic":
			return t.numeralArabic;
		case "cjk":
			return t.numeralCjk;
		case "circled":
			return t.numeralCircled;
		case "lower-alpha":
			return t.numeralLowerAlpha;
		case "upper-alpha":
			return t.numeralUpperAlpha;
		case "lower-roman":
			return t.numeralLowerRoman;
		case "upper-roman":
			return t.numeralUpperRoman;
	}
}

/**
 * 渲染某模板的行内编辑面板：可选改名 + 起始/结束层级 + 祖先序号渲染 +
 * 六级×多列网格（横向可滚动，移动端友好）+ 实时预览（每级 2 例）+ 跳级占位 + 白名单编辑器。
 */
export function renderEditPanel(
	tab: AutoHeadingsSettingTab,
	parent: HTMLElement,
	template: Template,
	isDefault: boolean,
): void {
	const t = tab.t;
	const plugin = tab.plugin;
	const panel = parent.createDiv({ cls: "ah-edit-panel" });

	// 改名（默认模板名固定，不提供）。
	if (!isDefault) {
		new Setting(panel)
			.setName(t.templateNameName)
			.setDesc(t.templateNameDesc)
			.addText((text) => {
				text.setValue(template.name);
				const commit = async () => {
					const next = text.getValue().trim();
					if (next === "" || next === template.name) {
						text.setValue(template.name); // 还原非法/未变更输入。
						return;
					}
					const ok = await plugin.renameTemplate(template.name, next);
					if (ok) {
						tab.expandedTemplate = next;
					}
					tab.display();
				};
				// 失焦或回车时提交，避免逐键创建中间文件（包一层丢弃 Promise，满足 void 回调签名）。
				text.inputEl.addEventListener("blur", () => void commit());
				text.inputEl.addEventListener("keydown", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						text.inputEl.blur();
					}
				});
			});
	}

	const top = normalizeTopLevel(template.topLevel);
	const bottom = normalizeBottomLevel(template.bottomLevel);

	// 各级预览单元格（网格渲染时填充）。提前声明，供「起始编号数字」等全局字段变更后统一刷新
	// ——文本输入不能走 tab.display() 整页重绘（会丢焦点），只重设各预览文本。
	const previewEls = new Map<LevelKey, HTMLElement>();
	const refreshPreviews = () => {
		LEVEL_KEYS.forEach((key, i) => {
			previewEls.get(key)?.setText(previewText(tab, template, i + 1));
		});
	};

	// —— 起始编号层级（下拉，每个模板各自决定）——
	new Setting(panel)
		.setName(t.topLevelName)
		.setDesc(t.topLevelDesc)
		.addDropdown((dd) => {
			for (let l = 1; l <= 6; l++) {
				dd.addOption(String(l), `H${l}`);
			}
			dd.setValue(String(top)).onChange(async (value) => {
				const next = normalizeTopLevel(Number(value));
				template.topLevel = next;
				// 保持 结束层级 ≥ 起始层级：起始抬高到结束之上时，把结束一并抬上去。
				if (normalizeBottomLevel(template.bottomLevel) < next) {
					template.bottomLevel = next;
				}
				await plugin.templateStore.save(template);
				plugin.renumberActiveFile();
				tab.display(); // 重新渲染以更新各级行的「生效/置灰」与预览。
			});
		});

	// —— 结束编号层级（下拉，M6：编号区间下界，支持只编号 H2–H4 这样的区间）——
	new Setting(panel)
		.setName(t.bottomLevelName)
		.setDesc(t.bottomLevelDesc)
		.addDropdown((dd) => {
			// 只列 ≥ 起始层级 的选项，从根上避免配出空区间。
			for (let l = top; l <= 6; l++) {
				dd.addOption(String(l), `H${l}`);
			}
			dd.setValue(String(Math.max(bottom, top))).onChange(async (value) => {
				template.bottomLevel = normalizeBottomLevel(Number(value));
				await plugin.templateStore.save(template);
				plugin.renumberActiveFile();
				tab.display();
			});
		});

	// —— 起始编号数字（M8 批次 1：首段从该数字起，设 0 得 0.1.1）——
	// 下拉只列 0 / 1：几乎全部真实诉求是「0 起」或「1 起」，其余值等有需求再放开；
	// 引擎仍支持 [0,9999]，JSON 手改的其他值会作为额外选项列出、不被静默改写。
	const startIndex = normalizeStartIndex(template.startIndex);
	new Setting(panel)
		.setName(t.startIndexName)
		.setDesc(t.startIndexDesc)
		.addDropdown((dd) => {
			const values = [0, 1];
			if (!values.includes(startIndex)) {
				values.push(startIndex);
			}
			for (const v of values) {
				dd.addOption(String(v), String(v));
			}
			dd.setValue(String(startIndex)).onChange(async (value) => {
				template.startIndex = normalizeStartIndex(value);
				await plugin.templateStore.save(template);
				plugin.renumberActiveFile();
				refreshPreviews();
			});
		});

	// —— 祖先序号渲染（下拉，每个模板各自决定）——
	const ancestorNumeral = normalizeAncestorNumeral(template.ancestorNumeral);
	new Setting(panel)
		.setName(t.ancestorName)
		.setDesc(t.ancestorDesc)
		.addDropdown((dd) => {
			dd.addOption("self", t.ancestorSelf);
			dd.addOption("arabic", t.ancestorArabic);
			dd.setValue(ancestorNumeral).onChange(async (value) => {
				template.ancestorNumeral = value as AncestorNumeral;
				await plugin.templateStore.save(template);
				plugin.renumberActiveFile();
				tab.display(); // 重新渲染以更新各级预览。
			});
		});

	// —— 跳级缺失层级的占位策略（每个模板各自决定；0.7.17 上移到层级网格前，与其余
	// 模板级下拉归成一组，见 testplan L23）——
	const skipFill = template.skipFill;
	new Setting(panel)
		.setName(t.skipFillName)
		.setDesc(t.skipFillDesc)
		.addDropdown((dd) =>
			dd
				.addOption("fill", t.skipFillFill)
				.addOption("drop", t.skipFillDrop)
				.addOption("none", t.skipFillNone)
				.setValue(skipFill.mode)
				.onChange(async (value) => {
					template.skipFill =
						value === "drop"
							? { mode: "drop" }
							: value === "none"
								? { mode: "none" }
								: {
										mode: "fill",
										placeholder:
											skipFill.mode === "fill" ? skipFill.placeholder : "0",
									};
					await plugin.templateStore.save(template);
					plugin.renumberActiveFile();
					tab.display(); // 重新渲染以显示/隐藏占位输入框。
				}),
		);

	if (skipFill.mode === "fill") {
		new Setting(panel)
			.setName(t.placeholderName)
			.setDesc(t.placeholderDesc)
			.addText((text) => {
				text.setPlaceholder("0").setValue(skipFill.placeholder);
				// 不走 TextComponent.onChange——需要 IME 感知（testplan L25）：组合期间
				// setValue 回写会打断输入法，故组合中不提交、compositionend 后提交一次。
				const commit = async () => {
					// 仅保留数字，并即时回写输入框（滤除非法字符）。
					const digits = text.inputEl.value.replace(/\D/g, "");
					if (digits !== text.inputEl.value) {
						text.setValue(digits);
					}
					template.skipFill = { mode: "fill", placeholder: digits };
					await plugin.templateStore.save(template);
					plugin.renumberActiveFile();
				};
				text.inputEl.addEventListener("input", (e) => {
					if (e instanceof InputEvent && e.isComposing) {
						return;
					}
					void commit();
				});
				text.inputEl.addEventListener("compositionend", () => void commit());
			});
	}

	// —— 级别格式子框（0.7.17，L23）：H1–H6 网格装入带标题的容器，与白名单子框对称 ——
	const gridBox = panel.createDiv({ cls: "ah-subbox" });
	gridBox.createDiv({ cls: "ah-subbox-title", text: t.levelFormatHeading });

	// 网格表头（列序：级别 → 前缀 → 序号 → 序号间隔符 → 后缀 → 标题间隔符 → 继承前级 → 预览）。
	const grid = gridBox.createDiv({ cls: "ah-grid" });
	const headRow = grid.createDiv({ cls: "ah-grid-row ah-grid-head" });
	for (const label of [
		t.colLevel,
		t.colPrefix,
		t.colNumeral,
		t.colNumberSep,
		t.colSuffix,
		t.colTitleSep,
		t.colInherit,
		t.colPreview,
	]) {
		headRow.createDiv({ cls: "ah-grid-cell", text: label });
	}

	// 每级一行（H1–H6）。在编号区间 [起始, 结束] 之外的行置灰，表示当前不参与编号。
	LEVEL_KEYS.forEach((key, i) => {
		const level = i + 1;
		const fmt = template.levels[key];
		const inactive = level < top || level > bottom;
		const row = grid.createDiv({
			cls: inactive ? "ah-grid-row ah-grid-row-inactive" : "ah-grid-row",
		});

		row.createDiv({ cls: "ah-grid-cell ah-level-label", text: `H${level}` });

		// 前缀。
		textCell(row, fmt.prefix, t.phPrefix, async (v) => {
			fmt.prefix = v;
			await saveAndPreview(tab, template, level, key, previewEls);
		});

		// 序号样式下拉。
		const numCell = row.createDiv({ cls: "ah-grid-cell" });
		const select = numCell.createEl("select", { cls: "dropdown" });
		NUMERAL_ORDER.forEach((style) => {
			const opt = select.createEl("option", {
				value: style,
				text: numeralLabel(style, t),
			});
			if (style === fmt.numeral) {
				opt.selected = true;
			}
		});
		select.addEventListener("change", () => {
			fmt.numeral = select.value as NumeralStyle;
			void saveAndPreview(tab, template, level, key, previewEls);
		});

		// 序号间隔符。
		textCell(row, fmt.numberSeparator, ".", async (v) => {
			fmt.numberSeparator = v;
			await saveAndPreview(tab, template, level, key, previewEls);
		});

		// 后缀（序号之后、标题间隔符之前，如「章」「节」）。
		textCell(row, fmt.suffix, t.phSuffix, async (v) => {
			fmt.suffix = v;
			await saveAndPreview(tab, template, level, key, previewEls);
		});

		// 标题间隔符。
		textCell(row, fmt.titleSeparator, t.phSpace, async (v) => {
			fmt.titleSeparator = v;
			await saveAndPreview(tab, template, level, key, previewEls);
		});

		// 继承前级勾选框。
		const inheritCell = row.createDiv({ cls: "ah-grid-cell ah-inherit-cell" });
		const checkbox = inheritCell.createEl("input", { type: "checkbox" });
		checkbox.checked = fmt.inherit;
		checkbox.addEventListener("change", () => {
			fmt.inherit = checkbox.checked;
			void saveAndPreview(tab, template, level, key, previewEls);
		});

		// 预览。
		const previewCell = row.createDiv({ cls: "ah-grid-cell ah-preview-cell" });
		previewCell.setText(previewText(tab, template, level));
		previewEls.set(key, previewCell);
	});

	// —— 白名单编辑器（Milestone 4，模板级；M8 批次 1 加过滤 / 排序）——
	renderWhitelistEditor(tab, panel, template);
}

/** 创建一个文本输入单元格，封装 onChange。 */
function textCell(
	row: HTMLElement,
	value: string,
	placeholder: string,
	onChange: (value: string) => void | Promise<void>,
): void {
	const cell = row.createDiv({ cls: "ah-grid-cell" });
	const input = cell.createEl("input", { type: "text", cls: "ah-text-input" });
	input.value = value;
	input.placeholder = placeholder;
	// IME 感知（testplan L25）：拼音组合期间不提交（否则半截拼音被当值保存、且逐键重编标题）；
	// 上屏（compositionend）后提交一次。
	input.addEventListener("input", (e) => {
		if (e instanceof InputEvent && e.isComposing) {
			return;
		}
		void onChange(input.value);
	});
	input.addEventListener("compositionend", () => {
		void onChange(input.value);
	});
}

/** 保存模板并刷新该级的预览文本。 */
async function saveAndPreview(
	tab: AutoHeadingsSettingTab,
	template: Template,
	level: number,
	key: LevelKey,
	previewEls: Map<LevelKey, HTMLElement>,
): Promise<void> {
	const el = previewEls.get(key);
	if (el) {
		el.setText(previewText(tab, template, level));
	}
	await tab.plugin.templateStore.save(template);
	// 模板改动后立即对当前活动文件重新编号，使格式调整即时可见（修复「调整后没更新」）。
	tab.plugin.renumberActiveFile();
}

/** 计算某级的预览字符串（取前两个同级序号示例，M7 精简）；在编号区间之外时显示「（不编号）」。 */
function previewText(tab: AutoHeadingsSettingTab, template: Template, level: number): string {
	const top = normalizeTopLevel(template.topLevel);
	const bottom = normalizeBottomLevel(template.bottomLevel);
	if (level < top || level > bottom) {
		return tab.t.previewInactive;
	}
	const samples = previewLevel(template, level, 2);
	const word = tab.t.previewHeadingWord;
	return samples.map((s) => `${s}${word}`).join("    ");
}
