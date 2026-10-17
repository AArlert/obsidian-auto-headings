import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { DEBOUNCE_DEFAULT, DEBOUNCE_MAX, DEBOUNCE_MIN, clampDebounceDelay } from "../model";
import { renderVcTargetSection } from "./VcIntegrationSection";
import { detectVcStatus } from "../../vcintegration";

/**
 * 「全局设置」TAB（M7 多 TAB 重构）。
 *
 * 1.0.29 起按**功能区**分节（用户反馈「全局设置该按功能区划分」）：语言（不挂节头，面板打开
 * 第一眼就是它）→「自动编号」（全局开关 + 防抖延迟）→「链接维护」（Backlink 同步）→
 * 「标题链接建议」（建议开关 + VC 共存策略 + VC 词典联动）。节头用原生 `setHeading()`（1.2.2 起去掉
 * 自绘的强调色竖条，与 Obsidian 自带设置页一致），而不是插一条 `<hr>`——分区**带标题**才能说明每组
 * 是干什么的，光有分隔线只是把设置切碎。说明文字一律一行，长解释在使用指南（testplan L28）。
 *
 * Backlink 开关的曝光度决策（0.7.11）不变：默认开 + 首次实际同步弹说明 Notice，见 spec.md §3.12。
 * 1.0.9 起原「独立触发」开关并入本开关：开启后全局生效，与是否命中编号模板 / 是否实际写入编号无关。
 */
export function renderGeneralTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;
	const plugin = tab.plugin;

	// —— 已交还所有权时的提示条（M12，见 spec.md §3.18）——
	// 放在最前、且**必须存在**：离场后下面那个「全局自动编号」开关即便是开着的也不会有任何效果，
	// 没有这条提示用户只会觉得「插件坏了」，这是本功能最容易砸掉信任的地方。
	if (plugin.settings.retired) {
		const banner = containerEl.createDiv({ cls: "ah-retired-banner" });
		banner.createEl("h4", { text: t.retiredBannerTitle });
		banner.createEl("p", { text: t.retiredBannerBody });
		new Setting(banner).addButton((btn) =>
			btn
				.setButtonText(t.resumeBtn)
				.setCta()
				.onClick(async () => {
					await plugin.resumeFromRetired();
				}),
		);
	}

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

	// ==== 分区：自动编号 ====
	new Setting(containerEl).setName(t.sectionNumbering).setHeading();

	// —— 全局自动编号开关（两层开关的「面板层」，见 spec.md §3.1）——
	new Setting(containerEl)
		.setName(t.autoNumberName)
		.setDesc(t.autoNumberDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.autoNumber).onChange(async (value) => {
				await plugin.setAutoNumber(value);
			}),
		);

	// —— 防抖延迟（滑块，M6，见 spec.md §3.9）——
	// 1.2.2：滑块左侧常显当前值（testplan L29）。拖动中经 `input` 事件实时刷新数字，
	// 保存仍走 onChange（与旧行为一致）。
	let debounceValueEl: HTMLElement | null = null;
	const showDebounce = (ms: number): void => {
		debounceValueEl?.setText(`${ms} ms`);
	};
	const debounceSetting = new Setting(containerEl)
		.setName(t.debounceName)
		.setDesc(t.debounceDesc(DEBOUNCE_MIN, DEBOUNCE_MAX, DEBOUNCE_DEFAULT))
		.addSlider((slider) => {
			slider
				.setLimits(DEBOUNCE_MIN, DEBOUNCE_MAX, 50)
				.setValue(plugin.settings.debounceDelay)
				.onChange(async (value) => {
					showDebounce(value);
					plugin.settings.debounceDelay = clampDebounceDelay(value);
					await plugin.saveSettings();
				});
			slider.sliderEl.addEventListener("input", () =>
				showDebounce(Number(slider.sliderEl.value)),
			);
		})
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
	debounceValueEl = debounceSetting.controlEl.createSpan({ cls: "ah-slider-value" });
	debounceSetting.controlEl.prepend(debounceValueEl);
	showDebounce(plugin.settings.debounceDelay);

	// ==== 分区：链接维护 ====
	new Setting(containerEl).setName(t.sectionLinking).setHeading();

	// —— Backlink 同步开关（默认开，全局生效，见 spec.md §3.12）——
	new Setting(containerEl)
		.setName(t.updateBacklinksName)
		.setDesc(t.updateBacklinksDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.updateBacklinks).onChange(async (value) => {
				plugin.settings.updateBacklinks = value;
				await plugin.saveSettings();
			}),
		);

	// ==== 分区：标题链接建议（M13）====
	new Setting(containerEl).setName(t.sectionSuggest).setHeading();

	// —— 标题链接建议开关（默认开，见 spec.md Roadmap M13）——
	new Setting(containerEl)
		.setName(t.headingLinkSuggestName)
		.setDesc(t.headingLinkSuggestDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.headingLinkSuggestEnabled).onChange(async (value) => {
				await plugin.setHeadingLinkSuggestEnabled(value);
			}),
		);

	// —— 装了 VC 时：建议显示在哪（2026-10-18 用户定，testplan Q43）——
	// 只在 VC **已启用**时显示（没装 / 没开 VC 的用户不存在这个选择）。例外：词典联动开着时无论 VC
	// 状态都显示——否则会留下「还在写词典、用户却看不见也关不掉」的隐身状态。
	const vcStatus = detectVcStatus(plugin.app);
	if (vcStatus !== "enabled" && plugin.settings.vcIntegrationMode === "off") {
		return;
	}
	const subEl = containerEl.createDiv({ cls: "ah-sub-settings" });
	renderVcTargetSection(tab, subEl);
}
