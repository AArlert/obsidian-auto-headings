/**
 * UVM 风格的「约束随机序列」测试框架（针对编号引擎 `renumberContent`）。
 *
 * ## 为什么要它
 *
 * 单测「一次编号」往往全绿，真正的 bug 几乎都藏在**操作序列**里——「已经有编号了、用户又改了某个
 * 配置 / 又编辑了文本，下一次触发才炸」（见 doc/testplan.md 的状态转移类）。手写穷举这些组合不现实，
 * 故借鉴硬件验证的 **UVM（Universal Verification Methodology）**：用**约束随机**的激励序列大面积撞，
 * 配一个**参考模型记分板**自动判对错，再用**功能覆盖率**确认真的撞到了关心的场景。
 *
 * ## UVM 组件映射（本文件各部分）
 *
 * | UVM 概念 | 这里的对应 |
 * |----------|------------|
 * | Sequence item / 激励 | {@link Op}（编辑文本 / 改模板 / 触发） |
 * | Sequencer（约束随机产生激励） | {@link World.step}（依当前状态、在约束内随机选一个 Op） |
 * | Driver（把激励打到 DUT） | {@link World.apply}（把 Op 施加到「裸文档真值」与「编辑器文本」） |
 * | DUT（被测对象） | `renumberContent`（剥旧前缀 + 重新编号） |
 * | Reference model + Scoreboard（判对错） | {@link World.check}：DUT 输出必须等于「从裸文档真值直接编号」 |
 * | Functional coverage（覆盖率闭合） | {@link Coverage} |
 *
 * ## 记分板核心不变量（oracle）
 *
 * 维护两份状态：`bare`（**规范裸文档**，无任何编号，是「用户真实意图」的真值）与 `rendered`
 * （**当前编辑器各行文本**，含上一次触发写入的前缀，与 `bare` 行一一锁步）。每次「触发」后断言：
 *
 * ```
 *   join(rendered)  ===  renumberContent(serialize(bare), 当前模板)
 *   └─ DUT：对带历史前缀的文本剥离+重编        └─ 参考：对裸文本直接编号（strip 对裸文本是 no-op）
 * ```
 *
 * 两者相等 ⟺ `stripPrefix` 把历史前缀剥得干干净净。**任何前缀叠加 / 残留都会让两侧不等而被当场抓出**
 * （B1–B5、C3 都能被这一条逮到），且参考侧复用**可信的 build 路径**、不重复实现编号逻辑。
 *
 * ## 两种模式与两块记分板（0.6.2 升级）
 *
 * 由 {@link GenConfig} 切换：
 * - **默认模式**（{@link DEFAULT_GEN}，参考模型记分板 {@link World.check}）：在「已修好、参考不变量恒成立」
 *   的受约束空间里随机，确保 CI 常绿、专逮残留 / 叠加。本轮在此**放开 inherit×非空前后缀**（B8 实测无 bug）、
 *   **新增就地安全编辑** {@link OpKind editTitleInPlace}（模拟在已编号标题里继续打字）。
 * - **explore 模式**（{@link EXPLORE_GEN}，幂等性记分板 {@link World.checkIdempotent}）：**放开全部约束**
 *   （字母样式 / inherit×非空前后缀 / 脏标题 / 手动破坏前缀），用恒成立的幂等性（`renumber∘renumber===renumber`）
 *   找 bug。本轮在 20000×80 里撞出 testplan §3.2 的 **U1**（低于 topLevel 标题逐次侵蚀）、**U2**（标点
 *   titleSeparator 吞标题首段数字）、**U3**（字母样式吞英文起头标题）。
 *
 * ## 约束（= 默认模式下 strip 健壮性的精确刻画）
 *
 * - `prefix` / `suffix`：**已放开**——「空 ↔ 候选」随机切换（B2/B3 已修，方案 A）。数字起头标题**不再回避**
 *   （L2 已修）。
 * - `inherit`：**0.6.2 已放开**——可在非空前后缀下翻转（B8 实测无叠加、幂等，原约束过保守）。
 * - `topLevel`：**已放开**（0.6.0 C3 修复）。
 * - 默认模式随机样式仍只用 arabic/cjk/circled（字母样式 L1/U3 取舍，仅 explore 放开）；默认模式不喂脏标题、
 *   不破坏前缀区（E5/U1/U2 取舍/未修 bug，仅 explore 放开）。
 * - 其余（numeral、两个间隔符、skipFill、ancestorNumeral、文本编辑、就地编辑、层级、代码块、白名单）：自由变。
 *
 * > 默认约束**就是 bug 边界**：放开一条 = 扩大覆盖，放开后变红即没修彻底。explore 模式则故意越过这些边界
 * > 找新 bug（U1/U2/U3 即此而来）。详见 uvm/README.md「放开约束」。
 *
 * ## 0.6.5 升级：扩大验证空间与自由度
 *
 * 把「插件全部可设置 + 用户可操作」更完整地纳入激励空间：
 * - **真实白名单驱动**：删去旧版注入的 `isWhitelisted` 回调，改由 `template.whitelist`（随机 0–2 条，
 *   匹配方式含 **exact/partial/subtree**）驱动引擎的 {@link computeWhitelistExemptions}——旧版**完全没
 *   覆盖子树 / 部分匹配与「子标题随根豁免」**。新增 `setWhitelist` 配置激励（增 / 删 / 改条目，覆盖
 *   「改白名单后再触发」的状态转移）。DUT 与参考两侧均走真实 whitelist，故能逮「带历史前缀 vs 裸文档」
 *   的豁免分叉（8000×80 默认模式全绿 → 确认 exact/partial/subtree 引擎实现一致、无前缀敏感分叉）。
 * - **结束编号层级 bottomLevel**：新增 `setBottomLevel` 激励（在 [topLevel,6] 随机），覆盖「只编号区间」
 *   与「收窄区间后剥残留」。
 * - **起始编号数字 startIndex**（0.7.13，M8 批次 1）：新增 `setStartIndex` 激励（0/1/2/5 随机，偏 0/1），
 *   覆盖「0 起编号首段偏移」与「改值后再触发旧前缀剥净」；配 startIndex=0 / non-default 两个覆盖 bin。
 * - **覆盖率新 bin**：whitelist-exact/partial/subtree、subtree-带子标题、bottomLevel-narrowed（默认 500×60 闭合）。
 * - explore 模式（新维度叠加脏编辑）撞出 **U4**（标题正文以**空白起头**时连续触发非幂等：首次保留前导空格、
 *   再次被 parser `[ \t]+` 收拢，见 testplan §3.2）——登记未修。
 *
 * ## 0.7.1 升级：纳入 Backlink 往返不变量（M7）
 *
 * 编号改写标题文本 → 指向旧标题的内部链接需同步（见 spec.md §3.12）。新增第三块记分板
 * {@link World.checkBacklinkRoundTrip}：对每次触发的「编号前→后」文本，断言 `src/backlinks.ts` 的
 * **改名表幂等** + **链接重写往返一致**（指向旧标题的 `[[Target#旧]]` 重写后恰指向同一标题的新名）。
 * 两种 oracle 都跑（纯属文本性质），在整个随机编号空间里压测 backlink 核心；新增覆盖率 bin `backlink-rename`。
 *
 * ## 0.7.5 升级：纳入「清除命令」与「两层触发门控」（扩展蓝图阶段 1，见 testplan §4.1）
 *
 * 把更多**真实用户操作**纳入激励空间，原框架只压 `renumberContent`，现补两类：
 * - **缺口①清除命令**：新增激励 {@link OpKind clearNumbering}（`clearNumberingContent`）/
 *   {@link OpKind clearForeign}（`clearForeignNumberingContent`），并配两条记分板——
 *   **S4 清除还原律**（清除编号 → 还原裸文档）+ **S5 清外来不动律**（清外来 → 不动自家 WJ 编号）。
 *   只在「裸文档为 clear 定点」时施加（排除自食/外来样标题），且**仅参考模式**（explore 的 mutatePrefix
 *   故意抹 WJ，此后清外来剥掉残缺前缀属预期，见 testplan §3.2 S5b）。
 * - **缺口②两层触发门控**：新增 {@link OpKind setFrontmatterSwitch}（true/false/非法/删除）/
 *   {@link OpKind setAutoNumber}，触发分**手动**（{@link OpKind manualTrigger}，绕过门控）/**自动**
 *   （`trigger`，过真实 {@link readFileSwitch} + 全局开关的 `shouldAutoTrigger`）。**S6 门控**：门控关时
 *   `rendered` 冻结、且真实开关解析与结构化 fm 状态一致（{@link World.checkGate}）。
 *
 * 8000×80 两记分板全绿、**未发现引擎 bug**。
 *
 * ## 0.7.6 升级：World→Vault 多文件 + 多模板 + 路径规则 + S7（扩展蓝图阶段 2，缺口③）
 *
 * 把「单文件单模板」升级为**仓库模型**，覆盖远更多真实用户操作：
 * - **多文件**：{@link World.files} 持若干文件（各自 bare/rendered/frontmatter），`switchFile` 切换当前
 *   编辑 / 触发对象；每文件按真实 {@link resolvePathRule} + 查找解析**各自的生效模板**。
 * - **多模板**：{@link World.templates} 命名模板集（共享前后缀候选池，保固定剥离并集为真实
 *   `strippableAffixes()` 上界）；config 类激励改**随机一个模板**的字段。生命周期：createTemplate /
 *   deleteTemplate（锚点「默认」不可删；引用其的规则降级/改投/连删）/ renameTemplate（改名 + 同步规则）。
 * - **路径规则**：{@link World.pathRules}（addRule/deleteRule/editRulePattern/setRuleTemplate/reorderRule），
 *   删根规则 → 该文件无模板（自动静默 / 手动无操作，I7/K6）。
 * - **S7 模板解析记分板**（{@link World.checkResolution}）：无悬挂引用（生命周期同步正确）+ 锚点恒在 +
 *   真实解析与独立参考 {@link World.expectedResolve} 一致。跨模板残留（B2/B3）由参考模型每文件压测。
 *
 * 8000×80 + 20000×80 三记分板全绿、**未发现引擎 bug**。剥离并集取共享候选池上界（动态活模板并集 +
 * 删模板孤儿残留留 backlog，见 testplan §4.1.1 注）。Backlink 开关门控（缺口④）属集成层，留 main.test。
 */

