/**
 * 装了 Various Complements 时的「建议显示在」设置区（M13；2026-10-18 用户定的三种情况，testplan Q43）。
 *
 * 1. 只有本插件：不渲染本区，「标题链接建议」开关即全部（默认开，可关）。
 * 2. 本插件 + VC，选「本插件的建议框」：不写 VC 词典，本插件的框排在 VC 前面、盖住它。
 * 3. 本插件 + VC，选「VC 的建议框」：标题写进 VC 词典（手动 / 自动配置），本插件让路。
 *
 * 一个下拉取代原先的「VC 启用时（让路 / 本插件优先）」+「VC 联动（不联动 / 手动 / 自动）」——两者组合出的
 * 「让路但没联动」「优先却开着联动」都是自相矛盾的状态（用户实测两边建议混在一起）。行为只看一件事：
 * 联动开着就让路，否则用本插件的框（见 vcintegration.ts `shouldYieldSuggestToVc`）。
 *
 * 下拉 onChange 本身不写 settings：切到 VC 弹自动配置确认框（框里另有「手动配置」入口），切回本插件走停止
 * 联动确认（VC 还挂着词典时问要不要移除）。取消则由 tab.display() 按 settings 现值重绘复位。
 *
 * 确认 Modal 的结构照抄 MaintenanceTab.ts 的 VaultConfirmModal 惯例
 * （Modal 子类 + onOpen 里 createEl + 取消/确认按钮，确认后 this.close() 再 await 业务方法）。
 */

import { Modal, Notice, Setting, type App } from "obsidian";
import type AutoHeadingsPlugin from "../../main";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { readVcDescriptionOnSuggestion } from "../../vcintegration";

/** 渲染「建议显示在」下拉，及其附属行（VC 侧：词典路径；本插件侧：过期词典提示）。 */
export function renderVcTargetSection(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;
	const plugin = tab.plugin;
	const inVc = plugin.settings.vcIntegrationMode !== "off";

	new Setting(containerEl)
		.setName(t.vcTargetName)
		.setDesc(t.vcTargetDesc)
		.addDropdown((dd) => {
			dd.addOption("plugin", t.vcTargetPlugin);
			dd.addOption("vc", t.vcTargetVc);
			dd.setValue(inVc ? "vc" : "plugin").onChange(async (value) => {
				if ((value === "vc") === inVc) {
					return;
				}
				if (value === "vc") {
					new VcAutoModeConfirmModal(plugin.app, plugin, tab).open();
				} else {
					await stopVcIntegration(tab);
				}
			});
		});

	if (!inVc) {
		// 过期词典（testplan Q36）：用的是本插件的框，但启用中的 VC 仍挂着本插件词典（旧版切回时不清理留下的）。
		if (plugin.isVcDictionaryRegistered()) {
			new Setting(containerEl)
				.setName(t.vcStaleDictName)
				.setDesc(t.vcStaleDictDesc)
				.addButton((btn) =>
					btn.setButtonText(t.vcStaleDictRemoveButton).onClick(async () => {
						await plugin.removeVcDictionaryRegistration();
						tab.display();
					}),
				);
		}
		return;
	}

	// 1.0.32：来源路径行靠 VC 的 descriptionOnSuggestion 渲染；用户把它设成 None 时那一行
	// 不会出现。这是 VC 的全局显示偏好（同时管 internalLink 等），不代改，只如实提示一句。
	if (readVcDescriptionOnSuggestion(plugin.app)?.toLowerCase() === "none") {
		containerEl.createEl("p", { cls: "ah-section-desc", text: t.vcDescriptionOffHint });
	}
	// 词典路径只有手动配置才用得上（自己填进 VC）；自动配置已替用户填好，再显示反倒像还有事要做。
	if (plugin.settings.vcIntegrationMode !== "manual") {
		return;
	}
	const path = plugin.vcDictionaryFilePath();
	new Setting(containerEl)
		.setName(t.vcDictionaryPathLabel)
		.setDesc(path)
		.addButton((btn) =>
			btn.setButtonText(t.vcCopyPathButton).onClick(async () => {
				try {
					await navigator.clipboard.writeText(path);
					new Notice(t.noticeVcPathCopied);
				} catch {
					// 不再回退已废弃的 execCommand：路径就在说明里，复制失败时可手动选取。
					new Notice(t.noticeCopyFailed);
				}
			}),
		);
}

/** 切回本插件的建议框：VC 还挂着本插件词典时先问要不要一并移除（Q35），否则直接停止联动。 */
async function stopVcIntegration(tab: AutoHeadingsSettingTab): Promise<void> {
	const plugin = tab.plugin;
	if (plugin.isVcDictionaryRegistered()) {
		new VcOffConfirmModal(plugin.app, plugin, tab).open();
		return;
	}
	await plugin.setVcIntegrationOff();
	tab.display();
}

/** 切回「不联动」确认框（testplan Q35）：两个按钮都会停止联动，区别只在要不要从 VC 移除词典路径。 */
class VcOffConfirmModal extends Modal {
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
		this.setTitle(t.vcOffConfirmTitle);
		contentEl.createEl("p", { text: t.vcOffConfirmBody });
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText(t.vcOffKeepButton).onClick(async () => {
					this.close();
					await this.plugin.setVcIntegrationOff();
					this.tab.display();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText(t.vcOffRemoveButton)
					.setCta()
					.onClick(async () => {
						this.close();
						await this.plugin.setVcIntegrationOff();
						await this.plugin.removeVcDictionaryRegistration();
						this.tab.display();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		// 点遮罩 / Esc 关闭 = 什么都没做：重绘把下拉复位到原值。
		this.tab.display();
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
		this.setTitle(t.vcManualConfirmTitle);
		contentEl.createEl("p", { text: t.vcManualConfirmBody });
		new Setting(contentEl)
			.setName(t.vcDictionaryPathLabel)
			.setDesc(path)
			.addButton((btn) =>
				btn.setButtonText(t.vcCopyPathButton).onClick(async () => {
					try {
						await navigator.clipboard.writeText(path);
						new Notice(t.noticeVcPathCopied);
					} catch {
						// 不再回退已废弃的 execCommand：路径就在说明里，复制失败时可手动选取。
						new Notice(t.noticeCopyFailed);
					}
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
		this.tab.display(); // 点遮罩 / Esc 关闭：重绘把下拉复位
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
		this.setTitle(t.vcAutoConfirmTitle);
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
			// 不想让插件改 VC 设置的用户：只生成词典，自己把路径填进 VC（Q11）。
			.addButton((btn) =>
				btn.setButtonText(t.vcAutoManualButton).onClick(() => {
					this.close();
					new VcManualModeConfirmModal(this.app, this.plugin, this.tab).open();
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
		this.tab.display(); // 点遮罩 / Esc 关闭：重绘把下拉复位
	}
}
