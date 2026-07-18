/**
 * UVM 框架的生成器约束配置：默认（常绿）/ explore（找 bug）两套 {@link GenConfig}，
 * 以及各类激励的种类枚举 {@link OpKind}。
 */

import type { NumeralStyle } from "../../../src/numbering";
import { NUMERALS, NUMERALS_WITH_ALPHA } from "./stimulus";

/**
 * **生成器约束配置**：把「在哪些维度上随机」抽成可切换的配置。
 * - {@link DEFAULT_GEN}：当前「常绿」空间（约束 = strip 健壮性的精确刻画），新增「就地安全编辑」。
 * - {@link EXPLORE_GEN}：**放开已知约束**（字母样式 / inherit×非空前后缀 / 脏编辑）的**找 bug** 空间，
 *   改用**幂等性记分板**（恒成立、容脏输入），不在默认 CI 跑（见 random_sequence.test.ts 的 explore 门）。
 */
export interface GenConfig {
	/** 随机序号样式池（默认 arabic/cjk/circled；explore 加 lower/upper-alpha）。 */
	numerals: NumeralStyle[];
	/** 是否允许在「当前前后缀非空」时翻转 `inherit`（默认否=约束；explore 放开，验证 testplan B8）。 */
	allowInheritWithAffix: boolean;
	/** 是否启用「就地编辑已带前缀的标题」激励（保留旧前缀、改标题文本，模拟真实打字）。 */
	inPlaceEdit: boolean;
	/** 是否启用「手动破坏前缀区」激励（删字符 / 改数字 / 去空格，模拟手抖删错；仅 explore）。 */
	manualPrefixEdit: boolean;
	/** 是否把「脏碎片 / 分隔符起头标题」纳入取样（仅 explore）。 */
	messyTitles: boolean;
	/**
	 * 记分板：
	 * - `reference`：裸文档参考模型（强，能逮残留/叠加，但要求激励落在「干净」空间）。
	 * - `idempotent`：幂等性（`renumber∘renumber === renumber`，**恒成立**、容脏输入与放开的约束）。
	 */
	oracle: "reference" | "idempotent";
}

/**
 * 默认（常绿）生成配置：参考模型记分板。本轮在原约束上**放开两处、新增一处**（均经 20000×80 验证绿）：
 * - 放开 `inherit × 非空前后缀`（testplan B8 实测无叠加、幂等，原约束过保守）；
 * - 新增「就地安全编辑」（保留旧前缀改标题文本，模拟真实打字主线）。
 *
 * 仍约束：字母样式（L1 取舍）、脏标题 / 手动破坏前缀（参考模型对其会因 E5/L1 取舍误报，改由
 * explore 模式 + 幂等性记分板覆盖，见 {@link EXPLORE_GEN}）。
 */
export const DEFAULT_GEN: GenConfig = {
	numerals: NUMERALS,
	allowInheritWithAffix: true,
	inPlaceEdit: true,
	manualPrefixEdit: false,
	messyTitles: false,
	oracle: "reference",
};

/** explore（找 bug）生成配置：放开字母 / inherit×非空前后缀 / 脏编辑，改用幂等性记分板。 */
export const EXPLORE_GEN: GenConfig = {
	numerals: NUMERALS_WITH_ALPHA,
	allowInheritWithAffix: true,
	inPlaceEdit: true,
	manualPrefixEdit: true,
	messyTitles: true,
	oracle: "idempotent",
};

/** 各类激励（仅用于覆盖率与失败时的轨迹打印）。 */
export type OpKind =
	| "insertHeading"
	| "insertRaw"
	| "insertFence"
	| "deleteLine"
	| "retitle"
	| "editTitleInPlace"
	| "mutatePrefix"
	| "demoteHeading"
	| "changeLevel"
	| "setNumeral"
	| "setNumberSep"
	| "setTitleSep"
	| "setInherit"
	| "setPrefix"
	| "setSuffix"
	| "setTopLevel"
	| "setBottomLevel"
	| "setStartIndex"
	| "setSkipFill"
	| "setAncestor"
	| "setWhitelist"
	| "setFrontmatterSwitch"
	| "setAutoNumber"
	| "clearNumbering"
	| "clearForeign"
	| "createTemplate"
	| "deleteTemplate"
	| "renameTemplate"
	| "addRule"
	| "deleteRule"
	| "editRulePattern"
	| "setRuleTemplate"
	| "reorderRule"
	| "switchFile"
	| "manualTrigger"
	| "trigger";
