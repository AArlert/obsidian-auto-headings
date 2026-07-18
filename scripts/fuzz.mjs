/**
 * 跨平台跑「重型随机序列压测」（UVM 风格框架，见 tests/dev_tests/uvm/README.md）。
 *
 * 用法：
 *   node scripts/fuzz.mjs                          # 默认 5000 条 × 80 步
 *   node scripts/fuzz.mjs --runs=20000 --ops=80    # 专项加压
 *   node scripts/fuzz.mjs --seed=9 --runs=1        # 复现失败种子（照 SequenceError 里的 seed）
 *
 * **为什么需要这个脚本**：原先 `test:fuzz` 直接写成 `AAH_FUZZ_RUNS=5000 … vitest run …`，
 * 这是 POSIX 的前缀赋值语法。npm 在 Windows 上默认用 `cmd.exe` 跑 script（`script-shell` 未配置），
 * cmd 解析不了该语法 ⇒ `npm run test:fuzz` 在 Windows 开发机上直接报错，而 CLAUDE.md §4 第 4 步
 * 「动核心逻辑后额外跑一遍 test:fuzz」正依赖它。改由本脚本注入环境变量，三大平台一致。
 *
 * 直接以 `process.execPath` 拉起 vitest 的 ESM 入口（而非 `npx` + `shell: true`）：免去 shell 解析、
 * 免去 npx 的包解析开销，参数也不会被二次拆词。
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 解析 `--key=value` 形式的覆盖项；未给则用默认值。 */
const argOf = (key, fallback) => {
	const hit = process.argv.slice(2).find((a) => a.startsWith(`--${key}=`));
	return hit ? hit.slice(key.length + 3) : fallback;
};

const vitestBin = join(root, "node_modules", "vitest", "vitest.mjs");
if (!existsSync(vitestBin)) {
	console.error(`找不到 vitest 入口：${vitestBin}\n请先跑 npm install。`);
	process.exit(1);
}

const runs = argOf("runs", "5000");
const ops = argOf("ops", "80");
const seed = argOf("seed", "1");

console.log(`[fuzz] ${runs} 条序列 × ${ops} 步，起始种子 ${seed}（两块记分板各跑一轮）`);

const r = spawnSync(
	process.execPath,
	[
		vitestBin,
		"run",
		"tests/dev_tests/random_sequence.test.ts",
		// 重型压测远超用例内联的 30s 超时（random_sequence.test.ts:34/50），此处整体放宽。
		"--testTimeout=600000",
	],
	{
		cwd: root,
		stdio: "inherit",
		env: {
			...process.env,
			AAH_FUZZ_RUNS: runs,
			AAH_FUZZ_OPS: ops,
			AAH_FUZZ_SEED: seed,
		},
	},
);

// 透传退出码——否则失败的压测会被 npm / CI 当成通过。
if (r.error) {
	console.error(`[fuzz] 启动 vitest 失败：${r.error.message}`);
	process.exit(1);
}
process.exit(r.status ?? 1);
