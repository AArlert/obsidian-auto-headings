# CLAUDE.md

本仓库是 Obsidian 插件 **Auto Headings**（按模板自动为 Markdown 标题编号）的**独立发布仓库**，
对外发布名 `AArlert/obsidian-auto-headings`，用于向 Obsidian 社区插件目录提交与分发。

> 动手前：先读本文件，再读 [`doc/`](./doc/) 下的规格与日志。
> 详细规格：[`doc/spec.md`](./doc/spec.md)。

## 0. SubAgent 派发（省 token 核心纪律）

**能派就派**：跑测试、查定位、机械改动一律派 SubAgent（定义在 [`.claude/agents/`](./.claude/agents/)），
长输出隔离在子上下文，主上下文只收结构化摘要。

| 任务类型                             | 派给                      | 期望返回                            |
| ------------------------------------ | ------------------------- | ----------------------------------- |
| 跑 test / lint / preflight / fuzz    | `quality-gate`（haiku）   | 每项 PASS/FAIL + 失败要点，≤25 行   |
| 查 spec / testplan / 归档 / 源码定位 | `repo-scout`（haiku）     | 结论 + file:line + 最小摘录，≤20 行 |
| 重命名 / 样板 / i18n 对 / 格式修复   | `mech-editor`（haiku）    | 改动文件清单 + 自检结果，≤15 行     |
| 边界清晰的功能 / 已定位 bug          | `feature-coder`（sonnet） | 摘要 + 触碰文件 + 门槛结果，≤25 行  |

**输出契约（通用）**：结论先行；引用一律 `file:line`；禁止整段粘贴命令输出或文件内容；超长即返工。

**升级路径**：haiku 两次失败 → 换 sonnet（feature-coder 或加细任务描述重派）→ 仍不行主模型接管，
根因记入当期 log 块。

**主模型保留**：需求澄清、架构决策、testplan 语义设计、log.md / status.jsonl 周期块、bump、
commit、合并。每周期 log 块记一句「本周期派发 N 次（agent 名 × 次数）」，供回顾各 agent 去留。

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

| 文件                       | 职责                                                              | 何时改                          |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| `README.md`/`README.zh.md` | 简介：功能 + 安装 + 命令一览（商店渲染的门面）                    | 功能变化时                      |
| `doc/spec.md`              | 详细规格 / 设计决策 / Roadmap                                     | 涉及规格改动时                  |
| `doc/log.md`               | 详细交接日志（倒序，**仅保留最新 N 周期块**）                     | 每周期追加新块，收尾跑归档脚本  |
| `doc/log-archive.md`       | 由 `log.md` 滚动出去的历史周期块（倒序）                          | 归档脚本自动维护，**平时不读**  |
| `doc/status.jsonl`         | 状态索引（首行总览 + 最新 N 条周期概括，倒序）                    | 每周期更新，收尾脚本滚动        |
| `doc/status-archive.jsonl` | 由 `status.jsonl` 滚动出去的历史概括行（倒序）                    | 归档脚本自动维护，**平时不读**  |
| `doc/testplan.md`          | 场景真值表：操作序列 + 预期结果 + 状态（✅/❌/⚠️/🔲）+ 已知 bug   | 加功能 / 修 bug 时先改这里      |
| `doc/marker-contract.md`   | 标记字符契约（英文，面向下游的字节格式与稳定性承诺）              | 格式/承诺变化时（须主版本迁移） |
| `doc/release-notes/*.md`   | 各版本发布说明（双语；Release 工作流打 tag 时按 `<tag>.md` 取用） | 每次打 tag 发版前写好对应文件   |

`testplan.md` 与 `tests/dev_tests/`（自动化单测）、`tests/user_tests/`（实测样例）一一对应。

> **文档维护脚本化**：`scripts/docs.mjs`（`npm run docs`）负责机械整理——归档 `log.md` 旧周期块、
> 滚动 `status.jsonl`、打印 `testplan` 摘要、校验 `status.jsonl` 与「目录结构约定」常青块（与磁盘
> 双向比对，防漂移）。Agent 只写语义内容（新周期块、状态概括），**机械的挪动交给脚本**。

> **单一事实源纪律**：同一份设计 / 状态只**详写在一处**（规格→`spec.md`，验证设计→`testplan.md`，
> 周期细节→`log.md`），其他文件只放一行概括 + 链接，不复制表格。临时分析 / 调研文档一旦结论
> 落进上述常驻文件，**原文件即删**，不留副本。

## 4. 通用开发流程

> 一句话流程：改代码+测试 → `npm run bump` → 写 `log.md` 新块 + `status.jsonl`
> → **`npm run preflight`**（一条命令 = docs 归档 + release 重建 + test + lint + format:check）→ 提交。

**做实质改动或准备收尾提交前，读 `dev-cycle` 技能**（`.claude/skills/dev-cycle/SKILL.md`）——
完整 10 步清单（testplan 先行、质量门槛、release 重建、回填 testplan）与版本号规则（`0.M.*`
格式、`npm run bump` 各形态、上架后仅行为改动才 bump）都在那里。上面这条一句话流程是底线，
**bump 与 preflight 一步都不能省**。

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

**本地克隆首次需手动** `git config core.hooksPath .githooks` 启用 pre-commit 文档守卫（远程会话由
SessionStart 钩子自动设）。守卫拦下提交时的修复姿势：跑 `npm run docs` 后 `git add` 重提——但
「目录结构约定」常青块漂移**脚本修不了**，需手动修缮 `log.md` 该块；确需跳过用 `git commit --no-verify`。
