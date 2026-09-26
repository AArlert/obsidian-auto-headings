# obsidian-auto-headings 开发日志与协作交接

本文件用于多 agent / 多人协作的**握手交接**：每个开发周期结束时，记录「做了什么、没做什么、
下一步干嘛」，让接手者无需通读全部代码即可继续。倒序排列（最新在最上），当前状态与下一步以
最新一块为准。

**接手**：第一条命令跑 **`npm run docs -- --handover`**（见根 [`CLAUDE.md`](../CLAUDE.md) §3），一次打印
「当前版本 + 本文件最新块 + 近期周期索引 + testplan 待办」；更早的来龙去脉按需翻
[`log-archive.md`](./log-archive.md)，**不必从头通读**。周期块何时写、写什么，见
[`dev-cycle` 技能](../.claude/skills/dev-cycle/SKILL.md)（流程的唯一出处）。

> **注**：历史条目中出现的「README §X.Y」均指原规格文档（已更名为 `spec.md`，章节号不变）；
> 2026-09-26 起 spec / testplan 拆成「顶层索引 + 分节文件」，此前条目里的 `spec.md#锚点`、
> `testplan.md` 行号指当时的单文件，请按 § 号 / 场景 ID 查 [`spec.md`](./spec.md)、[`testplan.md`](./testplan.md) 索引。

---

## 2026-09-26 仓库与流程瘦身（不 bump，交接：claude/agent-workflow-review-b9lj22）

### 做了什么

- 口径：只删**重复内容**与**已在 log-archive / git 里有记录的历史**；已落地功能的设计如果只写在 Roadmap 里，
  就先搬进 spec 再删，不丢信息。插件行为零改动，`release/` 字节不变。
- **Roadmap 37KB → 21KB**：已完成的里程碑与条目压成一行（版本 + 规格 / testplan 指针），M14 整节删（规格在
  §3.22）；M13 的设计只写在 Roadmap 里，迁成新节 **spec §3.23**（标题链接建议与 VC 联动）；M9 的两条划线重定向、
  已落地项与「调研同时产出」备注删；执行顺序表只列未完成的。
- **testplan**：§3.1「已修 bug」表并入场景行——根因与修复版本写进对应场景行的状态格（单一出处）；其中 N1–N3
  与场景组 N（startIndex）撞号，改名 TPL-refresh / TPL-add-lag / PR-drag 移入 §3.4 集成层 bug，`src/main.ts`
  注释的引用同步；删已失效的「方案A 前历史取舍」注记。
- **spec 去历史**：§3.12 三条划线「已修」条目改写为现行设计说明（快照基线、WJ 与链接解析、同文件内链走同一事务）；
  §2.2 两条翻案的非目标改写为仍然成立的非目标，删掉已做完的「多文件批量重新编号（后续版本）」。
- **流程**：删 `repo-scout` / `mech-editor` 两个 agent（与内置 Explore / general-purpose 重复），只留
  `quality-gate` / `feature-coder`；CLAUDE.md 删与 §3 重复的 §6、过时的「log 导语有专属规则」，log 块字段改指向
  dev-cycle；dev-cycle 第 5 步不再要求同步已知 bug 表；`tests/user_tests/README.md` 从未填过的「手动回归记录」表
  改为一句指针（结果只回填 testplan 场景行）。
- **仓库**：`sync-release.mjs` 去掉无人使用的 zip 打包（Release 工作流直接传三个文件），删 `adm-zip` 依赖；
  锁文件手工删两处条目，npm 10.9.7 与 npm 11.20.0 下 `npm ci` 均通过。

### 没做什么

- 现行规格正文（附录 A、§3.6 模板系统等大节）未删减——它们描述的是当前行为或有意保留的决策记录。
- testplan 场景行的行内版本史未压缩（真值表本身，逐行改风险大于收益）。
- 竞品调研结论仍未落 A.11（上一块的下一步不变）。

### 下一步

- 同上一块：与用户讨论竞品调研结论 → 落 A.11 + 重排 Roadmap；首次真机实测时跑通 BRAT beta 通道。

### 验证方式

- `npm run preflight` 全绿（索引 / 链接 / 目录树守卫 + 788 测试 + lint + 格式），`release/` 与提交前字节一致；
  spec 索引 ↔ 38 个分节文件一致。

---

## 2026-09-26 仓库重构：spec / testplan 拆分、停用 status、发版才 bump + BRAT beta（不 bump，交接：claude/agent-workflow-review-b9lj22）

### 做了什么

