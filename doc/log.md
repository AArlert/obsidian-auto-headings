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

## 2026-10-18 issue #10 定稿：标题链接建议按信号触发 + VC 收紧（不 bump，交接：fix/heading-suggest-signals，仅本地、未推送）

### 做了什么

- 推翻上一块的「中文 3 字 / 英文 6 字母」长度门槛（会把 `axi`、`uart` 这类短术语全挡掉）。依据用户主力库
  Oblivion 的只读统计（272 篇、1987 个不同标题、85% 只在一个文件、310 个被链接过、≥ 3 个文件的 102 个几乎
  全是面试模板小节），改为按信号触发，规则表见 spec §3.23「触发规则：按信号而非长度」：
  - 套话标题（同名出现在 ≥ 3 个文件）与 Excalidraw 绘图文件不参与建议、不进 VC 词典（`headingindex.ts`
    增量维护 `keyFileCount`、`isExcalidrawFile`、`eligibleEntries`）；
  - 新增 `headinglinks.ts`：metadataCache 出链 → 解析到目标文件 → 按索引条目锚点比对 → 「标题被链接次数」；
  - `resolveTriggerQuery` 改为规则表：长词前缀 / 短英文词完整命中 / 短中文词完整命中且被链接过 / 连写后缀
    完整命中且（够长或被链接过）；中日韩与其他字符的交界算词边界；排序加「被链接多 → 当前文件」；
  - VC：词典只放 eligible 条目；自动配置阈值 1 → 2（只抬不降）；**推翻「切回不联动不做反向清理」**——
    切回时问要不要从 VC 移除词典路径，「不联动」时发现残留在面板常驻提示 + 移除按钮（只删那一行）。
- 用户在 Oblivion 实测：打字观感良好；输入法下按空格不会接受建议（要 Enter）。但点「移除」后 VC 框里仍有标题——
  根因：VC 的词典提供者缓存路径列表，只在 `updateSettings` 里刷新；我们只 `saveData` + 重载命令，读到的还是旧路径
  （自动配置新加路径同理要重启才生效）。改走 VC 自己的 `saveSettings({ customDictionary: true })`（Q39），并用它清掉了
  用户库里 VC 内存中残留的 2610 条标题。
- 用户明确设计意图：单独用本插件用它自己的框，同时用 VC 时标题出现在 VC 框里。装了 VC 却没开联动时，面板那句被动提示
  改为带「开启词典联动」按钮的一行（Q40）；联动仍需用户确认，不自动开。
- 用户实测「选了本插件优先仍是 VC 混合」：联动还开着（VC 框里照出标题）+ 本插件建议框排在 VC 后面（重载过本插件）。
  改为加载 / 布局就绪时把本插件建议框挪到 VC 之前（Q41，`moveBefore`），「本插件优先」与联动互斥（Q42：切换时走停止
  联动确认，已处在该状态时面板给「关闭联动」入口）。
- 用户定简化模型（Q43）：只有本插件 = 一个开关；装了 VC = 一个「建议显示在」（本插件的建议框 / VC 的建议框）。
  删掉「VC 启用时」与「VC 联动」两个下拉和 `headingSuggestWhenVcActive` 字段（加载时迁移清理），让路只看联动开没开；
  选 VC 走自动配置确认框（框里另有「手动配置」），切回本插件走停止联动确认。上面 Q40/Q42 的两个过渡方案未发版即被取代。
- 用户实测「快打 axi 是本插件，ax 停一下再打 i 一直是 VC」。把 VC 临时装进 loom test-vault，在 `editorSuggest.trigger`
  与两边 `showSuggestions` 上挂日志，英文键入各种节奏都是本插件赢；用 CDP `Input.imeSetComposition` 模拟输入法才复现：
  拼字期间本插件按 Q9 不弹、VC 占位，上屏不改文档就不再触发。改为 `compositionend` 后补触发一轮（Q44）。场景整理成
  可重复跑的 `tests/probes/suggest-timing.js`（11 个场景全过）；test-vault 测完已停用 VC。
- 用户实测又报三项，均已修：① 「VC 的建议框」模式下新写的标题打不出——VC 只在启动 / 重载 / 保存设置时读词典文件，
  改为写词典后只替换 VC 内存里本插件那部分词（Q45，不重读用户的联网英文词表）；验证时又抓到启动同步不等索引建完、
  写出空词典的旧 bug，一并修。② 防抖滑块在 Obsidian 1.14.4 上两个数并排——新版滑块自带数值显示与
  `setDisplayFormat`，有就用原生的（L29）。③ 新建标题后光标在编号前面——仅显示模式的编号装饰改 `side: -1`（V46）；
  写入模式补上「已有文字、光标在正文开头」的情形（J22）。
- 顺手修 `extractTriggerToken` 遇星平面汉字（代理对）提前截断。
- `test:fuzz` 的 M13 用例每 200 条让出一次事件循环，根治 vitest `onTaskUpdate` RPC 超时。
- testplan Q27–Q38，Roadmap 登记 M18（置信分 + 淡色提示 + 历史反应），使用指南双语同步。
- 在 loom 的 test-vault 用探查通道实测：Q27–Q34 全部按预期；Q38 在 Easy Typing（中英文加空格）下**未复现**
  空格误选。test-vault 的插件测完已还原为原 1.2.3 构建。

### 没做什么

- 没推送、没打 tag：用户要求先在 Oblivion 本地实测，没问题再推 GitHub 发 tag（计划 1.2.4）。
- 输入法拼字过程下的空格误选没测（模拟不了），等用户手测；VC 侧（Q35–Q37）只有单测。
- issue #10 回复草稿里的规则描述已过时，发版时按新规则重写。

### 下一步

- 用户在 Oblivion 实测：Q27–Q34 打字观感；Q36 过期词典提示（主力库现状即此场景）与「移除」；输入法下的空格。
- 实测通过后：合并回 master → bump 1.2.4 → 写发布说明 → 推送打 tag → 回复并关闭 issue #10。

### 验证方式

- `npm run check`（唯一失败为已知 Windows ICU 排序假红 `whitelist.test.ts`）、`npm run test:fuzz` 全绿无超时、
  test-vault 探查 22 项全过。

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
