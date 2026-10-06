/**
 * 单标题 / 整节改写的纯函数（M16，见 spec §3.24）：跳过标记切换、整节升降级。
 *
 * 不依赖 Obsidian 运行时，node 环境可直接单测（`tests/dev_tests/headingedit.test.ts`）。
 * 只产出「整行变更」，由调用方（`main.ts`）并入同一个 `editor.transaction`。
 */
import { hasSkipMarker, hasSkipTreeMarker, parseHeadings } from "./parser";

/** 跳过标记的两种类型：`self` 只跳过这一个标题，`tree` 连同整棵子树一起跳过。 */
export type SkipKind = "self" | "tree";

/** 规范形态的跳过标记（含前导空格），写入侧只产出这两种。 */
export const SKIP_MARKER = " <!-- skip -->";
export const SKIP_TREE_MARKER = " <!-- skip-tree -->";

/** 行尾跳过标记（两种之一，连同前导空白）的匹配；与 `parser.ts` 的识别口径一致。 */
const SKIP_TAIL_RE = /[ \t]*<!--\s*skip(?:-tree)?\s*-->\s*$/i;

/** 标题行当前带哪种跳过标记；没有返回 `null`。 */
export function skipKindOf(line: string): SkipKind | null {
	if (hasSkipTreeMarker(line)) {
		return "tree";
	}
	return hasSkipMarker(line) ? "self" : null;
}

/** 把标题文本里的跳过标记（若有）整段去掉，供标签行 / 别名显示用。 */
export function stripSkipMarker(text: string): string {
	return text.replace(SKIP_TAIL_RE, "");
}

/** 一行的整行替换。 */
export interface LineEdit {
	line: number;
	text: string;
}

/**
 * 切换标题行的跳过标记：已带**同类**标记则整段移除（含前导空白）；带**另一类**则换成这一类；
 * 没有则在行尾补规范标记。调用方须保证 `line` 是标题行。
 */
export function toggleSkipMarker(line: string, kind: SkipKind = "self"): string {
	const current = skipKindOf(line);
	if (current === kind) {
		return line.replace(SKIP_TAIL_RE, "");
	}
	const bare = current === null ? line.replace(/[ \t]+$/, "") : line.replace(SKIP_TAIL_RE, "");
	return bare + (kind === "tree" ? SKIP_TREE_MARKER : SKIP_MARKER);
}

/**
 * 规划整节升降级。
 *
 * @param headingLine 小节标题所在行（0 起）；须恰为 `parseHeadings` 认得的标题行。
 * @param delta `-1` 升级（少一个 `#`）/ `+1` 降级。
 * @returns 整行变更集；越界（范围内任一标题会 <1 或 >6 级）或 `headingLine` 不是标题时返回 `null`。
 */
export function planSectionShift(
	content: string,
	headingLine: number,
	delta: -1 | 1,
): LineEdit[] | null {
	const headings = parseHeadings(content);
	const start = headings.findIndex((h) => h.lineIndex === headingLine);
	if (start === -1) {
		return null;
	}
	const base = headings[start].level;
	const lines = content.split("\n");
	const edits: LineEdit[] = [];
	for (let i = start; i < headings.length; i++) {
		const h = headings[i];
		if (i > start && h.level <= base) {
			break;
		}
		const level = h.level + delta;
		if (level < 1 || level > 6) {
			return null;
		}
		const text = lines[h.lineIndex];
		edits.push({
			line: h.lineIndex,
			text: delta < 0 ? text.slice(1) : "#" + text,
		});
	}
	return edits;
}

/**
 * 整节移动：把 `headingLine` 所在小节（含全部子标题）整体搬到第 `destLine` 行之前（`destLine` 取
 * `0..正文行数`，等于正文行数即移到文末）。小节范围同 {@link planSectionShift}：到下一个级别 ≤ 它的标题为止。
 *
 * 搬动**不改任何标题级别**（升降级是另外的操作）。目标落在小节自身之内或紧贴其后（等于没动）时返回
 * `null`。文末换行符原样保留，不会因搬动多出或丢掉空行。
 */
export function moveSection(content: string, headingLine: number, destLine: number): string | null {
	const headings = parseHeadings(content);
	const idx = headings.findIndex((h) => h.lineIndex === headingLine);
	if (idx === -1) {
		return null;
	}
	const base = headings[idx].level;
	const trailingNewline = content.endsWith("\n");
	const lines = content.split("\n");
	const body = trailingNewline ? lines.slice(0, -1) : lines;
	let end = body.length;
	for (let i = idx + 1; i < headings.length; i++) {
		if (headings[i].level <= base) {
			end = headings[i].lineIndex;
			break;
		}
	}
	const start = headingLine;
	if (destLine < 0 || destLine > body.length || (destLine >= start && destLine <= end)) {
		return null;
	}
	const chunk = body.slice(start, end);
	const rest = [...body.slice(0, start), ...body.slice(end)];
	const at = destLine < start ? destLine : destLine - chunk.length;
	rest.splice(at, 0, ...chunk);
	return rest.join("\n") + (trailingNewline ? "\n" : "");
}

/** {@link moveSection} 之外的辅助：正文行数（不含文末换行产生的空尾行）。 */
export function bodyLineCount(content: string): number {
	const n = content.split("\n").length;
	return content.endsWith("\n") ? n - 1 : n;
}
