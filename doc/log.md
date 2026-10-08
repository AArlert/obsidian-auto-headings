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

## 2026-10-08 登记路线图：从 Number Headings 迁移命令（仅文档，不 bump，交接：master）

### 做了什么

- 用户提出：可以加一个「当前文件 / 全库从 Number Headings 迁移」的按钮 / 命令。本插件的跳过标记是 HTML 注释
  `<!-- skip -->`，不会出现在阅读视图和侧栏大纲里，比 Number Headings 的 `^skipped` 块锚点更干净，属性也可一并迁移。
- 已登记到 [`spec/5-Roadmap.md`](./spec/5-Roadmap.md) M9 候选池顶部（编号、跳过标记、属性三块迁移 + 约束）。

### 没做什么

- 未立项：没有写 spec 节、testplan 行，也没动任何代码；属性映射的具体落点留到立项时按 [3.20](./spec/3.20-单文件配置的落盘位置.md) 定。

### 下一步

- 立项时先补规格节 + testplan 行，再按 dev-cycle 实现；整库版要等 M11 的 H8 清库竞态保护。

### 验证方式

- `npm run docs`（索引与链接一致性校验）。

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
