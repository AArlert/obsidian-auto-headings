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

## 2026-11-08 1.3.2 收口：仅显示模式按级别过半、清除全库只清插件编号、门槛变真绿（未发版，交接：claude/foreign-lead-words）

### 做了什么

- **需求来源**：与用户评审 1.3.2 的投入，定中心需求——带手写编号的笔记能清掉、接管；`API 要求` 这类不被误清。拿主力库
  对照：不误清一侧已到位；接管一侧写入模式到位，但新装默认的仅显示模式在 18 篇带手写编号的笔记里只认出 1 篇。
- 仅显示模式外来编号判定加「按级别过半」（`cleanup.ts` `isMostlyForeignHeadings`）：某一级至少 2 个「确定」或纯编号、
  且占该级过半即整篇不叠编号、弹提示。主力库 1 → 3 篇（Oceanus、求职追踪、时钟网络），正是整级手写编号的三篇；只有零星
  一两处的（`〇、一屏结论`、一串 `① 「问题」`）照常显示。testplan V81，spec 3.22。
- 「清除全库编号」只清插件写的编号（`CleanupOptions.keepForeign`）：手写编号一个字节不动，提示改报「另有 M 个文件带手写编号，
  未动」并指向本篇菜单「清理手写编号…」（文案键 `noticeClearedVaultUnsure` → `noticeClearedVaultForeign`，10 种语言）。
  用户确认没用过、也没见过反馈批量清手写编号；它是唯一会大面积删用户手写文字又撤销不了的路径。testplan H24（取代 H23 清库一半），
  spec 3.10，用户指南中英，探针 `vault-clear-tiers.js` 改按新行为。「清除当前文件编号」不变。
- 前导词分支保留并入 1.3.2：评审时曾提议撤回，复核后改主意——源码约 77 行，且补的 `第一部分` / `第1步` 在 master 上完全认不出；
  词表冻结，只按反馈加词（Roadmap 记了不做通用「单词 + 数字」的理由）。孤立的 `1 概述`（值 = 同级序位）保留为确定。
- 门槛变真绿：`whitelist.test.ts` 的 A–Z 断言改为只断言各语言一致的部分（产品仍按系统语言排序，中文按拼音）；加 `.gitattributes`
  统一 LF，本机全量 prettier 不再误报。本机 `npm run check` 首次全绿。
- `release/` 移出版本库（`.gitignore`），发版本来就由 Release 工作流现场构建；CLAUDE.md §5、dev-cycle、spec 4 / 7 同步。
- 新增 `CONTRIBUTING.md`（中英）与 CLAUDE.md §6「外部贡献者」：不碰 log、版本号、发布说明，testplan 状态填 🔲。起因是外部贡献者
  rps007 的 fork 分支（双小写字母序号样式，尚未开 PR）照着本仓库 CLAUDE.md 写了周期块、打了包，必然冲突。
- dev-cycle 第 2 步加「需求来源」一行与「推测性需求先进 Roadmap」；改手写编号识别须跑 `foreign-corpus.mjs --expect` 对答案。
  脚本新增 `--expect`：按守卫 / 仅显示 / 各标题档位比对答案文件，不符即非零退出。主力库答案 `doc/research/foreign-answers-oblivion.json`
  （不入库，人工逐条核对）；撤掉按级别过半时它报出 2 处不符，验证有效。

### 没做什么

- 真机未测（V81、H24、前导词 J35）；手机端未测。
- 未发版：版本号未 bump，未写 `doc/release-notes/1.3.2.md`，未打 tag；PR #11 未回复。
- rps007 的双小写字母分支：等对方开 PR，拟排 1.3.3；需提的修改见本会话评审（下拉文案只写例字 `aa, bb, cc`、别改 log / 产物）。
- testplan 积压（49 🔲 / 14 ⚠️）未清理。

### 下一步

- 真机过一遍 V81 / H24 / J35（Obsidian CLI 探针或手动），然后发 1.3.2：bump、写双语发布说明、打 tag，回复 PR #11。

### 验证方式

- `npm run check` 全绿（docs 守卫、1125 个测试、eslint、prettier）；`node scripts/foreign-corpus.mjs <主力库> --expect
  doc/research/foreign-answers-oblivion.json` 全部相符（确定 76 / 存疑 35，守卫拦 18 篇，仅显示不叠编号 3 篇）。
  未跑 `test:fuzz`（未动编号引擎）。

---

## 2026-11-05 手写编号识别补前导词：`Step 1` / `Chapter 2` / `§1` / `第1步` / `第一部分`（未发版，交接：claude/foreign-lead-words）

### 做了什么

- 修漏判：`Step 1 安装` 这类标题此前对不上手写编号正则，守卫不拦，写入模式会叠成 `1 Step 1 安装`。`strip.ts` 的
  `matchForeignPrefix` 加前导词封闭短表（Step / Chapter / Part / Section / Lesson / Lecture / Unit / Module / Phase / Stage /
  Appendix / Week / Day，首字母大小写与全大写，及 `§`），结果多交出 `lead`；量词加 `步`、`部分`，只认 `第` 起头的
  （`3步`、`两部分` 是数量）。`isNumberOnlyHeading` 认 `# Chapter 2`、`## Day 1`、`Part II` 这类只有前导词 + 序号的标题。
