/**
 * 按路径配置：路径规则的数据模型与解析（Milestone 5，见 spec.md §3.8）。
 *
 * 一条**路径规则**把一个「路径模式」映射到一个模板名。某文件命中某条规则时，便用该规则
 * 指定的模板（连同其各级格式与白名单）为它编号。本模块是**纯函数**（不依赖 Obsidian 运行时），
 * 故可独立单测（见 `tests/dev_tests/pathrules.test.ts`）。
 *
 * **路径模式的两类写法（按 GUI 约定）：**
 * - **文件夹规则**：以 `/` 结尾（如 `Projects/`），匹配该文件夹及其**全部子项**。
 * - **文件规则**：不以 `/` 结尾（如 `读书笔记/深度工作.md`），仅**精确匹配**该文件。
 * - **根规则 `/`**：特殊的文件夹规则，匹配仓库下**所有文件**，是具体度最低的兜底（即「全局默认」）。
 * - **未配置（空串）**：GUI 新增规则行的初始状态，**不匹配任何文件**，与根规则 `/` 严格区分（见 `normalizePattern`）。
 *
 * **解析逻辑（见 spec.md §3.8）：**
 * 1. 收集所有与当前文件匹配的规则（`/` 根规则匹配所有文件）。
 * 2. **最具体**者优先：精确文件路径 ＞ 最长文件夹前缀 ＞ `/` 根规则。
 * 3. 具体度并列时（如两条不同文件夹名恰好等长）**行号更大**（列表中靠后）者胜出——这是**确定性
 *    兜底**，不是推荐用法；**两条规则的路径模式归一化后完全相同**属于用户误操作，GUI 层从
 *    0.7.23 起直接**阻断保存**（`findDuplicatePatternIndex`），不再允许静默产生（testplan K12）。
 * 4. 无任何规则匹配（含 `/` 根规则被删的情形）：返回 `null`——该文件**无可用模板**。
 */

/** 一条路径规则：把路径模式映射到模板名。持久化于 `data.json` 的 `pathRules` 数组。 */
export interface PathRule {
	/** 路径模式：`/`（根）、`Foo/`（文件夹）、`Foo/bar.md`（文件）。 */
	pattern: string;
	/** 命中时使用的模板名（即 `templates/*.json` 的模板显示名）。 */
	template: string;
}

/**
 * 归一化路径模式：折叠反斜杠与重复斜杠、去首尾空白；`/` 视为根。
 * 非根模式去掉前导 `/` 与 `./`（Obsidian 文件路径相对仓库根、不带前导斜杠）。
 *
 * **空串 `""` 单独返回 `""`（不折算为根）**：新增规则行的初始 `pattern` 即为 `""`，代表
 * 「尚未填写路径」的未配置状态，与用户显式输入 `/` 意在表达根规则是两回事——若把它也当根，
 * 用户新增一行、还没来得及输路径就先点了模板下拉，会立刻把该行当根规则套用到全部文件并触发
 * 编号（testplan K11 已报告的 bug）。`ruleMatches` 对空串一律不匹配，`hasRootRule` 也不会
 * 误判这类未配置行为已有根规则。
 */
function normalizePattern(pattern: string): string {
	const p = pattern.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
	if (p === "") {
		return "";
	}
	if (p === "/") {
		return "/";
	}
	const stripped = p.replace(/^\.?\//, "");
	return stripped === "" ? "/" : stripped;
}

/** 归一化文件路径：折叠反斜杠与重复斜杠、去前导 `/` 与 `./` 及首尾空白。 */
function normalizeFilePath(filePath: string): string {
	const p = filePath.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
	return p.replace(/^\.?\//, "");
}

/** 某模式是否为文件夹规则（根 `/` 或以 `/` 结尾）。 */
function isFolderPattern(normalized: string): boolean {
	return normalized === "/" || normalized.endsWith("/");
}

/**
 * 判断某路径模式是否匹配给定文件路径。
 * - 空串（未配置）：不匹配任何文件。
 * - 根 `/`：匹配所有文件。
 * - 文件夹 `Foo/`：匹配路径以 `Foo/` 开头的文件（含深层子项）。
 * - 文件 `Foo/bar.md`：仅精确相等时匹配。
 */
export function ruleMatches(pattern: string, filePath: string): boolean {
	const p = normalizePattern(pattern);
	if (p === "") {
		// 未配置路径的规则（新增行尚未填写）不匹配任何文件。
		return false;
	}
	const f = normalizeFilePath(filePath);
	if (p === "/") {
		return true;
	}
	if (p.endsWith("/")) {
		return f.startsWith(p);
	}
	return f === p;
}

/**
 * 路径模式的**具体度**评分（越大越具体），用于解析时挑选最具体的匹配：
 * - 根 `/`：`0`（最低）。
 * - 文件夹：按归一化后的字符长度（更长 = 更深 = 更具体）。
 * - 文件：在文件夹之上加一个足够大的基数，确保**任何精确文件匹配都胜过任何文件夹匹配**。
 */
export function ruleSpecificity(pattern: string): number {
	const p = normalizePattern(pattern);
	if (p === "/") {
		return 0;
	}
	if (isFolderPattern(p)) {
		return p.length;
	}
	// 文件规则：恒高于一切文件夹规则。
	return 1_000_000 + p.length;
}

/**
 * 解析当前文件应使用的路径规则。
 *
 * 返回命中的、**最具体**的规则（具体度并列时取列表中靠后者——这只是遗留/异常数据下的确定性
 * 兜底，正常操作下 GUI 已阻断产生路径模式完全重复的规则，见 `findDuplicatePatternIndex`）；
 * 无任何规则匹配时返回 `null`（该文件无可用模板，调用方据此决定静默跳过或提示，见 spec.md
 * §3.8 第 4 条）。
 */
export function resolvePathRule(rules: PathRule[], filePath: string): PathRule | null {
	let best: PathRule | null = null;
	let bestSpec = -1;
	rules.forEach((rule) => {
		if (!ruleMatches(rule.pattern, filePath)) {
			return;
		}
		const spec = ruleSpecificity(rule.pattern);
		// `>=` 配合正向遍历：并列时后出现的规则覆盖先前的（行号更大者胜出）。
		if (spec >= bestSpec) {
			best = rule;
			bestSpec = spec;
		}
	});
	return best;
}

/** 列表中是否存在根规则（`/`）。用于「兜底缺失提示条」的判定（见 spec.md §3.8）。 */
export function hasRootRule(rules: PathRule[]): boolean {
	return rules.some((rule) => normalizePattern(rule.pattern) === "/");
}

/**
 * 检测 `rules[index]` 的路径模式是否与列表中**其它**规则重复（归一化后完全相同）。
 * 未配置的空串不参与判定（本就不匹配任何文件，谈不上「重复」）。返回首个冲突规则的下标；
 * 无冲突返回 `-1`。GUI 在提交路径编辑（新增/改路径）时据此**阻断保存**，强制路径模式唯一
 * （用户报告：两条规则同填 `/`、各投不同模板，编号结果取决于哪条「更靠后」，体验极不直观；
 * 见 spec.md §3.8、testplan K12）。
 */
export function findDuplicatePatternIndex(rules: PathRule[], index: number): number {
	const target = normalizePattern(rules[index]?.pattern ?? "");
	if (target === "") {
		return -1;
	}
	for (let i = 0; i < rules.length; i++) {
		if (i !== index && normalizePattern(rules[i].pattern) === target) {
			return i;
		}
	}
	return -1;
}
