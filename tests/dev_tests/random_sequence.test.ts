/**
 * UVM 风格「约束随机序列」测试入口（见 tests/dev_tests/uvm/framework.ts 与 uvm/README.md）。
 *
 * 跑一批种子，每个种子推进一条随机的「编辑文本 / 改模板 / 触发编号」序列，由参考模型记分板
 * 自动判对错；最后断言**功能覆盖率闭合**（确认随机真撞到了关心的场景）。
 *
 * 可调（环境变量）：
 * - `AAH_FUZZ_RUNS`：序列条数（默认 500）。
 * - `AAH_FUZZ_OPS`：每条序列的操作步数（默认 60）。
 * - `AAH_FUZZ_SEED`：起始种子（默认 1）。复现失败时设为报错里的 seed、RUNS=1 即可单跑那一条。
 * - `AAH_FUZZ_MODE`：保留、无实际门控效果（0.6.7 起 explore 已转正为回归测试，常态运行）。
 *   大规模压测仍可手动跑：`AAH_FUZZ_RUNS=8000 AAH_FUZZ_OPS=80 npx vitest run ...`。
 */
import { describe, expect, it } from "vitest";
import { Coverage, runSequence, DEFAULT_GEN, EXPLORE_GEN } from "./uvm/framework";

const RUNS = Number(process.env.AAH_FUZZ_RUNS ?? 500);
const OPS = Number(process.env.AAH_FUZZ_OPS ?? 60);
const BASE_SEED = Number(process.env.AAH_FUZZ_SEED ?? 1);

describe("约束随机序列（UVM 风格状态转移压测）", () => {
	it(`${RUNS} 条序列 × ${OPS} 步：参考模型记分板全程一致`, () => {
		const cov = new Coverage();
		// 单跑模式（RUNS=1 + 指定 SEED）时只跑那一条，便于复现失败种子。
		for (let i = 0; i < RUNS; i++) {
			// 不抛即通过；抛出的 SequenceError 含种子 + 操作轨迹 + 三方文本。
			runSequence(BASE_SEED + i, OPS, cov, DEFAULT_GEN);
		}
		// 仅在跑了足够多序列时才要求覆盖率闭合（单跑复现模式不强求）。
		if (RUNS >= 100) {
			expect(cov.gaps(), `功能覆盖率未闭合（缺失 bin）`).toEqual([]);
			expect(cov.triggers).toBeGreaterThan(RUNS); // 平均每条序列 >1 次触发
		}
	}, 30000); // 放宽超时：默认 500×60 通常 <2s，但 CI 机器波动或经 AAH_FUZZ_* 调大时留足余量。

	/**
	 * explore 幂等性记分板：放开字母样式 / 脏标题 / 手动破坏前缀，断言
	 * `renumber∘renumber === renumber`（恒成立、容脏输入）。
	 *
	 * 0.6.7 起从 `it.skip` 转正为常规回归测试——U4（标题前导空白非幂等）已修，
	 * 8000×80 explore 全绿；当前 explore 空间内无已知未修 bug。
	 * U3（字母样式吞英文起头标题）属设计取舍（见 testplan §3.2），explore 模式通过
	 * `EXPLORE_GEN` 内部约束规避，不影响本测试。
	 */
	it(`[explore] ${RUNS}×${OPS}：幂等性记分板（脏输入全覆盖回归）`, () => {
		const cov = new Coverage();
		for (let i = 0; i < RUNS; i++) {
			runSequence(BASE_SEED + i, OPS, cov, EXPLORE_GEN);
		}
	}, 30000);
});
