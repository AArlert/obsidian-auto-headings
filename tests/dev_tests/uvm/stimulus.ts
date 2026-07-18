/**
 * UVM 框架的激励取样池：标题 / 白名单词 / 序号与分隔符样式 / 前后缀候选 / 层级 /
 * 就地编辑碎片，以及仓库模型用的文件路径与路径规则模式池。
 */

import type { NumeralStyle, WhitelistEntry } from "../../../src/numbering";

/** 标题文本池：覆盖普通、含 latin、"自食前缀"（2024 总结 / 实现 1.2）、白名单词、空标题。 */
export const TITLES = [
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
export const WHITELIST_WORDS = ["目录", "附录", "参考文献", "小结", "概述"];
/** 白名单匹配方式池（含 subtree，专为覆盖子树豁免与「子标题错挂」边界）。 */
export const MATCH_MODES: WhitelistEntry["match"][] = ["exact", "partial", "subtree"];
/**
 * "自食前缀"型标题：本身以**数字**开头（如 `2024 总结`），会被 arabic 剥离器按预期吃掉
 * （spec §2.3 既定取舍）。
 *
 * **不再按前缀是否为空回避**（旧版有 `TOKEN_STARTING` 过滤，对应 testplan L2 约束）：方案 A 让剥离
 * 时**恒把「空前缀」纳入候选**，故无论模板前缀是否非空，裸标题「2024 总结」都会被对称地吃掉
 * （`第1 总结` / `1 总结`），参考模型恒一致。配合「只剥一层」，`1 2024 总结`（用户在序号后补回数字）
 * 又能稳定保留——这正是 L2 被修复、约束得以放开的体现（E5 静态测试覆盖 `1 2024` 保留）。
 */
export const SELF_EATING = new Set(["2024 总结", "100% 覆盖"]);

/**
 * 随机变换用的序号样式池：**仅 always-strippable 三种**（arabic / cjk / circled）。
 *
 * 刻意**排除字母样式**（lower/upper-alpha）：它们不在 numbering.ts 的 `ALWAYS_STRIPPABLE_STYLES`
 * 里（为避免把「API」这类英文起头标题误当字母序号吃掉）。后果是——当某级**从字母样式改走**、
 * 且此后无任何级别再用字母时，残留的旧字母前缀（如 `A）`）剥不掉、会叠加。这是**有意的取舍**（不是
 * 状态转移 bug），字母样式的渲染与同样式往返已由静态测试（"非 arabic 序号样式" 块）覆盖，故随机
 * 序列里不混入字母样式的相互切换，以保持参考模型一致、CI 常绿。
 */
export const NUMERALS: NumeralStyle[] = ["arabic", "cjk", "circled"];
export const NUMBER_SEPS = [".", "-", "·", ")", "．"];
export const TITLE_SEPS = [" ", "、", ". ", "。", "： "];
/** 非空前缀 / 后缀候选（每条序列各定一个，序列内在「空 ↔ 该候选」间随机切换，验证 B2/B3）。 */
export const PREFIX_CANDIDATES = ["第", "（"];
export const SUFFIX_CANDIDATES = ["章", "）"];
/** 标题级别取样（偏向 H2–H4，但也覆盖 H1/H5/H6）。 */
export const LEVEL_POOL = [1, 2, 2, 3, 3, 3, 4, 4, 5, 6];

/**
 * **字母 / 罗马数字样式**（lower/upper-alpha, lower/upper-roman）：仅 explore 模式纳入随机样式池。
 * 默认仍按 L1 取舍排除（见框架顶部注释）；explore 放开以撞「改走字母/罗马后残留」「自食标题」等。
 */
export const NUMERALS_WITH_ALPHA: NumeralStyle[] = [
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
export const SAFE_FRAGMENTS = ["补充", "说明", "细节", "续", "草稿"];

/**
 * explore 模式的**脏碎片**：以分隔符 / 数字 / 字母 / 空白起头，专门撞**容差剥离的误伤边界**
 * （标题首字符恰落入「标题间隔符容差类」或「序号 token」时是否被吃掉）。
 */
export const MESSY_FRAGMENTS = ["-注", ".5", "、附", "2024 ", "a) ", "  ", ") ", "."];

/** explore 模式额外的**分隔符 / 符号起头标题**（裸态即以容差类字符起头）。 */
export const MESSY_TITLES = ["- 列表式标题", ". 点起头", "、顿号起头", ") 右括起头", "1.2 像子号"];

/** 仓库内可用的文件路径池（含多层文件夹，供文件夹规则 / 文件规则 / 子树匹配）。 */
export const FILE_PATHS = [
	"笔记.md",
	"Projects/规划.md",
	"Projects/sub/细节.md",
	"读书/深度工作.md",
	"归档/old.md",
];
/** 路径规则模式池：根 / 各级文件夹 / 精确文件（具体度递增，供 resolvePathRule 解析压测）。 */
export const RULE_PATTERNS = [
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
export const ANCHOR_TEMPLATE = "默认";
