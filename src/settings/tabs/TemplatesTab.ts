import { App, Modal, Setting, setIcon } from "obsidian";
import type AutoHeadingsPlugin from "../../main";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import type { Template } from "../../numbering";
import type { PathRule } from "../../pathrules";
import { DEFAULT_TEMPLATE_NAME } from "../../templates/schema";
import { renderPathRules } from "./PathRules";
import { renderEditPanel } from "./EditPanel";

/** 删模板对话框里「连规则一并删除」的下拉哨兵值（不会与任何模板名冲突）。 */
const DELETE_RULES_SENTINEL = " __delete_rules__";

/**
 * 「路径与模板」TAB（M7 多 TAB 重构）：上为**路径规则**分区（`PathRules.ts`），下为**模板**分区
 * ——「+ 新增模板」、每个模板一行（删除 / 编辑）、行内展开编辑面板（`EditPanel.ts`）。
 */
export function renderTemplatesTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;

	// —— 路径规则分区（Milestone 5）——
	renderPathRules(tab, containerEl);

	// —— 模板分区 ——（节头挂强化类，与「路径规则」分区一眼可分，testplan L20）
	new Setting(containerEl)
		.setName(t.templatesHeading)
		.setHeading()
		.settingEl.addClass("ah-section-head");
	containerEl.createEl("p", { cls: "ah-section-desc", text: t.templatesDesc });

	new Setting(containerEl).addButton((btn) =>
		btn
			.setButtonText(t.addTemplate)
			.setCta()
			.onClick(() => {
				// 同步创建 + 立即重绘（落盘在后台），避免等磁盘写入导致的卡顿 / GUI 不刷新。
				const created = tab.plugin.templateStore.create();
				tab.expandedTemplate = created.name; // 新建后自动展开。
				tab.display();
			}),
	);

	const listEl = containerEl.createDiv({ cls: "ah-template-list" });
	for (const template of tab.plugin.templateStore.all()) {
		renderTemplateRow(tab, listEl, template);
	}
}

/**
 * 渲染单个模板的行（标题行 + 可展开编辑面板）；默认模板显示名随语言。
 *
 * 0.7.17 布局（testplan L23）：折叠钮**前置**作展开标志（▸/▾），其后模板名；展开时整行变
 * **大框**（边框圆角）扩住标题行与编辑面板，面板缩进与模板名左对齐（折叠钮悬在左侧沟槽）。
 * 点击折叠钮或模板名均可切换展开；删除按钮靠右。
 */
function renderTemplateRow(
	tab: AutoHeadingsSettingTab,
	parent: HTMLElement,
	template: Template,
): void {
	const t = tab.t;
	const isDefault = template.name === DEFAULT_TEMPLATE_NAME;
	const expanded = tab.expandedTemplate === template.name;

	const rowEl = parent.createDiv({
		cls: expanded ? "ah-template-row ah-template-row-expanded" : "ah-template-row",
	});

	// —— 标题行：[▸/▾] 模板名 …（默认模板说明）… [删除] ——
	const header = rowEl.createDiv({ cls: "ah-template-header" });
	const toggle = () => {
		tab.expandedTemplate = expanded ? null : template.name;
		tab.display();
	};

	const chevron = header.createSpan({ cls: "ah-template-chevron" });
	setIcon(chevron, expanded ? "chevron-down" : "chevron-right");
	chevron.setAttr("aria-label", expanded ? t.collapseTooltip : t.editTooltip);
	chevron.title = expanded ? t.collapseTooltip : t.editTooltip;
	chevron.addEventListener("click", toggle);

	const nameEl = header.createSpan({
		cls: "ah-template-name",
		text: tab.templateDisplayName(template.name),
	});
	nameEl.addEventListener("click", toggle);

	// 说明（仅默认模板）兼弹性占位，把删除按钮推到最右。
	const desc = header.createSpan({ cls: "ah-template-desc" });
	if (isDefault) {
		desc.setText(t.defaultTemplateDesc);
	}

	const delBtn = header.createEl("button", { cls: "mod-warning ah-template-del" });
	delBtn.setText(t.deleteBtn);
	if (isDefault) {
		delBtn.disabled = true;
		delBtn.title = t.defaultCannotDelete;
	} else {
		delBtn.addEventListener("click", () => {
			void requestDeleteTemplate(tab, template);
		});
	}

	// —— 展开的编辑面板（缩进与模板名对齐，见 styles.css）——
	if (expanded) {
		renderEditPanel(tab, rowEl, template, isDefault);
	}
}

