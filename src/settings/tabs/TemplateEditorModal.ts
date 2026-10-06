import { type App, Modal, setIcon } from "obsidian";
import type AutoHeadingsPlugin from "../../main";
import type { Messages } from "../../i18n";
import type { Template, WhitelistSortMode } from "../../numbering";
import { DEFAULT_TEMPLATE_NAME } from "../../templates/schema";
import { styleOf, stylesEqual, type TemplateStyle } from "../../templates/styles";
import type { AutoHeadingsSettingTab } from "../SettingsTab";
import { renderFormatPane } from "./EditPanel";
import { renderWhitelistEditor } from "./WhitelistEditor";

/** 编辑弹窗的两个内部 TAB。 */
export type EditorPane = "format" | "whitelist";

/** 底部预览的内容来源。 */
export type PreviewSource = "current" | "sample";

/**
 * 格式页 / 白名单页渲染时拿到的宿主：文案、插件、跨重绘保持的视图态，以及整窗重绘。
 * 两页的渲染函数只认这个接口，不直接依赖弹窗类。
 */
export interface TemplateEditorHost {
	readonly t: Messages;
	readonly plugin: AutoHeadingsPlugin;
	/** 模板显示名（默认模板随语言显示「默认」/「Default」）。 */
	templateDisplayName(name: string): string;
	/** 白名单搜索框文本（纯视图态，跨重绘保持；testplan L14）。 */
	wlFilter: string;
	/** 白名单排序方式（纯视图态；L15，默认 A–Z）。 */
	wlSort: WhitelistSortMode;
	/** 底部预览显示当前笔记还是示例（testplan L40）。 */
	previewSource: PreviewSource;
	/** 重绘后要聚焦的元素选择器（如白名单添加框，添加一条后光标留在原处）。 */
	pendingFocus: string | null;
	/** 整窗重绘（保留滚动位置）。 */
	rerender(): void;
	/**
	 * 草稿被改动（M16，S22）：两页的每次改动都调它，**不写盘、不碰任何笔记**；点「保存」才落盘并重编。
	 * 传入的 `template` 恒为弹窗持有的草稿对象。
	 */
	persist(template: Template): Promise<void>;
}

/**
 * 模板编辑弹窗（1.2.2 视觉更新，取代 0.7.17 的行内展开面板，testplan L35）。
 *
 * - 标题区：小字「编辑模板」+ 模板名 + 铅笔就地改名（沿用 `plugin.renameTemplate`；默认模板名固定，
 *   不给铅笔）。写在原生 `titleEl` 里，与关闭按钮同一行。
 * - 两个内部 TAB：格式（`EditPanel.ts` 的 {@link renderFormatPane}）/ 白名单（带条数，
 *   `WhitelistEditor.ts`）。
 * - 改动**即时生效**（与旧面板一致：每次改动都存模板并重编当前文件），底部只有「完成」和一行说明
 *   （格式页：影响多少规则 / 笔记；白名单页：单击改写的提示）。
 * - 关闭时重绘设置页，让卡片预览与用量跟上。
 */
export class TemplateEditorModal extends Modal implements TemplateEditorHost {
	wlFilter = "";
	wlSort: WhitelistSortMode = "az";
	previewSource: PreviewSource = "current";
	pendingFocus: string | null = null;

	private pane: EditorPane;
	private templateName: string;
	private renaming = false;
	/** 草稿（M16，S22）：编辑期间所有改动落在这份深拷贝上，保存前不动模板文件与笔记。 */
	private draft: Template | null = null;
	/** 打开时的样式，保存时据此判断样式是否变过（决定要不要记历史）。 */
	private baseStyle: TemplateStyle | null = null;
	private dirty = false;
	private saveBtn: HTMLButtonElement | null = null;
	private dirtyEl: HTMLElement | null = null;

	constructor(
		app: App,
		private readonly tab: AutoHeadingsSettingTab,
		templateName: string,
		pane: EditorPane = "format",
	) {
		super(app);
		this.templateName = templateName;
		this.pane = pane;
	}

	get t(): Messages {
		return this.tab.t;
	}

	get plugin(): AutoHeadingsPlugin {
		return this.tab.plugin;
	}

	templateDisplayName(name: string): string {
		return this.tab.templateDisplayName(name);
	}

	onOpen(): void {
		this.modalEl.addClass("ah-template-modal");
		const stored = this.plugin.templateStore.get(this.templateName);
		if (stored) {
			this.draft = structuredClone(stored);
			this.baseStyle = styleOf(stored);
		}
		this.render();
	}

	async persist(): Promise<void> {
		this.dirty = true;
		this.syncDirtyUi();
	}

	private syncDirtyUi(): void {
		if (this.saveBtn) {
			this.saveBtn.disabled = !this.dirty;
		}
		this.dirtyEl?.toggleClass("is-visible", this.dirty);
	}

