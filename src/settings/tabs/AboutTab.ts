import { Setting } from "obsidian";
import type { AutoHeadingsSettingTab } from "../SettingsTab";

/** 仓库地址：Issues 反馈也挂在该仓库下。 */
const REPO_URL = "https://github.com/AArlert/obsidian-auto-headings";

/**
 * 「关于」TAB（M7 多 TAB 重构）：插件名 + 版本 + 简介 + 链接（GitHub 仓库 / 反馈问题）。
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
}
