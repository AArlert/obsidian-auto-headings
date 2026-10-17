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

## 2026-10-18 修 issue #10：标题链接建议误触发（不 bump，交接：fix/heading-suggest-trigger → master）

### 做了什么

- 外部用户报 [issue #10](https://github.com/AArlert/obsidian-auto-headings/issues/10)：随便打「项目」「json」
  就弹框，接着按空格会误选。根因是两层猜测叠加：触发门槛只有 2 字符，行内连写截出的后缀也按前缀匹配
  （截图里「…当前项目」的尾巴「项目」撞上【项目级…】）。
- `headingtrigger.ts`：`MIN_QUERY_LENGTH = 2` 换成按字数加权的 `MIN_TRIGGER_WEIGHT = 6`（中日韩字符记 2、
  其他记 1）；`resolveTriggerQuery` 改收 `TriggerIndexProbe`，整段按前缀、行内后缀只认完整标题
  （新增 `HeadingIndex.hasExactMatch`）。`headingsuggest.ts`：Tab 加 `isComposing` 判定。
- testplan 新增 Q27–Q29、改写 Q22 例子；spec §3.23 记取舍；使用指南双语补触发说明。
- UVM 标题索引对拍改为两档判定并对拍 `hasExactMatch`；参考侧改成每步只展平一次——否则 `test:fuzz` 的
  M13 用例同步跑到 56s，触发 vitest `onTaskUpdate` RPC 超时（测试本身全过，但会报未处理错误）。

### 没做什么

- 「空格误选」没复现、没修：两侧代码都没绑空格（核对了 Obsidian 1.10.6 app.js，建议框只注册 Enter / Tab
  且判 `isComposing`）。issue 回复草稿（请报告者补充系统 / 输入法 / 其他补全插件信息）已交用户，由用户贴出。
- 没发版、没真机测；Q27–Q29 的真机部分仍 🔲。
- 取舍要用户知悉：【事务】【总结】这类两字标题不再触发（1.0.29 的 Q22 原例因此改写）。

### 下一步

- 真机验 Q27–Q29（建议推 `1.2.4-beta.1` 走 BRAT），然后发 1.2.4 并回复 / 关闭 issue #10；报告者补了
  环境信息再看空格问题。之后回到 M17。

### 验证方式

- `npm run check`（唯一失败为已知的 Windows ICU 排序假红 `whitelist.test.ts`），`npm run test:fuzz` 全绿无超时。

---

## 2026-10-08 登记 M17：仅显示模式固化 + 阅读视图 live TOC（仅文档，不 bump，交接：master）

### 做了什么

- 用户定下一批开发：①「固化编号并交还所有权」补齐仅显示模式（目标：运行后得到不含不可见字符的编号文本与标题，
  插件不再管理，可安全退出）；② 阅读视图 live TOC 提上来。两项从 M9 升格为 [`spec/5-Roadmap.md`](./spec/5-Roadmap.md)
  **M17**（下一版），M9 里的原条目已移除。
- 核对现状：固化只对写入模式文件达标；仅显示文件没写过编号，固化后显示的编号直接消失（`freezeVaultNumbering` 末尾的
  `refreshVirtualViews()`）。差距与 5 条实现约束写在 M17-A（写入顺序、链接同步、两模式并存、单文件版、确认框）。
- 顺手把 Roadmap 执行顺序表里 M16 改为「已发版 1.2.3」（原写「下一版」，已过期）。

### 没做什么

- 没写 spec 节、testplan 行，没动代码；写入与 `retired` 的先后顺序留到立项时推演。

### 下一步

- M17 立项：先补 3.18 的仅显示模式节、2.2 的 live TOC 澄清，再写 testplan 行，按 dev-cycle 实现。

### 验证方式

- `npm run docs`（索引与链接 / 锚点一致性）。

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
