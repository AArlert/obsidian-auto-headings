import { Modal, Setting, setIcon, type App } from "obsidian";
import type AutoHeadingsPlugin from "../../main";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { confirmWordMatches } from "../model";
import { markDestructive } from "../buttons";

/**
 * 「编号维护」TAB（原「敏感操作」，1.2.2 改名与重排，见 spec.md §3.10 / §3.13、testplan L43）。分两组：
 *
 * - **当前笔记**（组标题旁「文件名 · 可用 Ctrl+Z 撤销」）：立即重新编号 / 清除当前文件编号 /
 *   清理非本插件编号（先弹清理预览确认框，与迁移守卫同一个框）/ 清除残留编号——现有命令的面板入口，
 *   普通按钮。
 * - **整个仓库**（组标题旁警示图标 +「不可撤销，操作前建议备份」）：清除全库编号… / 固化编号并交还
 *   所有权…——红字普通按钮，确认框里输入确认词后才能点红底按钮（L44）。
 *
 * 红色只在最后一步：页面上危险操作是红字，确认框里才用红底。独立成 TAB 后天然不与常用设置同屏（L8）。
 */
export function renderMaintenanceTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;
	const plugin = tab.plugin;

	// —— 当前笔记 ——
	const notePath = plugin.activeNotePath();
	const noteName = notePath ? (notePath.split("/").pop() ?? notePath) : null;
	groupHeading(
		containerEl,
		t.maintCurrentHeading,
		noteName ? t.maintCurrentMeta(noteName) : t.maintNoNote,
	);

	const noteAction = (name: string, desc: string, btnText: string, run: () => void): void => {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addButton((btn) => btn.setButtonText(btnText).onClick(run));
	};
	noteAction(t.renumberNowName, t.renumberNowDesc, t.renumberNowBtn, () =>
		plugin.renumberActiveNoteNow(),
	);
	noteAction(t.clearFileName, t.clearFileDesc, t.clearFileBtn, () =>
		plugin.clearActiveFileNumbering(),
	);
	noteAction(t.clearForeignName, t.clearForeignDesc, t.clearForeignBtn, () =>
		plugin.reviewActiveFileForeignNumbering(),
	);
	noteAction(t.clearStaleName, t.clearStaleDesc, t.clearStaleBtn, () =>
		plugin.clearActiveFileStaleNumbering(),
	);

	// —— 整个仓库 ——
	groupHeading(containerEl, t.maintVaultHeading, t.maintVaultMeta, "alert-triangle");

	const vaultAction = (name: string, desc: string, btnText: string, open: () => void): void => {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addButton((btn) => {
				btn.setButtonText(btnText).onClick(open);
				btn.buttonEl.addClass("ah-danger-text");
			});
	};
	vaultAction(t.clearVaultName, t.clearVaultDesc, t.clearVaultBtn, () => {
		new VaultConfirmModal(plugin.app, plugin, "clear").open();
	});
	vaultAction(t.freezeVaultName, t.freezeVaultDesc, t.freezeVaultBtn, () => {
		new VaultConfirmModal(plugin.app, plugin, "freeze").open();
	});
}

/** 分组标题：原生 `setHeading()`，右侧一行灰字（可带小号图标）。 */
function groupHeading(containerEl: HTMLElement, name: string, meta: string, icon?: string): void {
	const heading = new Setting(containerEl).setName(name).setHeading();
	heading.settingEl.addClass("ah-maint-group");
	const metaEl = heading.controlEl.createSpan({ cls: "ah-maint-meta" });
	if (icon) {
		setIcon(metaEl.createSpan({ cls: "ah-maint-meta-icon" }), icon);
	}
	metaEl.createSpan({ text: meta });
}

/**
 * 全库操作确认框（「清除全库编号」/「固化编号并交还所有权」共用，见 spec.md §3.10 / §3.18）。
 *
 * 两项都**刻意不注册为命令**，避免快捷键 / 命令面板误触发大面积改动；固化比清库更需要防误触——
 * 清库清掉的编号还能重编回来，固化之后插件已认不出那些编号是自己写的，回不去了。
 *
 * 1.2.2（testplan L44）：输入确认词（「清除」/「固化」，英文 clear / freeze）后确认按钮才可点，
 * 按钮红底。说明文字与执行逻辑不变（清库仍先关闭全局自动编号，H7）。
 */
class VaultConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: AutoHeadingsPlugin,
		private readonly kind: "clear" | "freeze",
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		const t = this.plugin.messages();
		const isClear = this.kind === "clear";
		const word = isClear ? t.clearVaultWord : t.freezeVaultWord;
		contentEl.empty();
		this.setTitle(isClear ? t.clearVaultModalTitle : t.freezeVaultModalTitle);
		contentEl.createEl("p", { text: isClear ? t.clearVaultModalBody : t.freezeVaultModalBody });

		// 清库专属选项（1.3.0，testplan H20）：同时关闭自动编号，默认勾选（避免刚清掉又被编回去）。
		let turnOffAuto = true;
		if (isClear) {
			const row = contentEl.createEl("label", { cls: "ah-confirm-option" });
			const box = row.createEl("input", { type: "checkbox" });
			box.checked = true;
			box.addEventListener("change", () => {
				turnOffAuto = box.checked;
			});
			row.createSpan({ text: t.clearVaultTurnOffAuto });
			row.createSpan({ cls: "ah-confirm-option-hint", text: t.clearVaultTurnOffAutoHint });
		}

		contentEl.createDiv({ cls: "ah-confirm-word-label", text: t.confirmWordPrompt(word) });
		const input = contentEl.createEl("input", { type: "text", cls: "ah-confirm-word-input" });
		input.setAttr("aria-label", t.confirmWordPrompt(word));

		let confirmBtn: HTMLButtonElement | null = null;
		const run = async (): Promise<void> => {
			if (!confirmWordMatches(input.value, word)) {
				return;
			}
			this.close();
			if (isClear) {
				await this.plugin.clearAllVaultNumbering(turnOffAuto);
			} else {
				await this.plugin.freezeVaultNumbering();
			}
		};
		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText(t.cancel).onClick(() => this.close()))
			.addButton((btn) => {
				markDestructive(
					btn.setButtonText(isClear ? t.confirmClearVault : t.confirmFreezeVault),
				)
					.setDisabled(true)
					.onClick(() => void run());
				confirmBtn = btn.buttonEl;
			});
		input.addEventListener("input", () => {
			if (confirmBtn) {
				confirmBtn.disabled = !confirmWordMatches(input.value, word);
			}
		});
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.isComposing) {
				e.preventDefault();
				void run();
			}
		});
		window.setTimeout(() => input.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