import {
	computeWhitelistExemptions,
	DEFAULT_TEMPLATE,
	renumberContent,
	type AncestorNumeral,
	type NumeralStyle,
	type SkipFill,
	type Template,
	type WhitelistEntry,
} from "../../../src/numbering";
import { parseHeadings, type Heading } from "../../../src/parser";
import {
	computeHeadingRenames,
	linkAnchor,
	rewriteBacklinksInContent,
} from "../../../src/backlinks";
import { clearForeignNumberingContent, clearNumberingContent } from "../../../src/cleanup";
import { readFileSwitch } from "../../../src/frontmatter";
import { resolvePathRule, type PathRule } from "../../../src/pathrules";
import { Rng } from "./rng";

/**
 * 独立重实现的「规则是否匹配 / 具体度」（S7 参考模型，与 `src/pathrules.ts` 解耦）：用于核对真实
 * {@link resolvePathRule} 的解析结果。生成器只产出已归一化的干净模式（无反斜杠 / `./` / 重复斜杠），
 * 故此处无需归一化——归一化边界由 `pathrules.test.ts` 静态覆盖，本参考模型聚焦「具体度 + 并列取后者」。
 */
function indepMatch(pattern: string, path: string): boolean {
	if (pattern === "/") return true;
	if (pattern.endsWith("/")) return path.startsWith(pattern);
	return path === pattern;
}
function indepSpec(pattern: string): number {
	if (pattern === "/") return 0;
	if (pattern.endsWith("/")) return pattern.length;
	return 1_000_000 + pattern.length;
}

/** 文档的一行：标题（级别 + 裸标题文本）或原样行（正文 / 代码块栅栏 / 块内行）。 */
type Line = { kind: "heading"; level: number; title: string } | { kind: "raw"; text: string };

/** 把一行序列化为 Markdown 文本（空标题 → `### `，带尾随空格，复现空行转标题场景）。 */
function serializeLine(line: Line): string {
	return line.kind === "heading" ? `${"#".repeat(line.level)} ${line.title}` : line.text;
}

function serialize(lines: Line[]): string {
	return lines.map(serializeLine).join("\n");
}

/** 标题文本池：覆盖普通、含 latin、"自食前缀"（2024 总结 / 实现 1.2）、白名单词、空标题。 */
const TITLES = [
	"概述",
	"细节",
	"背景与动机",
	"2024 总结",
	"API 设计",
	"100% 覆盖",
	"三",
	"目录",
	"附录",
	"参考文献",
	"",
	"实现 1.2",
	"小结",
];
/**
 * 白名单**候选词池**（0.6.5 升级：UVM 改用**真实** `template.whitelist` 驱动引擎的
 * {@link computeWhitelistExemptions}，覆盖 exact/partial/**subtree** 三种匹配，而非旧版注入
 * 的 `isWhitelisted` 回调——后者只测「单点命中」、**完全没覆盖子树 / 部分匹配**）。
 *
 * 这些词都出现在 {@link TITLES} 里（如「附录」「目录」「参考文献」「小结」「概述」），故随机把它们
 * 设进白名单后会真实命中标题，驱动子树 / 部分匹配的豁免与计数器跳过逻辑。
 */
const WHITELIST_WORDS = ["目录", "附录", "参考文献", "小结", "概述"];
/** 白名单匹配方式池（含 subtree，专为覆盖子树豁免与「子标题错挂」边界）。 */
const MATCH_MODES: WhitelistEntry["match"][] = ["exact", "partial", "subtree"];
/**
 * "自食前缀"型标题：本身以**数字**开头（如 `2024 总结`），会被 arabic 剥离器按预期吃掉
 * （spec §2.3 既定取舍）。
 *
 * **不再按前缀是否为空回避**（旧版有 `TOKEN_STARTING` 过滤，对应 testplan L2 约束）：方案 A 让剥离
 * 时**恒把「空前缀」纳入候选**，故无论模板前缀是否非空，裸标题「2024 总结」都会被对称地吃掉
 * （`第1 总结` / `1 总结`），参考模型恒一致。配合「只剥一层」，`1 2024 总结`（用户在序号后补回数字）
 * 又能稳定保留——这正是 L2 被修复、约束得以放开的体现（E5 静态测试覆盖 `1 2024` 保留）。
 */
const SELF_EATING = new Set(["2024 总结", "100% 覆盖"]);

/**
 * 随机变换用的序号样式池：**仅 always-strippable 三种**（arabic / cjk / circled）。
 *
 * 刻意**排除字母样式**（lower/upper-alpha）：它们不在 numbering.ts 的 `ALWAYS_STRIPPABLE_STYLES`
 * 里（为避免把「API」这类英文起头标题误当字母序号吃掉）。后果是——当某级**从字母样式改走**、
 * 且此后无任何级别再用字母时，残留的旧字母前缀（如 `A）`）剥不掉、会叠加。这是**有意的取舍**（不是
 * 状态转移 bug），字母样式的渲染与同样式往返已由静态测试（"非 arabic 序号样式" 块）覆盖，故随机
 * 序列里不混入字母样式的相互切换，以保持参考模型一致、CI 常绿。
 */
const NUMERALS: NumeralStyle[] = ["arabic", "cjk", "circled"];
const NUMBER_SEPS = [".", "-", "·", ")", "．"];
const TITLE_SEPS = [" ", "、", ". ", "。", "： "];
/** 非空前缀 / 后缀候选（每条序列各定一个，序列内在「空 ↔ 该候选」间随机切换，验证 B2/B3）。 */
const PREFIX_CANDIDATES = ["第", "（"];
const SUFFIX_CANDIDATES = ["章", "）"];
/** 标题级别取样（偏向 H2–H4，但也覆盖 H1/H5/H6）。 */
const LEVEL_POOL = [1, 2, 2, 3, 3, 3, 4, 4, 5, 6];

/**
 * **字母 / 罗马数字样式**（lower/upper-alpha, lower/upper-roman）：仅 explore 模式纳入随机样式池。
 * 默认仍按 L1 取舍排除（见框架顶部注释）；explore 放开以撞「改走字母/罗马后残留」「自食标题」等。
 */
const NUMERALS_WITH_ALPHA: NumeralStyle[] = [
	...NUMERALS,
	"lower-alpha",
	"upper-alpha",
	"lower-roman",
	"upper-roman",
];

/**
 * 「就地编辑」追加用的**安全碎片**：纯中文、不以数字 / 分隔符 / 字母 / 空白起头。
 * 默认模式下用它给已带前缀的标题追加文本，保证「裸↔渲染」对应干净、参考模型不变量恒成立。
 */
const SAFE_FRAGMENTS = ["补充", "说明", "细节", "续", "草稿"];

/**
 * explore 模式的**脏碎片**：以分隔符 / 数字 / 字母 / 空白起头，专门撞**容差剥离的误伤边界**
 * （标题首字符恰落入「标题间隔符容差类」或「序号 token」时是否被吃掉）。
 */
const MESSY_FRAGMENTS = ["-注", ".5", "、附", "2024 ", "a) ", "  ", ") ", "."];

/** explore 模式额外的**分隔符 / 符号起头标题**（裸态即以容差类字符起头）。 */
const MESSY_TITLES = ["- 列表式标题", ". 点起头", "、顿号起头", ") 右括起头", "1.2 像子号"];

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

/** frontmatter 单文件开关的结构化状态（驱动两层触发门控，见 {@link World.checkGate}）。 */
type FrontmatterState = "none" | "true" | "false" | "illegal";

