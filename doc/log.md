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

## 2026-10-08 发版 1.2.3：笔记内入口（M16）+ 商店审查清理（交接：feat/1.3.0-note-entry → master，tag 1.2.3）

### 做了什么

- 用户在 test 库确认右键菜单正常后要求发版，**版本号按用户定为 1.2.3**（原计划 1.3.0），从 master 发。
- 发版前最后一改：「本篇」菜单的系统 emoji 换成 Obsidian 原生 Lucide 图标（与标题菜单一致：map-pin / repeat / circle-check / ban / file-text / refresh-cw / clipboard-list / eraser / undo-2），spec 3.24、testplan S28 同步。
- `npm run bump 1.2.3`；写 [`release-notes/1.2.3.md`](./release-notes/1.2.3.md)；testplan「未发版」→ 1.2.3。

### 没做什么

- 上两块列的真机未测项（历史弹窗、整节升级越界、手机端 ⋯、源码模式手柄、拖动向前 / 文末 / 自动滚动等）仍未逐项实测，用户已认可直接发版。
- 1.13 声明式设置 API（`getSettingDefinitions`）未接，商店审查会继续给 Warning / Recommendation。

### 下一步

- master CI 绿后打 tag `1.2.3` 推送；用户到 Community Hub 维护者面板点「Check for new releases」送审。

### 验证方式

- `npm run preflight`；vitest 仅 `whitelist.test.ts:406` ICU 本机假红。

---

## 2026-10-07 1.3.0 开发：商店审查告警清理；test 库右键菜单打不开查明（不 bump，交接：feat/1.3.0-note-entry，仅本地）

### 做了什么

- **test 库右键失效**：不是代码问题——`F:\文档\Obsidian\test\test` 里装的是商店版 1.2.2（`main.js` 不含标题手柄），已把本分支构建部署过去（`data.json` 未动），Oblivion 库同步更新。
- **按 Community Hub 审查报告修**（用官方 `eslint-plugin-obsidianmd` 0.4.2 在 scratchpad 本地复现，仓库 lint 配置未改）：
  - `createEl("div"/"span")` → `createDiv` / `createSpan`；手机端手柄、两处编号 span 不再用 `document.createElement`（阅读视图单测给 `createSpan` 打桩）；
  - 计时器 `activeWindow.*Timeout` → `window.*Timeout`；去掉两处多余类型断言、一个未用变量；落点线显隐改 `hide()` / `show()`；
  - 破坏性按钮新增 `settings/buttons.ts` 的 `markDestructive`：1.13+ 用 `setDestructive`，旧版加 `mod-warning` 类（不再调废弃的 `setWarning`）；
  - VC 词典路径复制去掉 `execCommand` 回退，失败提示「复制到剪贴板失败」（路径本就显示在说明里）；
  - 单测用的 `js-yaml` 换成 `yaml`（锁文件已按 master 口径补回 npm 11 删掉的 vite-node 可选条目）；
  - CSS：网格 `column-gap` → `gap: 0 Npx`；残留编号的虚线下划线改为 `border-bottom` 虚线；
  - README 双语常见问题加「会访问哪些内容」（全库文件列举、剪贴板用途），回应审查的 Behavior 两条。

### 没做什么

- **有意保留**：`getSettingDefinitions` / `display()` 废弃（1.13 声明式设置 API，minAppVersion 1.8.7 下要整体重写设置页，留待以后）；`main.ts` 选区序列化的 `doc.createElement`（分离节点，已有注释说明；`Node.createDiv` 会挂到 document 上，不可用）。
- 改动未真机验证；testplan 无行为变化，未改场景。

### 下一步

- 用户重载 test 库与 Oblivion 库后复查标题右键菜单、清库 / 删模板确认按钮的红色样式、残留编号虚线；然后照上一块的发版步骤走。

### 验证方式

- `tsc` / `eslint` / `prettier --check` 全绿；vitest 881/882（`whitelist.test.ts:406` ICU 假红）；官方规则集复跑只剩上述有意保留的项。

---

## 2026-10-07 1.3.0 开发：M16 笔记内入口与模板编辑增强全部落地（不 bump，交接：feat/1.3.0-note-entry，仅本地）

### 做了什么

- 规格 [3.24](./spec/3.24-笔记内入口.md) + testplan S 组（S1–S23）先行。
- **纯函数**：`headingedit.ts`（`toggleSkipMarker` / `planSectionShift`，围栏内 `#` 不动、越界整体拒绝）、
  `templates/styles.ts`（样式快照 / 历史 / 去重限额 / 五个预设）。