	/**
	 * 保存草稿（S22）：写模板文件；样式变过则记历史（历史为空时先把打开时的样式记一份，保证能回到编辑前）；
	 * 再重编已打开的笔记。保存成功后关闭弹窗。
	 */
	private async save(): Promise<void> {
		const draft = this.draft;
		if (!draft || !this.baseStyle) {
			return;
		}
		await this.plugin.templateStore.save(draft);
		const next = styleOf(draft);
		if (!stylesEqual(this.baseStyle, next)) {
			if (this.plugin.templateHistoryOf(draft.name).length === 0) {
				await this.plugin.recordTemplateStyle(draft.name, this.baseStyle);
			}
			await this.plugin.recordTemplateStyle(draft.name, next);
		}
		this.plugin.renumberActiveFile();
		this.dirty = false;
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
		this.tab.display();
	}

	rerender(): void {
		this.render();
	}

	private render(): void {
		const template = this.draft;
		if (!template || !this.plugin.templateStore.get(this.templateName)) {
			this.close(); // 模板已被删除 / 改名失败后丢失：没有可编辑的对象。
			return;
		}
		const scrollTop = this.contentEl.scrollTop;
		this.renderTitle(template);
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ah-editor-content");

		// —— 内部 TAB：格式 / 白名单（条数）——
		const tabs = contentEl.createDiv({ cls: "ah-editor-tabs" });
		tabs.setAttr("role", "tablist");
		const addTab = (id: EditorPane, label: string, count?: number): void => {
			const btn = tabs.createEl("button", {
				cls: id === this.pane ? "ah-editor-tab is-active" : "ah-editor-tab",
			});
			btn.setAttr("role", "tab");
			btn.setAttr("aria-selected", String(id === this.pane));
			btn.createSpan({ text: label });
			if (count !== undefined) {
				btn.createSpan({ cls: "ah-editor-tab-count", text: String(count) });
			}
			btn.addEventListener("click", () => {
				if (this.pane !== id) {
					this.pane = id;
					this.render();
				}
			});
		};
		addTab("format", this.t.editorTabFormat);
		addTab("whitelist", this.t.editorTabWhitelist, template.whitelist.length);

		const body = contentEl.createDiv({ cls: "ah-editor-body" });
		if (this.pane === "format") {
			renderFormatPane(this, body, template);
		} else {
			renderWhitelistEditor(this, body, template);
		}

		// —— 底部：一行说明 + 「完成」——
		const footer = contentEl.createDiv({ cls: "ah-editor-footer" });
		footer.createSpan({ cls: "ah-editor-footer-note", text: this.footerNote(template) });
		this.dirtyEl = footer.createSpan({ cls: "ah-editor-dirty", text: this.t.editorDirty });
		const cancel = footer.createEl("button", { text: this.t.editorCancel });
		cancel.addEventListener("click", () => this.close());
		this.saveBtn = footer.createEl("button", { cls: "mod-cta", text: this.t.editorSave });
		this.saveBtn.addEventListener("click", () => void this.save());
		this.syncDirtyUi();

		contentEl.scrollTop = scrollTop;
		if (this.pendingFocus) {
			contentEl.querySelector<HTMLElement>(this.pendingFocus)?.focus();
			this.pendingFocus = null;
		}
	}

	/** 底部说明：格式页给影响范围（testplan L41），白名单页给操作提示。 */
	private footerNote(template: Template): string {
		const t = this.t;
		if (this.pane === "whitelist") {
			return t.footerWhitelist;
		}
		const usage = this.plugin.templateUsage(template.name);
		return usage.rules === 0
			? t.footerUnused
			: t.footerImpact(usage.rules, usage.notes, usage.writeNotes);
	}

	/** 标题区：小字 + 模板名 + 铅笔（就地改名）。 */
	private renderTitle(template: Template): void {
		const t = this.t;
		const { titleEl } = this;
		titleEl.empty();
		titleEl.addClass("ah-editor-title");
		titleEl.createDiv({ cls: "ah-editor-kicker", text: t.editorKicker });
		const nameRow = titleEl.createDiv({ cls: "ah-editor-name-row" });

		if (this.renaming) {
			const input = nameRow.createEl("input", { type: "text", cls: "ah-editor-name-input" });
			input.value = template.name;
			let done = false;
			const finish = async (commit: boolean): Promise<void> => {
				if (done) {
					return;
				}
				done = true;
				this.renaming = false;
				const next = input.value.trim();
				if (commit && next !== "" && next !== template.name) {
					// 沿用原改名逻辑：同步更新模板文件与引用它的路径规则（名称冲突时失败，原名不变）。
					if (await this.plugin.renameTemplate(template.name, next)) {
						this.templateName = next;
						template.name = next;
					}
				}
				this.render();
			};
			input.addEventListener("blur", () => void finish(true));
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter" && !e.isComposing) {
					e.preventDefault();
					void finish(true);
				} else if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation(); // 只退出改名，不关弹窗
					void finish(false);
				}
			});
			window.setTimeout(() => {
				input.focus();
				input.select();
			}, 0);
			return;
		}

		nameRow.createSpan({
			cls: "ah-editor-name",
			text: this.templateDisplayName(template.name),
		});
		if (template.name !== DEFAULT_TEMPLATE_NAME) {
			const pencil = nameRow.createEl("button", { cls: "clickable-icon ah-editor-rename" });
			setIcon(pencil, "pencil");
			pencil.setAttr("aria-label", t.renameTemplateTooltip);
			pencil.addEventListener("click", () => {
				this.renaming = true;
				this.renderTitle(template);
			});
		}
	}
}
