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

## 2026-11-04 新装后重启一次就从「仅显示」变成写入（未发版，交接：claude/fresh-install-restart-mode）

### 做了什么

- 起因：真机验 PR #11 时，Test 库（新装、没改过设置）在替换插件重载后进了写入模式，笔记被写上编号。根因：新装判据 `isFreshInstall` 只看「data.json 为空且没有 `templates/`」，而首次加载随后就建了 `templates/`、新装分支又刻意不落盘 data.json（V4）——第二次启动被当成「从没改过设置的老用户」切到写入。V4、V5 各自有测，「新装后重启」这条没人测。
- `src/main.ts`：判为新装时在 vault 级 `localStorage`（`app.saveLocalStorage`，1.8.7+ = minAppVersion）记 `auto-headings-fresh-install`，之后 data.json 为空时以它为准；有 data.json 就按内容。标记只在本机、不随同步走，V4 / V6 不变；读写失败退回目录判据。
- testplan V78、spec 3.22「新装与升级」补一条；`settings.test.ts` V78 三例。
- 1.2.0–1.3.0 已被这样切到写入的库不回迁（无从区分是否用户本意），写进 spec。

### 没做什么

- 真机还没验：Test 库已重置成新装状态（`templates/` 挪到 scratchpad、无 data.json、验证2 恢复成无编号原文），待用户重载两次确认仍是仅显示。

### 下一步

- 真机验 V78 与 PR #11 三篇验证笔记，通过后发 1.3.1（含 10-29、11-03、本块三项修复；发版说明致谢 @smallerxie）。

### 验证方式

- `settings.test.ts` 25/25；全量 1073/1074（唯一红是已知 ICU 排序假红）；lint 0 错误；docs 守卫全过。

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

---

## 2026-10-29 标题本身就是编号时不再叠编号（未发版，交接：claude/auto-headings-plugin-review-1076f5）

### 做了什么

- 起因：Grok 外部测评用 Demo 笔记（`# 第一章` / `## 第一节` / `## 第二节` / `# 第二章`）套章节模板，仅显示模式渲染成「第一章 第一章」。核实：`第一章 概述` 这类早有守卫拦截；漏的是**整行只有编号**的标题——`stripForeignNumbering` 要求编号后跟分隔符，剥不掉它，于是过半判定没算它。
- `src/strip.ts` 新增 `isNumberOnlyHeading`：只认阿拉伯 / 中文数字 / 圈码，且须带 `第`、量词、括号、末尾标点或本身是圈码；`2024`、`三`、`1.2`、`API.`、`Summary:` 不算。
- `src/cleanup.ts`：`isMostlyForeignNumbered`（仅显示模式、ah-toc、大纲同源）把它计入过半；写入模式守卫 `hasUnclaimedForeignNumbering` 在「任一可剥的外来编号」之外加「过半（含纯编号）」——纯编号不按「一个就算」，否则个别一个就永远拦住整篇。
- 提示：命中但清理预览为空（全是纯编号）时，`main.ts` 改弹「这篇的标题本身就是编号（如「第一章」），本次没有自动 / 显示编号。」，不给「查看并清理」；11 种语言加 `noticeNumberOnlyGuard`。
- testplan J25 / J26 / V77；spec 3.22 补一条；单测 4 例。

### 没做什么

- 真机没复测（Demo 笔记打开看不叠编号、提示文案）。
- `npm run test:fuzz` 在 worktree 里找不到 vitest 入口没跑；新函数只接在守卫判定上，没进编号引擎。
- 测评里的其他条目没动：改语言后命令名需重载（spec 3.11 已知限制，可用同 id 重新注册修，待定）、「固化编号并交还所有权」文案待用户定。

### 下一步

- 真机打开 Demo 笔记确认 V77 / J26，随下个补丁版发。

### 验证方式

- `npx vitest run tests/dev_tests/cleanup.test.ts`（59 例全绿）；全量 1061/1062，唯一红是已知 ICU 排序假红（whitelist.test.ts）。
