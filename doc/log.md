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

---

## 2026-11-03 合入外部 PR #11：拉丁词开头的标题不再被当成手写编号（未发版，交接：claude/pr11-latin-word-numbering）

### 做了什么

- 合入外部 PR [#11](https://github.com/AArlert/obsidian-auto-headings/pull/11)（@smallerxie，`5c03a19`，`merge --no-ff` 保留作者）：`stripForeignNumbering` 的字母序号从 `[a-z]+` 收窄成单字母，`## git 相关`、`## GPG 签名策略`、`## API 设计` 不再被迁移守卫拦整篇、不再被清理命令删字（testplan J27 / H21）。`stripPrefixBroad` 不收窄（要剥本插件写出的 `aa`），取舍对。
- 补 PR 漏的（testplan J28）：罗马 token `[ivxlcdm]+` 没跟着收窄，`vim 配置`、`XML 解析`、`CLI 工具`、`MVC 架构` 照旧误判；单字母 + 空格（`C 语言`、`B 站`）与 `K-means` 也是。`src/strip.ts` 新增 `isLatinWordPrefix`：命中的前缀若只有字母、后面只跟空白（或单连字符紧接字母），否决剥离。规范罗马数字判定救不了（`CLI`=151），故走「须带标点 / 括号」口径。代价：`IV 结论` 不再认。PR 原测试 `## a 备注` → `## 备注` 改为保留。
- 10 个 locale 清理框文案的误判举例「API 设计 / TODO 清单」→「2024 总结 / 3 个要点」（合入后旧例子已不成立）；spec 2.8 / 3.9 / 3.10、Roadmap「整篇判断」条补进展。

### 没做什么

- 没在 PR 上留言致谢（本机无 `gh`）；合入推送后 GitHub 会自动把 PR 标为 merged。
- 真机没测；没发版。`2024 总结` 误判与 `Step 1` / `Chapter 2` 漏判留给 Roadmap「整篇判断（序列证据）」。

### 下一步

- 随下个补丁版发（与 10-29 的「标题本身就是编号」一起）；发版说明致谢 @smallerxie。
- 启发：spec 里「已接受」的误伤（3.9 当初说守卫误判只是「跳过 + 提示」）在技术用户的笔记里代价远大于估计——Roadmap 序列证据一项值得提优先级。

### 验证方式

- `npx vitest run tests/dev_tests/cleanup.test.ts` 68/68；全量 1070/1071，唯一红是已知 ICU 排序假红（whitelist.test.ts）；lint 0 错误；`npm run docs` 守卫全过。
