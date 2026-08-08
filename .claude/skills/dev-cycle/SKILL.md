---
name: dev-cycle
description: Auto Headings 开发周期的完整收尾清单：testplan 先行 → 改代码与测试 → 质量门槛 → 重建 release → bump 版本号 → 写 log.md/status.jsonl → preflight → 提交。开工做实质改动、或准备收尾提交时读它。
---

# 开发周期流程

1. `npm install`（首次或依赖变化时）。
2. `testplan.md`：**先**在其中加 / 改场景行（操作 + 预期 + 初始状态），再动代码。
3. 改代码，配套补 / 改 `tests/dev_tests/` 与 `tests/user_tests/`，可追溯回 testplan 场景 ID。
4. 质量门槛全绿：`npm test`、`npm run lint`、`npm run format:check`。动核心逻辑后额外跑一遍 `npm run test:fuzz`；修好已登记 bug 后放开对应的随机测试约束。
5. 重新生成 `release/`（`npm run release`）并随提交入库。
6. 回填 `testplan.md`：场景行状态 🔲/❌ → ✅，更新已知 bug 汇总。
7. **bump 版本号**：`npm run bump` 一键同步（见下）。
8. 更新 `doc/log.md`（顶部追加新周期块）与 `doc/status.jsonl`（见 `CLAUDE.md` §3）。
9. **跑文档维护脚本**：写完新周期块后跑 `npm run docs`，把旧块归档进 `log-archive.md`
   （顺带打印 testplan 摘要做收尾自检）。**先写后挪**：脚本只搬旧块，不动你刚写的新块。
10. 提交。

## 版本号

格式 `0.M.*`：`M` = 当前 Milestone，`*` 在该里程碑内持续递增至满意再进入下一个。**凡实质改动（含纯文档）都要 bump `*`**，同步 `manifest.json` / `package.json` / `versions.json` 及 lockfile、`release/` 副本。

> **一键 bump**：`npm run bump`（打磨递增 `*`）/ `npm run bump minor`（进新 Milestone，`*` 归零）/
> `npm run bump 0.7.0`（显式），它会一次性同步上述全部文件，免去手改 4~5 处。

> **上架后策略**（1.0.0 起适用，见 `doc/spec.md` §5 M7）：改为**仅行为 / 产物变化才 bump** manifest
> 版本——纯文档改动只记 `log.md`，避免向线上用户推送无内容更新。
