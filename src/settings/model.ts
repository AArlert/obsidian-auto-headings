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
import type { TemplateSnapshot } from "../templates/styles";

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
	 * 更新指向该标题的 wikilink / Markdown 链接锚点（`[[file#标题]]` / `[说明](file.md#标题)`）——
	 * **全局生效，与是否命中编号模板 / 是否实际写入
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
	 * 打字时建议标题链接（M13，spec §3.23）：在任意笔记正文里打出与 vault 内某标题原文匹配的文字时弹出建议，
	 * 接受后替换为指向该标题的链接。关闭后标题索引完全不构建（见 headingindex.ts），内存 / CPU 成本降为零。
	 * **全新安装默认关**（issue #10，2026-10-24 用户定：不用补全插件的人没有「打字出建议」的习惯，默认不打扰，
	 * 保持 Obsidian 的默认行为，想用的人在设置里打开）；老用户升级保持原值，没有该键的当年默认开 → 开（见 main.loadSettings）。
	 */
	headingLinkSuggestEnabled: boolean;
	/**
	 * 标题右键菜单（spec §3.24）：右键标题折叠箭头（编辑 / 阅读视图）与编辑器右键里的标题项。默认开；
	 * 关掉后不再拦截右键，Obsidian 原生行为照旧。设置里放这个开关也是在告诉用户有这个入口。
	 */
	headingMenuEnabled: boolean;
	/** 状态栏「本篇」小标签（spec §3.24）。默认开；关掉后状态栏不再占位，命令照常可用。 */
	statusBarMenuEnabled: boolean;
	/**
	 * 一次性迁移标记（issue #10）：升级时把「打字时建议标题链接」统一改关（开着 VC 联动的除外）只做一次，做过记 true，
	 * 之后用户自己打开不会再被改回去。全新安装直接为 true（新装本就默认关）。见 main.loadSettings。
	 */
	headingSuggestOffMigrated: boolean;
	/**
	 * Various Complements 联动模式（M13，见 spec.md Roadmap M13 与 vcintegration.ts）：
	 * - "off"：不联动（**默认**——不能因为标题链接建议默认开就跟着默认开，
	 *   需用户在设置面板显式选择）。
	 * - "manual"：只生成/维护 JSON 词典文件，把路径显示给用户，引导其自行粘贴进 VC 设置；
	 *   不碰 Various Complements 的任何配置文件。
	 * - "auto"：额外尝试把词典路径自动写入 Various Complements 的设置（探测运行时实例优先，
	 *   文件级读改写兜底，schema 校验失败整体放弃）。
	 * 任何离开 "off" 的切换都必须先过独立确认框（见 VcIntegrationSection.ts）。
	 */
	vcIntegrationMode: "off" | "manual" | "auto";
	/**
	 * 各模板的样式历史（M16，spec §3.24）：模板名 → 最近若干份保存快照（最新在前）。存在 data.json
	 * 里、不另写文件；模板改名 / 删除时随之搬迁 / 清除。缺省视为空表。
	 */
	templateHistory: Record<string, TemplateSnapshot[]>;
}

/** 防抖延迟的边界与默认值（见 spec.md §3.9）。 */
export const DEBOUNCE_MIN = 50;
export const DEBOUNCE_MAX = 2000;
export const DEBOUNCE_DEFAULT = 300;

/** 默认路径规则：一条 `/` 根规则指向「默认」模板，开箱即对全库生效（见 spec.md §3.8）。 */
export function defaultPathRules(): PathRule[] {
	return [{ pattern: "/", template: "默认" }];
}

/**
 * 全新安装时的路径规则（M14，见 spec.md §3.22「新装与升级」）：与 {@link defaultPathRules} 相同，
 * 只是根规则设为「仅显示」。老用户升级不走这里，缺省 mode 仍按写入处理。
 */
export function freshInstallPathRules(): PathRule[] {
	return [{ pattern: "/", template: "默认", mode: "virtual" }];
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
	headingLinkSuggestEnabled: false,
	headingMenuEnabled: true,
	statusBarMenuEnabled: true,
	headingSuggestOffMigrated: true,
	vcIntegrationMode: "off",
	templateHistory: {},
};

/** 将防抖延迟夹到合法范围 [50, 2000]，非数字回退到默认值。 */
export function clampDebounceDelay(value: number): number {
	if (!Number.isFinite(value)) {
		return DEBOUNCE_DEFAULT;
	}
	return Math.min(DEBOUNCE_MAX, Math.max(DEBOUNCE_MIN, Math.round(value)));
}

/**
 * 全库操作确认框的确认词是否输对（1.2.2，testplan L44）：忽略首尾空白与大小写，
 * 防误触而非防恶意——只要求用户有意识地敲一遍。
 */
export function confirmWordMatches(input: string, word: string): boolean {
	return input.trim().toLowerCase() === word.trim().toLowerCase();
}
