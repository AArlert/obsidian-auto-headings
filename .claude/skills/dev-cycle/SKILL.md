---
name: dev-cycle
description: Auto Headings 开发与发版流程的唯一出处：testplan 先行 → 改代码与测试 → 质量门槛 → 回填 testplan → 写 log 周期块 → preflight → 提交；版本号只在发版时 bump，真机测试走 BRAT beta。开工做实质改动、准备收尾提交或发版时读它。
---

# 开发周期

1. **接手**：`npm run docs -- --handover`；首次或依赖变化时 `npm install`。
2. **testplan 先行**（行为有变化时）：先在 `doc/testplan/<组>.md` 加 / 改场景行（操作 + 预期 + 初始状态），
   再动代码。场景写法要诀见 `doc/testplan/1-核心理念.md`。
3. **改代码**，配套补 / 改 `tests/dev_tests/` 与 `tests/user_tests/`，可追溯回场景 ID。涉及规格的同步改
   `doc/spec/` 对应节；新增 / 拆分源码文件回填 `doc/spec/4-架构设计.md`「目录结构约定」。
4. **质量门槛**：`npm run check`（docs 守卫 + 测试 + lint + 格式，只报问题）。动编号引擎（`numbering.ts`
   家族 / `parser.ts`）后额外跑 `npm run test:fuzz`；修好已登记 bug 后放开 UVM 对应约束（约束表见
   `doc/testplan/4-UVM压测.md`），放开后仍绿才算修彻底。
5. **回填 testplan**：场景行 🔲/❌ → ✅（+ 根因 / 备注），同步 `doc/testplan/3-已知bug汇总.md`。
6. **写 `doc/log.md` 周期块**（顶部追加）：日期 / 交接人（分支名）、做了什么、没做什么、下一步、验证方式。
7. **`npm run preflight`**（= `npm run docs` 归档旧块 + `npm run release` 重建 `release/` + `npm run check`）。
   **先写后挪**：脚本只搬旧块，不动刚写的新块。
8. **提交**：源码 + 测试 + `release/` + 文档自包含；收尾按根 `CLAUDE.md` §5.1 合并回 master。

## 版本号与发版

-   **开发周期不 bump**。`manifest.json` 的版本号只代表「最近一次发版」；还没发版的改动记在 log 周期块里。
-   **真机实测（含手机）走 BRAT beta**：在要测的提交上推 tag `X.Y.Z-beta.N`（`X.Y.Z` = 计划中的下一个
    版本），Release 工作流发 GitHub 预发布，只改产物里的 manifest 版本；装法见
    `doc/spec/7-开发环境搭建.md` §7.3。
-   **发版**（只有行为 / 产物变化才发，纯文档改动不发）：
    1. `npm run bump`（补丁位 +1）/ `npm run bump minor` / `npm run bump 1.3.0`：一次同步 `manifest.json` /
       `package.json` / `package-lock.json` / `versions.json` / `release/manifest.json`；
    2. 写 `doc/release-notes/<版本>.md`（双语，Release 工作流按 tag 取用）；
    3. `npm run preflight` 全绿 → 提交 → 按 §5.1 合并回 master；
    4. 在 master 上打 tag `<版本>`（不带 `v`，须与 manifest 版本一致，工作流会校验）并推送 →
       Release 工作流构建、附产物溯源证明并发布；
    5. 到 Community Hub 维护者面板点「Check for new releases」送审。manifest 的 `description` 不得含
       「Obsidian」一词；同一版本号不会二次审核，被拒后改完只能升版本重发。
