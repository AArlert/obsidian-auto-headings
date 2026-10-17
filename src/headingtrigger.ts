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
/** 触发词的最短码点数：单个字符永远不触发（任何规则下都是噪音）。 */
export const MIN_TOKEN_CHARS = 2;

/**
 * 按**前缀**匹配所需的最低权重（testplan Q27，issue #10）：中日韩字符记 2、其他字符记 1，合计不足
 * 时只走完整命中（{@link resolveTriggerQuery}）——中文 3 字、英文 6 字母起才边打边出候选。
 *
 * 为什么不是 1.0.29 的「2 个字符起就前缀匹配」：本功能没有触发字符，正文里每次按键都在匹配；2 个字
 * 的「项目」、4 个字母的「json」在稍大的库里几乎必然撞上某个标题开头，用户反馈「随便打两三个字都
 * 弹框」。按字数加权而非统一码点数，是因为一个汉字的信息量约抵两三个字母。
 *
 * 为什么短词不干脆不触发（未发版的第一版就是这样，随即推翻）：短标题恰恰多是术语——用户主力库
 * 167 个短标题里大量是 `axi`、`uart`、`cdc`，长度门槛一刀切会把它们全部挡掉。
 */
export const MIN_PREFIX_WEIGHT = 6;

const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** 是否中日韩字符（单个码点）。 */
function isCjk(ch: string): boolean {
	return CJK_CHAR_RE.test(ch);
}

/** 触发权重：中日韩字符记 2，其他（拉丁字母、数字等）记 1；按码点计。 */
export function triggerWeight(text: string): number {
	let w = 0;
	for (const ch of text) {
		w += isCjk(ch) ? 2 : 1;
	}
	return w;
}

/**
 * 从「光标之前的整行文本」里提取候选触发词；返回词本身与其起始列偏移（UTF-16 code unit）。
 *
 * 规则：向左扫描，只要字符是 Unicode 字母或数字（`\p{L}`/`\p{N}`，天然覆盖中日韩 / 拉丁 /
 * 数字，无需手工列举标点黑名单）就继续纳入；遇到第一个非字母数字字符（含空白、标点、行首）
 * 即停止。不足 {@link MIN_TOKEN_CHARS} 个码点或超过 {@link MAX_TOKEN_LENGTH} 时返回 null。
 *
 * 已知限制（v1 明确接受，见方案 §10）：标题内部含标点时只有标点之后的连续字母数字段能被匹配。
 */
export function extractTriggerToken(
	lineTextBeforeCursor: string,
): { token: string; start: number } | null {
	const s = lineTextBeforeCursor;
	let i = s.length;
	let steps = 0;
	while (i > 0 && steps < MAX_TOKEN_LENGTH) {
		// 按码点回溯：星平面字符（「𠮷」）是代理对，单看低位代理匹配不上 \p{L}。
		const pair = i >= 2 && /[\uDC00-\uDFFF]/.test(s[i - 1]) ? 2 : 1;
		if (!WORD_CHAR_RE.test(s.slice(i - pair, i))) {
			break;
		}
		i -= pair;
		steps++;
	}
	const token = s.slice(i);
	if (Array.from(token).length < MIN_TOKEN_CHARS) {
		return null;
	}
	return { token, start: i };
}

/** {@link suffixCandidates} 的一项。 */
export interface TriggerCandidate {
	/** 候选原文。 */
	text: string;
	/** 在**原行**中的起始列（UTF-16 code unit），即接受建议时替换区间的起点。 */
	start: number;
	/**
	 * 是否起于词边界：整个 token 的开头，或中日韩字符与其他字符的交界（「用uart」里的 `uart`、
	 * 「uart接口」里的「接口」）——在中文里切输入法打出一个英文词，本身就是词边界。
	 * 其余后缀是在连写中间「猜」出来的切点，规则更严（见 {@link resolveTriggerQuery}）。
	 */
	boundary: boolean;
}

/**
 * 把触发词展开为「按用户已输入量从多到少」的匹配候选：整段优先，其后是逐字剥掉开头字符
 * 得到的各级后缀（至少 {@link MIN_TOKEN_CHARS} 个码点）。
 *
 * 为什么需要后缀（testplan Q22，用户实测）：触发词提取只认「连续字母数字段」，而中文正文没有
 * 词边界——已有「一个」再接着打「交叉矩阵」会被整段吞成一个 token，与标题【交叉矩阵】的前缀匹配
 * 必然失败（换成「哈哈，交叉矩阵」则因逗号断开而正常）。放宽到后缀即可命中。
 *
 * 按**码点**切分（`Array.from`）而非 code unit，避免把代理对劈成半个字符。
 */
export function suffixCandidates(token: string, tokenStart: number): TriggerCandidate[] {
	const chars = Array.from(token);
	const out: TriggerCandidate[] = [];
	for (let cut = 0; cut <= chars.length - MIN_TOKEN_CHARS; cut++) {
		const text = chars.slice(cut).join("");
		const boundary = cut === 0 || isCjk(chars[cut - 1]) !== isCjk(chars[cut]);
		out.push({ text, start: tokenStart + (token.length - text.length), boundary });
	}
	return out;
}

/** {@link resolveTriggerQuery} 需要的索引侧判定（均已剔除套话标题，见 `HeadingIndex`）。 */
export interface TriggerIndexProbe {
	/** 是否存在 matchKey 以该串为前缀的标题。 */
	hasAnyPrefixMatch(normalizedQuery: string): boolean;
	/** 是否存在 matchKey 恰好等于该串的标题。 */
	hasExactMatch(normalizedQuery: string): boolean;
	/** matchKey 恰好等于该串的标题是否被链接过（见 headinglinks.ts）。 */
	isLinked(normalizedQuery: string): boolean;
}