- **1.2.1 已过审上架**（用户 2026-09-26 确认）。
- 流程评审后按用户拍板重构仓库。不 bump，插件行为零改动，`release/` 与提交前字节一致：
  - **spec 拆分**：`doc/spec.md` 改为顶层索引，正文拆进 `doc/spec/` 37 个分节文件（文件名 = 节号-短名；
    节号即稳定引用 ID，代码注释里的「spec §3.22」照旧可查）。
  - **testplan 拆分 + 瘦身**：`doc/testplan.md` 改为顶层索引，场景组 A–V 一组一文件，另有 0/1/3/4 章。
    删「维护工作流程」章（与 dev-cycle 重复；「写场景的要诀」挪进核心理念）；UVM 章删掉已落地的缺口清单 /
    设计草图 / 分阶段史（历史在 log-archive），约束表与 `tests/dev_tests/uvm/README.md` 去重——README
    管「怎么用」，testplan 管「验证了什么」。场景行本身一行未动。
  - 搬家由一次性脚本完成：逐行比对 spec 2076 行 / testplan 658 行正文零差异；搬家前先修了 9 处本就失效的
    链接（§3.20 / §3.21 锚点与 GitHub 实际渲染不符、「白名单（3.6）」指错节、使用指南 LICENSE 路径）。
  - **停用 `status.jsonl` / `status-archive.jsonl`**：版本看 manifest，现状与下一步只写在 log 最新块。
  - **`scripts/docs.mjs`**：handover 改为「版本 + log 最新块 + 近期周期索引 + testplan 待办」；新增三道守卫——
    索引 ↔ 分节文件双向一致且节号唯一、文档相对链接与锚点可解析（slug 算法对照 GitHub 渲染的 143 个标题校准）、
    目录树（已从 log.md 挪到 `doc/spec/4-架构设计.md`）。
  - **单一来源清理**：log.md 三个常青块迁出（强制规则 → dev-cycle，目录结构 → spec §4，安装说明 → spec §7.2）；
    竞品下载量集中到 spec A.11「下载量快照」；Roadmap 状态订正（M14、M13 标 ✅）；testplan 节号引用订正
    （U 组 bug 在 §3.3、WL-int 在 §3.4）；CLAUDE.md §3.1 文档表、repo-scout 过期尺寸、bump.mjs 注释同步。
  - **流程**：版本号只在发版时 bump；真机（含手机）实测走 BRAT beta——`release.yml` 对 `X.Y.Z-beta.N`
    tag 只改产物里的 manifest 版本并发 pre-release，正式 tag 与 manifest 版本不一致即失败（spec §7.3、
    dev-cycle「版本号与发版」）；SubAgent 改为「输出长才派」，不再记派发次数；新增 `npm run check`
    （docs 守卫 + dot 格式测试 + lint + 格式，只报问题），preflight 改为 docs + release + check。
- 竞品调研交给 sonnet 子代理，原始报告在本地 `doc/research/2026-09-26-新竞品调研.md`（不入库）：
  找到约 14 个文档里没有的竞品 / 近邻，结论待与用户讨论后再落 A.11。
- 子代理使用：quality-gate × 1（门槛计时；实测绿灯路径派发反而更费）、general-purpose/sonnet × 1（竞品调研）。

### 没做什么

- testplan 更深的瘦身（§3.1 已修 bug 表与场景行合并、行内版本史压缩）改动的是真值表本身，留待用户拍板。
- 竞品调研结论未落 A.11，Roadmap 未按调研重排（下一周期先讨论）。
- spec 索引开头的定位导语未改（用户：定位措辞不用管）。
- 未引入官方 `eslint-plugin-obsidianmd`（需 ESLint 8→9，另起周期）；`main.ts`（2634 行）未拆。

### 下一步

- 与用户讨论竞品调研结论 → 落 A.11 + 重排 Roadmap（候选：Number Headings 迁移向导、信任包小件、
  官方 lint、拆 `main.ts`）。
- 下次需要真机实测时首跑 BRAT beta 通道（推 `X.Y.Z-beta.1` tag），验证 release.yml 的预发布分支。

### 验证方式

- `npm run preflight` 全绿：docs 守卫（索引 / 链接 / 目录树）+ 23 个测试文件 788 个用例 + lint + 格式；
  `release/` 重建后与提交前字节一致。
- release.yml 的版本校验脚本本地模拟三种 tag：`1.2.1` 通过且 manifest 字节不变、`1.2.2` 以非零退出、
  `1.3.0-beta.1` 改写产物版本并带 `--prerelease`。

---

## 2026-09-26 升 1.2.1 重发（Hub 不给同版本二次审核，交接：chore/release-1.2.1）

### 做了什么

- 上一块挪 tag 重发 1.2.0 后，Community Hub **不对同一版本号做第二次审核**，只能升版本：`npm run bump -- 1.2.1`。
  代码无改动，与重发后的 1.2.0 仅版本号不同。
- `scripts/bump.mjs`：`versions.json` 带 UTF-8 BOM（387d2fd 合并时引入，疑为 PowerShell 写入），`JSON.parse` 直接报错、
  bump 半途退出留下半套改动。`readJson` 改为先 `trimStart()`（U+FEFF 属 JS 空白）；写回不带 BOM，`versions.json` 顺带修好。
- `doc/release-notes/1.2.1.md`：商店用户从未拿到 1.2.0，故沿用 1.2.0 全文，开头加一句双语说明。
- 本周期派发 1 次（quality-gate × 1）。

### 没做什么

- 1.2.0 的 tag / Release 保留不动（GitHub 上已是修好描述的版本）。

### 下一步

- 推 tag 1.2.1 后请用户在维护者面板点「Check for new releases」，确认审核通过、公开页 Current version 变为 1.2.1。

### 验证方式

- bump 输出「1.2.0 → 1.2.1」且五处同步；preflight；Release 工作流成功、资产 attestation 查询 200。
