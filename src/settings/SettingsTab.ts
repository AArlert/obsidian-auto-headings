import { App, PluginSettingTab, setIcon } from "obsidian";
import type AutoHeadingsPlugin from "../main";
import type { Messages } from "../i18n";
import type { WhitelistSortMode } from "../numbering";
import { DEFAULT_TEMPLATE_NAME } from "../templates/schema";
import { renderGeneralTab } from "./tabs/GeneralTab";
import { renderTemplatesTab } from "./tabs/TemplatesTab";
import { renderDangerTab } from "./tabs/DangerTab";
import { renderAboutTab } from "./tabs/AboutTab";

/** 设置页的四个 TAB（M7 多 TAB 重构，见 spec.md §3.13）。 */
export type SettingsTabId = "general" | "templates" | "danger" | "about";

/** TAB 的固定遍历顺序。 */
const TAB_ORDER: SettingsTabId[] = ["general", "templates", "danger", "about"];

/**
 * 各 TAB 的 lucide 图标（0.7.17，testplan L22）。用 Obsidian 内置 `setIcon`（SVG、currentColor）
 * 而非 emoji——emoji 由系统字体渲染、固定彩色不吃 CSS 颜色，无法「黑白随主题」。
 */
const TAB_ICONS: Record<SettingsTabId, string> = {
	general: "settings",
	templates: "folder-cog",
	danger: "alert-triangle",
	about: "info",
};

/**
 * 设置页面（M7 起为**多 TAB** 结构，见 spec.md §3.13）：
 *
 * - **全局设置**：语言 / 全局自动编号 / Backlink 同步 / 防抖延迟。
 * - **路径与模板**：路径规则表 + 模板列表（行内展开编辑面板，含白名单编辑器）。
 * - **敏感操作**：三个清除入口（当前文件 / 外来编号 / 全库）+ ⚠ 说明。
 * - **关于**：版本 + 链接。
 *
 * 本类只是**壳**：渲染版本号与 TAB 栏，把各 TAB 的内容渲染委托给 `tabs/` 下的分区模块；
 * 同时持有跨重绘的视图态（当前 TAB、展开的模板）。
 * 全部界面文案经 {@link Messages} 中英双语（Milestone 6），由 `settings.language` 决定。
 */
export class AutoHeadingsSettingTab extends PluginSettingTab {
	readonly plugin: AutoHeadingsPlugin;

	/** 当前激活的 TAB（面板存续期间保持，重开面板回到「全局设置」）。 */
	activeTab: SettingsTabId = "general";

	/** 当前展开编辑面板的模板名（null 表示全部折叠）。 */
	expandedTemplate: string | null = null;

	/** 白名单编辑器的搜索框文本（纯视图态，跨重绘保持；M8 批次 1，见 testplan L14）。 */
	wlFilter = "";

	/** 白名单编辑器的排序方式（纯视图态；M8 批次 1，L15）。0.7.17 起默认 A–Z。 */
	wlSort: WhitelistSortMode = "az";

	/** TAB 按钮元素（切 TAB 时复用、不重建，好让背景色 CSS 过渡动画能播放，见 switchTab）。 */
	private tabButtons = new Map<SettingsTabId, HTMLButtonElement>();

	/** 当前 TAB 内容容器（切 TAB 时只清空重绘这一块，不动 TAB 栏）。 */
	private bodyEl: HTMLElement | null = null;