/** 功能覆盖率收集器（UVM functional coverage）：确认随机真的撞到了关心的场景。 */
export class Coverage {
	readonly ops = new Map<OpKind, number>();
	readonly numerals = new Set<NumeralStyle>();
	inheritFalse = false;
	skipDrop = false;
	skipFill = false;
	/** skipFill=none（跳级标题完全不编号，0.7.15）曾被设入模板。 */
	skipNone = false;
	ancestorArabic = false;
	ancestorSelf = false;
	topLevelLowered = false;
	/** topLevel 被**升高**（C3 修复后放开，见框架顶部注释）。 */
	topLevelRaised = false;
	/** 前缀 / 后缀曾被切换（验证 B2/B3 的状态转移）。 */
	affixToggled = false;
	/** 曾在「前缀或后缀非空」的状态下触发编号。 */
	affixNonEmptyTrigger = false;
	fencePresent = false;
	whitelistHit = false;
	/** 白名单三种匹配方式各自曾被设入模板（真实 whitelist 驱动，0.6.5）。 */
	whitelistExact = false;
	whitelistPartial = false;
	whitelistSubtree = false;
	/** 曾出现「子树根命中且其下确有更深子标题被一并豁免」的情形。 */
	whitelistSubtreeWithChildren = false;
	/** 结束编号层级 bottomLevel 曾被收窄到 < 6（编号区间下界，0.6.5）。 */
	bottomLevelNarrowed = false;
	/** 起始编号数字 startIndex 曾被设为 0（0 起编号 `0.1.1`，M8 批次 1）。 */
	startIndexZero = false;
	/** 起始编号数字曾被设为非默认值（≠1，覆盖首段偏移 + 改值后再触发剥净）。 */
	startIndexNonDefault = false;
	emptyTitle = false;
	levelGE5 = false;
	levelJump = false;
	selfEatingTitle = false;
	/** 曾就地编辑过「已带前缀」的标题（保留旧前缀改文本）。 */
	inPlaceEdited = false;
	/** 曾手动破坏过前缀区（explore）。 */
	prefixMutated = false;
	/** 曾把已编号标题降级为正文（删光 `#`），触发 ③ 残留清理路径（0.7.20）。 */
	demoted = false;
	/** 曾在「前后缀非空」状态下翻转 inherit（explore，验证 B8）。 */
	inheritWithAffix = false;
	/** 曾发生过标题锚点改名（编号改写标题 → Backlink 改名表非空，M7）。 */
	backlinkRename = false;
	/** 两层门控（缺口②）：曾因 frontmatter / 全局开关把自动触发门控关掉（rendered 冻结）。 */
	gatedOff = false;
	/** 曾设过 frontmatter 开关的各值（驱动真实 readFileSwitch + shouldAutoTrigger）。 */
	fmFalse = false;
	fmTrue = false;
	fmIllegal = false;
	/** 曾在「全局自动编号=关」下走自动触发（应被冻结）。 */
	autoNumberOffTrigger = false;
	/** 曾走过手动触发路径（绕过门控，对应「立即重新编号」命令）。 */
	manualTriggered = false;
	/** 清除还原律 S4 曾被断言（清除当前文件编号 → 还原裸文档，缺口①）。 */
	clearRestore = false;
	/** 清外来不动律 S5 曾被断言（清理外来编号 → 自家 WJ 编号不动，缺口①）。 */
	clearForeignNoop = false;
	// ── 阶段 2（缺口③）：多文件 + 多模板 + 路径规则 ──
	templateCreated = false;
	templateDeleted = false;
	templateRenamed = false;
	ruleAdded = false;
	ruleDeleted = false;
	ruleEdited = false;
	ruleRetargeted = false;
	ruleReordered = false;
	fileSwitched = false;
	/** 曾在某时刻同时存在 ≥2 个模板。 */
	multiTemplate = false;
	/** 某文件两次有效触发之间，其生效模板名发生过变化（跨模板状态转移）。 */
	crossTemplateSwitch = false;
	/** 某次触发时当前文件无可用模板（无规则命中 → 静默跳过，对应 I7/K6）。 */
	nullResolution = false;
	/** 触发时生效规则的具体度：根 / 文件夹 / 精确文件各命中过。 */
	resolveRoot = false;
	resolveFolder = false;
	resolveFile = false;
	triggers = 0;

	bumpOp(kind: OpKind): void {
		this.ops.set(kind, (this.ops.get(kind) ?? 0) + 1);
	}

	/** 返回未被覆盖到的关键 bin 列表（空数组表示覆盖闭合）。 */
	gaps(): string[] {
		const missing: string[] = [];
		const allOps: OpKind[] = [
			"insertHeading",
			"insertRaw",
			"insertFence",
			"deleteLine",
			"retitle",
			"editTitleInPlace",
			"changeLevel",
			"setNumeral",
			"setNumberSep",
			"setTitleSep",
			"setInherit",
			"setPrefix",
			"setSuffix",
			"setTopLevel",
			"setBottomLevel",
			"setStartIndex",
			"setSkipFill",
			"setAncestor",
			"setWhitelist",
			"setFrontmatterSwitch",
			"setAutoNumber",
			"clearNumbering",
			"clearForeign",
			"createTemplate",
			"deleteTemplate",
			"renameTemplate",
			"addRule",
			"deleteRule",
			"editRulePattern",
			"setRuleTemplate",
			"reorderRule",
			"switchFile",
			"manualTrigger",
			"trigger",
		];
		for (const op of allOps) {
			if ((this.ops.get(op) ?? 0) === 0) missing.push(`op:${op}`);
		}
		for (const n of NUMERALS) if (!this.numerals.has(n)) missing.push(`numeral:${n}`);
		if (!this.inheritFalse) missing.push("inherit=false");
		if (!this.skipDrop) missing.push("skipFill=drop");
		if (!this.skipFill) missing.push("skipFill=fill");
		if (!this.skipNone) missing.push("skipFill=none");
		if (!this.ancestorArabic) missing.push("ancestor=arabic");
		if (!this.ancestorSelf) missing.push("ancestor=self");
		if (!this.topLevelLowered) missing.push("topLevel-lowered");
		if (!this.topLevelRaised) missing.push("topLevel-raised");
		if (!this.affixToggled) missing.push("affix-toggled");
		if (!this.affixNonEmptyTrigger) missing.push("affix-nonempty-trigger");
		if (!this.fencePresent) missing.push("fence");
		if (!this.whitelistHit) missing.push("whitelist-hit");
		if (!this.whitelistExact) missing.push("whitelist-exact");
		if (!this.whitelistPartial) missing.push("whitelist-partial");
		if (!this.whitelistSubtree) missing.push("whitelist-subtree");
		if (!this.whitelistSubtreeWithChildren) missing.push("whitelist-subtree-children");
		if (!this.bottomLevelNarrowed) missing.push("bottomLevel-narrowed");
		if (!this.startIndexZero) missing.push("startIndex=0");
		if (!this.startIndexNonDefault) missing.push("startIndex-non-default");
		if (!this.emptyTitle) missing.push("empty-title");
		if (!this.levelGE5) missing.push("level>=5");
		if (!this.levelJump) missing.push("level-jump");
		if (!this.selfEatingTitle) missing.push("self-eating-title");
		if (!this.demoted) missing.push("demote-heading");
		if (!this.inPlaceEdited) missing.push("in-place-edit");
		if (!this.backlinkRename) missing.push("backlink-rename");
		// 缺口①②新增 bin。
		if (!this.gatedOff) missing.push("gated-off");
		if (!this.fmFalse) missing.push("fm=false");
		if (!this.fmTrue) missing.push("fm=true");
		if (!this.fmIllegal) missing.push("fm=illegal");
		if (!this.autoNumberOffTrigger) missing.push("autoNumber-off-trigger");
		if (!this.manualTriggered) missing.push("manual-trigger");
		if (!this.clearRestore) missing.push("clear-restore(S4)");
		if (!this.clearForeignNoop) missing.push("clear-foreign-noop(S5)");
		// 缺口③新增 bin。
		if (!this.multiTemplate) missing.push("multi-template");
		if (!this.crossTemplateSwitch) missing.push("cross-template-switch");
		if (!this.nullResolution) missing.push("null-resolution");
		if (!this.resolveRoot) missing.push("resolve-root");
		if (!this.resolveFolder) missing.push("resolve-folder");
		if (!this.resolveFile) missing.push("resolve-file");
		if (!this.fileSwitched) missing.push("file-switched");
		return missing;
	}
}

/** 失败时抛出，携带种子 + 操作轨迹 + 三方文本，便于直接复现定位。 */
export class SequenceError extends Error {
	constructor(seed: number, trace: string[], detail: string) {
		super(`UVM 序列失败（seed=${seed}）：${detail}\n操作轨迹：\n  ${trace.join("\n  ")}`);
		this.name = "SequenceError";
	}
}

/**
 * 单个「文件」的状态：裸文档真值 + 编辑器文本（锁步）+ 该文件的 frontmatter 开关。
 * 阶段 2（缺口③）：一个仓库有多个文件，各自独立编辑、各自按路径规则解析模板。
 */
interface FileState {
	path: string;
	bare: Line[];
	/** 与 bare 行一一对应；含上一次触发写入的前缀（刚插入/改写的行暂为裸文本）。 */
	rendered: string[];
	/** 单文件开关的结构化真值（驱动真实 {@link readFileSwitch}）。 */
	frontmatterState: FrontmatterState;
}

/** 仓库内可用的文件路径池（含多层文件夹，供文件夹规则 / 文件规则 / 子树匹配）。 */
const FILE_PATHS = [
	"笔记.md",
	"Projects/规划.md",
	"Projects/sub/细节.md",
	"读书/深度工作.md",
	"归档/old.md",
];
/** 路径规则模式池：根 / 各级文件夹 / 精确文件（具体度递增，供 resolvePathRule 解析压测）。 */
const RULE_PATTERNS = [
	"/",
	"Projects/",
	"Projects/sub/",
	"读书/",
	"归档/",
	"笔记.md",
	"Projects/规划.md",
	"读书/深度工作.md",
];
/** 不可删 / 不可改名的锚点模板名（对应真实插件「默认」模板，保证根规则恒可解析）。 */
const ANCHOR_TEMPLATE = "默认";

/**
 * 一条序列的「世界」（阶段 2 起为**多文件 + 多模板 + 路径规则**的仓库模型）：持有若干文件
 * （各自裸文档 / 编辑器文本 / frontmatter）、一组命名模板、一组路径规则与全局开关，并提供
 * step（约束随机产生并施加一个 Op）与各记分板（参考模型 / 幂等 / Backlink / 清除 S4·S5 / 门控 S6 /
 * 模板解析 S7）。
 *
 * **当前文件**（{@link cur}）是编辑 / 触发的作用对象；其**生效模板**由 `pathRules` 经真实
 * {@link resolvePathRule} + 模板查找解析（= 插件 `getTemplateForFile`），无命中则该文件无模板
 * （自动静默 / 手动无操作）。`bare` / `rendered` / `frontmatterState` 经 getter/setter 委托到当前文件。
 */
