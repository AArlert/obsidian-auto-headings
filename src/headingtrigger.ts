/**
 * 标题链接建议的触发边界与链接构造（M13，见 spec.md Roadmap M13 与 doc/research 方案 §3.4/§3.5）。
 *
 * 纯字符串运算，无 Obsidian 依赖，可纯函数单测。
 *
 * 与 `[[` 补全不同，本功能没有触发字符——用户在普通正文里打字本身就是触发。故触发边界的
 * 提取是「从光标沿当前行向左回溯连续字母数字段」，再叠加上下文屏蔽（标题行 / `#` 标签 /
 * 未闭合 `[[` / 紧邻单个 `[`）避免抢戏。
 */

import type { HeadingIndexEntry } from "./headingindex";

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
/** 触发词回溯扫描的安全上限（码点数），防御无标点大段文本的病态情形（方案 §3.4，可调常量）。 */
export const MAX_TOKEN_LENGTH = 80;
/** 最短触发长度：太短的前缀候选过多、噪音大（方案 §3.4，可调常量）。 */
export const MIN_QUERY_LENGTH = 2;

/**
 * 从「光标之前的整行文本」里提取候选触发词；返回词本身与其起始列偏移（UTF-16 code unit）。
 *
 * 规则：向左扫描，只要字符是 Unicode 字母或数字（`\p{L}`/`\p{N}`，天然覆盖中日韩 / 拉丁 /
 * 数字，无需手工列举标点黑名单）就继续纳入；遇到第一个非字母数字字符（含空白、标点、行首）
 * 即停止。长度不足 {@link MIN_QUERY_LENGTH} 或超过 {@link MAX_TOKEN_LENGTH} 时返回 null。
 *
 * 已知限制（v1 明确接受，见方案 §10）：标题内部含标点时只有标点之后的连续字母数字段能被匹配。
 */
export function extractTriggerToken(
	lineTextBeforeCursor: string,
): { token: string; start: number } | null {
	const s = lineTextBeforeCursor;
	let i = s.length;
	let steps = 0;
	while (i > 0 && steps < MAX_TOKEN_LENGTH && WORD_CHAR_RE.test(s[i - 1])) {
		i--;
		steps++;
	}
	const token = s.slice(i);
	if (token.length < MIN_QUERY_LENGTH) {
		return null;
	}
	return { token, start: i };
}

/**
 * 是否应放弃本次触发（方案 §3.4 的「礼貌规则」，避免与 Obsidian 原生补全抢戏）：
 * ① 当前行本身是 ATX 标题行——不该把「正在写的标题文本」当成「正文里提到了某标题」来建议链接；
 * ② 紧邻 `#`——标签输入上下文，让给 Obsidian 原生标签补全；
 * ③ 处于未闭合的 `[[` 内——wikilink 输入上下文，让给 Obsidian 原生链接补全（最高优先级）；
 * ④ 紧邻单个 `[`——markdown 链接文本上下文，保守让开（v1 不细分）。
 *
 * 已知限制（v1 明确接受）：围栏代码块只做同行内反引号不做全文件级扫描（onTrigger 每次按键
 * 都跑，O(文件行数) 不划算），跨行围栏块内部可能弹出建议，见方案 §10。
 */
export function isBlockedContext(
	fullLineText: string,
	lineTextBeforeCursor: string,
	tokenStart: number,
): boolean {
	if (/^\s{0,3}#{1,6}(\s|$)/.test(fullLineText)) {
		return true;
	}
	const before = lineTextBeforeCursor.slice(0, tokenStart);
	if (before.endsWith("#")) {
		return true;
	}
	const lastOpen = before.lastIndexOf("[[");
	const lastClose = before.lastIndexOf("]]");
	if (lastOpen > lastClose) {
		return true;
	}
	if (before.endsWith("[")) {
		return true;
	}
	return false;
}

/**
 * 建议排序：matchKey 与查询完全相等的优先；其余按 matchKey 长度升序（越接近精确匹配越靠前）；
 * 再按 path 字典序兜底，保证结果确定性可测。
 */
export function sortEntries(
	entries: HeadingIndexEntry[],
	normalizedQuery: string,
): HeadingIndexEntry[] {
	return [...entries].sort((a, b) => {
		const aExact = a.matchKey === normalizedQuery ? 0 : 1;
		const bExact = b.matchKey === normalizedQuery ? 0 : 1;
		if (aExact !== bExact) {
			return aExact - bExact;
		}
		if (a.matchKey.length !== b.matchKey.length) {
			return a.matchKey.length - b.matchKey.length;
		}
		return a.path.localeCompare(b.path);
	});
}

/**
 * 构造要写入编辑器的链接文本。
 * - 目标是当前活动文件自身时用 `[[#anchor|alias]]`（无文件名的同文件锚点形式，与 backlinks.ts
 *   对 `[[#锚点]]` 的既有语义一致）。
 * - 否则用 `[[basename#anchor|alias]]`。
 * - alias 恒为标题的**完整原文**（displayText，剥编号前缀后）——1.0.27 产品决策：接受建议时
 *   把用户打的残缺前缀自动补全为完整标题名（用户实测反馈「希望是完整的标题名而不是残缺的」，
 *   与 VC 词典 value 的 alias 形态一致）。
 */
export function buildHeadingLink(entry: HeadingIndexEntry, activeFilePath: string): string {
	const target = entry.path === activeFilePath ? "" : entry.basename;
	return `[[${target}#${entry.anchor}|${entry.displayText}]]`;
}
