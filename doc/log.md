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

---

## 2026-11-04 发版 1.3.1：拉丁词误判 + 纯编号标题叠号 + 新装重启切写入（交接：claude/release-1.3.1 → master，tag 1.3.1）

### 做了什么

- `npm run bump`：1.3.0 → 1.3.1；`doc/release-notes/1.3.1.md` 双语，致谢 @smallerxie（PR #11）。
- 合入三项修复（11-03 / 11-04 见下方两块，10-29 已滚入 log-archive.md）：10-29「标题本身就是编号」不再叠号（J25 / J26 / V77）；11-03 PR #11 + 后续，拉丁词开头的标题不再当手写编号（J27 / J28 / H21）；11-04 新装 `templates/` 懒建，重启不再切写入（V5 / V78 / V79）。
- testplan 状态格「未发版」→「1.3.1」；spec 3.10 / 3.22 / Roadmap 本次条目同步。

### 没做什么

- J25 / J26（纯编号标题）真机只看了守卫不叠号，提示文案未单独确认；iOS / Android / macOS / Linux 未上真机。
- 「数字 + 空格」误判（`2024 总结`，写入模式下任一即拦）与 `Step 1` 漏判未修，已提新会话卡片「手写编号识别改为整篇判断（序列证据）」。

### 下一步

- 推送 master 与 tag 后核实 Release 工作流产物；用户到 Community Hub 点「Check for new releases」。

### 验证方式

- `npm run preflight` 全绿（唯一红为已知 ICU 排序假红 whitelist.test.ts）；真机见 11-03 / 11-04 两块。

---

## 2026-11-04 新装后重启一次就从「仅显示」变成写入（未发版，交接：claude/fresh-install-restart-mode → claude/fresh-install-no-templates-dir）

### 做了什么

- 起因：真机验 PR #11 时，Test 库（新装、没改过设置）替换插件重载后进了写入模式，笔记被写上编号。根因：新装判据 `isFreshInstall` 看「data.json 为空且没有 `templates/`」，而 `TemplateStore.init` 首次加载就自己建了 `templates/default.json`、新装分支又刻意不落盘 data.json（V4）——第二次启动被认成「从没改过设置的老用户」切到写入。原 V5 顺序约束只保住了第一次加载。
- 第一版（`6f58e56`，已被取代）用 vault 级 `localStorage` 记「判过新装」；用户追问全平台后改掉：移动端 WebView 存储可能被系统回收，也不随同步走（新装库同步到第二台设备照样切写入）。
- 最终方案：**`templates/` 懒建**（`src/templates/TemplateStore.ts`）。`init` 不建目录、不写文件，默认模板走内置默认；`create` / `save` / `rename` 写前过 `ensureDir`，第一次建目录**之前**回调主插件 `saveSettings`（先 data.json 后目录，中途失败最多是有设置无模板）。新装不改设置时磁盘零写入，各设备都判为新装；老用户目录已在，行为不变、不额外落盘。
- testplan V5 改写、V78 改写、新增 V79；spec 3.22 / 3.6 / 4 / 7 同步；`tests/dev_tests/fake-disk.ts`（最严格平台语义：`write` 不自动建父目录、`list` 对缺失目录抛错）+ `template-store.test.ts` 5 例 + `settings.test.ts` V78 / V79 走真实重启链路。

### 没做什么

- 真机已验（用户 Windows Test 库：V78 卸载重装 + 重载两次、V79 只改白名单）；iOS / Android / macOS / Linux 未上真机，靠 `fake-disk` 最严格语义兜底。1.2.0–1.3.0 期间已被切到写入的库不回迁（目录已在，无从区分）。
- 已知边界（spec 3.22）：新装用户改过模板后，另一台设备先同步到 `templates/`、data.json 未到时启动，会短暂按写入处理——与 V6 同类，接受。

### 下一步

- 真机验 V78 / V79 与 PR #11 三篇验证笔记，通过后发 1.3.1（含 10-29、11-03、本块三项修复；发版说明致谢 @smallerxie）。

### 验证方式

- `settings.test.ts` + `template-store.test.ts` 28/28；全量 1076/1077（唯一红是已知 ICU 排序假红）；lint 0 错误；docs 守卫全过。
