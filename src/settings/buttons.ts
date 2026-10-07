import { requireApiVersion, type ButtonComponent } from "obsidian";

/**
 * 把按钮标成「破坏性操作」样式（删除、清库等难以撤销的确认按钮）。
 *
 * Obsidian 1.13.0 起改用 `setDestructive`（旧的 `setWarning` 已废弃）；本插件 `minAppVersion` 更低，
 * 旧版本直接加 `setWarning` 原本加的 `mod-warning` 类，外观一致。
 */
export function markDestructive(btn: ButtonComponent): ButtonComponent {
	if (requireApiVersion("1.13.0")) {
		return btn.setDestructive();
	}
	btn.buttonEl.addClass("mod-warning");
	return btn;
}