export class World {
	/** 仓库内的若干文件（缺口③）；编辑 / 触发作用于 {@link cur} 指向的当前文件。 */
	private readonly files: FileState[];
	private cur = 0;
	/** 命名模板集合（缺口③）：全部共享同一前后缀候选池（方案 A，使固定剥离并集恒覆盖）。 */
	private templates: Template[];
	/** 路径规则（缺口③）：路径模式 → 模板名；经真实 {@link resolvePathRule} 解析当前文件的模板。 */
	private pathRules: PathRule[];
	/** 全序列共享的非空前缀 / 后缀候选；各模板前后缀在「空 ↔ 候选」间切换（验证 B2/B3）。 */
	private readonly prefixCandidate: string;
	private readonly suffixCandidate: string;
	/**
	 * 传给 `renumberContent` 的剥离选项：`strippablePrefixes` / `strippableSuffixes` 取「空 + 候选」，
	 * 模拟 main.ts 的 `strippableAffixes()`「全模板前后缀并集」（方案 A）。**全部模板共享同一候选池**，
	 * 故固定并集恒等于真实全模板并集的上界，即便文件在模板间切换、旧模板前缀仍被剥净（跨模板 B2/B3）。
	 *
	 * 0.6.5 起不再注入 `isWhitelisted` 回调——改由引擎按 `template.whitelist` 自动计算豁免。
	 */
	private readonly opts: {
		strippablePrefixes: string[];
		strippableSuffixes: string[];
	};
	/** 本序列的标题取样池；方案 A 后不再回避「数字/字母起头」标题（恒含空前缀候选 → 对称处理）。 */
	private readonly titlePool: string[];
	private readonly trace: string[] = [];
	/** 全局自动编号面板开关（缺口②）；自动触发须过 `shouldAutoTrigger`，手动触发绕过。 */
	private autoNumber = true;
	/** 每个文件上次**有效触发**时的生效模板名，用于检测「跨模板切换」覆盖（缺口③）。 */
	private readonly lastResolved = new Map<string, string | null>();

	constructor(
		private readonly rng: Rng,
		private readonly seed: number,
		private readonly cov: Coverage,
		private readonly cfg: GenConfig = DEFAULT_GEN,
	) {
		this.titlePool = cfg.messyTitles ? [...TITLES, ...MESSY_TITLES] : TITLES;
		this.prefixCandidate = rng.pick(PREFIX_CANDIDATES);
		this.suffixCandidate = rng.pick(SUFFIX_CANDIDATES);
		this.opts = {
			strippablePrefixes: ["", this.prefixCandidate],
			strippableSuffixes: ["", this.suffixCandidate],
		};
		// —— 模板集合：锚点「默认」+ 随机 1–2 个额外模板（各自格式不同，但共享前后缀候选池）——
		this.templates = [this.makeTemplate(ANCHOR_TEMPLATE)];
		const extra = rng.int(2); // 0/1：再加 0~1 个，半数序列多模板。
		const extraNames = ["模板B", "模板C"];
		for (let i = 0; i < extra + 1; i++) {
			this.templates.push(this.makeTemplate(extraNames[i]));
		}
		// —— 路径规则：恒含根规则「/」→默认（锚点），再随机叠 0–2 条更具体的规则 ——
		this.pathRules = [{ pattern: "/", template: ANCHOR_TEMPLATE }];
		const ruleCount = rng.int(3);
		for (let i = 0; i < ruleCount; i++) {
			this.pathRules.push({
				pattern: rng.pick(RULE_PATTERNS),
				template: rng.pick(this.templates).name,
			});
		}
		// —— 文件：随机 1–3 个不同路径，各自最小裸文档 + 随机 frontmatter ——
		const fileCount = rng.intRange(1, 3);
		const paths = [...FILE_PATHS];
		this.files = [];
		const startFm: FrontmatterState[] = ["none", "none", "true", "false", "illegal"];
		for (let i = 0; i < fileCount && paths.length; i++) {
			const path = paths.splice(rng.int(paths.length), 1)[0];
			const bare: Line[] = [
				{ kind: "heading", level: rng.intRange(2, 3), title: rng.pick(this.titlePool) },
			];
			this.files.push({
				path,
				bare,
				rendered: bare.map(serializeLine),
				frontmatterState: rng.pick(startFm),
			});
		}
		this.cur = 0;
		this.autoNumber = rng.chance(0.5);
	}

	// ── 当前文件 / 生效模板访问器 ─────────────────────────────────────────────
	private get file(): FileState {
		return this.files[this.cur];
	}
	private get bare(): Line[] {
		return this.file.bare;
	}
	private set bare(v: Line[]) {
		this.file.bare = v;
	}
	private get rendered(): string[] {
		return this.file.rendered;
	}
	private set rendered(v: string[]) {
		this.file.rendered = v;
	}
	private get frontmatterState(): FrontmatterState {
		return this.file.frontmatterState;
	}
	private set frontmatterState(v: FrontmatterState) {
		this.file.frontmatterState = v;
	}

	/** 造一个共享前后缀候选池、格式随机的命名模板。 */
	private makeTemplate(name: string): Template {
		const tpl = structuredClone(DEFAULT_TEMPLATE);
		tpl.name = name;
		const startPrefix = this.rng.chance(0.5) ? "" : this.prefixCandidate;
		const startSuffix = this.rng.chance(0.5) ? "" : this.suffixCandidate;
		for (const k of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
			tpl.levels[k].prefix = startPrefix;
			tpl.levels[k].suffix = startSuffix;
			tpl.levels[k].numeral = this.rng.pick(this.cfg.numerals);
		}
		tpl.topLevel = this.rng.intRange(1, 3);
		tpl.whitelist = this.randomWhitelist();
		return tpl;
	}

	/** 当前文件经真实 `resolvePathRule` + 模板查找解析到的生效模板（= 插件 getTemplateForFile）。 */
	private resolvedTemplate(): Template | null {
		const rule = resolvePathRule(this.pathRules, this.file.path);
		if (!rule) {
			return null;
		}
		return this.templates.find((t) => t.name === rule.template) ?? null;
	}

	/** 随机挑一个模板来「改格式字段」（config 类激励的作用对象）。 */
	private pickTemplate(): Template {
		return this.rng.pick(this.templates);
	}

	/** 把结构化 frontmatter 状态渲染成实际的 `---` 块行（none 时为空块）。 */
	private frontmatterLines(): string[] {
		if (this.frontmatterState === "none") {
			return [];
		}
		const value =
			this.frontmatterState === "true"
				? "true"
				: this.frontmatterState === "false"
					? "false"
					: "ON"; // illegal：旧版文本值，readFileSwitch 按非法 → null 处理。
		return ["---", `obsidian-auto-headings: ${value}`, "---"];
	}

	/** 组合「frontmatter + 编辑器正文」的完整文件文本（供真实 readFileSwitch 读单文件开关）。 */
	private composeFull(): string {
		const fm = this.frontmatterLines();
		return fm.length ? [...fm, ...this.rendered].join("\n") : this.rendered.join("\n");
	}

	/** 当前序列的剥离选项（清除命令与剥离器共用同一前后缀并集）。 */
	private get cleanupOpts(): { strippablePrefixes: string[]; strippableSuffixes: string[] } {
		return this.opts;
	}

	/** 随机生成一组白名单条目（0–2 条，词去重，匹配方式随机）。 */
	private randomWhitelist(): WhitelistEntry[] {
		const count = this.rng.int(3); // 0/1/2
		const out: WhitelistEntry[] = [];
		const used = new Set<string>();
		for (let i = 0; i < count; i++) {
			const text = this.rng.pick(WHITELIST_WORDS);
			if (used.has(text)) continue;
			used.add(text);
			out.push({ text, match: this.rng.pick(MATCH_MODES) });
		}
		return out;
	}

	/**
	 * 计算**裸文档**里被白名单豁免的标题所在行下标（供就地编辑守卫与覆盖率）。
	 * 直接复用引擎的 {@link computeWhitelistExemptions}，与 DUT 同口径。
	 */
	private exemptBareIndices(template: Template | null): Set<number> {
		const out = new Set<number>();
		if (!template) {
			return out;
		}
		const headings = parseHeadings(serialize(this.bare));
		const exemptSet = computeWhitelistExemptions(headings, template, this.opts);
		for (const h of headings) {
			if (exemptSet.has(h)) out.add(h.lineIndex);
		}
		return out;
	}

	/** 当前 bare 文档里的标题行下标。 */
	private headingIndices(): number[] {
		const out: number[] = [];
		this.bare.forEach((l, i) => {
			if (l.kind === "heading") out.push(i);
		});
		return out;
	}

	/** 在两份状态的同一下标处插入同一行（裸形式）。 */
	private insertAt(i: number, line: Line): void {
		this.bare.splice(i, 0, line);
		this.rendered.splice(i, 0, serializeLine(line));
	}

	/** 约束随机地产生并施加一个 Op；触发类 Op 之后会调用 {@link check}。 */
	step(): void {
		const r = this.rng.next();
		if (r < 0.35) {
			// 触发分两路（缺口②）：约 30% 走手动（「立即重新编号」，绕过门控），其余走自动（受门控）。
			this.trigger(this.rng.chance(0.3));
		} else if (r < 0.65) {
			this.edit();
		} else {
			this.config();
		}
	}

	/**
	 * 收尾：确保每条序列至少**有效结算一次**——补一条根规则→默认（若已被删），再对每个文件**手动**触发
	 * （绕过门控、必命中模板），让所有文件的参考模型在终态都被校验一遍。
	 */
	finish(): void {
		if (!this.pathRules.some((r) => r.pattern === "/")) {
			this.pathRules.unshift({ pattern: "/", template: ANCHOR_TEMPLATE });
		}
		for (let i = 0; i < this.files.length; i++) {
			this.cur = i;
			this.trigger(true);
		}
	}

