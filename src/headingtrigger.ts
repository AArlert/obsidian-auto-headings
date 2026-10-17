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
import { normalizeForWhitelist } from "./whitelist";

const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
/** 触发词回溯扫描的安全上限（码点数），防御无标点大段文本的病态情形（方案 §3.4，可调常量）。 */
export const MAX_TOKEN_LENGTH = 80;
/**
 * 最低触发权重（testplan Q27，issue #10）：中日韩字符记 2、其他字符记 1，合计不足即不触发——
 * 中文至少 3 字、英文至少 6 字母。
 *
 * 为什么不是 1.0.29 的「至少 2 个字符」：本功能没有触发字符，正文里每次按键都在匹配；2 个字
 * 的「项目」「总结」、4 个字母的「json」在稍大的库里几乎必然撞上某个标题开头，用户反馈
 * 「随便打两三个字都弹框」。按字数加权而非统一码点数，是因为一个汉字的信息量约抵两三个字母：
 * 统一按码点算，要么中文门槛太高，要么英文门槛太低。
 */
export const MIN_TRIGGER_WEIGHT = 6;

const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** 触发权重：中日韩字符记 2，其他（拉丁字母、数字等）记 1；按码点计。 */
export function triggerWeight(text: string): number {
	let w = 0;
	for (const ch of text) {
		w += CJK_CHAR_RE.test(ch) ? 2 : 1;
	}
	return w;
}

/**
 * 从「光标之前的整行文本」里提取候选触发词；返回词本身与其起始列偏移（UTF-16 code unit）。
 *
 * 规则：向左扫描，只要字符是 Unicode 字母或数字（`\p{L}`/`\p{N}`，天然覆盖中日韩 / 拉丁 /
 * 数字，无需手工列举标点黑名单）就继续纳入；遇到第一个非字母数字字符（含空白、标点、行首）
 * 即停止。权重不足 {@link MIN_TRIGGER_WEIGHT} 或超过 {@link MAX_TOKEN_LENGTH} 时返回 null。
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
	if (triggerWeight(token) < MIN_TRIGGER_WEIGHT) {
		return null;
	}
	return { token, start: i };
}

/**
 * 把触发词展开为「按用户已输入量从多到少」的匹配候选：整段优先，其后是逐字剥掉开头字符
 * 得到的各级后缀（权重 ≥ {@link MIN_TRIGGER_WEIGHT}）。
 *
 * 为什么需要后缀（testplan Q22，用户实测「一笔事务」）：触发词提取只认「连续字母数字段」，
 * 而中文正文没有词边界——已有「一个」再接着打「交叉矩阵」会被整段吞成一个 token，与标题
 * 【交叉矩阵】的前缀匹配必然失败（换成「哈哈，交叉矩阵」则因逗号断开而正常）。放宽到后缀
 * 即可命中；后缀同样要过权重门槛。后缀怎样才算命中见 {@link resolveTriggerQuery}。
 *
 * `start` 是该候选在**原行**中的列偏移（UTF-16 code unit），由调用方用作替换区间起点。
 * 按**码点**切分（`Array.from`）而非 code unit，避免把代理对劈成半个字符。
 */
export function suffixCandidates(
	token: string,
	tokenStart: number,
): Array<{ text: string; start: number }> {
	const chars = Array.from(token);
	const out: Array<{ text: string; start: number }> = [];
	for (let cut = 0; cut < chars.length; cut++) {
		const text = chars.slice(cut).join("");
		if (triggerWeight(text) < MIN_TRIGGER_WEIGHT) {
			break; // 后缀越剥越短，权重单调不增
		}
		out.push({ text, start: tokenStart + (token.length - text.length) });
	}
	return out;
}

/** {@link resolveTriggerQuery} 需要的索引侧判定（`HeadingIndex` 的两个廉价查询）。 */
export interface TriggerIndexProbe {
	/** 是否存在 matchKey 以该串为前缀的标题。 */
	hasAnyPrefixMatch(normalizedQuery: string): boolean;
	/** 是否存在 matchKey 恰好等于该串的标题。 */
	hasExactMatch(normalizedQuery: string): boolean;
}

/**
 * 在 {@link suffixCandidates} 里挑出「用户输入量最多、且索引中确有命中」的那一个，
 * 返回它的原文、替换起点与归一化查询串；全都落空时返回 null（onTrigger 让路）。
 *
 * **命中标准分两档**（testplan Q28，issue #10）：整段（从词边界开始，用户大概率是在打一个新词）
 * 按**前缀**匹配，边打边出候选；从连写中间截出来的后缀只认**完整等于**某个标题。1.0.29 后缀
 * 也按前缀匹配，于是任何一句话的末尾两三个字只要碰巧是某标题的开头就弹框（「当前项目」→
 * 【项目级…】）——后缀本来就是猜测的词边界，再叠一层前缀猜测，误报成倍放大。
 *
 * **`start` 必须是被匹配上的那一段的起点，不是整个 token 的起点**——接受建议时
 * `selectSuggestion` 替换的是 `[start, 光标)` 区间，用整段起点会把没参与匹配的前半截
 * （「一笔事务」里的「一笔」）连带吃掉。同理，归一化查询串取的是**该后缀**而非整段，
 * 否则 {@link sortEntries} 的「精确匹配优先」判据永远不成立。
 *
 * @param probe 索引侧的廉价判定（`HeadingIndex` 本身即满足），注入进来使本函数保持纯函数
 *   可测；onTrigger 每次按键都跑，故用它而非收集结果的 `queryPrefix`。
 */
export function resolveTriggerQuery(
	token: string,
	tokenStart: number,
	probe: TriggerIndexProbe,
): { text: string; start: number; query: string } | null {
	for (const candidate of suffixCandidates(token, tokenStart)) {
		const query = normalizeForWhitelist(candidate.text);
		if (!query) {
			continue;
		}
		const isWholeToken = candidate.start === tokenStart;
		if (isWholeToken ? probe.hasAnyPrefixMatch(query) : probe.hasExactMatch(query)) {
			return { ...candidate, query };
		}
	}
	return null;
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
