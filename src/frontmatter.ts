/**
 * 单文件开关（frontmatter）读写（见 README 3.2）。
 *
 * 插件只碰一个 frontmatter 键 `obsidian-auto-headings`，用于局部控制单个文件：
 * - 合法值仅 `true` 与 `false`（YAML 布尔值，对应 Obsidian 复选框属性）。
 * - `false`：即便面板全局开关为「开」，该文件也不被处理。
 * - `true` 或该键缺省：跟随面板全局开关（`true` 额外强制开启，见下）。
 * - `true`：文件级**强制**自动编号（覆盖全局关）。
 * - 非法值（非 `true`/`false`，含旧版 `ON`/`OFF` 文本）：忽略该键，按缺省处理（跟随全局开关）。
 *
 * 注意：仍手写解析而非依赖 Obsidian 的 YAML 解析器，避免引入运行时依赖。
 * 识别时对值做字符串比对（含去引号），布尔 `true`/`false` 或带引号的 `"true"`/`"false"` 均认。
 *
 * **写入侧**（1.0.15，见 spec.md §3.19）只产出「编辑计划」{@link SwitchEdit} 而不直接改字符串——
 * 调用方（`main.ts`）要把它并进**同一个** `editor.transaction`，与清除编号的行级 diff 一次性写回，
 * 使「清除并暂停」只占一条撤销记录。返回整行级别的插入 / 替换 / 删除，避免在此处依赖编辑器类型。
 */

/** 单文件开关的判定结果：`true`（强制开）/ `false`（强制关）/ `null`（缺省或非法，跟随全局开关）。 */
export type FileSwitch = boolean | null;

/** 插件读取的唯一 frontmatter 键；同时用于向 Obsidian 注册复选框属性类型。 */
export const SWITCH_KEY = "obsidian-auto-headings";

/**
 * 定位 frontmatter 区块的闭合行下标（开头恒为第 0 行的 `---`）。
 * 无 frontmatter、或有开头但**未闭合**（畸形）时返回 `-1`——两种情况都按「无 frontmatter」处理，
 * 读取侧跟随全局开关，写入侧则保守地拒绝改写（见 {@link planPauseFileSwitch}）。
 */
function findFrontmatterEnd(lines: readonly string[]): number {
	if (lines.length === 0 || lines[0].replace(/\r$/, "").trim() !== "---") {
		return -1;
	}
	for (let i = 1; i < lines.length; i++) {
		const t = lines[i].replace(/\r$/, "").trim();
		if (t === "---" || t === "...") {
			return i;
		}
	}
	return -1; // 未闭合。
}

/** 在 frontmatter 区块内查找本插件那个键所在的行下标；没有则返回 `-1`。 */
function findSwitchLine(lines: readonly string[], end: number): number {
	for (let i = 1; i < end; i++) {
		const line = lines[i].replace(/\r$/, "");
		const colon = line.indexOf(":");
		if (colon !== -1 && line.slice(0, colon).trim() === SWITCH_KEY) {
			return i;
		}
	}
	return -1;
}

