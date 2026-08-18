/**
 * 「Various Complements 联动」设置区（M13，见 spec.md Roadmap M13 与 doc/research 方案 §5.10/§6.2）。
 *
 * 三态选择器（不联动 / 手动配置 / 自动配置）：任何**离开「不联动」**的切换都必须先过独立确认框
 * （产品决策：基础功能默认开 ≠ 联动默认开，需用户显式确认）；确认框内部才真正调用插件的
 * enableVcManualIntegration / enableVcAutoIntegration，取消则下拉由 tab.display() 重绘复位
 * （每次渲染都读最新 settings，无需额外「复位」状态）。
 *
 * 选中非「不联动」时额外渲染一行「词典文件路径 + 一键复制」。
 *
 * 两个确认 Modal 的结构照抄 DangerTab.ts 的 ClearVaultModal/FreezeVaultModal 惯例
 * （Modal 子类 + onOpen 里 createEl + 取消/确认按钮，确认后 this.close() 再 await 业务方法）。
 */

import { Modal, Notice, Setting, type App } from "obsidian";
import type AutoHeadingsPlugin from "../../main";
import type { AutoHeadingsSettingTab } from "../SettingsTab";

/** 复制文本到剪贴板：优先 Clipboard API，失败回退临时 textarea + execCommand（移动端兜底）。 */
async function copyToClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		return;
	} catch {
		/* 回退到 execCommand */
	}
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.style.position = "fixed";
	ta.style.opacity = "0";
	document.body.appendChild(ta);
	ta.select();
	try {
		document.execCommand("copy");
	} finally {
		document.body.removeChild(ta);
	}
}

/**
 * 渲染 VC 联动设置区。下拉 onChange 本身不写 settings——根据目标值弹对应确认框；
 * 只有用户在框内点确认才真正调用插件方法。
 */
export function renderVcIntegrationSection(
	tab: AutoHeadingsSettingTab,
	containerEl: HTMLElement,
): void {
	const t = tab.t;
	const plugin = tab.plugin;

	new Setting(containerEl)
		.setName(t.vcModeName)
		.setDesc(t.vcModeDesc)
		.addDropdown((dd) => {
			dd.addOption("off", t.vcModeOff);
			dd.addOption("manual", t.vcModeManual);
			dd.addOption("auto", t.vcModeAuto);
			dd.setValue(plugin.settings.vcIntegrationMode).onChange(async (value) => {
				const target = value === "manual" || value === "auto" ? value : "off";
				if (target === plugin.settings.vcIntegrationMode) {
					return;
				}
				if (target === "off") {
					await plugin.setVcIntegrationOff();
					tab.display();
					return;
				}
				if (target === "manual") {
					new VcManualModeConfirmModal(plugin.app, plugin, tab).open();
				} else {
					new VcAutoModeConfirmModal(plugin.app, plugin, tab).open();
				}
				// 取消时无需额外复位：确认框关闭后 tab.display() 会按 settings 现值重绘下拉。
			});
		});

	if (plugin.settings.vcIntegrationMode !== "off") {
		const path = plugin.vcDictionaryFilePath();
		new Setting(containerEl)
			.setName(t.vcDictionaryPathLabel)
			.setDesc(path)
			.addButton((btn) =>
				btn.setButtonText(t.vcCopyPathButton).onClick(async () => {
					await copyToClipboard(path);
					new Notice(t.noticeVcPathCopied);
				}),
			);
	}
}

/** 「手动配置」确认框：说明不碰 VC 任何配置 + 词典路径展示与一键复制。 */
class VcManualModeConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: AutoHeadingsPlugin,
		private readonly tab: AutoHeadingsSettingTab,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		const t = this.plugin.messages();
		const path = this.plugin.vcDictionaryFilePath();
		contentEl.empty();
		contentEl.createEl("h3", { text: t.vcManualConfirmTitle });
		contentEl.createEl("p", { text: t.vcManualConfirmBody });
		new Setting(contentEl)
			.setName(t.vcDictionaryPathLabel)
			.setDesc(path)
			.addButton((btn) =>
				btn.setButtonText(t.vcCopyPathButton).onClick(async () => {
					await copyToClipboard(path);
					new Notice(t.noticeVcPathCopied);
				}),
			);
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText(t.cancel).onClick(() => {
					this.close();
					this.tab.display();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText(t.vcManualConfirmButton)
					.setCta()
					.onClick(async () => {
						this.close();
						await this.plugin.enableVcManualIntegration();
						this.tab.display();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** 「自动配置」确认框：明确告知会读写 VC 的配置文件（含开启其自定义词典补全）与安全回退承诺。 */
class VcAutoModeConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: AutoHeadingsPlugin,
		private readonly tab: AutoHeadingsSettingTab,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		const t = this.plugin.messages();
		contentEl.empty();
		contentEl.createEl("h3", { text: t.vcAutoConfirmTitle });
		// 1.0.27：长段 ①②③ 文案改为「短总述 + 要点列表」，确认框整洁可扫读。
		contentEl.createEl("p", { text: t.vcAutoConfirmBody });
		const ul = contentEl.createEl("ul");
		for (const point of t.vcAutoConfirmPoints) {
			ul.createEl("li", { text: point });
		}
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText(t.cancel).onClick(() => {
					this.close();
					this.tab.display();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText(t.vcAutoConfirmButton)
					.setCta()
					.onClick(async () => {
						this.close();
						await this.plugin.enableVcAutoIntegration();
						this.tab.display();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
