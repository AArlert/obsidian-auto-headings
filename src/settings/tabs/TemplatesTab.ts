import { App, Menu, Modal, Setting, setIcon } from "obsidian";
import type AutoHeadingsPlugin from "../../main";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import type { Template } from "../../numbering";
import type { PathRule } from "../../pathrules";
import { DEFAULT_TEMPLATE_NAME } from "../../templates/schema";
import { cardPreviewLines } from "../templateView";
import { decorateHeadingButton, renderPathRules } from "./PathRules";
import { TemplateEditorModal } from "./TemplateEditorModal";

/** 删模板对话框里「连规则一并删除」的下拉哨兵值（不会与任何模板名冲突）。 */
const DELETE_RULES_SENTINEL = " __delete_rules__";

/**
 * 「路径模板」TAB（M7 多 TAB 重构）：上为**路径规则**分区（`PathRules.ts`），下为**模板**分区。
 *
 * 1.2.2 视觉更新（testplan L34）：「新增模板」挪到「模板」标题行右侧（普通按钮，新建后直接打开编辑
 * 弹窗）；每个模板一张卡片——名称（默认模板带「内置」灰标）+ 三行效果预览 +「用于 N 条规则 · 白名单
 * M 项」+「编辑」+ ⋯ 菜单（删除，红字；默认模板不可删，没有 ⋯）。编辑在弹窗里（`TemplateEditorModal.ts`）。
 */
export function renderTemplatesTab(tab: AutoHeadingsSettingTab, containerEl: HTMLElement): void {
	const t = tab.t;

	// —— 路径规则分区（Milestone 5）——
	renderPathRules(tab, containerEl);

	// —— 模板分区 ——
	new Setting(containerEl)
		.setName(t.templatesHeading)
		.setHeading()
		.addButton((btn) => {
			decorateHeadingButton(btn.buttonEl, "plus", t.addTemplate);
			btn.onClick(() => {
				// 同步创建（落盘在后台），随即打开编辑弹窗；弹窗关闭时重绘设置页。
				const created = tab.plugin.templateStore.create();
				new TemplateEditorModal(tab.plugin.app, tab, created.name).open();
			});
		});
	containerEl.createEl("p", { cls: "ah-section-desc", text: t.templatesDesc });

	const cards = containerEl.createDiv({ cls: "ah-template-cards" });
	for (const template of tab.plugin.templateStore.all()) {
		renderTemplateCard(tab, cards, template);
	}
}

/** 渲染单个模板的卡片（testplan L34）。 */
function renderTemplateCard(
	tab: AutoHeadingsSettingTab,
	parent: HTMLElement,
	template: Template,
): void {
	const t = tab.t;
	const isDefault = template.name === DEFAULT_TEMPLATE_NAME;
	const card = parent.createDiv({ cls: "ah-template-card" });
	card.setAttr("aria-label", tab.templateDisplayName(template.name));

	// —— 标题行：名称（+ 内置灰标）… ⋯ ——
	const head = card.createDiv({ cls: "ah-template-card-head" });
	const name = head.createDiv({ cls: "ah-template-card-name" });
	name.createSpan({ text: tab.templateDisplayName(template.name) });
	if (isDefault) {
		name.createSpan({ cls: "ah-pill", text: t.templateBuiltinTag });
	} else {
		const more = head.createEl("button", { cls: "clickable-icon ah-template-card-more" });
		setIcon(more, "more-horizontal");
		more.setAttr("aria-label", t.templateActionsTooltip);
		more.addEventListener("click", (e) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle(t.deleteBtn)
					.setIcon("trash-2")
					.setWarning(true)
					.onClick(() => void requestDeleteTemplate(tab, template)),
			);
			menu.showAtMouseEvent(e);
		});
	}

	// —— 三行效果预览：级别 + 编号 + 示例标题 ——
	const preview = card.createDiv({ cls: "ah-template-card-preview" });
	cardPreviewLines(template).forEach((line, i) => {
		preview.createSpan({ cls: "ah-template-card-level", text: `H${line.level}` });
		const text = preview.createSpan({ cls: "ah-template-card-line" });
		text.setCssStyles({ paddingInlineStart: `${line.indent}em` });
		text.createSpan({ text: line.label });
		text.createSpan({
			cls: "ah-template-card-word",
			text: t.cardSampleTitles[i] ?? t.previewHeadingWord,
		});
	});

	// —— 底部：用量 … 编辑 ——
	const foot = card.createDiv({ cls: "ah-template-card-foot" });
	const ruleCount = tab.plugin.settings.pathRules.filter((r) => r.template === template.name).length;
	foot.createSpan({
		cls: "ah-template-card-usage",
		text: t.templateCardUsage(ruleCount, template.whitelist.length),
	});
	const edit = foot.createEl("button", { text: t.editBtn });
	edit.addEventListener("click", () => {
		new TemplateEditorModal(tab.plugin.app, tab, template.name).open();
	});
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
		this.setTitle(t.delModalTitle(this.templateName));
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
