/**
 * 单文件开关（frontmatter）读取（见 README 3.2）。
 *
 * 插件**仅读取**一个 frontmatter 键 `obsidian-auto-headings`，用于局部控制单个文件：
 * - 合法值仅 `true` 与 `false`（YAML 布尔值，对应 Obsidian 复选框属性）。
 * - `false`：即便面板全局开关为「开」，该文件也不被处理。
 * - `true` 或该键缺省：跟随面板全局开关（`true` 额外强制开启，见下）。
 * - `true`：文件级**强制**自动编号（覆盖全局关）。
 * - 非法值（非 `true`/`false`，含旧版 `ON`/`OFF` 文本）：忽略该键，按缺省处理（跟随全局开关）。
 *
 * 注意：仍手写解析而非依赖 Obsidian 的 YAML 解析器，避免引入运行时依赖。
 * 识别时对值做字符串比对（含去引号），布尔 `true`/`false` 或带引号的 `"true"`/`"false"` 均认。
 */

/** 单文件开关的判定结果：`true`（强制开）/ `false`（强制关）/ `null`（缺省或非法，跟随全局开关）。 */
export type FileSwitch = boolean | null;

/** 插件读取的唯一 frontmatter 键；同时用于向 Obsidian 注册复选框属性类型。 */
export const SWITCH_KEY = "obsidian-auto-headings";

/**
 * 从文件原始内容中读取单文件开关。
 *
 * frontmatter 必须位于文件**最开头**：第一行恰为 `---`，并由其后的 `---`（或 `...`）闭合。
 * 在该区块内查找首个 `obsidian-auto-headings` 键，按上述规则判定。
 */
export function readFileSwitch(content: string): FileSwitch {
	const lines = content.split("\n");
	// frontmatter 必须从第一行的 `---` 开始（允许行尾的 \r）。
	if (lines.length === 0 || lines[0].replace(/\r$/, "").trim() !== "---") {
		return null;
	}

	// 查找闭合行。
	let end = -1;
	for (let i = 1; i < lines.length; i++) {
		const t = lines[i].replace(/\r$/, "").trim();
		if (t === "---" || t === "...") {
			end = i;
			break;
		}
	}
	if (end === -1) {
		return null; // 未闭合的 frontmatter，按缺省处理。
	}

	for (let i = 1; i < end; i++) {
		const line = lines[i].replace(/\r$/, "");
		const colon = line.indexOf(":");
		if (colon === -1) {
			continue;
		}
		const key = line.slice(0, colon).trim();
		if (key !== SWITCH_KEY) {
			continue;
		}
		let value = line.slice(colon + 1).trim();
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

	return null;
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
