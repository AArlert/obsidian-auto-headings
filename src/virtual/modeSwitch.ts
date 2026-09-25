/**
 * 路径规则变动引起的模式切换（M14，见 spec.md §3.22「切换模式」）的纯逻辑。
 *
 * 不区分用户做的是哪种改动——改模式下拉框、删规则、改路径、把模板改成「不编号」、拖拽排序——一律
 * 比较「改动前 / 改动后」每个文件的有效模式（{@link resolveNumberingMode}，与生效判定同一套具体度），
 * 天然只算到「有效规则确实变了」的文件，被更具体规则覆盖的文件不会被误算进来。
 */

import { resolveNumberingMode, type PathRule } from "../pathrules";

/** 一次规则变动会让哪些文件换模式。 */
export interface ModeTransition {
	/** 写入 → 仅显示。 */
	toVirtual: string[];
	/** 写入 → 不编号（删规则、改路径、改成「不编号」模板）。 */
	toNone: string[];
	/** 仅显示 → 写入。 */
	toWrite: string[];
}

/** 深拷贝规则列表：在副本上试改，确认后才替换设置，取消即原样不动。 */
export function cloneRules(rules: readonly PathRule[]): PathRule[] {
	return rules.map((r) => ({ ...r }));
}

/** 比较改动前后每个文件的有效模式。只关心「离开写入」与「从仅显示进入写入」两类。 */
export function diffNumberingModes(
	before: readonly PathRule[],
	after: readonly PathRule[],
	paths: readonly string[],
): ModeTransition {
	const result: ModeTransition = { toVirtual: [], toNone: [], toWrite: [] };
	for (const path of paths) {
		const was = resolveNumberingMode([...before], path);
		const now = resolveNumberingMode([...after], path);
		if (was === "write" && now === "virtual") {
			result.toVirtual.push(path);
		} else if (was === "write" && now === null) {
			result.toNone.push(path);
		} else if (was === "virtual" && now === "write") {
			result.toWrite.push(path);
		}
	}
	return result;
}

/** 这次变动是否无需询问用户（没有文件离开写入、也没有文件从仅显示进入写入）。 */
export function isQuietTransition(t: ModeTransition): boolean {
	return t.toVirtual.length === 0 && t.toNone.length === 0 && t.toWrite.length === 0;
}
