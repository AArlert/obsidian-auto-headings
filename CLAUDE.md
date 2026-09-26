# CLAUDE.md

本仓库是 Obsidian 插件 **Auto Headings**（按模板自动为 Markdown 标题编号）的**独立发布仓库**，
对外发布名 `AArlert/obsidian-auto-headings`，用于向 Obsidian 社区插件目录提交与分发。

> 动手前：先读本文件，再跑 `npm run docs -- --handover`（见 §3）。
> 规格：[`doc/spec.md`](./doc/spec.md)（顶层索引，正文一节一文件在 `doc/spec/`）。

## 0. SubAgent 派发：输出长才派

默认主模型自己干。只有**输出会很长**、放进主上下文不划算时才派 SubAgent（定义在
[`.claude/agents/`](./.claude/agents/)），让子上下文吸收长输出，主上下文只收结构化摘要：

| 场景                                                 | 派给                      | 期望返回                           |
| ---------------------------------------------------- | ------------------------- | ---------------------------------- |
| `npm run test:fuzz`；门槛失败、需要翻大量报错 / 堆栈 | `quality-gate`（haiku）   | 每项 PASS/FAIL + 失败要点，≤25 行  |
| 边界清晰、可独立并行的编码任务                       | `feature-coder`（sonnet） | 摘要 + 触碰文件 + 门槛结果，≤25 行 |

大范围只读检索（翻 log-archive、跨多文件汇总线索）用内置的 Explore 代理；绿灯路径不派——质量门槛直接跑
`npm run check`（只报问题），读单个 spec 节、单个 testplan 场景组、grep 一个符号，主模型直接做。
子代理两次失败就换 sonnet 重派或主模型接管，根因记入当期 log 块。

**输出契约**：结论先行；引用一律 `file:line`；禁止整段粘贴命令输出或文件内容；超长即返工。

**主模型保留**：需求澄清、架构决策、testplan 语义设计、log.md 周期块、发版、commit、合并。

## 2. 语言与代码风格

-   **所有注释、文档、commit message、PR 描述一律简体中文**；标识符用英文；面向用户的字符串用中文。
-   界面双语目标：中文 + 英文（已于 0.6.5 落地，见 `doc/spec.md` §3.11）。
-   遵循仓库自带的 `.prettierrc.json` / `.eslintrc.json` / `tsconfig.json`。提交前跑 `npm run format` 与 `npm run lint`。
-   TypeScript `strict: true`、ESM；公共导出写中文 JSDoc（意图 + 边界情况）。

## 3. Agent 交接与记忆系统 ★

**接手第一条命令**：`npm run docs -- --handover`——一次打印「当前版本 + `doc/log.md` 最新周期块 +
近期周期索引 + testplan 待办摘要」。当前状态与下一步只写在 log 最新周期块里，不另设状态文件。

**每个开发周期结束必须**在 `doc/log.md` 顶部追加周期块（写哪些字段见 `dev-cycle` 第 6 步），写完跑
`npm run docs`，脚本把超出保留数的旧块滚进 `log-archive.md`。

**省 token 读盘纪律**：

-   `log.md` 只读**最新一块**；更早历史在 `log-archive.md`，按需 grep，**勿整读**。
-   spec / testplan 先看顶层索引（`doc/spec.md`、`doc/testplan.md`），再打开对应分节文件——一节 /
    一组一文件，均可整读。✅ 的场景组与已归档周期**不读**。
-   源码优先 `grep` 关键字 / 函数名定位，不要从头读到尾；源码文件应按职责拆到**单文件可整读**的规模
    （超过 ~500 行且多职责的文件是拆分信号），而不是靠符号地图之类的派生文档止痛。
-   **定位菜谱**：spec 某节 → `ls doc/spec/3.22-*`（文件名以节号开头）；testplan 某场景 →
    `grep -rn '| F7 ' doc/testplan/`；历史周期 → `grep -n '0\.7\.15' doc/log-archive.md`。

### 3.1 文档结构