/** 把 `key: value` 行的值部分解析成开关值（去成对引号；非 `true`/`false` 一律记为非法 → `null`）。 */
function parseSwitchValue(line: string): FileSwitch {
	let value = line
		.replace(/\r$/, "")
		.slice(line.indexOf(":") + 1)
		.trim();
	// 去除成对的引号，使 `"true"` / `'false'` 也能识别。
	if (
		value.length >= 2 &&
		((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'")))
	) {
		value = value.slice(1, -1);
	}
	if (value === "true") {
		return true;
	}
	if (value === "false") {
		return false;
	}
	return null; // 非法值（含旧版 ON/OFF）：忽略该键，跟随全局开关。
}

/**
 * 从文件原始内容中读取单文件开关。
 *
 * frontmatter 必须位于文件**最开头**：第一行恰为 `---`，并由其后的 `---`（或 `...`）闭合。
 * 在该区块内查找首个 `obsidian-auto-headings` 键，按上述规则判定。
 */
export function readFileSwitch(content: string): FileSwitch {
	const lines = content.split("\n");
	const end = findFrontmatterEnd(lines);
	if (end === -1) {
		return null;
	}
	const keyLine = findSwitchLine(lines, end);
	return keyLine === -1 ? null : parseSwitchValue(lines[keyLine]);
}

/**
 * 判断某文件是否被 frontmatter 明确关闭。仅当开关值恰为 `false` 时返回 `true`。
 * 缺省、`true`、非法值均返回 `false`（即跟随全局开关）。
 */
export function isDisabledByFrontmatter(content: string): boolean {
	return readFileSwitch(content) === false;
}

/**
 * 判断某文件是否被 frontmatter 明确**强制开启**（文件级强制 opt-in，见 spec.md §3.2）。
 * 仅当开关值恰为 `true` 时返回 `true`——此时即便「全局自动编号」为关，该文件仍参与自动编号。
 * 缺省、`false`、非法值均返回 `false`。
 */
export function isForcedOnByFrontmatter(content: string): boolean {
	return readFileSwitch(content) === true;
}

/**
 * 一份**整行级**的 frontmatter 编辑计划，由调用方翻译成编辑器事务里的一条变更。
 *
 * 之所以不直接返回改好的字符串：`main.ts` 的 `writeLineDiff` 按「整文件重写永不增删行」的前提做
 * 逐行索引比对，往顶部插几行会让其后所有行错位。给出「从第几行起、吃掉几行、写入哪几行」，
 * 调用方即可把它和行替换合并进同一事务（CM6 的变更集一律按**原文档**坐标计算，互不干扰）。
 */
export interface SwitchEdit {
	/** 起始行下标（0 基，相对原内容）。 */
	startLine: number;
	/** 从 `startLine` 起消耗的原有行数；`0` 表示纯插入。 */
	removedLines: number;
	/** 写入的整行文本（不含换行符）；空数组表示纯删除。 */
	lines: string[];
}

/** 按原内容的换行风格给生成的行补上 `\r`——避免往 CRLF 文件里插进孤立的 LF 行。 */
function matchEol(lines: string[], content: string): string[] {
	return content.includes("\r\n") ? lines.map((l) => `${l}\r`) : lines;
}

/**
 * 规划「暂停该文件的自动编号」所需的 frontmatter 改动（写入 `obsidian-auto-headings: false`）。
 *
 * 用于「清除当前文件编号」——此前该命令只取消当前那一个待处理防抖计时器，下一次按键就重新编号，
 * 因此只要「全局自动编号」开着，它**永远不可能产生持久效果**（testplan H13）。复用既有的单文件开关
 * 而非新造一份暂停状态：它写在文件里、用户看得见改得动，且每条自动触发路径本就尊重它。
 *
 * 四种形态：无 frontmatter → 在文件最前新建区块；有区块但无该键 → 插在闭合符之前（保留用户原有
 * 键序）；该键存在但值不是 `false` → 就地替换那一行；已经是 `false` → 返回 `null`（无需改动）。
 * frontmatter **未闭合**（畸形）时同样返回 `null`：保守跳过，不去猜用户想要什么。
 */
export function planPauseFileSwitch(content: string): SwitchEdit | null {
	const lines = content.split("\n");
	const end = findFrontmatterEnd(lines);
	const entry = `${SWITCH_KEY}: false`;

	if (end === -1) {
		// 有 `---` 开头却没闭合 = 畸形，不碰；真正没有 frontmatter 才新建区块。
		if (lines.length > 0 && lines[0].replace(/\r$/, "").trim() === "---") {
			return null;
		}
		return {
			startLine: 0,
			removedLines: 0,
			lines: matchEol(["---", entry, "---"], content),
		};
	}

	const keyLine = findSwitchLine(lines, end);
	if (keyLine === -1) {
		return { startLine: end, removedLines: 0, lines: matchEol([entry], content) };
	}
	if (parseSwitchValue(lines[keyLine]) === false) {
		return null; // 已经是暂停状态。
	}
	return { startLine: keyLine, removedLines: 1, lines: matchEol([entry], content) };
}

/**
 * 规划「恢复该文件的自动编号」所需的 frontmatter 改动（移除 `obsidian-auto-headings: false`）。
 *
 * 用于「立即重新编号」，与 {@link planPauseFileSwitch} 构成对称闭环：清除即暂停、重新编号即恢复
 * （testplan H15）。**只在值恰为 `false` 时动手**——`true` 是用户的文件级强制 opt-in，不是本命令的
 * 管辖范围。若移除后区块内只剩空行（即该键本就是唯一一项，多半正是清除命令自己建的），整个
 * `---` 区块一并移除，不给用户留一个空壳。
 */
export function planResumeFileSwitch(content: string): SwitchEdit | null {
	const lines = content.split("\n");
	const end = findFrontmatterEnd(lines);
	if (end === -1) {
		return null;
	}
	const keyLine = findSwitchLine(lines, end);
	if (keyLine === -1 || parseSwitchValue(lines[keyLine]) !== false) {
		return null;
	}

	const onlyEntry = lines
		.slice(1, end)
		.every((l, i) => i + 1 === keyLine || l.replace(/\r$/, "").trim() === "");
	return onlyEntry
		? { startLine: 0, removedLines: end + 1, lines: [] }
		: { startLine: keyLine, removedLines: 1, lines: [] };
}
