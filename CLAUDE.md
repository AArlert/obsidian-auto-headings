# CLAUDE.md

本仓库是 Obsidian 插件 **Auto Headings**（按模板自动为 Markdown 标题编号）的**独立发布仓库**，
对外发布名 `AArlert/obsidian-auto-headings`，用于向 Obsidian 社区插件目录提交与分发。

> 历史备注：本仓库最初由作者的私有 monorepo（收纳多个浏览器扩展与 Obsidian 插件）迁移而来，早期曾
> 直接携带 monorepo 版 `CLAUDE.md`（含其他 Addon 的描述），已随本次迁移核实一并订正，去除不适用于
> 本仓库的内容。仓库根目录**就是**这个插件本身——没有多 Addon 子目录，也没有顶层 workspace。

> 动手前：先读本文件，再读 [`doc/`](./doc/) 下的规格与日志。
> 详细规格：[`doc/spec.md`](./doc/spec.md)。

## 0. Agent / SubAgent 调用准则

积极按任务难度调用 SubAgent 节省 token：

-   快速机械工作使用 Haiku（跑测试脚本返回结果、重命名、日志行、正则表达式解释、样板代码）
-   大多数编码使用 Sonnet（功能、测试、已知错误、重构）
-   真正卡住或更改范围很广时使用 Opus（困难调试、跨领域重构、架构决策）

## 1. 仓库结构

单一 Obsidian 插件的完整源码仓库：`src/` 源码、`tests/` 测试、`doc/` 规格与交接文档、`scripts/`
构建与文档维护脚本、`release/` 可分发产物（入库以支持 BRAT / 手动安装）。根目录 `package.json` 即
本插件的唯一 npm 项目，无需 `cd` 进任何子目录。

## 2. 语言与代码风格

-   **所有注释、文档、commit message、PR 描述一律简体中文**；标识符用英文；面向用户的字符串用中文。
-   界面双语目标：中文 + 英文（已于 0.6.5 落地，见 `doc/spec.md` §3.11）。
-   遵循仓库自带的 `.prettierrc.json` / `.eslintrc.json` / `tsconfig.json`。提交前跑 `npm run format` 与 `npm run lint`。
-   TypeScript `strict: true`、ESM；公共导出写中文 JSDoc（意图 + 边界情况）。

## 3. Agent 交接与记忆系统 ★

**接手第一条命令**：先跑 **`npm run docs -- --handover`**——一次打印「status 首行总览 + log.md
最新块 + testplan 待办摘要」，代替手动读下列三个文件：

1. **`doc/status.jsonl`**（首行 = 当前总览；其下每行一条倒序概括）——一眼看清现状。
2. **`doc/log.md` 最新一块**（尤其「下一步」）——开工起点；需要历史时再按需往下翻。
3. **`doc/spec.md`**——涉及规格改动时查阅并同步更新。

**每个开发周期结束必须同时维护（缺一不可）：**

-   `doc/log.md` 顶部追加记录，包含：日期 / 交接人（分支名）、做了什么、没做什么、下一步、验证方式。
-   `doc/status.jsonl` 首行下方插入一行概括（JSON，含 `date` / `version` / `summary`），并更新首行。
    **首行保持精简**（版本 + 一句话现状 + 下一步），细节下沉 `log.md`，别把根因 / seed / 测试数堆进首行。

> `doc/log.md` 顶部可能有本仓库专属强制规则，优先级高于本文件，必须先读。

**省 token 读盘纪律（重要）**：接手时**用 `grep` / `rg` 定位**所需信息，不要整读大文件。

-   `log.md` 只读**最新一块**；更早历史已被归档脚本滚动进 `log-archive.md`，需要时再按需翻。
-   `testplan.md` 不必整读：跑 `npm run docs` 即可得「状态计数 + 全部非 ✅ 待办行」摘要。
-   源码优先 `grep` 关键字 / 函数名定位，不要从头读到尾；源码文件应按职责拆到**单文件可整读**的规模
    （超过 ~500 行且多职责的文件是拆分信号），而不是靠符号地图之类的派生文档止痛。
-   **定位菜谱**：查 `spec.md` 某节 → 先 `grep -n '^## ' doc/spec.md` 拿节行号，再 `sed -n 'A,Bp'`
    截取该节；查 `testplan.md` 某场景 → `grep -n '| F7 ' doc/testplan.md`；查历史周期 →
    `grep -n '0\.7\.15' doc/log-archive.md`。按状态决定读多少：✅ 的场景/已归档周期**不读**。

### 3.1 文档结构

| 文件                       | 职责                                                            | 何时改                          |
| -------------------------- | --------------------------------------------------------------- | ------------------------------- |
| `README.md`/`README.zh.md` | 简介：功能 + 安装 + 命令一览（商店渲染的门面）                  | 功能变化时                      |
| `doc/spec.md`              | 详细规格 / 设计决策 / Roadmap                                   | 涉及规格改动时                  |
| `doc/log.md`               | 详细交接日志（倒序，**仅保留最新 N 周期块**）                   | 每周期追加新块，收尾跑归档脚本  |
| `doc/log-archive.md`       | 由 `log.md` 滚动出去的历史周期块（倒序）                        | 归档脚本自动维护，**平时不读**  |
| `doc/status.jsonl`         | 状态索引（首行总览 + 最新 N 条周期概括，倒序）                  | 每周期更新，收尾脚本滚动        |
| `doc/status-archive.jsonl` | 由 `status.jsonl` 滚动出去的历史概括行（倒序）                  | 归档脚本自动维护，**平时不读**  |
| `doc/testplan.md`          | 场景真值表：操作序列 + 预期结果 + 状态（✅/❌/⚠️/🔲）+ 已知 bug | 加功能 / 修 bug 时先改这里      |
| `doc/grill.md`             | 拷问式方向审查记录（推理过程与否决理由，长期保留）              | 大方向重审时追加                |
| `doc/marker-contract.md`   | 标记字符契约（英文，面向下游的字节格式与稳定性承诺）            | 格式/承诺变化时（须主版本迁移） |

