/**
 * 单标题 / 整节改写的纯函数（M16，见 spec §3.24）：跳过标记切换、整节升降级。
 *
 * 不依赖 Obsidian 运行时，node 环境可直接单测（`tests/dev_tests/headingedit.test.ts`）。
 * 只产出「整行变更」，由调用方（`main.ts`）并入同一个 `editor.transaction`。
 */
import { hasSkipMarker, parseHeadings } from "./parser";

/** 规范形态的跳过标记（含前导空格），写入侧只产出这一种。 */
export const SKIP_MARKER = " <!-- skip -->";

/** 行尾跳过标记（连同前导空白）的匹配；与 `parser.ts` 的识别口径一致。 */
const SKIP_TAIL_RE = /[ \t]*<!--\s*skip\s*-->\s*$/i;

/** 一行的整行替换。 */
export interface LineEdit {
	line: number;
	text: string;
}

/**
 * 切换标题行的跳过标记：无则在行尾补规范标记，有则整段移除（含前导空白）。
 * 调用方须保证 `line` 是标题行。
 */
export function toggleSkipMarker(line: string): string {
	if (hasSkipMarker(line)) {
		return line.replace(SKIP_TAIL_RE, "");
	}
	return line.replace(/[ \t]+$/, "") + SKIP_MARKER;
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
