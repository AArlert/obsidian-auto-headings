import type { Messages } from "../../i18n";
import {
	type AncestorNumeral,
	type LevelFormat,
	normalizeAncestorNumeral,
	normalizeBottomLevel,
	normalizeStartIndex,
	normalizeTopLevel,
	type NumeralStyle,
	previewLevel,
	stripWordJoiners,
	type Template,
} from "../../numbering";
import { LEVEL_KEYS } from "../../templates/schema";
import {
	applyInheritChoice,
	inheritChoiceOf,
	inheritDepthOptions,
	type InheritChoice,
	showSpaces,
} from "../templateView";
import type { TemplateEditorHost } from "./TemplateEditorModal";
import { renderStyleToolbar } from "./StyleToolbar";
import { type PreviewHandle, renderTemplatePreview } from "./TemplatePreview";

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

/** 取序号样式在当前语言下的下拉标签（只显示例字形，testplan L24）。 */
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

/** 建一个原生下拉框（`select.dropdown`，吃主题样式）。 */
function dropdown(
	parent: HTMLElement,
	options: ReadonlyArray<readonly [string, string]>,
	value: string,
	onChange: (value: string) => void,
	label?: string,
): HTMLSelectElement {
	const select = parent.createEl("select", { cls: "dropdown" });
	for (const [v, text] of options) {
		select.createEl("option", { value: v, text });
	}
	select.value = value;
	if (label) {
		select.setAttr("aria-label", label);
	}
	select.addEventListener("change", () => onChange(select.value));
	return select;
}

/**
 * 模板编辑弹窗的**格式页**（1.2.2 视觉更新，testplan L36–L40；取代 0.7.17 的行内展开面板）。
 *
 * - 上方两行：「编号范围」（起始层级 至 结束层级 + 起始编号数字）与「更多规则」（上级编号的写法 =
 *   祖先序号渲染；标题跳级时 = 跳级缺失层级，选「补位」时同一行出现占位字符输入）。
 * - 格式表按阅读顺序：级别 / 前缀 / 序号 / 序号间隔符 / 后缀 / 标题间隔符 / 上级编号 / 预览。
 *   「继承前级」勾选框 +「继承级数」下拉合成一列「上级编号」，写回仍是两个字段（L37）；文本框未聚焦时
 *   空格显示为「␣」（L38）；不在编号范围内的级别整行一句灰字（L39）；预览列只显示一例（L10）。
 * - 底部预览块（`TemplatePreview.ts`）：悬停表格某一行时，预览里同级标题高亮。
 *
 * 所有改动即时生效：存模板 + 重编当前文件。影响行结构的改动（范围、跳级策略等）整窗重绘；
 * 单格文本只刷新预览，不重绘（重绘会丢输入焦点）。
 */
