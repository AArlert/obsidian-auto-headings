import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import type { Messages } from "../../i18n";

/** 仓库地址：Issues 反馈也挂在该仓库下。 */
const REPO_URL = "https://github.com/AArlert/obsidian-auto-headings";

/**
 * 开发过程中参考了实现思路的开源插件（鸣谢，见 spec.md §3.8/§3.12 与本文件对应的「参考实现」说明）。
 * `note` 取 `Messages` 里的对应字段，随界面语言切换。
 */
const CREDITS: Array<{ repo: string; url: string; note: (t: Messages) => string }> = [
	{
		repo: "numeroflip/obsidian-auto-template-trigger",
		url: "https://github.com/numeroflip/obsidian-auto-template-trigger",
		note: (t) => t.aboutCreditPathSuggest,
	},
	{
		repo: "hobeedzc/obsidian-header-enhancer-plugin",
		url: "https://github.com/hobeedzc/obsidian-header-enhancer-plugin",
		note: (t) => t.aboutCreditBacklinks,
	},
	{
		repo: "gurjar1/auto-heading-obsidian",
		url: "https://github.com/gurjar1/auto-heading-obsidian",
		note: (t) => t.aboutCreditWordJoiner,
	},
];

/**
 * 「关于」TAB（M7 多 TAB 重构）：插件名 + 版本 + 简介 + 链接（GitHub 仓库 / 反馈问题）+ 鸣谢。
 */
export function renderAboutTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;
	const manifest = tab.plugin.manifest;

	new Setting(containerEl).setName(manifest.name).setHeading();
	containerEl.createEl("p", { cls: "ah-section-desc", text: manifest.description });

	new Setting(containerEl)
		.setName(t.aboutVersionLabel)
		.setDesc(`v${manifest.version}（minAppVersion ${manifest.minAppVersion}）`);

	const links = containerEl.createDiv({ cls: "ah-about-links" });
	links.createEl("a", { text: t.aboutLinkRepo, href: REPO_URL });
	links.createEl("a", { text: t.aboutLinkIssues, href: `${REPO_URL}/issues` });

	new Setting(containerEl)
		.setName(t.aboutCreditsHeading)
		.setHeading()
		.settingEl.addClass("ah-section-head");
	containerEl.createEl("p", { cls: "ah-section-desc", text: t.aboutCreditsIntro });
	const creditList = containerEl.createDiv({ cls: "ah-about-credits" });
	for (const credit of CREDITS) {
		const item = creditList.createDiv({ cls: "ah-about-credit-item" });
		item.createEl("a", { text: credit.repo, href: credit.url, cls: "ah-about-credit-repo" });
		item.createEl("p", { cls: "ah-section-desc", text: credit.note(t) });
	}
}