	// ── 编辑类激励 ───────────────────────────────────────────────────────────
	private edit(): void {
		const choices: OpKind[] = [
			"insertHeading",
			"insertRaw",
			"insertFence",
			"deleteLine",
			"retitle",
			"changeLevel",
			"demoteHeading",
		];
		// 清除命令 S4/S5 是「干净空间」不变量（rendered 全是插件自写的 WJ 前缀时才成立），故仅在
		// 参考模式纳入。explore 模式的 mutatePrefix 会**故意抹掉 WJ**，此后「清外来」把失去 WJ 的前缀
		// 当外来编号剥掉是预期行为（非 bug）——S5 的「无操作」前提随之不成立，故 explore 不施加清除命令。
		if (this.cfg.oracle === "reference") {
			choices.push("clearNumbering", "clearForeign");
		}
		if (this.cfg.inPlaceEdit) choices.push("editTitleInPlace");
		if (this.cfg.manualPrefixEdit) choices.push("mutatePrefix");
		const kind = this.rng.pick(choices);
		const len = this.bare.length;
		switch (kind) {
			case "insertHeading": {
				const level = this.rng.pick(LEVEL_POOL);
				const title = this.rng.pick(this.titlePool);
				this.insertAt(this.rng.int(len + 1), { kind: "heading", level, title });
				if (level >= 5) this.cov.levelGE5 = true;
				if (title === "") this.cov.emptyTitle = true;
				if (SELF_EATING.has(title)) this.cov.selfEatingTitle = true;
				this.trace.push(`insertHeading H${level} ${JSON.stringify(title)}`);
				break;
			}
			case "insertRaw": {
				const text = this.rng.pick([
					"正文一行",
					"- 列表项",
					"> 引用",
					"普通段落 # 不是标题",
				]);
				this.insertAt(this.rng.int(len + 1), { kind: "raw", text });
				this.trace.push(`insertRaw ${JSON.stringify(text)}`);
				break;
			}
			case "insertFence": {
				const i = this.rng.int(len + 1);
				const fence = this.rng.pick(["```", "~~~"]);
				// 代码块三行：栅栏 + 一行伪标题 + 同种栅栏闭合（块内 # 不应被编号）。
				for (const t of [fence, "# 代码块内的伪标题", fence].reverse()) {
					this.insertAt(i, { kind: "raw", text: t });
				}
				this.cov.fencePresent = true;
				this.trace.push(`insertFence ${fence}`);
				break;
			}
			case "deleteLine": {
				// 不删**栅栏定界行**：删掉它会让代码块失衡，把"已编号的标题"事后埋进未闭合代码块里——
				// 那段冻结的前缀插件再也够不着（视作代码、不剥），但参考模型仍按裸文档重算，二者必然不一致。
				// 这是真实但属边角的行为，非编号 bug；为聚焦状态转移压测，这里始终保持栅栏配平。
				const deletable: number[] = [];
				this.bare.forEach((l, idx) => {
					if (!(l.kind === "raw" && /^ {0,3}(`{3,}|~{3,})/.test(l.text)))
						deletable.push(idx);
				});
				if (this.bare.length > 1 && deletable.length) {
					const i = this.rng.pick(deletable);
					this.bare.splice(i, 1);
					this.rendered.splice(i, 1);
					this.trace.push(`deleteLine #${i}`);
				}
				break;
			}
			case "retitle": {
				const hs = this.headingIndices();
				if (hs.length) {
					const i = this.rng.pick(hs);
					const title = this.rng.pick(this.titlePool);
					const level = (this.bare[i] as { level: number }).level;
					// 用户清空并重打：两份状态同步成裸标题行。
					this.bare[i] = { kind: "heading", level, title };
					this.rendered[i] = serializeLine(this.bare[i]);
					if (title === "") this.cov.emptyTitle = true;
					if (SELF_EATING.has(title)) this.cov.selfEatingTitle = true;
					this.trace.push(`retitle #${i} -> ${JSON.stringify(title)}`);
				}
				break;
			}
			case "editTitleInPlace": {
				// 「就地编辑」：用户在**已经带编号前缀**的标题行里继续打字 / 改文本，**旧前缀仍留在行上**。
				// 这是真实使用的主线（不像 retitle 把整行清空重打），也是 strip 最易出错处——剥离面对的是
				// 「（可能用旧配置写的）旧前缀 + 新标题文本」。默认模式只追加**安全碎片**（保参考模型干净）；
				// explore 模式允许追加 / 前插**脏碎片**（分隔符 / 数字 / 字母 / 空白起头），撞容差剥离误伤边界。
				const hs = this.headingIndices();
				if (hs.length) {
					const i = this.rng.pick(hs);
					const h = this.bare[i] as Extract<Line, { kind: "heading" }>;
					const oldTitle = h.title;
					// 从当前渲染行提取「旧前缀」= marker 之后、裸标题之前的那段（可能含上次触发写入的编号）。
					const marker = "#".repeat(h.level) + " ";
					const body = this.rendered[i].startsWith(marker)
						? this.rendered[i].slice(marker.length)
						: this.rendered[i];
					const oldPrefix = body.endsWith(oldTitle)
						? body.slice(0, body.length - oldTitle.length)
						: "";
					let newTitle: string | null = null;
					if (this.cfg.messyTitles && this.rng.chance(0.5)) {
						const frag = this.rng.pick(MESSY_FRAGMENTS);
						newTitle = this.rng.chance(0.5) ? frag + oldTitle : oldTitle + frag;
					} else if (
						// 默认模式：避开自食 / 当前被白名单豁免 / 空标题，保证「裸↔渲染」strip 干净、参考模型恒一致。
						// 白名单判定改用引擎真实豁免集合（含 subtree），与 0.6.5 的真实 whitelist 驱动一致。
						this.cfg.messyTitles ||
						(!SELF_EATING.has(oldTitle) &&
							!this.exemptBareIndices(this.resolvedTemplate()).has(i) &&
							oldTitle !== "")
					) {
						newTitle = oldTitle + this.rng.pick(SAFE_FRAGMENTS);
					}
					if (newTitle !== null) {
						this.bare[i] = { kind: "heading", level: h.level, title: newTitle };
						this.rendered[i] = marker + oldPrefix + newTitle;
						this.cov.inPlaceEdited = true;
						if (SELF_EATING.has(newTitle)) this.cov.selfEatingTitle = true;
						this.trace.push(
							`editTitleInPlace #${i} keepPrefix=${JSON.stringify(oldPrefix)} -> ${JSON.stringify(newTitle)}`,
						);
					}
				}
				break;
			}
			case "mutatePrefix": {
				// 手动破坏前缀区（explore 专用）：用户手抖删/改了编号里的字符（删一位、去空格、改数字），
				// 但**裸标题意图不变**。故**不更新 bare**——只能用幂等性记分板校验（参考模型在此无效）。
				const hs = this.headingIndices();
				if (hs.length) {
					const i = this.rng.pick(hs);
					const h = this.bare[i] as Extract<Line, { kind: "heading" }>;
					const marker = "#".repeat(h.level) + " ";
					if (this.rendered[i].startsWith(marker)) {
						const body = this.rendered[i].slice(marker.length);
						// 仅当 body 比裸标题长（带前缀）时才破坏。
						if (body.length > h.title.length) {
							const prefixLen = body.length - h.title.length;
							let pre = body.slice(0, prefixLen);
							const which = this.rng.int(3);
							if (which === 0 && pre.length) {
								const k = this.rng.int(pre.length);
								pre = pre.slice(0, k) + pre.slice(k + 1); // 删一个字符
							} else if (which === 1) {
								pre = pre.replace(" ", ""); // 去一个空格
							} else {
								pre = pre.replace(/\d/, (d) => String((Number(d) + 1) % 10)); // 改一个数字
							}
							this.rendered[i] = marker + pre + h.title;
							this.cov.prefixMutated = true;
							this.trace.push(
								`mutatePrefix #${i} -> ${JSON.stringify(this.rendered[i])}`,
							);
						}
					}
				}
				break;
			}
			case "changeLevel": {
				const hs = this.headingIndices();
				if (hs.length) {
					const i = this.rng.pick(hs);
					const level = this.rng.pick(LEVEL_POOL);
					const title = (this.bare[i] as { title: string }).title;
					this.bare[i] = { kind: "heading", level, title };
					this.rendered[i] = serializeLine(this.bare[i]);
					if (level >= 5) this.cov.levelGE5 = true;
					this.trace.push(`changeLevel #${i} -> H${level}`);
				}
				break;
			}
			case "demoteHeading": {
				// 把某标题「删光 `#`」降级为正文（0.7.20，验证 ③ 残留清理）：bare 侧变成裸标题文本的
				// raw 段；rendered 侧保留**去掉 `#{level} ` 标记后的原文**——若原是带编号标题，残留即
				// 含 WJ 哨兵 + 编号（正是真实用户降级后的脏态）。下次触发时 ③ 应把残留清净，参考模型
				// （bare 的干净 raw 段）恒等于 renumberContent(裸) → 由现有 check 自动校验。
				const hs = this.headingIndices();
				if (hs.length) {
					const i = this.rng.pick(hs);
					const h = this.bare[i] as Extract<Line, { kind: "heading" }>;
					const marker = "#".repeat(h.level) + " ";
					const residue = this.rendered[i].startsWith(marker)
						? this.rendered[i].slice(marker.length)
						: this.rendered[i];
					this.bare[i] = { kind: "raw", text: h.title };
					this.rendered[i] = residue;
					this.cov.demoted = true;
					this.trace.push(`demoteHeading #${i} -> ${JSON.stringify(residue)}`);
				}
				break;
			}
			case "clearNumbering": {
				this.clearNumbering();
				break;
			}
			case "clearForeign": {
				this.clearForeign();
				break;
			}
		}
		this.cov.bumpOp(kind);
	}

	/**
	 * 「清除当前文件编号」命令（缺口①，DUT = {@link clearNumberingContent}）+ **S4 清除还原律**。
	 *
	 * 只在「裸文档本身是 clear 的定点」（`clearNumbering(bare)===bare`，即不含会被全样式并集剥离器
	 * 误吃的自食/外来样标题）时施加并断言：清除当前 `rendered`（可能含历史前缀）必还原成裸文档。
	 * 守卫排除自食前缀（spec §2.3 取舍）与白名单豁免——它们让「裸」本身就不是 clear 定点，断言不成立。
	 * 施加后 `rendered` 与裸文档锁步（参考模型在后续触发仍恒成立）。
	 */
	private clearNumbering(): void {
		const bareText = serialize(this.bare);
		if (clearNumberingContent(bareText, this.cleanupOpts) !== bareText) {
			return; // 裸文档非 clear 定点（自食/外来样标题）→ 排除出 S4 断言。
		}
		const got = clearNumberingContent(this.rendered.join("\n"), this.cleanupOpts);
		if (got !== bareText) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`S4 清除还原律失败：清除编号后未还原裸文档\n  清除得 : ${JSON.stringify(got)}\n  裸文档 : ${JSON.stringify(bareText)}`,
			);
		}
		this.rendered = got.split("\n");
		this.cov.clearRestore = true;
		this.trace.push("— clearNumbering (S4) —");
	}

	/**
	 * 「清理非本插件编号」命令（缺口①，DUT = {@link clearForeignNumberingContent}）+ **S5 清外来不动律**。
	 *
	 * 只在「裸文档是 foreign-clear 的定点」（`clearForeign(bare)===bare`）时断言：清外来对当前 `rendered`
	 * 是**无操作**——自家 WJ 编号被跳过、裸态标题既是 foreign 定点也不被动。守卫排除「裸标题恰像外来编号」
	 * （如 `2024 总结`）的情形。无操作故不改 `rendered`，锁步不变。
	 */
	private clearForeign(): void {
		const bareText = serialize(this.bare);
		if (clearForeignNumberingContent(bareText) !== bareText) {
			return; // 裸标题像外来编号 → 排除出 S5 断言。
		}
		const cur = this.rendered.join("\n");
		const got = clearForeignNumberingContent(cur);
		if (got !== cur) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`S5 清外来不动律失败：清理外来编号动了自家 WJ 编号\n  清理前 : ${JSON.stringify(cur)}\n  清理后 : ${JSON.stringify(got)}`,
			);
		}
		this.cov.clearForeignNoop = true;
		this.trace.push("— clearForeign (S5) —");
	}

