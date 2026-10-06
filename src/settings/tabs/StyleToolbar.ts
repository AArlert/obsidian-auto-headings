import { Menu, Modal, type App } from "obsidian";
import type { Messages } from "../../i18n";
import type { Template } from "../../numbering";
import {
	applyPreset,
	applyStyle,
	STYLE_PRESETS,
	styleOf,
	stylesEqual,
	summarizeStyle,
	type StylePreset,
	type TemplateSnapshot,
} from "../../templates/styles";
import type { TemplateEditorHost } from "./TemplateEditorModal";

/** 预设在当前语言下的菜单名。 */
function presetLabel(preset: StylePreset, t: Messages): string {
	switch (preset.id) {
		case "decimal":
			return t.presetDecimal;
		case "chapter":
			return t.presetChapter;
		case "official":
			return t.presetOfficial;
		case "legal":
			return t.presetLegal;
		case "outline":
			return t.presetOutline;
	}
}

/** 快照时间的本地化短格式。 */
function formatTime(at: number): string {
	return new Date(at).toLocaleString(undefined, {
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * 模板编辑弹窗格式页顶部的工具条（M16，testplan S20/S21）：「快速套用」菜单 + 「历史」弹窗。
 *
 * 套用 / 恢复都只改**草稿**（`template` 即弹窗草稿对象），经 `onApplied` 走与手改同一条提交通道
 * （标脏 + 重绘），点「保存」前不动任何笔记。
 */
export function renderStyleToolbar(
	host: TemplateEditorHost,
	parent: HTMLElement,
	template: Template,
	onApplied: () => Promise<void>,
): void {
	const t = host.t;
	const bar = parent.createDiv({ cls: "ah-style-toolbar" });

	const quick = bar.createEl("button", { text: t.editorQuickApply });
	quick.addEventListener("click", (evt) => {
		const menu = new Menu();
		const recent = host.plugin.templateHistoryOf(template.name);
		menu.addItem((i) => i.setTitle(t.quickRecentHeading).setIsLabel(true));
		if (recent.length === 0) {
			menu.addItem((i) => i.setTitle(t.quickNoRecent).setDisabled(true));
		}
		const current = styleOf(template);
		for (const snap of recent.slice(0, 4)) {
			menu.addItem((i) =>
				i
					.setTitle(`${summarizeStyle(snap.style) || "—"}  ·  ${formatTime(snap.at)}`)
					.setChecked(stylesEqual(snap.style, current))
					.onClick(() => {
						applyStyle(template, snap.style);
						void onApplied();
					}),
			);
		}
		menu.addSeparator();
		menu.addItem((i) => i.setTitle(t.quickPresetHeading).setIsLabel(true));
		for (const preset of STYLE_PRESETS) {
			menu.addItem((i) =>
				i.setTitle(presetLabel(preset, t)).onClick(() => {
					applyPreset(template, preset);
					void onApplied();
				}),
			);
		}
		menu.showAtMouseEvent(evt);
	});

	const history = bar.createEl("button", { text: t.editorHistory });
	history.addEventListener("click", () => {
		new TemplateHistoryModal(
			host.plugin.app,
			t,
			template.name,
			host.plugin.templateHistoryOf(template.name),
			styleOf(template),
			(snap) => {
				applyStyle(template, snap.style);
				void onApplied();
			},
		).open();
	});
}

/** 「此模板的历史」弹窗：列出保存快照，每份可恢复到草稿。 */
class TemplateHistoryModal extends Modal {
	constructor(
		app: App,
		private readonly t: Messages,
		private readonly name: string,
		private readonly snapshots: TemplateSnapshot[],
		private readonly current: ReturnType<typeof styleOf>,
		private readonly onRestore: (snap: TemplateSnapshot) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, t } = this;
		this.setTitle(t.historyTitle(this.name));
		contentEl.empty();
		if (this.snapshots.length === 0) {
			contentEl.createEl("p", { cls: "ah-section-desc", text: t.historyEmpty });
			return;
		}
		const list = contentEl.createDiv({ cls: "ah-history-list" });
		for (const snap of this.snapshots) {
			const row = list.createDiv({ cls: "ah-history-row" });
			const text = row.createDiv({ cls: "ah-history-text" });
			text.createDiv({ cls: "ah-history-summary", text: summarizeStyle(snap.style) || "—" });
			text.createDiv({ cls: "ah-history-time", text: formatTime(snap.at) });
			if (stylesEqual(snap.style, this.current)) {
				row.createSpan({ cls: "ah-history-same", text: t.historyCurrent });
				continue;
			}
			const btn = row.createEl("button", { text: t.historyRestore });
			btn.addEventListener("click", () => {
				this.onRestore(snap);
				this.close();
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
