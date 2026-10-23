import { Setting } from "obsidian";

/**
 * 设置分组（未发版，2026-10-24 用户定：每个分区一张大卡片，里面是一行行设置，参考 Easy Typing 的设置页）。
 *
 * 结构照 Obsidian 1.11 起的 `SettingGroup`（1.14.4 app.js 核过）：`.setting-group` 里先是 `setHeading()` 的标题行，再是
 * `.setting-items` 列表——设置行本身的样式（底色、分隔线、圆角）仍由 Obsidian 与主题给。本插件只在外面加一层 `ah-group`
 * 大卡片（styles.css）：原生分组在 Cupertino 这类「每行一张卡片」的主题下看不出分区，用户实测要的是「大内容、小内容」。
 * 不直接 `new SettingGroup()`：插件最低支持 1.8.7，那时还没有这个类；自建同款 DOM 在新旧版本上都成立。
 *
 * @param heading 分组标题；不给则只有卡片（如语言那一行）
 * @param desc 标题下的一行说明（原生 `setDesc`，在卡片的标题区里）
 * @returns `list` 放设置行（`new Setting(list)`）；`heading` 供调用方往标题行右侧加按钮 / 灰字；`groupEl` 放表格、卡片等自定义内容
 */
export function settingGroup(
	containerEl: HTMLElement,
	heading?: string,
	desc?: string,
): { list: HTMLElement; heading: Setting | null; groupEl: HTMLElement } {
	const groupEl = containerEl.createDiv({ cls: "setting-group ah-group" });
	const head = heading ? new Setting(groupEl).setName(heading).setHeading() : null;
	if (head && desc) {
		head.setDesc(desc);
	} else if (desc) {
		groupEl.createEl("p", { cls: "ah-section-desc", text: desc });
	}
	return { list: groupEl.createDiv({ cls: "setting-items" }), heading: head, groupEl };
}