- **接线**：`noteentry.ts`（5 条新命令、编辑器右键两项、状态栏「本篇」菜单、标题手柄菜单、单篇模板选择器）；
  `headinghandle.ts`（桌面端**复用原生折叠箭头**：单击折叠、拖动移整节、右键开菜单；手机端行尾 ⋯ 浮层）；`main.ts` 的 `getTemplateForFile` 认 frontmatter
  `obsidian-auto-headings-template`（只在规则命中且非「不编号」时生效，指向不存在的模板则忽略）。
- **命令改名**（ID 不变）：统一「动词 + 对象」，README / 使用指南同步。
- **模板编辑**：改动**即时生效**（用户 2026-10-07 定，草稿式保存已取消）；格式页顶部「快速套用」菜单（最近 4 份历史 + 预设）与
  「历史」弹窗；退出编辑窗口时样式变过就记一份历史，存 `data.json` 的 `templateHistory`，改名迁移、删除清除。
- 用户实测反馈后：标题手柄并入折叠箭头 + `moveSection` 整节拖动（S24）；本篇菜单从标题菜单进入时加「返回」；
  Artifact 画布（HeadingMenu / NoteMenu / TemplateEditorNext / CommandPalette / MobileHeadingSheet 与 noteC/noteD）已对齐实现。
- 路径规则「不编号」从模板下拉挪到「模式」下拉（S23，数据仍是 `$none`；切回退默认模板）。
- 单测 +20：`headingedit.test.ts`、`templatestyles.test.ts`、`main.test.ts` S 组；mock 补 `Menu` / `FuzzySuggestModal` / `Platform`。

- **二轮实测反馈（2026-10-07）**：链接 `|别名` 随标题改名同步（M33–M35）；复制本节嵌入 `![[…]]`（S27）；本篇菜单选项加 emoji（S28）；
  跳过标记分两种——`<!-- skip -->` 单标题、`<!-- skip-tree -->` 整节含子树（E42–E44，S26）；模板编辑弹窗给实色底（L47）；
  清库确认框加「同时关闭自动编号」勾选（H20）；路径规则圆点放到抓手之前（L46）；README / 使用指南 / spec / testplan / Artifact 画布（Version 30）同步。
- **用户要求（2026-10-07）：先别发版，等用户校验**——所以本分支**没有 bump 1.3.0、没写 release notes、没合并 master、没打 tag**。用户确认后再走 dev-cycle 的发版步骤。

### 没做什么

- **真机只测了一部分**（桌面，Oblivion 库「Claude测试/基础」，操作后均已撤销 / 还原）：手柄悬停与菜单、跳过标记、整节降级、右键两项、状态栏菜单、单篇模板选择与清除、命令改名、模板弹窗快速套用 / 草稿取消。
  **没测**：历史弹窗（需保存一次模板）、模板「保存」落盘、路径规则「模式」下拉里的「不编号」、自动编号三选一的写入、整节升级与越界提示、手机端 ⋯、源码模式下的手柄。
- 实测发现并已修：窄边距下手柄左边放不下会压住折叠箭头 → 贴到标题文字末尾；单篇模板选择器没有「清除」→ 加「跟随路径规则」项；删光最后一个 frontmatter 键会留空 `---` 外壳 → 顺手清掉。
- M8b 的「拖放重排」其余部分（侧栏大纲拖放等）未动；本版只有折叠箭头拖动整节。
- 折叠箭头拖动在 Outliner 插件装着时需挂 window 捕获阶段才收得到 mousedown（已处理）；拖动手势只实测了向后移，向前移 / 文末 / 自动滚动待测。

### 下一步

- 已部署 iCloud 测试库（库内即本分支最新构建，用户重载 Obsidian 即可）；等用户校验，通过后 bump 1.3.0、写 release notes、合并、等 master CI 绿再打 tag。二轮新增项（skip-tree 菜单、嵌入链接、别名同步、emoji、实色弹窗、清库勾选、圆点次序）尚无真机验证；另需核对「带 skip 标记的标题，其链接锚点在 Obsidian 里是否含标记」（spec 3.21 旧遗留）。
- 已知取舍：「不编号」切回写入 / 仅显示时模板退回默认，若用户嫌丢选择再加「记住上次模板」。

### 验证方式

- `npm run check`：全绿（Windows 本机 `whitelist.test.ts:406` ICU 假红除外）。