/**
 * 在 {@link suffixCandidates} 里挑出「用户输入量最多、且按规则命中」的那一个，返回它的原文、
 * 替换起点与归一化查询串；全都落空时返回 null（onTrigger 让路）。
 *
 * 命中规则（spec §3.23「触发规则」，testplan Q27/Q28/Q30/Q31）：
 *
 * | 候选 | 条件 |
 * |---|---|
 * | 起于词边界、权重 ≥ {@link MIN_PREFIX_WEIGHT} | 有标题以它开头 |
 * | 起于词边界、权重不足、不含中日韩字符 | 完整等于某标题 |
 * | 起于词边界、权重不足、含中日韩字符 | 完整等于某标题，且该标题被链接过 |
 * | 连写中间的后缀 | 完整等于某标题，且（权重 ≥ {@link MIN_PREFIX_WEIGHT} 或被链接过） |
 *
 * 道理：前缀匹配是在猜「用户想打哪个标题」，只有输入量够大才猜得准；完整命中不用猜，但短词常是
 * 普通词——英文短词在中文笔记里多是有意打的术语，中文两字词则靠「被链接过」证明它是个概念。
 * 连写中间的切点本身是猜的，不再叠加前缀猜测（1.0.29 叠加过，「当前项目」→【项目级…】就是这样来的）。
 *
 * **`start` 必须是被匹配上的那一段的起点，不是整个 token 的起点**——接受建议时
 * `selectSuggestion` 替换的是 `[start, 光标)` 区间，用整段起点会把没参与匹配的前半截
 * （「一个交叉矩阵」里的「一个」）连带吃掉。同理，归一化查询串取的是**该后缀**而非整段，
 * 否则 {@link sortEntries} 的「精确匹配优先」判据永远不成立。
 *
 * @param probe 索引侧的廉价判定，注入进来使本函数保持纯函数可测；onTrigger 每次按键都跑。
 */
export function resolveTriggerQuery(
	token: string,
	tokenStart: number,
	probe: TriggerIndexProbe,
): { text: string; start: number; query: string } | null {
	for (const candidate of suffixCandidates(token, tokenStart)) {
		const query = normalizeForWhitelist(candidate.text);
		if (query && candidateHits(candidate, query, probe)) {
			return { text: candidate.text, start: candidate.start, query };
		}
	}
	return null;
}

/** {@link resolveTriggerQuery} 的命中规则表（单个候选）。 */
function candidateHits(c: TriggerCandidate, query: string, probe: TriggerIndexProbe): boolean {
	const longEnough = triggerWeight(c.text) >= MIN_PREFIX_WEIGHT;
	if (c.boundary && longEnough) {
		return probe.hasAnyPrefixMatch(query);
	}
	if (!probe.hasExactMatch(query)) {
		return false;
	}
	if (c.boundary) {
		return !Array.from(c.text).some(isCjk) || probe.isLinked(query);
	}
	return longEnough || probe.isLinked(query);
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

/** {@link sortEntries} 的可选排序信号。 */
export interface SortContext {
	/** 某 matchKey 被链接的次数。 */
	linkCount?: (matchKey: string) => number;
	/** 当前活动文件路径（其中的标题排在前面）。 */
	activePath?: string;
}

/**
 * 建议排序（testplan Q34）：完整命中优先 → 被链接次数多的优先 → 当前文件里的优先 →
 * matchKey 短的优先（越接近精确匹配越靠前）→ path 字典序兜底，保证结果确定性可测。
 */
export function sortEntries(
	entries: HeadingIndexEntry[],
	normalizedQuery: string,
	ctx: SortContext = {},
): HeadingIndexEntry[] {
	const links = ctx.linkCount ?? (() => 0);
	return [...entries].sort((a, b) => {
		const aExact = a.matchKey === normalizedQuery ? 0 : 1;
		const bExact = b.matchKey === normalizedQuery ? 0 : 1;
		if (aExact !== bExact) {
			return aExact - bExact;
		}
		const linkDiff = links(b.matchKey) - links(a.matchKey);
		if (linkDiff !== 0) {
			return linkDiff;
		}
		const aHere = a.path === ctx.activePath ? 0 : 1;
		const bHere = b.path === ctx.activePath ? 0 : 1;
		if (aHere !== bHere) {
			return aHere - bHere;
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
 * - 否则用 `[[链接文本#anchor|alias]]`。链接文本由调用方按 Obsidian 的规则给出（`fileToLinktext`：文件名唯一
 *   时就是文件名，重名时是路径）；缺省回退文件名。**只写文件名会链错**：库里有多篇同名笔记时（如各公司文件夹里
 *   都有 `02-二面-速查卡.md`），Obsidian 会把 `[[02-二面-速查卡#…]]` 解析到另一篇（testplan Q47，用户实测）。
 * - alias 恒为标题的**完整原文**（displayText，剥编号前缀后）——1.0.27 产品决策：接受建议时
 *   把用户打的残缺前缀自动补全为完整标题名（用户实测反馈「希望是完整的标题名而不是残缺的」，
 *   与 VC 词典 value 的 alias 形态一致）。
 */
export function buildHeadingLink(
	entry: HeadingIndexEntry,
	activeFilePath: string,
	linktext: string = entry.basename,
): string {
	const target = entry.path === activeFilePath ? "" : linktext;
	return `[[${target}#${entry.anchor}|${entry.displayText}]]`;
}