export function renderFormatPane(
	host: TemplateEditorHost,
	parent: HTMLElement,
	template: Template,
): void {
	const t = host.t;
	const top = normalizeTopLevel(template.topLevel);
	const bottom = normalizeBottomLevel(template.bottomLevel);

	// 预览块在表格之后创建；表格里的回调经这两个变量拿到它。
	let preview: PreviewHandle | null = null;
	const rowPreviews: Array<() => void> = [];
	const refreshPreviews = (): void => {
		rowPreviews.forEach((fn) => fn());
		preview?.refresh();
	};

	/** 存模板 + 重编当前文件；`rerender` 为 true 时整窗重绘，否则只刷新预览。 */
	const commit = async (rerender: boolean): Promise<void> => {
		await host.persist(template);
		if (rerender) {
			host.rerender();
		} else {
			refreshPreviews();
		}
	};

	// —— 快速套用 / 历史（M16，testplan S20/S21）——
	renderStyleToolbar(host, parent, template, () => commit(true));

	// —— 上方两行 ——
	const form = parent.createDiv({ cls: "ah-fmt-form" });
	const formRow = (label: string): HTMLElement => {
		form.createSpan({ cls: "ah-fmt-form-label", text: label });
		return form.createDiv({ cls: "ah-fmt-form-line" });
	};

	const levelOptions = (from: number): Array<[string, string]> => {
		const out: Array<[string, string]> = [];
		for (let l = from; l <= 6; l++) {
			out.push([String(l), `H${l}`]);
		}
		return out;
	};

	const range = formRow(t.rangeLabel);
	dropdown(
		range,
		levelOptions(1),
		String(top),
		(v) => {
			const next = normalizeTopLevel(Number(v));
			template.topLevel = next;
			// 保持 结束层级 ≥ 起始层级：起始抬高到结束之上时，把结束一并抬上去（testplan L3）。
			if (normalizeBottomLevel(template.bottomLevel) < next) {
				template.bottomLevel = next;
			}
			void commit(true);
		},
		t.topLevelName,
	);
	range.createSpan({ text: t.rangeTo });
	// 只列 ≥ 起始层级 的选项，从根上避免配出空区间。
	dropdown(
		range,
		levelOptions(top),
		String(Math.max(bottom, top)),
		(v) => {
			template.bottomLevel = normalizeBottomLevel(Number(v));
			void commit(true);
		},
		t.bottomLevelName,
	);
	range.createSpan({ cls: "ah-fmt-gap" });
	range.createSpan({ text: t.startIndexLabel });
	// 起始编号数字只列 0 / 1：几乎全部真实诉求是「0 起」或「1 起」；引擎支持 [0,9999]，
	// JSON 手改的其他值作为额外选项列出、不被静默改写。
	const startIndex = normalizeStartIndex(template.startIndex);
	const startValues = [0, 1];
	if (!startValues.includes(startIndex)) {
		startValues.push(startIndex);
	}
	dropdown(
		range,
		startValues.map((v) => [String(v), String(v)] as const),
		String(startIndex),
		(v) => {
			template.startIndex = normalizeStartIndex(v);
			void commit(false);
		},
		t.startIndexLabel,
	);
	range.createSpan({ cls: "ah-fmt-hint", text: t.startIndexHint });

	const more = formRow(t.moreRulesLabel);
	more.createSpan({ text: t.ancestorLabel });
	dropdown(
		more,
		[
			["self", t.ancestorSelf],
			["arabic", t.ancestorArabic],
		],
		normalizeAncestorNumeral(template.ancestorNumeral),
		(v) => {
			template.ancestorNumeral = v as AncestorNumeral;
			void commit(true);
		},
		t.ancestorLabel,
	);
	more.createSpan({ cls: "ah-fmt-gap" });
	more.createSpan({ text: t.skipLabel });
	const skipFill = template.skipFill;
	dropdown(
		more,
		[
			["fill", t.skipFillFill],
			["drop", t.skipFillDrop],
			["none", t.skipFillNone],
		],
		skipFill.mode,
		(v) => {
			template.skipFill =
				v === "drop"
					? { mode: "drop" }
					: v === "none"
						? { mode: "none" }
						: {
								mode: "fill",
								placeholder: skipFill.mode === "fill" ? skipFill.placeholder : "0",
							};
			void commit(true); // 重绘以显示 / 隐藏占位输入框。
		},
		t.skipLabel,
	);
	if (skipFill.mode === "fill") {
		more.createSpan({ text: t.placeholderLabel });
		const input = more.createEl("input", {
			type: "text",
			cls: "ah-fmt-input ah-fmt-placeholder",
		});
		input.value = skipFill.placeholder;
		input.setAttr("aria-label", t.placeholderLabel);
		// IME 感知（testplan L25）：组合期间不提交，compositionend 后提交一次；仅保留数字。
		const submit = (): void => {
			const digits = input.value.replace(/\D/g, "");
			if (digits !== input.value) {
				input.value = digits;
			}
			template.skipFill = { mode: "fill", placeholder: digits };
			void commit(false);
		};
		input.addEventListener("input", (e) => {
			if ("isComposing" in e && e.isComposing === true) {
				return;
			}
			submit();
		});
		input.addEventListener("compositionend", submit);
	}

	// —— 格式表 ——
	const table = parent.createDiv({ cls: "ah-fmt-table" });
	const head = table.createDiv({ cls: "ah-fmt-row ah-fmt-head" });
	for (const label of [
		t.colLevel,
		t.colPrefix,
		t.colNumeral,
		t.colNumberSep,
		t.colSuffix,
		t.colTitleSep,
		t.colParents,
		t.colPreview,
	]) {
		head.createSpan({ text: label });
	}

	LEVEL_KEYS.forEach((key, i) => {
		const level = i + 1;
		const fmt = template.levels[key];
		const row = table.createDiv({ cls: "ah-fmt-row" });
		row.dataset.level = String(level);
		row.createSpan({ cls: "ah-fmt-level", text: `H${level}` });

		// 不在编号范围内：整行一句灰字（L39）。
		if (level < top || level > bottom) {
			row.addClass("ah-fmt-row-out");
			row.createSpan({
				cls: "ah-fmt-out",
				text: level < top ? t.outOfRangeBefore(top) : t.outOfRangeAfter(bottom),
			});
			return;
		}

		row.addEventListener("mouseenter", () => preview?.highlight(level));
		row.addEventListener("mouseleave", () => preview?.highlight(null));

		const text = (
			field: "prefix" | "numberSeparator" | "suffix" | "titleSeparator",
			label: string,
		) => textCell(row, fmt, field, `H${level} ${label}`, () => void commit(false));

		text("prefix", t.colPrefix);
		dropdown(
			row,
			NUMERAL_ORDER.map((style) => [style, numeralLabel(style, t)] as const),
			fmt.numeral,
			(v) => {
				fmt.numeral = v as NumeralStyle;
				void commit(false);
			},
			`H${level} ${t.colNumeral}`,
		);
		text("numberSeparator", t.colNumberSep);
		text("suffix", t.colSuffix);
		text("titleSeparator", t.colTitleSep);

		// 上级编号（L37）：起始层级那一行没有上级可继承，显示「—」。
		if (level <= top) {
			row.createSpan({ cls: "ah-fmt-dash", text: "—" });
		} else {
			const options: Array<[string, string]> = [
				["none", t.inheritNone],
				["all", t.inheritDepthAll],
				...inheritDepthOptions(level).map(
					(d) => [String(d), t.inheritLevels(d)] as [string, string],
				),
			];
			const current = inheritChoiceOf(fmt, level);
			dropdown(
				row,
				options,
				String(current),
				(v) => {
					const choice: InheritChoice = v === "none" || v === "all" ? v : Number(v);
					applyInheritChoice(fmt, choice, level);
					void commit(false);
				},
				`H${level} ${t.colParents}`,
			);
		}

		// 预览：只一例，编号正文色 + 示例标题浅色（L10）。
		const pv = row.createSpan({ cls: "ah-fmt-preview" });
		const drawPreview = (): void => {
			pv.empty();
			const [sample] = previewLevel(template, level, 1);
			pv.createSpan({ cls: "ah-fmt-preview-num", text: stripWordJoiners(sample ?? "") });
			pv.createSpan({ cls: "ah-fmt-preview-word", text: t.previewHeadingWord });
		};
		drawPreview();
		rowPreviews.push(drawPreview);
	});

	// —— 底部预览（L40）——
	preview = renderTemplatePreview(host, parent, template);
}

/**
 * 格式表里的一个文本框（L38）：未聚焦时空格显示为「␣」，聚焦时恢复真实值；存进模板的永远是真实值。
 * IME 感知（L25）：拼音组合期间不提交，上屏（compositionend）后提交一次。
 */
function textCell(
	row: HTMLElement,
	fmt: LevelFormat,
	field: "prefix" | "numberSeparator" | "suffix" | "titleSeparator",
	label: string,
	onChange: () => void,
): void {
	const input = row.createEl("input", { type: "text", cls: "ah-fmt-input" });
	input.setAttr("aria-label", label);
	input.value = showSpaces(fmt[field]);
	input.addEventListener("focus", () => {
		input.value = fmt[field];
	});
	input.addEventListener("blur", () => {
		input.value = showSpaces(fmt[field]);
	});
	const submit = (): void => {
		fmt[field] = input.value;
		onChange();
	};
	// isComposing 用 in 收窄读取：不依赖全局 InputEvent 构造器身份，弹出窗口下同样成立。
	input.addEventListener("input", (e) => {
		if ("isComposing" in e && e.isComposing === true) {
			return;
		}
		submit();
	});
	input.addEventListener("compositionend", submit);
}
