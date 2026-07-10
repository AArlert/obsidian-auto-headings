import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { DEBOUNCE_DEFAULT, DEBOUNCE_MAX, DEBOUNCE_MIN, clampDebounceDelay } from "../model";

/**
 * 「全局设置」TAB（M7 多 TAB 重构）：语言 / 全局自动编号 / Backlink 同步 / Backlink 独立触发 / 防抖延迟。
 *
 * Backlink 开关紧跟全局开关（0.7.11 曝光度决策：默认开 + 首次实际同步弹说明 Notice，
 * 面板上作为普通设置项自然呈现，见 spec.md §3.12）。Backlink 独立触发开关（CR-18）再紧跟其后、
 * 默认关（opt-in 扩展触发面，见 spec.md §3.12「独立于编号模板的触发」）。
 */
export function renderGeneralTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;
	const plugin = tab.plugin;

	// —— 语言选择（Milestone 6）——
	new Setting(containerEl)
		.setName(t.languageName)
		.setDesc(t.languageDesc)
		.addDropdown((dd) => {
			dd.addOption("auto", t.langAuto);
			dd.addOption("zh", t.langZh);
			dd.addOption("en", t.langEn);
			dd.setValue(plugin.settings.language).onChange(async (value) => {
				plugin.settings.language = value === "zh" || value === "en" ? value : "auto";
				await plugin.saveSettings();
				tab.display(); // 立即用新语言重绘面板。
			});
		});

	// —— 全局自动编号开关（两层开关的「面板层」，见 spec.md §3.1）——
	new Setting(containerEl)
		.setName(t.autoNumberName)
		.setDesc(t.autoNumberDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.autoNumber).onChange(async (value) => {
				await plugin.setAutoNumber(value);
			}),
		);

	// —— Backlink 同步开关（紧跟全局开关，默认开，见 spec.md §3.12）——
	new Setting(containerEl)
		.setName(t.updateBacklinksName)
		.setDesc(t.updateBacklinksDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.updateBacklinks).onChange(async (value) => {
				plugin.settings.updateBacklinks = value;
				await plugin.saveSettings();
			}),
		);

	// —— Backlink 独立于编号模板的触发（紧跟上一开关，默认关，CR-18，见 spec.md §3.12）——
	new Setting(containerEl)
		.setName(t.backlinkStandaloneTriggerName)
		.setDesc(t.backlinkStandaloneTriggerDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.backlinkStandaloneTrigger).onChange(async (value) => {
				plugin.settings.backlinkStandaloneTrigger = value;
				await plugin.saveSettings();
			}),
		);

	// —— 防抖延迟（滑块，M6，见 spec.md §3.9）——
	new Setting(containerEl)
		.setName(t.debounceName)
		.setDesc(t.debounceDesc(DEBOUNCE_MIN, DEBOUNCE_MAX, DEBOUNCE_DEFAULT))
		.addSlider((slider) =>
			slider
				.setLimits(DEBOUNCE_MIN, DEBOUNCE_MAX, 50)
				.setValue(plugin.settings.debounceDelay)
				.setDynamicTooltip()
				.onChange(async (value) => {
					plugin.settings.debounceDelay = clampDebounceDelay(value);
					await plugin.saveSettings();
				}),
		)
		.addExtraButton((btn) =>
			btn
				.setIcon("reset")
				.setTooltip(t.resetTooltip(DEBOUNCE_DEFAULT))
				.onClick(async () => {
					plugin.settings.debounceDelay = DEBOUNCE_DEFAULT;
					await plugin.saveSettings();
					tab.display();
				}),
		);
}
