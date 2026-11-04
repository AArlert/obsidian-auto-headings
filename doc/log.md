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

## 2026-11-05 手写编号识别补前导词：`Step 1` / `Chapter 2` / `§1` / `第1步` / `第一部分`（未发版，交接：claude/foreign-lead-words）

### 做了什么

- 修漏判：`Step 1 安装` 这类标题此前对不上手写编号正则，守卫不拦，写入模式会叠成 `1 Step 1 安装`。`strip.ts` 的
  `matchForeignPrefix` 加前导词封闭短表（Step / Chapter / Part / Section / Lesson / Lecture / Unit / Module / Phase / Stage /
  Appendix / Week / Day，首字母大小写与全大写，及 `§`），结果多交出 `lead`；量词加 `步`、`部分`，只认 `第` 起头的
  （`3步`、`两部分` 是数量）。`isNumberOnlyHeading` 认 `# Chapter 2`、`## Day 1`、`Part II` 这类只有前导词 + 序号的标题。
- `foreignassess.ts`：带前导词的形状封顶为「中」（`Part 2 of the series` 这类正文常见），成串、上下级、值 = 序位照常升档；
  前导词计入读法签名，不同前导词、有无前导词不互相成串；前导词后的字母不按拉丁词、冒号不按标签处理（`Appendix A: 术语`）。
- testplan J35 新增并 ✅；spec 3.10「按置信度分级」、Roadmap（并记下 `number headings` 属性的评估结论）、用户指南中英同步。
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

---

## 2026-11-04 「清除编号」不再删拉丁词开头的标题 + 手写编号识别定方案（未发版，交接：claude/clear-no-wj-foreign-rules）

### 做了什么

- PR #11 的 @smallerxie 追问：「清除当前笔记的编号」对不带 WJ 的 `## vim 配置` 仍会删掉 `vim`。根因：`stripPrefixBroad` 对**完全没有插件痕迹**的标题也套全样式正则。改为三路：首尾哨兵都在 → 精确剥；首哨兵在、尾哨兵坏 → 仍用全样式正则；没有插件痕迹（含只有链接锚点 WJ 的）→ `stripForeignNumbering`，与「清理非本插件编号」同一口径（testplan H22，spec 3.10）。
- H3 夹具 `#### a 备注` → `#### a. 备注`（不带 WJ 时字母序号须带标点，H22 的代价）。
- 与用户讨论定下手写编号识别的精简方案，写进 Roadmap「手写 / 外来编号识别改为整篇判断」（第 2 步：成串证据 + 重名否决 + 存疑默认不勾；刻意不做逐标题记忆、标签页图标、叠号自检等），「分级预览」一条并入。用户明确：分步走补丁，不为此升 1.4。

### 没做什么

- 第 2 步（`assessForeignNumbering`）与语料脚本未开工；`2024 总结`、`1.1 标题`（H5）在清除命令里仍会被剥。
- 未回复 PR #11（本机无 `gh`，回复草稿在会话里，需用户自己贴）；未真机验证。

### 下一步

- 写本地语料脚本统计主力库标题，定第 2 步门槛；再按 Roadmap 第 2 步实现。

### 验证方式

- `npm run check`：docs 守卫、eslint、prettier 全过，测试仅已知 ICU 排序假红 whitelist.test.ts；`npm run test:fuzz` 全绿。
