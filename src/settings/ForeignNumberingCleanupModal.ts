import { Modal, Setting, type App } from "obsidian";
import type { ForeignNumberingPreviewItem } from "../cleanup";
import type { Messages } from "../i18n";

/**
 * 「疑似外来编号」清理预览确认框（迁移守卫 Notice 点击入口，testplan J14，见 spec.md §2.8
 * 「残余已知限制」相邻讨论）。
 *
 * 与 `DangerTab.ts` 的 ClearVaultModal / FreezeVaultModal 同款二次确认样式（构造器注入依赖
 * + `onConfirm` 回调，`close()` 后再执行），但多一层**逐条现状→清理后对照预览**——「清理非本
 * 插件的标题编号」命令与迁移守卫共享同一误伤面（`## API 设计`、`## TODO 清单` 这类完全正常的
 * 标题也会被判成疑似外来编号），无预览的一键执行等于本插件一直在批评竞品的「吃用户内容」缺陷
 * 本身，故必须先亮出每一条会被改写的标题，用户确认后才真正执行清理。
 *
 * 预览列表由调用方（main.ts 的 `openForeignNumberingCleanupModal`）算好传入
 * （{@link ForeignNumberingPreviewItem}，来自 `previewForeignNumberingCleanup`），本类只负责渲染
 * 与两个按钮；真正的清理逻辑复用既有的 `runClearForeignNumbering`（经 `onConfirm` 回调），不重写。
 */
export class ForeignNumberingCleanupModal extends Modal {
	constructor(
		app: App,
		private readonly t: Messages,
		private readonly items: readonly ForeignNumberingPreviewItem[],
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: this.t.foreignGuardModalTitle });
		contentEl.createEl("p", { text: this.t.foreignGuardModalBody(this.items.length) });

		const list = contentEl.createEl("ul", { cls: "ah-foreign-guard-list" });
		for (const item of this.items) {
			const li = list.createEl("li", { cls: "ah-foreign-guard-item" });
			li.createEl("div", { cls: "ah-foreign-guard-before", text: item.before });
			li.createEl("div", { cls: "ah-foreign-guard-after", text: item.after });
		}

		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText(this.t.cancel).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(this.t.foreignGuardModalConfirm)
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
