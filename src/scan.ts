/**
 * 「跳过区域」块级扫描器（M12「注释块跳过」，见 spec.md §3.17）。
 *
 * 唯一权威地回答一个问题：**某一行是否落在插件不该介入的区域里**。目前两类区域：
 * - **围栏代码块**（``` / ~~~，须同种符号闭合，CommonMark 行为）——原实现在 `parser.ts`。
 * - **注释块**（`%%…%%` 与 `<!--…-->`）——本次新增。
 *
 * 独立成模块的理由：这是 `parser.ts`（标题识别）与 `numbering.ts`（残留清理）共享的块级原语，
 * 此前两处各自维护了一份**同构的围栏状态机**、且 `numbering.ts` 要反过来从 `./parser` 借
 * `FENCE_RE`，依赖方向别扭。收敛到这里后两处都只消费 {@link scanSkipRegions} 的结果。
 *
 * > UVM 参考模型（`tests/dev_tests/uvm/model.ts`）**刻意不复用本模块**——它是交叉验证用的
 * > 独立第二实现，复用被测代码即丧失验证价值。那边按同一份规格手写、且算法形状刻意不同。
 *
 * ## 与围栏的关键差异
 *
 * 围栏是**行级**的（整行是定界符），注释是**字符级**的、可以在同一行内开又闭。所以不能沿用
 * 「整行 continue」的写法，必须按字符位置判断该行行首是否被遮蔽。裁决表见 spec.md §3.17，
 * 要点：
 * - **行首定标题**：某行是标题 ⟺ 它第 0 列时不在注释内、不在围栏内、且本身不是围栏定界行。
 *   故 `## 标题 %% 批注 %%` 与 `## 标题 <!--` 都**仍是标题**（`#` 未被遮蔽）；后者会让**下方**
 *   各行进入注释区。
 * - **围栏优先**：围栏内不扫描注释标记，注释状态在围栏内冻结。反向（注释内出现 ``` 会开启围栏）
 *   属**已知限制**——失败方向是「多跳过 / 冻结」而非「误编号」，安全。
 * - **行内代码里的分隔符不识别**（`` `<!--` `` 照常开启注释）：正确处理需要 CommonMark 级的
 *   反引号游程 tokenizer，与本功能收益不成比例。同样是「冻结」方向的失败，可见且可恢复。
 * - 未闭合的注释一直延伸到文件末尾（与未闭合围栏对称）。
 */

/** 匹配围栏代码块的起止行：行首至多 3 个空格 + 至少 3 个反引号或波浪号。 */
export const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/** 注释块的两种风格：Obsidian 的 `%%…%%`（开闭同符）与 HTML 的 `<!--…-->`。 */
type CommentKind = "obsidian" | "html";

/** 单行的跳过状态。 */
export interface SkipState {
	/** 本行属于围栏代码块（含定界行本身）。 */
	inFence: boolean;
	/** 本行就是围栏定界行（``` / ~~~ 那一行）。 */
	isFenceMarker: boolean;
	/** 本行**行首**落在注释区内（决定该行的 `#` 是否被遮蔽）。 */
	inComment: boolean;
}

/** 该行是否应被跳过（不识别为标题、不参与编号与计数）。 */
export function isSkipped(state: SkipState): boolean {
	return state.inFence || state.isFenceMarker || state.inComment;
}

/**
 * 在一行内推进注释状态机，返回**行末**的开启状态。
 *
 * `%%` 开闭同符，是「开闭不同符」的退化情形：未开启时只找开标记，已开启时只找与当前风格
 * 匹配的闭标记——不必为它单独特判（与围栏机用 `fenceChar` 记「须同种符号闭合」同形状）。
 * 贪婪、从左到右，故 `%%%` = 开标记 + 残留的 `%`，`<!-- <!-- -->` 的首个 `-->` 即闭合（不嵌套）。
 */
function advanceComment(line: string, open: CommentKind | null): CommentKind | null {
	let i = 0;
	while (i < line.length) {
		if (open === null) {
			if (line.startsWith("%%", i)) {
				open = "obsidian";
				i += 2;
				continue;
			}
			if (line.startsWith("<!--", i)) {
				open = "html";
				i += 4;
				continue;
			}
		} else if (open === "obsidian") {
			if (line.startsWith("%%", i)) {
				open = null;
				i += 2;
				continue;
			}
		} else if (line.startsWith("-->", i)) {
			open = null;
			i += 3;
			continue;
		}
		i++;
	}
	return open;
}

/**
 * 扫描全文各行的跳过状态。
 *
 * @param lines 已按行切分的全文。
 * @returns 与 `lines` **等长**的状态数组（返回数组而非回调：三处消费者都按下标循环，
 *   `cleanDemotedResidue` 还需要随机访问）。
 */
export function scanSkipRegions(lines: readonly string[]): SkipState[] {
	const out: SkipState[] = [];
	let inFence = false;
	let fenceChar = "";
	let openComment: CommentKind | null = null;

	for (const line of lines) {
		const fence = line.match(FENCE_RE);
		if (fence) {
			const char = fence[1][0];
			if (!inFence) {
				inFence = true;
				fenceChar = char;
			} else if (char === fenceChar) {
				inFence = false;
				fenceChar = "";
			}
			// 定界行本身既不可能是标题、也不可能携带残留；注释状态在围栏边界上冻结不推进。
			out.push({ inFence: true, isFenceMarker: true, inComment: openComment !== null });
			continue;
		}
		if (inFence) {
			// 围栏内：不扫描注释标记（围栏优先），注释状态原样冻结。
			out.push({ inFence: true, isFenceMarker: false, inComment: openComment !== null });
			continue;
		}
		// 关键：先取**行首**状态再推进——本行的 `#` 是否被遮蔽只由第 0 列决定，
		// 哪怕这一行末尾才开启注释（`## 标题 <!--`），本行自己仍是标题。
		const atLineStart = openComment !== null;
		openComment = advanceComment(line, openComment);
		out.push({ inFence: false, isFenceMarker: false, inComment: atLineStart });
	}
	return out;
}
