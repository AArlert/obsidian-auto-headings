import { Setting, setIcon } from "obsidian";
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
 * 「关于插件」TAB（M7 多 TAB 重构；1.2.2 视觉更新，testplan L45）：插件名 + 小号版本号 + 双语简介
 * （随界面语言，不再直接显示英文 `manifest.description`）+「GitHub 仓库」「反馈问题」两个按钮 + 鸣谢
 * （每条一行名称 + 一行说明，点名称打开仓库）。
 */
export function renderAboutTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;
	const manifest = tab.plugin.manifest;

	const head = containerEl.createDiv({ cls: "ah-about-head" });
	head.createSpan({ cls: "ah-about-name", text: manifest.name });
	head.createSpan({ cls: "ah-about-version", text: manifest.version });
	containerEl.createEl("p", { cls: "ah-about-desc", text: t.aboutDescription });

	const links = containerEl.createDiv({ cls: "ah-about-links" });
	const linkButton = (icon: string, text: string, href: string): void => {
		const a = links.createEl("a", { cls: "ah-about-link", href });
		a.setAttr("target", "_blank");
		a.setAttr("rel", "noopener");
		setIcon(a.createSpan({ cls: "ah-about-link-icon" }), icon);
		a.createSpan({ text });
	};
	linkButton("external-link", t.aboutLinkRepo, REPO_URL);
	linkButton("message-square", t.aboutLinkIssues, `${REPO_URL}/issues`);

	new Setting(containerEl).setName(t.aboutCreditsHeading).setHeading();
	containerEl.createEl("p", { cls: "ah-section-desc", text: t.aboutCreditsIntro });
	for (const credit of CREDITS) {
		const item = new Setting(containerEl).setDesc(credit.note(t));
		item.nameEl.createEl("a", { text: credit.repo.replace("/", " / "), href: credit.url });
		item.settingEl.addClass("ah-about-credit");
	}
}
