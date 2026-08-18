import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { DEBOUNCE_DEFAULT, DEBOUNCE_MAX, DEBOUNCE_MIN, clampDebounceDelay } from "../model";
import { renderVcIntegrationSection } from "./VcIntegrationSection";
import { detectVcStatus } from "../../vcintegration";

/**
 * 「全局设置」TAB（M7 多 TAB 重构）。
 *
 * 1.0.29 起按**功能区**分节（用户反馈「全局设置该按功能区划分」）：语言（不挂节头，面板打开
 * 第一眼就是它）→「自动编号」（全局开关 + 防抖延迟）→「链接维护」（Backlink 同步）→
 * 「标题链接建议」（建议开关 + VC 共存策略 + VC 词典联动）。节头沿用 PathRules 的既有惯例
 * `setHeading() + .ah-section-head`（左侧强调色竖条），而不是插一条 `<hr>`——分区**带标题**
 * 才能说明每组是干什么的，光有分隔线只是把设置切碎。
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
	new Setting(containerEl)
		.setName(t.sectionNumbering)
		.setHeading()
		.settingEl.addClass("ah-section-head");

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

	// ==== 分区：链接维护 ====
	new Setting(containerEl)
		.setName(t.sectionLinking)
		.setHeading()
		.settingEl.addClass("ah-section-head");

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
	new Setting(containerEl)
		.setName(t.sectionSuggest)
		.setHeading()
		.settingEl.addClass("ah-section-head");
	// 分区导语（1.0.30）：先讲清「本功能自带、不依赖别的插件」，再说下面两项只有装了 VC 才
	// 需要关心——否则用户容易把「VC 联动」误读成本功能的前置条件（沿用 PathRules 的 p.ah-section-desc）。
	containerEl.createEl("p", { cls: "ah-section-desc", text: t.sectionSuggestDesc });

	// —— 标题链接建议开关（默认开，见 spec.md Roadmap M13）——
	new Setting(containerEl)
		.setName(t.headingLinkSuggestName)
		.setDesc(t.headingLinkSuggestDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.headingLinkSuggestEnabled).onChange(async (value) => {
				await plugin.setHeadingLinkSuggestEnabled(value);
			}),
		);

	// —— 与 Various Complements 的共存策略（1.0.29）——
	// 只在 VC **已安装**时渲染：没装 VC 的用户不存在这个取舍，多一项只是噪音。
	const vcStatus = detectVcStatus(plugin.app);
	if (vcStatus !== "not-installed") {
		new Setting(containerEl)
			.setName(t.vcCoexistName)
			.setDesc(t.vcCoexistDesc)
			.addDropdown((dd) => {
				dd.addOption("yield", t.vcCoexistYield);
				dd.addOption("own", t.vcCoexistOwn);
				dd.setValue(plugin.settings.headingSuggestWhenVcActive).onChange(async (value) => {
					plugin.settings.headingSuggestWhenVcActive = value === "own" ? "own" : "yield";
					await plugin.saveSettings();
					tab.display(); // 重绘：下面那条「无处出现」警告的显隐取决于本项
				});
			});

		// 选了让路、但词典联动还没开：此时**不会真的让路**（见 shouldYieldSuggestToVc），
		// 由本插件的建议框接管。1.0.30 及以前这里是一条「标题建议将无处出现」的警告——
		// 那个死角已在判定层消灭，现在只需如实告知当前谁在接管，不必再吓唬用户。
		const yieldPending =
			plugin.settings.headingLinkSuggestEnabled &&
			plugin.settings.headingSuggestWhenVcActive === "yield" &&
			vcStatus === "enabled" &&
			plugin.settings.vcIntegrationMode === "off";
		if (yieldPending) {
			containerEl
				.createEl("p", { cls: "ah-section-desc" })
				.createSpan({ text: t.vcCoexistFallbackHint });
		}
	}

	// —— Various Complements 词典联动（M13，见 spec.md Roadmap M13）——
	// 「本插件优先」且联动本就关着时**整块不渲染**（用户要求：这时 VC 的相关配置纯属噪音）。
	// 两条例外：① 联动已经开着照常显示——否则会留下「还在写词典、用户却看不见也关不掉」的
	// 隐身状态；② 没装 VC 时共存下拉根本不渲染，此时不该受它的历史值影响（手动联动本就允许
	// 在未装 VC 的情况下先生成词典，见 testplan Q10）。
	const hideVcSection =
		vcStatus !== "not-installed" &&
		plugin.settings.headingSuggestWhenVcActive === "own" &&
		plugin.settings.vcIntegrationMode === "off";
	if (!hideVcSection) {
		renderVcIntegrationSection(tab, containerEl);
	}
}