	// ── 配置类激励（在约束内）─────────────────────────────────────────────────
	private config(): void {
		// 格式类激励作用于**随机挑的一个模板** tpl（缺口③：多模板，改 A 模板未必影响用 B 模板的文件）。
		const tpl = this.pickTemplate();
		// inherit 翻转仍按**当前**前后缀是否都为空门控（约束未放开；非空前后缀下 inherit 翻转另案）。
		const affixEmptyNow = tpl.levels.h2.prefix === "" && tpl.levels.h2.suffix === "";
		const choices: OpKind[] = [
			"setNumeral",
			"setNumberSep",
			"setTitleSep",
			"setPrefix",
			"setSuffix",
			"setTopLevel",
			"setBottomLevel",
			"setStartIndex",
			"setSkipFill",
			"setAncestor",
			"setWhitelist",
			"setFrontmatterSwitch",
			"setAutoNumber",
			// 阶段 2（缺口③）：模板生命周期 + 路径规则 + 多文件切换。
			"createTemplate",
			"deleteTemplate",
			"renameTemplate",
			"addRule",
			"deleteRule",
			"editRulePattern",
			"setRuleTemplate",
			"reorderRule",
			"switchFile",
		];
		if (affixEmptyNow || this.cfg.allowInheritWithAffix) choices.push("setInherit");
		const kind = this.rng.pick(choices);
		const lvls = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
		switch (kind) {
			case "setNumeral": {
				const n = this.rng.pick(this.cfg.numerals);
				const lvl = this.rng.pick(lvls);
				tpl.levels[lvl].numeral = n;
				this.cov.numerals.add(n);
				this.trace.push(`setNumeral ${tpl.name}.${lvl}=${n}`);
				break;
			}
			case "setNumberSep": {
				const s = this.rng.pick(NUMBER_SEPS);
				for (const lvl of lvls) tpl.levels[lvl].numberSeparator = s;
				this.trace.push(`setNumberSep ${tpl.name} ${JSON.stringify(s)}`);
				break;
			}
			case "setTitleSep": {
				const s = this.rng.pick(TITLE_SEPS);
				for (const lvl of lvls) tpl.levels[lvl].titleSeparator = s;
				this.trace.push(`setTitleSep ${tpl.name} ${JSON.stringify(s)}`);
				break;
			}
			case "setInherit": {
				const v = this.rng.chance(0.5);
				const lvl = this.rng.pick(lvls);
				if (tpl.levels[lvl].prefix !== "" || tpl.levels[lvl].suffix !== "") {
					this.cov.inheritWithAffix = true;
				}
				tpl.levels[lvl].inherit = v;
				if (!v) this.cov.inheritFalse = true;
				this.trace.push(`setInherit ${tpl.name}.${lvl}=${v}`);
				break;
			}
			case "setPrefix": {
				// 在「空 ↔ 候选」间切换（所有级别同步），验证 B2/B3「改前缀后再触发不叠加」。
				const v = this.rng.chance(0.5) ? "" : this.prefixCandidate;
				for (const lvl of lvls) tpl.levels[lvl].prefix = v;
				this.cov.affixToggled = true;
				this.trace.push(`setPrefix ${tpl.name} ${JSON.stringify(v)}`);
				break;
			}
			case "setSuffix": {
				const v = this.rng.chance(0.5) ? "" : this.suffixCandidate;
				for (const lvl of lvls) tpl.levels[lvl].suffix = v;
				this.cov.affixToggled = true;
				this.trace.push(`setSuffix ${tpl.name} ${JSON.stringify(v)}`);
				break;
			}
			case "setTopLevel": {
				const cur = tpl.topLevel;
				const next = this.rng.intRange(1, 4);
				if (next < cur) this.cov.topLevelLowered = true;
				if (next > cur) this.cov.topLevelRaised = true;
				tpl.topLevel = next;
				// 保持 bottomLevel ≥ topLevel（与 GUI 一致），避免退化空区间淹没覆盖。
				if (tpl.bottomLevel < next) tpl.bottomLevel = next;
				this.trace.push(`setTopLevel ${tpl.name} ${cur}->${next}`);
				break;
			}
			case "setBottomLevel": {
				// 结束编号层级（0.6.5）：在 [topLevel, 6] 内随机，覆盖「只编号区间」与收窄后剥残留。
				const cur = tpl.bottomLevel;
				const next = this.rng.intRange(tpl.topLevel, 6);
				tpl.bottomLevel = next;
				if (next < 6) this.cov.bottomLevelNarrowed = true;
				this.trace.push(`setBottomLevel ${tpl.name} ${cur}->${next}`);
				break;
			}
			case "setStartIndex": {
				// 起始编号数字（M8 批次 1）：仅首段渲染期偏移。偏 0/1（各 1/3）再带两个更大值，
				// 覆盖「0 起编号」「改值后再触发旧前缀剥净」（剥离靠 WJ 边界，与数值无关）。
				const cur = tpl.startIndex;
				const next = this.rng.pick([0, 0, 1, 1, 2, 5]);
				tpl.startIndex = next;
				if (next === 0) this.cov.startIndexZero = true;
				if (next !== 1) this.cov.startIndexNonDefault = true;
				this.trace.push(`setStartIndex ${tpl.name} ${cur}->${next}`);
				break;
			}
			case "setSkipFill": {
				// 三策略等概率：补位 / 不补位 / 不编号（0.7.15 新增 none，跳级标题保持原样）。
				const roll = this.rng.int(3);
				const sf: SkipFill =
					roll === 0
						? { mode: "fill", placeholder: this.rng.pick(["0", "1"]) }
						: roll === 1
							? { mode: "drop" }
							: { mode: "none" };
				tpl.skipFill = sf;
				if (sf.mode === "drop") this.cov.skipDrop = true;
				else if (sf.mode === "none") this.cov.skipNone = true;
				else this.cov.skipFill = true;
				this.trace.push(`setSkipFill ${tpl.name} ${sf.mode}`);
				break;
			}
			case "setAncestor": {
				const a: AncestorNumeral = this.rng.chance(0.5) ? "arabic" : "self";
				tpl.ancestorNumeral = a;
				if (a === "arabic") this.cov.ancestorArabic = true;
				else this.cov.ancestorSelf = true;
				this.trace.push(`setAncestor ${tpl.name} ${a}`);
				break;
			}
			case "setWhitelist": {
				// 真实白名单驱动（0.6.5）：随机增 / 删 / 改一条条目（含 subtree），驱动引擎的
				// computeWhitelistExemptions，覆盖「改白名单后再触发」的状态转移与子树豁免。
				const wl = tpl.whitelist;
				const action = wl.length === 0 ? 0 : this.rng.int(3);
				if (action === 0) {
					const text = this.rng.pick(WHITELIST_WORDS);
					const match = this.rng.pick(MATCH_MODES);
					if (!wl.some((e) => e.text === text && e.match === match)) {
						wl.push({ text, match });
					}
				} else if (action === 1) {
					wl.splice(this.rng.int(wl.length), 1);
				} else {
					wl[this.rng.int(wl.length)].match = this.rng.pick(MATCH_MODES);
				}
				this.trace.push(`setWhitelist ${tpl.name} ${JSON.stringify(wl)}`);
				break;
			}
			case "createTemplate": {
				// 缺口③：新建模板（最多 3 个；共享前后缀候选池）。
				if (this.templates.length < 3) {
					const used = new Set(this.templates.map((t) => t.name));
					const name = ["模板B", "模板C", "模板D"].find((n) => !used.has(n));
					if (name) {
						this.templates.push(this.makeTemplate(name));
						this.cov.templateCreated = true;
						this.trace.push(`createTemplate ${name}`);
					}
				}
				this.checkResolution();
				break;
			}
			case "deleteTemplate": {
				// 缺口③：删模板（锚点「默认」不可删，对应真实插件）。删时把引用它的规则**降级/改投/连删**。
				const victims = this.templates.filter((t) => t.name !== ANCHOR_TEMPLATE);
				if (victims.length) {
					const victim = this.rng.pick(victims);
					const others = this.templates.filter((t) => t.name !== victim.name);
					// 去向：改投另一模板（含降级到默认）或「连规则一并删」。
					const deleteRules = this.rng.chance(0.3);
					const redirect = this.rng.pick(others).name;
					if (deleteRules) {
						this.pathRules = this.pathRules.filter((r) => r.template !== victim.name);
					} else {
						for (const r of this.pathRules) {
							if (r.template === victim.name) r.template = redirect;
						}
					}
					this.templates = others;
					this.cov.templateDeleted = true;
					this.trace.push(
						`deleteTemplate ${victim.name} -> ${deleteRules ? "连规则删" : redirect}`,
					);
				}
				this.checkResolution();
				break;
			}
			case "renameTemplate": {
				// 缺口③：改名（锚点不可改名）+ 同步所有引用该模板名的路径规则（= 插件 renameTemplate）。
				const victims = this.templates.filter((t) => t.name !== ANCHOR_TEMPLATE);
				if (victims.length) {
					const victim = this.rng.pick(victims);
					const used = new Set(this.templates.map((t) => t.name));
					const next = ["模板B", "模板C", "模板D", "模板E"].find((n) => !used.has(n));
					if (next) {
						const old = victim.name;
						victim.name = next;
						for (const r of this.pathRules) {
							if (r.template === old) r.template = next; // 同步规则。
						}
						this.cov.templateRenamed = true;
						this.trace.push(`renameTemplate ${old} -> ${next}`);
					}
				}
				this.checkResolution();
				break;
			}
			case "addRule": {
				this.pathRules.push({
					pattern: this.rng.pick(RULE_PATTERNS),
					template: this.rng.pick(this.templates).name,
				});
				this.cov.ruleAdded = true;
				this.trace.push(`addRule ${JSON.stringify(this.pathRules.at(-1))}`);
				this.checkResolution();
				break;
			}
			case "deleteRule": {
				// 允许删任意规则（含根规则 → 部分文件可能无模板，覆盖 null 解析 / I7·K6）。
				if (this.pathRules.length > 1) {
					const i = this.rng.int(this.pathRules.length);
					this.trace.push(`deleteRule #${i} ${JSON.stringify(this.pathRules[i])}`);
					this.pathRules.splice(i, 1);
					this.cov.ruleDeleted = true;
				}
				this.checkResolution();
				break;
			}
			case "editRulePattern": {
				if (this.pathRules.length) {
					const i = this.rng.int(this.pathRules.length);
					this.pathRules[i].pattern = this.rng.pick(RULE_PATTERNS);
					this.cov.ruleEdited = true;
					this.trace.push(`editRulePattern #${i} -> ${this.pathRules[i].pattern}`);
				}
				this.checkResolution();
				break;
			}
			case "setRuleTemplate": {
				if (this.pathRules.length) {
					const i = this.rng.int(this.pathRules.length);
					this.pathRules[i].template = this.rng.pick(this.templates).name;
					this.cov.ruleRetargeted = true;
					this.trace.push(`setRuleTemplate #${i} -> ${this.pathRules[i].template}`);
				}
				this.checkResolution();
				break;
			}
			case "reorderRule": {
				if (this.pathRules.length > 1) {
					const from = this.rng.int(this.pathRules.length);
					const to = this.rng.int(this.pathRules.length);
					const [moved] = this.pathRules.splice(from, 1);
					this.pathRules.splice(to, 0, moved);
					this.cov.ruleReordered = true;
					this.trace.push(`reorderRule ${from}->${to}`);
				}
				this.checkResolution();
				break;
			}
			case "switchFile": {
				// 缺口③：切换当前编辑 / 触发的文件（各文件独立状态、各按路径解析模板）。
				if (this.files.length > 1) {
					let next = this.cur;
					while (next === this.cur) next = this.rng.int(this.files.length);
					this.cur = next;
					this.cov.fileSwitched = true;
					this.trace.push(`switchFile -> ${this.file.path}`);
				}
				break;
			}
			case "setFrontmatterSwitch": {
				// 缺口②：改单文件开关（true/false/非法/删除），驱动真实 readFileSwitch + 门控。
				const next = this.rng.pick<FrontmatterState>(["none", "true", "false", "illegal"]);
				this.frontmatterState = next;
				if (next === "false") this.cov.fmFalse = true;
				else if (next === "true") this.cov.fmTrue = true;
				else if (next === "illegal") this.cov.fmIllegal = true;
				this.trace.push(`setFrontmatterSwitch ${next}`);
				break;
			}
			case "setAutoNumber": {
				// 缺口②：切换全局自动编号面板开关。
				this.autoNumber = this.rng.chance(0.5);
				this.trace.push(`setAutoNumber ${this.autoNumber}`);
				break;
			}
			default:
				break;
		}
		this.cov.bumpOp(kind);
	}

