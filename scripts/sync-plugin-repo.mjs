/**
 * 把本 Addon 同步到**独立的对外发布仓库**（AArlert/obsidian-auto-headings），
 * 用于向 Obsidian 社区插件目录发布。开发（本 monorepo）与发布（干净的标准插件仓库）分离：
 *
 * - **复制自 Addon 根**：`src/`、`manifest.json`、`versions.json`、`styles.css`、
 *   `esbuild.config.mjs`、`tsconfig.json`、`LICENSE`、构建产物 `main.js`（先跑 build 确保新鲜；
 *   main.js 入库以支持 BRAT / 手动安装，正式 Release 资产由发布仓库的 tag 工作流另行构建）。
 * - **复制自 `publish/` 模板目录**：发布仓库专属文件——双语 README、`.gitignore`、
 *   `.github/workflows/release.yml`、精简 `package.json`（version / description 由脚本按
 *   manifest 注入）。开发者专用内容（doc/、tests/、scripts/ 等）一概**不**带过去。
 * - 目标仓库中**不在管理清单内**的文件（如用户手动添加的截图 assets/）原样保留。
 *
 * 用法（在本 Addon 目录）：
 *   npm run publish:repo -- [--repo <路径>] [--dry-run] [--no-push] [--tag] [--skip-build]
 *
 * - `--repo <路径>`  目标仓库的本地克隆；缺省取环境变量 AAH_PLUGIN_REPO，
 *                    再缺省为 monorepo 的兄弟目录 `../../obsidian-auto-headings`。
 *                    目录必须已是 git 克隆（脚本不代为 clone，避免误写陌生目录）。
 * - `--dry-run`      只打印将执行的动作，不写任何文件、不动 git。
 * - `--no-push`      同步 + 提交，但不推送（本地检查后自行 push）。
 * - `--tag`          提交后额外打「与 manifest.version 完全一致」的 tag 并推送——
 *                    触发发布仓库的 Release 工作流（Obsidian 要求 tag 不带 v 前缀）。
 * - `--skip-build`   跳过 `npm run build`（确信根目录 main.js 已新鲜时用）。
 *
 * 每次在本仓库开发得到可发布版本后跑一次；提交信息为 `release: <version>`。
 */
import { execFileSync } from "child_process";
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import process from "process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// —— 解析参数 ——
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noPush = args.includes("--no-push");
const doTag = args.includes("--tag");
const skipBuild = args.includes("--skip-build");
const repoFlag = args.indexOf("--repo");
const target = resolve(
	repoFlag >= 0 && args[repoFlag + 1]
		? args[repoFlag + 1]
		: (process.env.AAH_PLUGIN_REPO ?? join(root, "..", "..", "obsidian-auto-headings")),
);

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const version = manifest.version;

console.log(`发布仓库同步：v${version} → ${target}${dryRun ? "（dry-run，只演不做）" : ""}`);

// —— 安全检查：目标必须是已存在的 git 克隆（不代为 clone / 不写陌生目录）——
if (!existsSync(target) || !existsSync(join(target, ".git"))) {
	console.error(
		`目标 ${target} 不存在或不是 git 仓库。请先克隆发布仓库，例如：\n` +
			`  git clone https://github.com/AArlert/obsidian-auto-headings ${target}\n` +
			`或用 --repo <路径> / 环境变量 AAH_PLUGIN_REPO 指定其克隆位置。`,
	);
	process.exit(1);
}

/** 在目标仓库执行 git 子命令并返回 stdout（trim 后）。 */
function git(...argv) {
	return execFileSync("git", ["-C", target, ...argv], { encoding: "utf8" }).trim();
}

// 目标工作区须干净，避免覆盖未提交的手工改动（如正在编辑的截图说明）。
if (!dryRun && git("status", "--porcelain") !== "") {
	console.error("目标仓库工作区不干净（有未提交改动），先处理后再同步。");
	process.exit(1);
}

// —— 1) 构建，确保 main.js 新鲜 ——
if (!skipBuild) {
	console.log("构建产物（npm run build）…");
	if (!dryRun) {
		execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
	}
} else {
	console.log("跳过构建（--skip-build），沿用现有 main.js。");
}

// —— 2) 同步管理清单 ——
/** 复制自 Addon 根的文件 / 目录（相对路径，目录以 / 结尾）。 */
const fromRoot = [
	"src/",
	"manifest.json",
	"versions.json",
	"styles.css",
	"esbuild.config.mjs",
	"tsconfig.json",
	"LICENSE",
	"main.js",
];
/** 复制自 publish/ 模板目录的发布仓库专属文件（package.json 单独注入版本后写出）。 */
const fromPublish = ["README.md", "README.zh.md", ".gitignore", ".github/workflows/release.yml"];

function syncPath(src, rel) {
	const dst = join(target, rel);
	console.log(`  sync ${rel}`);
	if (dryRun) {
		return;
	}
	if (rel.endsWith("/")) {
		rmSync(dst, { recursive: true, force: true }); // 先删后铺，清掉源里已不存在的文件
		cpSync(src, dst, { recursive: true });
	} else {
		mkdirSync(dirname(dst), { recursive: true });
		copyFileSync(src, dst);
	}
}

for (const rel of fromRoot) {
	syncPath(join(root, rel), rel);
}
for (const rel of fromPublish) {
	syncPath(join(root, "publish", rel), rel);
}

// package.json：以 publish/ 模板为基底，注入当前版本与 manifest 描述。
console.log("  sync package.json（注入 version / description）");
if (!dryRun) {
	const pkg = JSON.parse(readFileSync(join(root, "publish", "package.json"), "utf8"));
	pkg.version = version;
	pkg.description = manifest.description;
	writeFileSync(join(target, "package.json"), JSON.stringify(pkg, null, "\t") + "\n");
}

// —— 3) 提交 / 推送 / 打 tag ——
if (dryRun) {
	console.log("dry-run 结束：未写文件、未动 git。");
	process.exit(0);
}

git("add", "-A");
if (git("status", "--porcelain") === "") {
	console.log("与发布仓库无差异，无需提交。");
} else {
	git("commit", "-m", `release: ${version}`);
	console.log(`已提交：release: ${version}`);
	if (noPush) {
		console.log("按 --no-push 跳过推送，请自行检查后 push。");
	} else {
		git("push", "origin", "HEAD");
		console.log("已推送到 origin。");
	}
}

if (doTag) {
	// Obsidian 要求 Release tag 与 manifest.version 完全一致（不带 v 前缀）。
	git("tag", version);
	if (noPush) {
		console.log(`已打 tag ${version}（未推送）。`);
	} else {
		git("push", "origin", version);
		console.log(`已推送 tag ${version}——发布仓库的 Release 工作流将自动构建草稿 Release。`);
	}
}

console.log("发布仓库同步完成。");