| 文件                                | 职责                                                                                                                                                               | 何时改                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `README.md`/`README.zh.md`          | 商店门面：卖点 + 快速上手 + 命令 + FAQ，**只写用户看得懂、看了想装的话**，技术细节一律下沉使用指南；**不放图片占位**（断图过不了商店审查），链接用 GitHub 绝对地址 | 功能变化时                                                                     |
| `doc/user-guide.md`/`.zh.md`        | 面向用户的完整使用指南（双语）：全部设置、边界情况、标记字符影响、导出、干净卸载——README 不讲的细节都在这                                                          | 功能 / 行为变化时（与 README 同步）                                            |
| `doc/spec.md` + `doc/spec/`         | 规格 / 设计决策 / Roadmap：`spec.md` 是顶层索引（只放各节标题链接），正文一节一文件，文件名 = `节号-短名.md`                                                       | 涉及规格改动时（增删改节文件同步索引）                                         |
| `doc/testplan.md` + `doc/testplan/` | 场景真值表：`testplan.md` 是顶层索引；场景组 A–V 一组一文件（操作序列 + 预期结果 + 状态 ✅/❌/⚠️/🔲），另有使用说明 / 核心理念 / 已知 bug / UVM 章                 | 加功能 / 修 bug 时先改这里                                                     |
| `doc/log.md`                        | 周期交接日志（倒序，**仅保留最新 N 周期块**）                                                                                                                      | 每周期追加新块，收尾跑 `npm run docs`                                          |
| `doc/log-archive.md`                | 由 `log.md` 滚动出去的历史周期块（倒序）                                                                                                                           | 脚本自动维护，**平时不读**                                                     |
| `doc/marker-contract.md`            | 标记字符契约（英文，面向下游的字节格式与稳定性承诺）                                                                                                               | 格式/承诺变化时（须主版本迁移）                                                |
| `doc/release-notes/*.md`            | 各版本发布说明（双语；Release 工作流打 tag 时按 `<tag>.md` 取用）                                                                                                  | 每次打 tag 发版前写好对应文件                                                  |
| `doc/research/`                     | **本地调研留档，`.gitignore` 排除、不入库**（见该目录 `README.md`）——竞品拆解等含源码行号 / 攻击性表述的原始材料，公开发布仓库放不得                               | 单条结论按附录 A 口径改写后落进 `doc/spec/`、`doc/testplan/`；原始报告留在本地 |

testplan 与 `tests/dev_tests/`（自动化单测）、`tests/user_tests/`（实测样例）一一对应。

> **文档维护脚本化**：`scripts/docs.mjs`（`npm run docs`）负责机械整理与一致性校验——归档 `log.md`
> 旧周期块、打印 testplan 待办摘要，并守住三件事：索引 ↔ 分节文件双向一致且节号唯一、文档里的
> 相对链接与锚点都能解析、`doc/spec/4-架构设计.md`「目录结构约定」与磁盘一致。Agent 只写语义内容
> （新周期块、规格与场景），**机械的挪动与校验交给脚本**。

> **单一事实源纪律**：同一份设计 / 状态只**详写在一处**（规格→`doc/spec/` 某节，验证设计→
> `doc/testplan/` 某组，周期细节→`log.md`，流程→`dev-cycle` 技能），其他文件只放一行概括 + 链接，
> 不复制表格。临时分析 / 调研文档一旦结论落进上述常驻文件，**原文件即删**，不留副本——
> **`doc/research/` 是唯一例外**：它是故意长期保留的本地引用库（不入库、不随克隆/其他机器带走），
> 结论摘要照常落进常驻文件，但原始报告**不删**，供日后需要溯源 / 深挖细节时回查。

## 4. 通用开发流程

开发与发版流程的**唯一出处**是 `dev-cycle` 技能（`.claude/skills/dev-cycle/SKILL.md`）：testplan 先行、
质量门槛、回填、log 周期块、preflight、提交；版本号只在发版时 bump，真机测试走 BRAT beta。
**做实质改动、准备收尾提交或发版前先读它，不可跳步。**

## 5. Git 与提交

-   Commit message 用中文，Conventional Commits：`feat: …`、`fix: …`、`docs: …`、`chore: …`。
-   提交自包含：源码 + 测试 + 产物（`release/`）+ `doc/log.md`。
-   **仅在用户明确要求时才创建 Pull Request。**

### 5.1 会话收尾：合并回 `master`（用户长期授权）

质量门槛全绿后：工作分支自包含提交并推送 → `checkout master` → `pull` → `merge --no-ff <分支>` → 推 `master`。网络失败按 2/4/8/16s 退避重试。有冲突或行为存疑就停下问用户。长期授权**仅限合并到 `master`**。

## 7. 开发环境

**本地克隆首次需手动** `git config core.hooksPath .githooks` 启用 pre-commit 文档守卫（远程会话由
SessionStart 钩子自动设）。守卫拦下提交时的修复姿势：log 周期块超限就跑 `npm run docs` 后 `git add`
重提；索引、链接、目录树漂移**脚本修不了**，按报错手动修缮对应文件；确需跳过用 `git commit --no-verify`。