/**
 * 删除模板：若**未被任何路径规则引用**则直接删除；否则弹出「知情确认 + 安全降级」对话框
 * （列出受影响规则，可降级到「默认」/ 改投他模板 / 连规则一并删，见 spec.md §3.6）。
 */
async function requestDeleteTemplate(
	tab: AutoHeadingsSettingTab,
	template: Template,
): Promise<void> {
	const affected = tab.plugin.settings.pathRules.filter((r) => r.template === template.name);
	if (affected.length === 0) {
		await tab.deleteTemplate(template.name);
		return;
	}
	new DeleteTemplateModal(tab.plugin.app, template.name, affected, tab).open();
}

/**
 * 删除被路径规则引用的模板时的「知情确认 + 安全降级」对话框（见 spec.md §3.6）。
 *
 * 列出受影响的全部路径规则，并让用户选择删除后这些规则的去向：降级到「默认」（缺省）/ 改投他模板 /
 * 连同这些规则一并删除。确认后先按选择改写 / 删除规则，再删除模板，最后刷新设置面板。
 */
class DeleteTemplateModal extends Modal {
	private readonly templateName: string;
	private readonly affected: PathRule[];
	private readonly tab: AutoHeadingsSettingTab;
	/** 受影响规则的去向：模板名 或「连规则一并删除」哨兵；缺省降级到「默认」。 */
	private redirect: string = DEFAULT_TEMPLATE_NAME;

	constructor(app: App, templateName: string, affected: PathRule[], tab: AutoHeadingsSettingTab) {
		super(app);
		this.templateName = templateName;
		this.affected = affected;
		this.tab = tab;
	}

	onOpen(): void {
		const { contentEl } = this;
		const plugin = this.tab.plugin;
		const t = plugin.messages();
		contentEl.empty();
		contentEl.createEl("h3", { text: t.delModalTitle(this.templateName) });
		contentEl.createEl("p", { text: t.delModalBody(this.affected.length) });
		const ul = contentEl.createEl("ul");
		for (const rule of this.affected) {
			ul.createEl("li", { text: rule.pattern || t.delModalEmptyPath });
		}

		// 可选模板（排除正在删除的模板）+「连规则一并删除」。
		new Setting(contentEl).setName(t.delModalRedirect).addDropdown((dd) => {
			for (const tpl of plugin.templateStore.all()) {
				if (tpl.name !== this.templateName) {
					dd.addOption(tpl.name, this.tab.templateDisplayName(tpl.name));
				}
			}
			dd.addOption(DELETE_RULES_SENTINEL, t.delModalDeleteRules);
			dd.setValue(this.redirect).onChange((value) => {
				this.redirect = value;
			});
		});

		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText(t.cancel).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(t.confirmDelete)
					.setWarning()
					.onClick(async () => {
						await this.applyAndClose(plugin);
					}),
			);
	}

	/** 按选择改写 / 删除受影响规则，再删除模板，刷新面板并关闭。 */
	private async applyAndClose(plugin: AutoHeadingsPlugin): Promise<void> {
		const rules = plugin.settings.pathRules;
		if (this.redirect === DELETE_RULES_SENTINEL) {
			plugin.settings.pathRules = rules.filter((r) => r.template !== this.templateName);
		} else {
			for (const rule of rules) {
				if (rule.template === this.templateName) {
					rule.template = this.redirect;
				}
			}
		}
		await plugin.saveSettings();
		await this.tab.deleteTemplate(this.templateName);
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
