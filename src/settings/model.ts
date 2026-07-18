/**
 * 插件设置的数据模型。
 *
 * Milestone 2 引入面板开关与防抖延迟字段。Milestone 5 把「是否运行」拆成**两层**
 * （见 spec.md §3.1）：
 * - **启用插件**：Obsidian 社区插件总开关（不由本设置表达，启用 ≠ 自动编号）。
 * - **「全局自动编号」`autoNumber`**：决定插件是否在编辑后**自动触发**编号，持久化于 data.json，
 *   与全局命令「切换全局自动编号」双向同步。
 *
 * Milestone 5 另引入**路径规则** `pathRules`（路径 → 模板的映射，见 {@link PathRule} 与 spec.md §3.8）。
 * 防抖延迟的滑块 UI 留待 Milestone 6。
 */

import { DEFAULT_LANG_SETTING, type LangSetting } from "../i18n";
import type { PathRule } from "../pathrules";

export interface AutoHeadingsSettings {
	/**
	 * 「全局自动编号」面板开关：是否在编辑后自动触发编号。持久化于 data.json，与全局命令双向同步。
	 * （历史字段名为 `enabled`，0.5.0 起改名为 `autoNumber`；加载时自动迁移，见 main.loadSettings。）
	 */
	autoNumber: boolean;
	/** 实时编辑的防抖延迟（毫秒）。可配置范围 50–2000，默认 300（滑块 UI 见 Milestone 6）。 */
	debounceDelay: number;
	/**
	 * 路径规则列表（路径模式 → 模板名）。首次启用预置一条 `/`→「默认」规则即对全库生效；
	 * 用户可增删改、可整行删除根规则（见 spec.md §3.8）。解析逻辑见 {@link resolvePathRule}。
	 */
	pathRules: PathRule[];
	/**
	 * 界面语言（Milestone 6）：`auto` 跟随 Obsidian 界面语言，`zh`/`en` 显式锁定。
	 * 默认 `auto`。解析见 {@link resolveLang}，文案见 {@link getMessages}。
	 */
	language: LangSetting;
	/**
	 * Backlink 同步（Milestone 7，见 spec.md §3.12）：标题文本一旦被改写（无论是否由编号引起），自动
	 * 更新指向该标题的内部链接锚点 `[[file#标题]]`——**全局生效，与是否命中编号模板 / 是否实际写入
	 * 编号无关**（1.0.9 起由原「总开关 + 独立触发」两个开关合一，见 main.ts
	 * `shouldBacklinkStandaloneTrigger`）。**默认开**（0.7.11 上架前重估：它是 1.0 的头牌卖点，且有
	 * 重复标题保守不改等护栏；首次实际同步时弹一次说明 Notice 告知，见 `backlinksIntroShown`）。仍受
	 * 文件级 frontmatter `false` 约束（用户对该文件的明确「别碰」表态优先级最高）。
	 */
	updateBacklinks: boolean;
	/**
	 * Backlink 同步的**首次说明 Notice** 是否已经弹过（0.7.11）：默认开后，第一次真正改写了别的文件时
	 * 弹一条较长的说明（改了什么、在哪里关），只弹一次。持久化以免每次启动重复打扰。
	 */
	backlinksIntroShown: boolean;
	/**
	 * 复制净化（M11「复制净化开关」，1.0.10，见 spec.md §2.8）：copy/cut 时把插件写入的 WJ 哨兵
	 * 从剪贴板出口剥净（外部应用不再收到隐形字符），同会话内粘贴回本库时自动还原原文避免双重
	 * 编号。**默认开**（M11 信任包：把 WJ 风险从「披露」升级到「主动消解」；WJ 守卫保证不含
	 * 编号的复制粘贴零介入）。单开关同时门控 copy/cut 净化与 paste 还原两端。
	 */
	sanitizeClipboard: boolean;
}

/** 防抖延迟的边界与默认值（见 spec.md §3.9）。 */
export const DEBOUNCE_MIN = 50;
export const DEBOUNCE_MAX = 2000;
export const DEBOUNCE_DEFAULT = 300;

/** 默认路径规则：一条 `/` 根规则指向「默认」模板，开箱即对全库生效（见 spec.md §3.8）。 */
export function defaultPathRules(): PathRule[] {
	return [{ pattern: "/", template: "默认" }];
}

/** 默认设置：全局自动编号开启、防抖延迟 300 ms、预置 `/`→「默认」根规则、语言自动、
 * Backlink 同步开（全局生效，与编号与否无关）、复制净化开（M11 信任包）。 */
export const DEFAULT_SETTINGS: AutoHeadingsSettings = {
	autoNumber: true,
	debounceDelay: DEBOUNCE_DEFAULT,
	pathRules: defaultPathRules(),
	language: DEFAULT_LANG_SETTING,
	updateBacklinks: true,
	backlinksIntroShown: false,
	sanitizeClipboard: true,
};

/** 将防抖延迟夹到合法范围 [50, 2000]，非数字回退到默认值。 */
export function clampDebounceDelay(value: number): number {
	if (!Number.isFinite(value)) {
		return DEBOUNCE_DEFAULT;
	}
	return Math.min(DEBOUNCE_MAX, Math.max(DEBOUNCE_MIN, Math.round(value)));
}