- `foreignassess.ts`：带前导词的形状封顶为「中」（`Part 2 of the series` 这类正文常见），成串、上下级、值 = 序位照常升档；
  前导词计入读法签名，不同前导词、有无前导词不互相成串；前导词后的字母不按拉丁词、冒号不按标签处理（`Appendix A: 术语`）。
- testplan J35 新增并 ✅；spec 3.10「按置信度分级」、Roadmap（并记下 `number headings` 属性的评估结论）、用户指南中英同步。
- 评审定：剥时连前导词一起去掉；单独一个、恰是同级第 1 个的 `Step 1` 算确定；带标点的前导词也封顶存疑；Week / Day 留在表里
  （去掉会在写入模式叠成 `1 Week 1 计划`，删字只在用户主动跑命令时发生）。
- 评审中抓出上一块的漏洞并修：「值 = 同级序位」绕过了成串的重名否决，`Week 1 计划` / `Week 2 计划`（纯数字的 `1 计划` / `2 计划`
  同理）被各自升回确定，清除命令会剥成两个 `计划`。现在剥后与同级标题（含本就没编号的）重名的不走这条，只算存疑（J30 补行）。
  强形状（`1. 计划` / `2. 计划`）不受影响——明确写法照旧确定。
- 同场评估了 Roadmap 第 3 步（守卫提示只弹一次 + 状态栏）：建议等 1.3.2 上线、用一阵再定。

### 没做什么

- 真机未测；主力库 Oblivion 没有这类标题（只有 10 个 UVM 的 `phase …`，正确地未被认），语料统计前后完全一致，漏判一侧
  只有单测覆盖。
- 守卫提示只弹一次、`number headings` 属性证据未做（见上）；1.3.2 未发、PR #11 未回复。

### 下一步

- 与用户评审本块后决定是否并入 1.3.2 发版，发版后回复 PR #11。

### 验证方式

- `npm run check` 的测试全过（唯一红为已知 ICU 排序假红 whitelist.test.ts），eslint、tsc 通过；改动文件
  `prettier --end-of-line auto --check` 通过（本机 CRLF 误报）；`npm run test:fuzz` 全绿；`node scripts/foreign-corpus.mjs`
  主力库改动前后统计一致（确定 74 / 存疑 34，守卫拦 17 篇）。

---

## 2026-11-04 手写编号按置信度分级：整篇判定确定 / 存疑（未发版，交接：claude/foreign-confidence-tiers）

### 做了什么

- 新增 `src/foreignassess.ts` 的 `assessForeignNumbering`：形状分强 / 中 / 弱，再用同级成串、上下级对得上、「值 = 同级序位」升为「确定」，量词否决孤立猜测、重名与「同字起头的字母修饰语」否决成串。`strip.ts` 拆出 `matchForeignPrefix`（同一条正则交出组成部分），`stripForeignNumbering` 行为不变。
- 各入口改按档位（spec 3.10「按置信度分级」）：守卫只认确定；仅显示过半只数确定与纯编号；预览框存疑默认不勾、全不勾时按钮为「不清理，直接编号」；清理 / 清除命令只剥确定，存疑跳过并在提示里给「检查…」（清除命令点开的框只剥不套模板）；清除全库提示带存疑篇数。新增 4 条文案 × 10 语言，并改了预览框说明。
- `scripts/foreign-corpus.mjs`：用当前源码过一遍某库的标题、对照 1.3.1 单标题正则。主力库 Oblivion（323 篇 / 3539 标题）：确定 74 个全是真编号，存疑 34 个全是数量短语与一个日期；守卫会拦的笔记 33 → 17 篇。实测中抓出并修掉三处误判：单字量词挡串（`2 分析`）、字母 + 冒号标签（`Q：` / `ID：`）、`A 档` / `B 档` 修饰语串；另修孤立 `⑤ 「…」` 被降成存疑。报告在 `doc/research/`（不入库）。
- testplan J29–J34、H23、V80 新增并 ✅；H5（孤立 `1.1 标题` 被误剥）随之解决。

### 没做什么

- 真机（主力库 Oblivion，经 Obsidian CLI `eval` 跑新探针 `tests/probes/foreign-tiers.js`）全过：两篇真实笔记照常显示编号且未被改动；守卫、预览框默认勾选与按钮、两个命令的「检查…」、仅显示过半均符合预期。实测抓出清除命令提示「…恢复接管。；另有…」重复标点，已在 main.ts 统一去掉原提示末尾句号（+ 单测）。清除全库另在 Test 库用探针 `tests/probes/vault-clear-tiers.js` 真机跑过，全过（库内原有笔记跑前备份、跑后还原）。用户指南（中英）补了「拿得准 / 拿不准」一节。未测：手机端。
- Roadmap 第 3 步（守卫提示只弹一次 + 状态栏常驻）、`Step 1` / `Chapter 2` 前导词、`number headings` 属性证据未做。
- PR #11 仍未回复（本机无 `gh`）。

### 下一步

- 真机试一轮后决定是否发 1.3.2（含上一块的清除命令修复与本块）。

### 验证方式

- `npm run check` 的测试与 eslint 全过（唯一红为已知 ICU 排序假红 whitelist.test.ts）；本机 CRLF 工作副本下 prettier 全量检查会误报，改动文件单独 `prettier --check` 通过；`npm run test:fuzz` 全绿；语料脚本见上。