	constructor(app: App, plugin: AutoHeadingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/** 当前界面语言的文案表（随 `settings.language` 实时解析）。 */
	get t(): Messages {
		return this.plugin.messages();
	}

	/**
	 * 模板的**显示名**：默认模板（存储名恒「默认」、文件名恒 `default.json`）随界面语言显示为
	 * 「默认」/「Default」；其余模板显示存储名。仅影响显示，存储与路径规则引用不变。
	 */
	templateDisplayName(name: string): string {
		return name === DEFAULT_TEMPLATE_NAME ? this.t.defaultTemplateDisplay : name;
	}

	/** 某 TAB 的显示标签。 */
	private tabLabel(id: SettingsTabId): string {
		const t = this.t;
		switch (id) {
			case "general":
				return t.tabGeneral;
			case "templates":
				return t.tabTemplates;
			case "danger":
				return t.tabDanger;
			case "about":
				return t.tabAbout;
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// —— 版本号（右上角，低调但清晰）——
		containerEl.createDiv({
			cls: "ah-version",
			text: `v${this.plugin.manifest.version}`,
		});

		// —— TAB 栏（0.7.17 图标化，L21/L22）：未激活 = 仅图标，激活 = 图标 + 文字 + 强调色背景；
		// 栏自身可横向滑动（窄屏不撑宽设置页）。按钮元素本身跨切换保留（见 switchTab），
		// 只切换 class/子节点，好让 CSS 背景色过渡动画能播放（新建元素无法从旧状态过渡）。
		const bar = containerEl.createDiv({ cls: "ah-tabs" });
		this.tabButtons.clear();
		for (const id of TAB_ORDER) {
			const btn = bar.createEl("button", { cls: "ah-tab" });
			const iconEl = btn.createSpan({ cls: "ah-tab-icon" });
			setIcon(iconEl, TAB_ICONS[id]);
			// 未激活只显图标，名称经 aria-label / title 提供（无障碍 + hover 提示）。
			btn.setAttr("aria-label", this.tabLabel(id));
			btn.title = this.tabLabel(id);
			btn.addEventListener("click", () => this.switchTab(id));
			this.tabButtons.set(id, btn);
			this.applyTabButtonState(id, btn);
		}

		// —— 当前 TAB 内容 ——
		this.bodyEl = containerEl.createDiv({ cls: "ah-tab-body" });
		this.renderActiveTabContent();
	}

	/** 按 `id` 是否为当前激活 TAB，同步某个 TAB 按钮的高亮 class 与文字标签。 */
	private applyTabButtonState(id: SettingsTabId, btn: HTMLButtonElement): void {
		const active = id === this.activeTab;
		btn.classList.toggle("ah-tab-active", active);
		const existingLabel = btn.querySelector<HTMLElement>(".ah-tab-label");
		if (active && !existingLabel) {
			btn.createSpan({ cls: "ah-tab-label", text: this.tabLabel(id) });
		} else if (!active && existingLabel) {
			existingLabel.remove();
		}
	}

	/** 切换当前 TAB：只更新 TAB 栏按钮的 class/内容重绘，不重建 TAB 栏本身（好让背景色过渡动画播放）。 */
	private switchTab(id: SettingsTabId): void {
		if (id === this.activeTab) {
			return;
		}
		this.activeTab = id;
		for (const [tid, btn] of this.tabButtons) {
			this.applyTabButtonState(tid, btn);
		}
		this.renderActiveTabContent();
	}

	/** 只清空重绘 TAB 内容区域（不动 TAB 栏），供 `switchTab` 与 `display` 共用。 */
	private renderActiveTabContent(): void {
		if (!this.bodyEl) {
			return;
		}
		this.bodyEl.empty();
		switch (this.activeTab) {
			case "general":
				renderGeneralTab(this, this.bodyEl);
				break;
			case "templates":
				renderTemplatesTab(this, this.bodyEl);
				break;
			case "danger":
				renderDangerTab(this, this.bodyEl);
				break;
			case "about":
				renderAboutTab(this, this.bodyEl);
				break;
		}
	}

	/** 真正执行模板删除并刷新面板（收起其编辑面板）。供模板分区与删除对话框调用。 */
	async deleteTemplate(name: string): Promise<void> {
		await this.plugin.templateStore.delete(name);
		if (this.expandedTemplate === name) {
			this.expandedTemplate = null;
		}
		this.display();
	}
}
