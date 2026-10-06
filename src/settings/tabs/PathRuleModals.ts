/**
 * 路径规则表用到的两个确认框（1.2.2 从 `PathRules.ts` 拆出，让规则表文件保持单文件可整读）：
 * 模式切换确认框（M14，spec §3.22）与批量重编号确认框（M12，testplan K16）。
 */
import { Modal, Setting, type App } from "obsidian";
import type { Messages } from "../../i18n";
import type { ModeTransition } from "../../virtual/modeSwitch";

/**
 * 模式切换确认框（M14）：说明有多少文件离开写入 / 进入写入，各给一个开关。
 * - 「清除本插件写入的编号」：只有改为仅显示的文件时默认勾选；涉及「不编号」时默认不勾（沿用
 *   §3.10 的老语义：不编号 = 冻结现状）。
 * - 「立即写入编号」：默认不勾，等下次编辑再写。
 * 点取消或按 Esc 关闭 = 规则不变。
 */
export class ModeTransitionModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private readonly t: Messages,
		private readonly plan: ModeTransition,
		private readonly onConfirm: (opts: { clear: boolean; write: boolean }) => void,
		private readonly onCancel: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl, plan, t } = this;
		contentEl.empty();
		this.setTitle(t.modeModalTitle);
		const leaving = plan.toVirtual.length + plan.toNone.length;
		const opts = { clear: leaving > 0 && plan.toNone.length === 0, write: false };
		if (leaving > 0) {
			contentEl.createEl("p", {
				text: t.modeModalLeaving(leaving, plan.toVirtual.length, plan.toNone.length),
			});
			new Setting(contentEl)
				.setDesc(t.modeModalClearLabel)
				.addToggle((tg) => tg.setValue(opts.clear).onChange((v) => (opts.clear = v)));
		}
		if (plan.toWrite.length > 0) {
			contentEl.createEl("p", { text: t.modeModalEntering(plan.toWrite.length) });
			new Setting(contentEl)
				.setDesc(t.modeModalWriteLabel)
				.addToggle((tg) => tg.setValue(opts.write).onChange((v) => (opts.write = v)));
		}
		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText(t.batchModalCancel).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(t.modeModalConfirm)
					.setCta()
					.onClick(() => {
						this.confirmed = true;
						this.close();
						this.onConfirm(opts);
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.confirmed) {
			this.onCancel();
		}
	}
}

/**
 * 批量重编号确认对话框（M12，testplan K16）：展示规则路径与命中文件数，确认后才执行
 * （`batchRenumberRule` 见 main.ts——跳过 frontmatter `false`/外来编号守卫/「不编号」，
 * 已打开文件可撤销、未打开文件直接改写）。
 */
export class BatchRenumberModal extends Modal {
	constructor(
		app: App,
		private readonly t: Messages,
		private readonly pattern: string,
		private readonly count: number,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle(this.t.batchModalTitle);
		contentEl.createEl("p", { text: this.t.batchModalBody(this.pattern, this.count) });
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText(this.t.batchModalCancel).onClick(() => this.close()),
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.t.batchModalConfirm)
					.setCta()
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