	/**
	 * **门控记分板 S6**（缺口②）：用真实 {@link readFileSwitch} 解析当前 frontmatter，断言其结果与本框架
	 * 设定的结构化状态 {@link frontmatterState} 一致（true→true / false→false / none·illegal→null）。
	 * 这把真实的单文件开关解析器（含引号剥离、非法值兜底）纳入随机 frontmatter 空间压测。
	 */
	private checkGate(sw: boolean | null): void {
		const expected =
			this.frontmatterState === "true"
				? true
				: this.frontmatterState === "false"
					? false
					: null; // none / illegal → 跟随全局开关（readFileSwitch 返回 null）。
		if (sw !== expected) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`S6 门控解析不一致：frontmatter=${this.frontmatterState} 时 readFileSwitch=${JSON.stringify(
					sw,
				)} ≠ 期望 ${JSON.stringify(expected)}`,
			);
		}
	}

	// ── 触发（DUT）+ 记分板（参考模型 + 两层门控 S6）──────────────────────────
	/**
	 * @param manual 手动触发（「立即重新编号」命令）绕过门控；自动触发须过 `shouldAutoTrigger`。
	 */
	private trigger(manual: boolean): void {
		this.checkResolution(); // S7：每次触发前核对路径解析一致 + 无悬挂引用。
		// 两层门控（缺口②）：自动路径由真实 readFileSwitch + 全局开关决定是否放行；手动路径恒放行。
		const sw = readFileSwitch(this.composeFull());
		this.checkGate(sw);
		const gateOpen = manual || (sw === false ? false : sw === true ? true : this.autoNumber);
		if (!gateOpen) {
			// 门控关：自动触发不应用任何改动，rendered 冻结（S6 冻结律的行为体现）。
			this.cov.gatedOff = true;
			if (sw !== true && !this.autoNumber) this.cov.autoNumberOffTrigger = true;
			this.trace.push(`— autoTrigger gated-off (fm=${this.frontmatterState}) —`);
			return;
		}
		// 缺口③：当前文件按路径规则解析生效模板；无命中 → 无可用模板（自动静默 / 手动无操作，I7/K6）。
		const rule = resolvePathRule(this.pathRules, this.file.path);
		const template = this.resolvedTemplate();
		if (!template) {
			this.cov.nullResolution = true;
			this.trace.push(`— trigger no-template (${this.file.path}) —`);
			return;
		}
		// 解析具体度覆盖 + 跨模板切换检测（与上次该文件有效触发的生效模板比对）。
		if (rule) {
			if (rule.pattern === "/") this.cov.resolveRoot = true;
			else if (rule.pattern.endsWith("/")) this.cov.resolveFolder = true;
			else this.cov.resolveFile = true;
		}
		const prev = this.lastResolved.get(this.file.path);
		if (prev !== undefined && prev !== template.name) this.cov.crossTemplateSwitch = true;
		this.lastResolved.set(this.file.path, template.name);
		if (this.templates.length >= 2) this.cov.multiTemplate = true;

		if (manual) this.cov.manualTriggered = true;
		if (template.levels.h2.prefix !== "" || template.levels.h2.suffix !== "") {
			this.cov.affixNonEmptyTrigger = true;
		}
		const before = this.rendered.join("\n");
		const after = renumberContent(before, template, this.opts);
		this.rendered = after.split("\n");
		this.cov.bumpOp(manual ? "manualTrigger" : "trigger");
		this.cov.triggers++;
		this.trace.push(manual ? "— manualTrigger —" : "— autoTrigger —");
		this.detectLevelJump();
		this.detectWhitelistCoverage(template);
		// Backlink 改名表 + 链接重写往返不变量（M7，两种 oracle 均跑：纯属 before→after 文本性质）。
		this.checkBacklinkRoundTrip(before, after);
		if (this.cfg.oracle === "reference") {
			this.check(template);
		} else {
			this.checkIdempotent(template);
		}
	}

	/**
	 * **模板解析记分板 S7**（缺口③）：核对路径规则解析的自洽性——
	 * 1. **无悬挂引用**：每条规则引用的模板名都存在（删 / 改名后同步正确，= 插件 renameTemplate / 删模板降级）。
	 * 2. **锚点恒在**：默认模板不可删 → 必存在（保证根规则恒可解析）。
	 * 3. **解析一致**：真实 {@link resolvePathRule} 的结果与独立参考模型 {@link expectedResolve} 一致
	 *    （具体度：精确文件 ＞ 最长文件夹 ＞ 根；并列取列表靠后者）。
	 */
	private checkResolution(): void {
		const live = new Set(this.templates.map((t) => t.name));
		if (!live.has(ANCHOR_TEMPLATE)) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`S7：锚点模板「${ANCHOR_TEMPLATE}」丢失`,
			);
		}
		for (const r of this.pathRules) {
			if (!live.has(r.template)) {
				throw new SequenceError(
					this.seed,
					this.trace,
					`S7 悬挂引用：规则 ${JSON.stringify(r)} 指向不存在的模板（生命周期同步漏改）`,
				);
			}
		}
		for (const f of this.files) {
			const real = resolvePathRule(this.pathRules, f.path);
			const exp = this.expectedResolve(f.path);
			if ((real?.pattern ?? null) !== (exp?.pattern ?? null)) {
				throw new SequenceError(
					this.seed,
					this.trace,
					`S7 解析不一致（${f.path}）：真实=${JSON.stringify(real)} 参考=${JSON.stringify(exp)}`,
				);
			}
		}
	}

	/** S7 的独立参考解析：在干净模式池里选最具体（并列取后者）的匹配规则。 */
	private expectedResolve(path: string): PathRule | null {
		let best: PathRule | null = null;
		let bestSpec = -1;
		for (const r of this.pathRules) {
			if (!indepMatch(r.pattern, path)) continue;
			const s = indepSpec(r.pattern);
			if (s >= bestSpec) {
				best = r;
				bestSpec = s;
			}
		}
		return best;
	}

	/**
	 * **Backlink 往返记分板**（M7，见 spec.md §3.12）：对本次触发的「编号前 → 编号后」文本，
	 * 校验 `src/backlinks.ts` 的改名表 + 链接重写自洽：
	 *
	 * 1. **改名表幂等**：`computeHeadingRenames(after, after)` 必为空（编号后锚点已稳定，再算无改名）。
	 * 2. **往返一致**：为每个「唯一旧锚点」标题造一条 `[[Target#旧标题]]` 链接，经 `rewriteBacklinksInContent`
	 *    重写后，其锚点归一必须等于**该行新标题**的锚点——即「指向旧标题的链接，重写后恰好指向同一标题的新名」。
	 *
	 * 它在整个随机编号空间里压测 backlink 核心：任何「改名表算错 / 重写错位 / 漏改 / 误改」都会被逮。
	 * 重复锚点（歧义）按设计跳过（保守不改），故只在唯一锚点上断言。
	 */
	private checkBacklinkRoundTrip(before: string, after: string): void {
		if (computeHeadingRenames(after, after).length !== 0) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`Backlink 改名表非幂等：after→after 应为空`,
			);
		}
		const map = new Map(computeHeadingRenames(before, after).map((r) => [r.from, r.to]));
		const beforeH = parseHeadings(before);
		const afterByLine = new Map<number, Heading>(
			parseHeadings(after).map((h) => [h.lineIndex, h]),
		);
		// 旧锚点出现次数：重复=歧义（设计上保守不改），只在唯一锚点上断言往返。
		const oldCount = new Map<string, number>();
		for (const h of beforeH) {
			const a = linkAnchor(h.text);
			if (a) oldCount.set(a, (oldCount.get(a) ?? 0) + 1);
		}
		const targetable = beforeH.filter((h) => {
			const a = linkAnchor(h.text);
			const nh = afterByLine.get(h.lineIndex);
			if (!nh) return false;
			// 新锚点为空（标题被编号吃成空，如 explore 里的「（0.0.1）」）时，computeHeadingRenames 按设计
			// **不改名**（无法链到空标题，spec §2.3 自食取舍）→ 链接保持旧值不动，故排除出往返断言。
			const na = linkAnchor(nh.text);
			// 排除空锚点 / 歧义 / 含链接语法字符（避免造出畸形 synthetic 链接）。
			return a !== "" && na !== "" && (oldCount.get(a) ?? 0) === 1 && !/[[\]#|]/.test(h.text);
		});
		if (targetable.length === 0) return;
		const synthetic = targetable.map((h) => `[[Target#${h.text}]]`).join("\n");
		const rewritten = rewriteBacklinksInContent(synthetic, "Target", false, map).content.split(
			"\n",
		);
		targetable.forEach((h, i) => {
			const newAnchor = linkAnchor((afterByLine.get(h.lineIndex) as Heading).text);
			const m = rewritten[i].match(/^\[\[Target#(.*)\]\]$/);
			const got = m ? linkAnchor(m[1]) : "";
			if (got !== newAnchor) {
				throw new SequenceError(
					this.seed,
					this.trace,
					`Backlink 往返不一致：旧锚点 ${JSON.stringify(linkAnchor(h.text))} 重写后 ${JSON.stringify(
						got,
					)} ≠ 新标题锚点 ${JSON.stringify(newAnchor)}`,
				);
			}
			if (linkAnchor(h.text) !== newAnchor) this.cov.backlinkRename = true;
		});
	}

	/** 收集白名单相关覆盖率（匹配方式 / 命中 / 子树带子标题），与真实豁免集合一致。 */
	private detectWhitelistCoverage(template: Template): void {
		for (const e of template.whitelist) {
			if (e.match === "exact") this.cov.whitelistExact = true;
			else if (e.match === "partial") this.cov.whitelistPartial = true;
			else if (e.match === "subtree") this.cov.whitelistSubtree = true;
		}
		const exempt = this.exemptBareIndices(template);
		if (exempt.size > 0) this.cov.whitelistHit = true;
		// 子树带子标题：存在 subtree 条目，且相邻两个被豁免标题中后者更深（= 子标题被一并豁免）。
		if (template.whitelist.some((e) => e.match === "subtree") && exempt.size >= 2) {
			const headings = parseHeadings(serialize(this.bare));
			for (let i = 0; i < headings.length - 1; i++) {
				if (
					exempt.has(headings[i].lineIndex) &&
					exempt.has(headings[i + 1].lineIndex) &&
					headings[i + 1].level > headings[i].level
				) {
					this.cov.whitelistSubtreeWithChildren = true;
					break;
				}
			}
		}
	}

	private detectLevelJump(): void {
		const hs = this.bare.filter(
			(l): l is Extract<Line, { kind: "heading" }> => l.kind === "heading",
		);
		for (let i = 1; i < hs.length; i++) {
			if (hs[i].level - hs[i - 1].level >= 2) {
				this.cov.levelJump = true;
				return;
			}
		}
	}

	/**
	 * **幂等性记分板**（explore 模式）：对刚触发得到的文本**再触发一次**，必须不变
	 * （`renumber(renumber(x)) === renumber(x)`，见 testplan §1「幂等性总断言」）。
	 *
	 * 它**恒成立、与配置无关**，故能容纳放开的约束（字母样式 / inherit×非空前后缀）与脏激励
	 * （就地脏编辑 / 手动破坏前缀）——这些会让「裸文档参考模型」因既定取舍（E5/L1）误报，而幂等性不会。
	 * 它逮的是「再触发就变样」的**非定点叠加**（旧前缀没剥净、下一次又叠一层且与上次不同）。
	 *
	 * > 局限：若叠加后的形态本身已是**定点**（再触发不变，如 L1 残留 `1 a) 标题`），幂等性逮不到——
	 * > 那类「定点但错」的残留由默认模式的参考模型在受约束空间里把守。两记分板**互补**。
	 */
	private checkIdempotent(template: Template): void {
		const once = this.rendered.join("\n"); // = 本次触发输出（已写回 rendered）。
		const twice = renumberContent(once, template, this.opts);
		if (twice !== once) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`幂等性失败（连续触发两次不一致 → 旧前缀未剥净 / 非定点叠加）\n  1× : ${JSON.stringify(
					once,
				)}\n  2× : ${JSON.stringify(twice)}`,
			);
		}
	}

	/** 记分板：DUT 输出必须等于「裸文档真值直接编号」，且层级 / 原样行不被改写。 */
	private check(template: Template): void {
		const dut = this.rendered.join("\n");
		const reference = renumberContent(serialize(this.bare), template, this.opts);
		if (dut !== reference) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`参考模型不一致（旧前缀未被剥净 / 叠加）\n  DUT  : ${JSON.stringify(dut)}\n  期望 : ${JSON.stringify(
					reference,
				)}\n  裸文档 : ${JSON.stringify(serialize(this.bare))}`,
			);
		}
		// 结构不变量：标题级别数量与顺序不被改写（插件只增删前缀、绝不动 #）。
		const dutLevels = headingLevels(dut);
		const bareLevels = this.bare
			.filter((l): l is Extract<Line, { kind: "heading" }> => l.kind === "heading")
			.map((l) => l.level);
		// 注：被栅栏夹住的标题不计入——参考与 DUT 同口径，这里仅核对二者一致即可。
		const refLevels = headingLevels(reference);
		if (dutLevels.join(",") !== refLevels.join(",")) {
			throw new SequenceError(
				this.seed,
				this.trace,
				`标题层级被改写：DUT=${dutLevels} 参考=${refLevels} 裸=${bareLevels}`,
			);
		}
	}
}

/** 提取一段文本里（代码块外）各标题的级别序列。复用解析器口径以与 DUT 一致。 */
function headingLevels(text: string): number[] {
	// 轻量解析：仅供结构断言，规则与 parser 一致（栅栏外、行首 1–6 个 #）。
	const lines = text.split("\n");
	const out: number[] = [];
	let inFence = false;
	let fenceChar = "";
	for (const line of lines) {
		const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
		if (f) {
			const c = f[1][0];
			if (!inFence) {
				inFence = true;
				fenceChar = c;
			} else if (c === fenceChar) {
				inFence = false;
				fenceChar = "";
			}
			continue;
		}
		if (inFence) continue;
		const m = line.match(/^(#{1,6})[ \t]+/);
		if (m) out.push(m[1].length);
	}
	return out;
}

/** 跑一条序列：给定种子与操作步数，全程在记分板监督下随机推进。失败抛 {@link SequenceError}。 */
export function runSequence(
	seed: number,
	ops: number,
	cov: Coverage,
	cfg: GenConfig = DEFAULT_GEN,
): void {
	const rng = new Rng(seed);
	const world = new World(rng, seed, cov, cfg);
	for (let i = 0; i < ops; i++) {
		world.step();
	}
	world.finish();
}
