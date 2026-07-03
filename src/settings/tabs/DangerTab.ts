import { Modal, Setting, type App } from "obsidian";
import type AutoHeadingsPlugin from "../../main";
import type { AutoHeadingsSettingTab } from "../SettingsTab";

/**
 * 「敏感操作」TAB（M7 多 TAB 重构，见 spec.md §3.10）：⚠ 说明 + 三个清除入口——
 *
 * 1. **清除当前文件编号**（等价同名命令）。
 * 2. **清理非本插件编号**（等价同名命令，只剥不带 WJ 的手写 / 外来编号）。
 * 3. **清除全库编号**（二次确认对话框；清除期间全局自动编号临时停用、完毕恢复，见
 *    {@link AutoHeadingsPlugin.clearAllVaultNumbering}）。
 *
 * 独立成 TAB 后天然不与常用设置同屏（旧版「危险区域默认折叠」的防误触目标由 TAB 隔离达成）。
 */
export function renderDangerTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;
	const plugin = tab.plugin;

	new Setting(containerEl).setName(t.dangerHeading).setHeading();
	containerEl.createEl("p", { cls: "ah-danger-intro", text: t.dangerIntro });

	// —— 清除当前文件编号 ——
	new Setting(containerEl)
		.setName(t.clearFileName)
		.setDesc(t.clearFileDesc)
		.addButton((btn) =>
			btn
				.setButtonText(t.clearFileBtn)
				.setWarning()
				.onClick(() => {
					plugin.clearActiveFileNumbering();
				}),
		);

	// —— 清理非本插件编号 ——
	new Setting(containerEl)
		.setName(t.clearForeignName)
		.setDesc(t.clearForeignDesc)
		.addButton((btn) =>
			btn
				.setButtonText(t.clearForeignBtn)
				.setWarning()
				.onClick(() => {
					plugin.clearActiveFileForeignNumbering();
				}),
		);

	// —— 清除全库编号（二次确认）——
	new Setting(containerEl)
		.setName(t.clearVaultName)
		.setDesc(t.clearVaultDesc)
		.addButton((btn) =>
			btn
				.setButtonText(t.clearVaultBtn)
				.setWarning()
				.onClick(() => {
					new ClearVaultModal(plugin.app, plugin).open();
				}),
		);
}

/**
 * 「清除全库编号」二次确认对话框（见 spec.md §3.10）。
 *
 * 刻意**不注册为命令**，避免快捷键 / 命令面板误触发大面积改动（见 spec.md §3.10）。
 * 点击「确认清除全库」后调用 {@link AutoHeadingsPlugin.clearAllVaultNumbering}。
 */
class ClearVaultModal extends Modal {
	private readonly plugin: AutoHeadingsPlugin;

	constructor(app: App, plugin: AutoHeadingsPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		const t = this.plugin.messages();
		contentEl.empty();
		contentEl.createEl("h3", { text: t.clearVaultModalTitle });
		contentEl.createEl("p", { text: t.clearVaultModalBody });
		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText(t.cancel).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(t.confirmClearVault)
					.setWarning()
					.onClick(async () => {
						this.close();
						await this.plugin.clearAllVaultNumbering();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
