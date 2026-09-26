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

## 2026-09-26 属性链接：补测试、修 YAML 引号安全、反查并上 resolvedLinks（不 bump，交接：claude/agent-workflow-review-b9lj22）

### 做了什么

- **属性（frontmatter）里的标题链接补测试**（testplan M29–M32）：新 `property-links.test.ts` 13 例、`yamlquote.test.ts`
  15 例，`main.test.ts` +4 例；真机样例 `tests/user_tests/14-属性里的标题链接.md`。Obsidian 写出的 `"[[a#简介]]"`、列表
  属性、流式序列、单引号、文本内嵌、裸值，以及属性里的 Markdown 链接，旧代码本来就能改（M29 / M31 在旧实现下即通过）。
- **测出并修掉 YAML 引号问题**（M30，旧实现下 6 例失败）：锚点含 `"` / `'`（YAML 里写作 `\"` / `''`）时匹配不上，编号后
  链接断掉；改名新引入引号 / `: ` / 反斜杠时直接写坏 frontmatter（YAML 一坏，Obsidian 丢掉该笔记全部属性）。新模块
  `src/yamlquote.ts`：扫描 frontmatter 里的引号串（只认节点起点的引号；块标量、注释、多行裸值续行不误判），双 / 单引号串
  还原转义后比对、写回时再转义；裸值等无法转义处新引入敏感字符则保守不改。随机不变量覆盖 10 种 YAML 形态 × 1500 组含
  敏感字符的改名：改写后 js-yaml 解析全部合法，引号串里全部正确更新。
- **反查取并集**（M32）：半公开 `getBacklinksForFile` ∪ 公开 `resolvedLinks`——只在属性里引用的文件也覆盖到，半公开 API
  缺失时照样同步（以前缺失就整个不同步）。
- 新增 devDependency `js-yaml`（原已在依赖树里，只给测试做 YAML 合法性断言）。
- 文档：spec §3.12（流程第 3、4 步与风险条）、§4 目录树加 `yamlquote.ts`、使用指南双语加「属性里的链接」、README 双语补
  一句；dev-cycle：开发周期的状态格写「未发版」，发版时统一换成版本号。
- 读 gurjar1/auto-heading 最新 README（v1.5.11，2026-08-26）对出差距初表（见下一步）。

### 没做什么

- M32 未真机验证（Obsidian 的两种反查是否都含「只在属性里引用」）：要用 BRAT beta。
- 竞品差距清单未落 spec / Roadmap：方向已定，逐项立项留到后续开发。

### 下一步

- **后续开发方向（用户 2026-09-26 定）**：先补 gurjar1/auto-heading 有、我们没有的功能，再吸收调研报告里其他插件的
  可取之处；逐项立项时按 dev-cycle 先写 spec 节 + testplan 行，Roadmap 排序与用户一起定。gurjar1 v1.5.11 对照差距初表：
  1. 单篇配置：快速配置对话框 + 「把当前设置存进本篇 frontmatter」+ frontmatter 覆盖起止层级 / 起始编号 / 样式 /
     分隔符（spec §3.20 已定「frontmatter 落盘、GUI 主入口」）；
  2. 单标题跳过的一键入口：「切换光标所在标题的跳过」命令 + 标题右键菜单（现在只能手敲 `<!-- skip -->`）；
  3. 本篇开关命令：切换 / 启用 / 停用本篇编号（现在靠「清除即暂停、重新编号即恢复」间接实现）；
  4. 自动更新的目录代码块（`toc`，只读渲染；Roadmap 已有「阅读视图 live TOC」）；
  5. 视觉缩进：按层级缩进成树形，可调缩进量、可选引导线、可按篇覆盖（纯显示）；
  6. 小节导航条：顶部吸顶面包屑 + 当前小节字数 / 阅读时长；7. 状态栏显示当前小节字数 / 阅读时长；
  8. 编辑器左边距显示 H1–H6 层级；9. 标题悬浮工具条（升级 / 降级 / 折叠本节）；10. 东阿拉伯数字（٠-٩）序号样式。
  有意不同：自动接管手写编号不照搬（只进手动清理，Roadmap 已有置信度分级预览）；它只支持桌面端，我们的新功能都要
  保持移动端可用。其他插件的可取之处（调研报告 §2–§3）：重编号前预览改动（Structure Commander）、编号作用范围（全文 /
  当前分支 / 选区）、一键修复标题跳级、标题旁显示被引用数并可跳转（Header Backlinks）、真机沙盒 e2e 测试（Heading Linker
  and Refactor）、「从 Number Headings 迁移」说明段（Section Numbering）。
- BRAT beta 真机复测 M32（`tests/user_tests/14`）。

### 验证方式

- `npm run preflight` 全绿；同一组测试在旧实现下 M30 6 例失败、新实现通过；随机不变量每种形态有效样本 >200。

---

## 2026-09-26 testplan 继续瘦身：长行压缩、导语去重、修 ID 撞号（不 bump，交接：claude/agent-workflow-review-b9lj22）

### 做了什么

- testplan 133KB → 111KB（最初 143KB），场景仍 331 条、状态分布不变（✅294 / ⚠️10 / 🔲27）。
- **长行压缩**（场景行合计 108.7KB → 约 91KB）：37 条 >600B 的行只留「场景 + 可观察的预期 + 状态（版本、测试位置、
  修复类一句根因）」；排查叙事、参考实现调研、版本演变链（「初版 → 一度 → 最终」）、实现细节删去——历史在
  log-archive，设计在 spec。仍 >600B 的 18 行都是逐条列举可观察行为的真值表，保留。
- **导语去重**：各场景组开头 / 表后的注记改为「范围 + 测试位置 + spec 指针」，删掉与 spec（§2.4 / §2.5 / §3.4 /
  §3.6 / §3.12）或场景行状态格重复的设计说明；核心理念里的「2024 折中与 WJ 根治」历史叙述改为指向 spec §2.4 / §2.5；
  已知 bug 文件删与场景行 / spec 重复的两段注记。
- **修 ID 撞号**：M 组两行都叫 M18（0.7.25 竞态 bug 与「首次说明 Notice」）——后者改名 **M28**（M19 是 1.0.9 退役的
  旧 ID，不复用）；spec §3.12 / Roadmap 里过期的「testplan M19–M26」改为 M20–M26；spec §3.13 里的「N1 同源」改为
  TPL-refresh。
- **spec §3.23 补到现状**：共存规则 1.0.31 起「让路还要求词典联动开着」、Q24 面板隐藏、1.1.0 候选上限只抬不降到 10——
  此前只写在 testplan 行里。
- 回答用户：Backlink 同步能否改属性里的链接——纯函数实测已能改（见下一步）；竞品调研完整报告已发给用户审阅。

### 没做什么

- 竞品结论仍未落 A.11：用户先读完报告，再一起定后续开发。
- 属性链接未补测试、未改反查方式（见下一步）。

### 下一步

- 与用户共同决定后续开发（竞品结论 → A.11 + Roadmap）。
- 属性（frontmatter）里的标题链接：`rewriteBacklinksInContent` 已会改写 YAML 里的 `[[笔记#标题]]`（实测 4 处全改），
  但 ① 无单测覆盖；② 只在属性里引用的文件能否被半公开的 `getBacklinksForFile` 报出来须真机确认（可考虑改用公开的
  `metadataCache.resolvedLinks` 反查）；③ YAML 字符串里的 Markdown 链接语法 Obsidian 不认，但我们也会改写并做 URL 编码。

### 验证方式

- `npm run preflight` 全绿；`release/` 字节不变；场景计数与改前一致；索引 / 链接守卫通过。

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
