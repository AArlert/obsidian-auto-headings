/**
 * 可复现的种子化伪随机数发生器（mulberry32）。
 *
 * UVM 思想：随机激励必须**可复现**——失败时打印种子，照同一种子即可重跑同一条序列定位 bug。
 * 这里用 mulberry32（32 位状态、无依赖、跨平台结果一致），并封装常用取样方法。
 */
export class Rng {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	/** 返回 [0, 1) 的浮点数。 */
	next(): number {
		let t = (this.state += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** 返回 [0, maxExclusive) 的整数。 */
	int(maxExclusive: number): number {
		return Math.floor(this.next() * maxExclusive);
	}

	/** 返回 [min, maxInclusive] 的整数。 */
	intRange(min: number, maxInclusive: number): number {
		return min + this.int(maxInclusive - min + 1);
	}

	/** 以概率 p 返回 true。 */
	chance(p: number): boolean {
		return this.next() < p;
	}

	/** 从数组中等概率取一个元素。 */
	pick<T>(arr: readonly T[]): T {
		return arr[this.int(arr.length)];
	}
}
