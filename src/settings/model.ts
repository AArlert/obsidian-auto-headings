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
	 * **已交还所有权 / 插件离场**（M12「固化编号并交还所有权」，见 spec.md §3.18）。
	 *
	 * `true` 时插件**停止一切自动编号**。这是一道**硬闸**，位置在 `shouldAutoTrigger` 首行、
	 * **凌驾于 frontmatter `obsidian-auto-headings: true`** ——只关 `autoNumber` 是不够的：
	 * 带 `fm:true` 的文件本就绕开全局开关，固化之后一编辑就会在已成普通文本的编号上再叠一层
	 * 新前缀，变成双重编号。
	 *
	 * 刻意**不动 `autoNumber`**：那是用户的偏好，恢复接管时不该要他重设一遍。
	 * 手动命令（「立即重新编号」等）不受本闸约束——用户显式敲命令即明确意图。
	 */
	retired: boolean;
	/**
	 * 标题链接建议（M13，见 spec.md Roadmap M13）：在任意笔记正文里打出与 vault 内某标题原文
	 * 匹配的文字时，弹出建议，接受后替换为指向该标题的可点击链接（视觉上保留用户打的原文）。
	 * **默认开**——与「全局自动编号」`autoNumber`、Backlink 同步 `updateBacklinks` 一样，是面向
	 * 全体用户的默认能力，不是 opt-in。关闭后标题索引完全不构建（见 headingindex.ts），
	 * 内存/CPU 成本降为零。
	 */
	headingLinkSuggestEnabled: boolean;
	/**
	 * Various Complements 联动模式（M13，见 spec.md Roadmap M13 与 vcintegration.ts）：
	 * - "off"：不联动（**默认**——不能因为 headingLinkSuggestEnabled 默认开就跟着默认开，
	 *   需用户在设置面板显式选择）。
	 * - "manual"：只生成/维护 JSON 词典文件，把路径显示给用户，引导其自行粘贴进 VC 设置；
	 *   不碰 Various Complements 的任何配置文件。
	 * - "auto"：额外尝试把词典路径自动写入 Various Complements 的设置（探测运行时实例优先，
	 *   文件级读改写兜底，schema 校验失败整体放弃）。
	 * 任何离开 "off" 的切换都必须先过独立确认框（见 VcIntegrationSection.ts）。
	 */
	vcIntegrationMode: "off" | "manual" | "auto";
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
	retired: false,
	headingLinkSuggestEnabled: true,
	vcIntegrationMode: "off",
};

/** 将防抖延迟夹到合法范围 [50, 2000]，非数字回退到默认值。 */
export function clampDebounceDelay(value: number): number {
	if (!Number.isFinite(value)) {
		return DEBOUNCE_DEFAULT;
	}
	return Math.min(DEBOUNCE_MAX, Math.max(DEBOUNCE_MIN, Math.round(value)));
}
