/**
 * 计数器状态机（引擎四职之一，见 `numbering.ts` 顶部说明）。
 *
 * 内部维护 `[c1, c2, c3, c4, c5, c6]`，全程纯阿拉伯整数；渲染成各种序号样式在写入时才发生
 * （见 `render.ts`）。
 */

/**
 * 计数器状态机。内部维护 `[c1, c2, c3, c4, c5, c6]`，分别对应 H1–H6。
 * 所有标题（无论是否在编号范围内）都推进计数器：比 `topLevel` 浅的标题虽不输出序号，
 * 但仍累加并归零更深级别，从而充当「重置边界」（多个 H1 各自子节重新从 1 起）。
 * 全程使用纯阿拉伯整数。
 */
export class HeadingCounter {
	/** counts[0] -> H1, …, counts[5] -> H6。 */
	private readonly counts = [0, 0, 0, 0, 0, 0];

	/**
	 * 推进给定级别的计数器：`c[level]` 加一，所有更深级别归零。
	 * @param level 标题级别，必须在 1–6。
	 */
	bump(level: number): void {
		assertCountedLevel(level);
		const idx = level - 1;
		this.counts[idx] += 1;
		for (let i = idx + 1; i < this.counts.length; i++) {
			this.counts[i] = 0;
		}
	}

	/** 返回某级当前的纯阿拉伯计数值。 */
	current(level: number): number {
		assertCountedLevel(level);
		return this.counts[level - 1];
	}

	/**
	 * 返回从 H1 到 `level` 的计数序列（纯阿拉伯整数）。
	 * 例如 level=4 时返回 `[c1, c2, c3, c4]`；拼接前缀时由 `render.ts` 的 `buildPrefix`
	 * 按 `topLevel` 截取。
	 */
	sequence(level: number): number[] {
		assertCountedLevel(level);
		return this.counts.slice(0, level);
	}

	/** 将所有计数器归零（用于复用同一实例重新编号另一文件）。 */
	reset(): void {
		this.counts.fill(0);
	}
}

function assertCountedLevel(level: number): void {
	if (level < 1 || level > 6) {
		throw new RangeError(`参与计数的标题级别须在 1–6，收到 ${level}`);
	}
}
