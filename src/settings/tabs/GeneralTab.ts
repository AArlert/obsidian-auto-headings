import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { isLang, LANG_SELF_NAMES } from "../../i18n";
import { DEBOUNCE_DEFAULT, DEBOUNCE_MAX, DEBOUNCE_MIN, clampDebounceDelay } from "../model";
import { renderVcTargetSection } from "./VcIntegrationSection";
import { settingGroup } from "../group";
import { detectVcStatus } from "../../vcintegration";

/**
 * 「全局设置」TAB（M7 多 TAB 重构）。
 *
 * 1.0.29 起按**功能区**分节（用户反馈「全局设置该按功能区划分」）：「界面」（语言；未发版起与其他分区一样挂标题，
 * 卡片才对齐）→「自动编号」（全局开关 + 防抖延迟）→「链接维护」（Backlink 同步）→
 * 「笔记内菜单」（标题右键菜单 / 状态栏标签开关，未发版）→「标题链接建议」（建议开关 + VC 共存策略 + VC 词典联动）。每节是一个原生分组容器（{@link settingGroup}，未发版起；
 * 节头仍是原生 `setHeading()`，1.2.2 起去掉自绘的强调色竖条，与 Obsidian 自带设置页一致），而不是插一条 `<hr>`——分区**带标题**才能说明每组
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
	new Setting(settingGroup(containerEl, t.sectionInterface).list)
		.setName(t.languageName)
		.setDesc(t.languageDesc)
		.addDropdown((dd) => {
			dd.addOption("auto", t.langAuto);
			dd.addOption("zh", t.langZh);
			dd.addOption("zh-TW", LANG_SELF_NAMES["zh-TW"]);
			dd.addOption("ja", LANG_SELF_NAMES.ja);
			dd.addOption("es", LANG_SELF_NAMES.es);
			dd.addOption("fr", LANG_SELF_NAMES.fr);
			dd.addOption("de", LANG_SELF_NAMES.de);
			dd.addOption("ru", LANG_SELF_NAMES.ru);
			dd.addOption("ko", LANG_SELF_NAMES.ko);
			dd.addOption("pt-BR", LANG_SELF_NAMES["pt-BR"]);
			dd.addOption("en", t.langEn);
			dd.setValue(plugin.settings.language).onChange(async (value) => {
				plugin.settings.language = isLang(value) ? value : "auto";
				await plugin.saveSettings();
				tab.display(); // 立即用新语言重绘面板。
			});
		});

	// ==== 分区：自动编号 ====
	const numbering = settingGroup(containerEl, t.sectionNumbering).list;

	// —— 全局自动编号开关（两层开关的「面板层」，见 spec.md §3.1）——
	new Setting(numbering)
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
	let nativeValueDisplay = false; // 滑块自带数值显示时不再加自己的（见下方 addSlider）
	const showDebounce = (ms: number): void => {
		debounceValueEl?.setText(`${ms} ms`);
	};
	const debounceSetting = new Setting(numbering)
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
			// 新版 Obsidian（实测 1.14.4）的滑块自带数值显示（`span.slider-value`）与 `setDisplayFormat`；
			// 旧版没有，只在拖动时浮出提示——有原生的就用原生的、不再自己加，免得同一个数显示两遍。
			const native = slider as unknown as {
				setDisplayFormat?: (fmt: (v: number) => string) => unknown;
			};
			if (typeof native.setDisplayFormat === "function") {
				native.setDisplayFormat((v) => `${v} ms`);
				nativeValueDisplay = true;
				return;
			}
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
	if (!nativeValueDisplay) {
		debounceValueEl = debounceSetting.controlEl.createSpan({ cls: "ah-slider-value" });
		debounceSetting.controlEl.prepend(debounceValueEl);
		showDebounce(plugin.settings.debounceDelay);
	}

	// ==== 分区：链接维护 ====
	const linking = settingGroup(containerEl, t.sectionLinking).list;

	// —— Backlink 同步开关（默认开，全局生效，见 spec.md §3.12）——
	new Setting(linking)
		.setName(t.updateBacklinksName)
		.setDesc(t.updateBacklinksDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.updateBacklinks).onChange(async (value) => {
				plugin.settings.updateBacklinks = value;
				await plugin.saveSettings();
			}),
		);

	// ==== 分区：笔记内菜单（spec §3.24）====
	// 两个入口默认开；放进设置一是能关，二是让用户知道有这两个入口。
	const entries = settingGroup(containerEl, t.sectionNoteEntry).list;
	new Setting(entries)
		.setName(t.headingMenuName)
		.setDesc(t.headingMenuDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.headingMenuEnabled).onChange(async (value) => {
				plugin.settings.headingMenuEnabled = value;
				await plugin.saveSettings();
			}),
		);
	new Setting(entries)
		.setName(t.statusBarMenuName)
		.setDesc(t.statusBarMenuDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.statusBarMenuEnabled).onChange(async (value) => {
				plugin.settings.statusBarMenuEnabled = value;
				await plugin.saveSettings();
				plugin.noteEntry?.updateStatus();
			}),
		);

	// ==== 分区：标题链接建议（M13）====
	const suggest = settingGroup(containerEl, t.sectionSuggest).list;

	// —— 打字时建议标题链接（issue #10：新装默认关，spec §3.23 / testplan Q49）——
	// 切换后由 setHeadingLinkSuggestEnabled 重绘面板（「建议显示在」随之显隐）。
	new Setting(suggest)
		.setName(t.headingLinkSuggestName)
		.setDesc(t.headingLinkSuggestDesc)
		.addToggle((toggle) =>
			toggle.setValue(plugin.settings.headingLinkSuggestEnabled).onChange(async (value) => {
				await plugin.setHeadingLinkSuggestEnabled(value);
			}),
		);

	// —— 装了 VC 时：建议显示在哪（2026-10-18 用户定，testplan Q43）——
	// 只在建议**开着**时显示：关着无事可显示，不存在「显示在哪」（Q55）。
	// 开着时只在 VC **已启用**时显示（没装 / 没开 VC 的用户不存在这个选择）。例外：词典联动开着时无论
	// VC 状态都显示——否则会留下「还在写词典、用户却看不见也关不掉」的隐身状态。
	// 与上一行同级、左对齐（Q56，2026-10-23 用户定：不再缩进一层）。
	if (!plugin.settings.headingLinkSuggestEnabled) {
		return;
	}
	const vcStatus = detectVcStatus(plugin.app);
	if (vcStatus !== "enabled" && plugin.settings.vcIntegrationMode === "off") {
		return;
	}
	renderVcTargetSection(tab, suggest);
}