`testplan.md` 与 `tests/dev_tests/`（自动化单测）、`tests/user_tests/`（实测样例）一一对应。

> **文档维护脚本化**：`scripts/docs.mjs`（`npm run docs`）负责机械整理——归档 `log.md` 旧周期块、
> 滚动 `status.jsonl`、打印 `testplan` 摘要、校验 `status.jsonl` 与「目录结构约定」常青块（与磁盘
> 双向比对，防漂移）。Agent 只写语义内容（新周期块、状态概括），**机械的挪动交给脚本**。

> **单一事实源纪律**：同一份设计 / 状态只**详写在一处**（规格→`spec.md`，验证设计→`testplan.md`，
> 周期细节→`log.md`），其他文件只放一行概括 + 链接，不复制表格。临时分析 / 调研文档一旦结论
> 落进上述常驻文件，**原文件即删**，不留副本。

## 4. 通用开发流程

1. `npm install`（首次或依赖变化时）。
2. `testplan.md`：**先**在其中加 / 改场景行（操作 + 预期 + 初始状态），再动代码。
3. 改代码，配套补 / 改 `tests/dev_tests/` 与 `tests/user_tests/`，可追溯回 testplan 场景 ID。
4. 质量门槛全绿：`npm test`、`npm run lint`、`npm run format:check`。动核心逻辑后额外跑一遍 `npm run test:fuzz`；修好已登记 bug 后放开对应的随机测试约束。
5. 重新生成 `release/`（`npm run release`）并随提交入库。
6. 回填 `testplan.md`：场景行状态 🔲/❌ → ✅，更新已知 bug 汇总。
7. **bump 版本号**：`npm run bump` 一键同步（见 §4.1）。
8. 更新 `doc/log.md`（顶部追加新周期块）与 `doc/status.jsonl`（见 §3）。
9. **跑文档维护脚本**：写完新周期块后跑 `npm run docs`，把旧块归档进 `log-archive.md`
   （顺带打印 testplan 摘要做收尾自检）。**先写后挪**：脚本只搬旧块，不动你刚写的新块。
10. 提交。

> 一句话流程：改代码+测试 → `npm run bump` → 写 `log.md` 新块 + `status.jsonl`
> → **`npm run preflight`**（一条命令 = docs 归档 + release 重建 + test + lint + format:check）→ 提交。

### 4.1 版本号

格式 `0.M.*`：`M` = 当前 Milestone，`*` 在该里程碑内持续递增至满意再进入下一个。**凡实质改动（含纯文档）都要 bump `*`**，同步 `manifest.json` / `package.json` / `versions.json` 及 lockfile、`release/` 副本。

> **一键 bump**：`npm run bump`（打磨递增 `*`）/ `npm run bump minor`（进新 Milestone，`*` 归零）/
> `npm run bump 0.7.0`（显式），它会一次性同步上述全部文件，免去手改 4~5 处。

> **上架后策略**（1.0.0 起适用，见 `doc/spec.md` §5 M7）：改为**仅行为 / 产物变化才 bump** manifest
> 版本——纯文档改动只记 `log.md`，避免向线上用户推送无内容更新。

## 5. Git 与提交

-   Commit message 用中文，Conventional Commits：`feat: …`、`fix: …`、`docs: …`、`chore: …`。
-   提交自包含：源码 + 测试 + 产物（`release/`）+ `doc/log.md`。
-   **仅在用户明确要求时才创建 Pull Request。**

### 5.1 会话收尾：合并回 `master`（用户长期授权）

质量门槛全绿后：工作分支自包含提交并推送 → `checkout master` → `pull` → `merge --no-ff <分支>` → 推 `master`。网络失败按 2/4/8/16s 退避重试。有冲突或行为存疑就停下问用户。长期授权**仅限合并到 `master`**。

## 6. 当前状态

见 [`doc/status.jsonl`](./doc/status.jsonl) 首行（版本 + 一句话现状 + 下一步）与
[`doc/log.md`](./doc/log.md) 最新周期块。不在本文件复述，避免与 status/log 双份维护、彼此漂移。

## 7. 开发环境

SessionStart 钩子（`.claude/hooks/session-start.sh`，由 `.claude/settings.json` 挂接）在远程会话
启动时自动安装依赖，并启用共享 git 钩子（`git config core.hooksPath .githooks`）。

**pre-commit 文档守卫**（`.githooks/pre-commit`）：提交时若本次有暂存改动，跑
`node scripts/docs.mjs --check`——`log.md` 周期块超上限（忘归档）、`status.jsonl` 概括行超上限
（忘滚动）、或「目录结构约定」常青块与磁盘不一致（新增/拆分文件忘回填），任一命中即**拦下提交**。
修复：跑 `npm run docs`（目录树漂移需手动修缮 log.md 该块）后 `git add` 重提；确需跳过用
`git commit --no-verify`。本地克隆首次需手动 `git config core.hooksPath .githooks`（远程会话由
SessionStart 自动设）。

**CI**（`.github/workflows/ci.yml`）：push 到 `master` 与 PR 时跑完整质量门槛（文档守卫 + test +
lint + format:check + build）——pre-commit 可被 `--no-verify` 跳过，CI 是机器兜底。

> 历史备注：这三项曾在私有 monorepo 迁移到本独立仓库时遗漏，2026-07-03 按单项目结构补回
> （原 monorepo 版按多 Addon 循环处理，本仓库只有一个项目，已简化为直接对仓库根跑）。
