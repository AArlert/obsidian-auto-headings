/**
 * 一条命令同步全部版本号文件，消灭「手改 4~5 处」的机械开销。
 *
 * 用法：
 *   node scripts/bump.mjs            # 打磨递增：0.6.7 → 0.6.8（bump `*`）
 *   node scripts/bump.mjs minor      # 进入新 Milestone：0.6.7 → 0.7.0（bump M，`*` 归零）
 *   node scripts/bump.mjs 0.7.3      # 显式指定版本
 *
 * 版本号语义见根 CLAUDE.md §4.1：格式 `0.M.*`，M=当前 Milestone，`*` 在里程碑内递增。
 *
 * 同步以下文件（单一真相源 = manifest.json 的当前版本）：
 *   - package.json            version
 *   - manifest.json           version
 *   - package-lock.json       顶层 version + packages[""].version
 *   - versions.json           追加 "<新版本>": "<minAppVersion>"
 *   - release/manifest.json   version（产物副本，存在才改）
 *
 * 注意：本脚本只改版本号，不跑 build/release。改完后仍需 `npm run release` 重建产物。
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (f) => join(root, f);

/** 读 JSON（保留为对象，写回时用 2-space + 行尾换行，与仓库现状一致）。 */
const readJson = (f) => JSON.parse(readFileSync(p(f), "utf8"));
const writeJson = (f, obj) => writeFileSync(p(f), JSON.stringify(obj, null, "\t") + "\n");

const manifest = readJson("manifest.json");
const cur = manifest.version;
const m = cur.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!m) {
	console.error(`manifest.json 版本号格式异常：${cur}（应为 0.M.*）`);
	process.exit(1);
}
const [major, milestone, patch] = m.slice(1).map(Number);

const arg = process.argv[2];
let next;
if (!arg || arg === "patch") {
	next = `${major}.${milestone}.${patch + 1}`;
} else if (arg === "minor" || arg === "milestone") {
	next = `${major}.${milestone + 1}.0`;
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
	next = arg;
} else {
	console.error(`无法识别的参数：${arg}（用 patch / minor / 显式版本如 0.7.0）`);
	process.exit(1);
}

if (next === cur) {
	console.error(`新版本与当前版本相同（${cur}），未做改动。`);
	process.exit(1);
}

// 1) manifest.json
manifest.version = next;
writeJson("manifest.json", manifest);

// 2) package.json
const pkg = readJson("package.json");
pkg.version = next;
writeJson("package.json", pkg);

// 3) package-lock.json（顶层 + 根 package 条目）
if (existsSync(p("package-lock.json"))) {
	const lock = readJson("package-lock.json");
	lock.version = next;
	if (lock.packages && lock.packages[""]) lock.packages[""].version = next;
	writeJson("package-lock.json", lock);
}

// 4) versions.json（追加新版本 → minAppVersion 映射）
const versions = readJson("versions.json");
if (!versions[next]) {
	versions[next] = manifest.minAppVersion;
	writeJson("versions.json", versions);
}

// 5) release/manifest.json（产物副本，存在才同步；最终仍以 npm run release 为准）
if (existsSync(p("release/manifest.json"))) {
	const rel = readJson("release/manifest.json");
	rel.version = next;
	writeJson("release/manifest.json", rel);
}

console.log(`版本号已同步：${cur} → ${next}`);
console.log(
	"已改：package.json / manifest.json / package-lock.json / versions.json / release/manifest.json",
);
console.log("提醒：仍需 `npm run release` 重建产物，并在 doc/log.md 追加交接记录。");
