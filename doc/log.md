# obsidian-auto-headings 开发日志与协作交接

本文件用于多 agent / 多人协作的**握手交接**：每个开发周期结束时，记录「做了什么、
没做什么、下一步干嘛」，让接手者无需通读全部代码即可继续。倒序排列（最新在最上）。

**接手前怎么读**（见根 [`CLAUDE.md`](../CLAUDE.md) §3）：第一条命令跑 **`npm run docs -- --handover`**，
一次打印「status 首行总览 + 本文件最新块 + testplan 待办摘要」；需要更早来龙去脉时才按需翻
[`log-archive.md`](./log-archive.md)，**不必从头通读**。

> 配套文档：完整需求与功能规格见 [`spec.md`](./spec.md)（含 7 个 Milestone 的 Roadmap）；
> 面向读者的简介见上一级 [`../README.md`](../README.md)。
>
> **注**：本日志**历史条目**中出现的「README §X.Y」均指原规格文档——它已更名为 `spec.md`
> （章节号不变），请按 `spec.md` 对应章节查阅。

---

## ⚠️ 强制规则（所有 Agent 必须遵守）

1. **每个开发周期都必须产出可供 Obsidian 实测的插件**，放在仓库的 **`release/`** 文件夹。
   完成代码改动后，**务必运行 `npm run release`**（= `npm run build` + 同步脚本），它会把
   `main.js` / `manifest.json` / `styles.css` 刷新进 `release/`。**不要只改源码而忘记重新生成
   `release/`**——用户是直接拿 `release/` 里的文件丢进 `.obsidian/plugins/` 实测的。
2. **`release/` 必须随提交一起入库**（`.gitignore` 已对 `release/main.js` 设例外放行）。
   提交前自检：`git status` 应能看到 `release/` 下的文件已更新/已暂存。
3. 改动若影响行为或版本，**跑 `npm run bump`** 一键同步版本号（`package.json` / `manifest.json` /
   `package-lock.json` / `versions.json` / `release/manifest.json`），并在本文件**最上方追加一条新的周期记录**。
4. 写完新周期块后**跑 `npm run docs`**：归档旧周期块进 `log-archive.md`（只保留最新 3 块）、
   滚动 `status.jsonl`（首行外只留最新 12 行，更旧滚入 `status-archive.jsonl`）、打印 testplan
   摘要、校验下方「目录结构约定」块与磁盘一致（新增/拆分源码文件必须回填目录树，否则
   `--check` 拦提交）。**先写新块、后跑脚本**——脚本只搬旧块，不碰你刚写的块。
5. 合并前的质量门槛：`npm test`、`npm run lint`、`npm run format:check` 全绿。

> **省 token 读盘**：接手跑 `npm run docs -- --handover` 一条命令即可（更早历史翻 `log-archive.md`）。
> 源码已按职责拆分（编号引擎 = `template` / `count` / `render` / `strip` / `whitelist` + `numbering` 编排兼
> barrel，外部一律从 `./numbering` 导入；设置 GUI = `SettingsTab.ts` 壳 + `settings/tabs/` 七个 TAB，
> 均可整读）；仍大的 `main.ts`（~1290 行）与 `i18n.ts`（~710 行）先 `grep` 定位、别整读。
> UVM 压测框架（`tests/dev_tests/uvm/`）已按职责拆成 9 个文件、均可整读，入口仍是 `framework.ts`。

> 一句话：**改代码 → `npm run bump` → 写本文件新块 + `status.jsonl` → `npm run preflight`（= docs + release + test + lint + format:check）→ 提交（含 `release/`）。**

---

## 2026-08-09 真机回归：新敲的标题不编号——彻底换掉「整行冻结」（并入 1.0.23，不单独发版）

> **接手者注意**：本块记录的是**上一块修得不对**、用户真机又打回来的一次。教训在最后一节，
> 比改动本身值钱。
>
> **版本号说明**：本轮一度 bump 到 1.0.24，用户要求**并入 1.0.23**、不单独发新版，故版本号已退回
> 1.0.23，`release-notes/1.0.24.md` 的内容并进 `1.0.23.md`、原文件删除。**但 1.0.23 的 tag 与
> GitHub Release 是在本轮修复之前就已推送发布的**——线上那份 1.0.23 产物**不含本轮修复**，仓库里的
> 1.0.23 与线上的 1.0.23 就此分叉。要让线上也拿到修复，须移动 1.0.23 tag 重新触发发布工作流
> （见「没做什么」）。

### 症状与根因

用户实测：敲 `##` 写完标题文本，光标**直接移到另一行**，编号不出现；必须再编辑一次（多数人是
碰巧按了 Enter）才补上。用户原话「怎么老毛病又回来了」——他把它读成 1.0.15 那个老问题复发。

根因是**上一块给的修法覆盖不全**。那一版的判据是「光标行的标题层级相对
`headingSnapshots` 是否变化」，而该判据前有一道保守闸：

```ts
if (headings.length !== snapshot.length) return false;  // 逐位对照前提被打破 → 当作"没变" → 冻结
```

**新敲出一个标题恰好会让标题数量变化**，于是走保守分支、整行冻结——层级判据只挡住了「改层级」
那一种症状，挡不住「新增标题」这一种。

更要命的是**解除冻结的条件从来就不成立**：冻结后本该「光标移开后的下一次触发补上」，但自动路径
只挂 `editor-change`，**移动光标不触发任何事件**。所以真实解除条件是「再编辑一次」，不是「移开」。
这一条 1.0.15 就写在注释和 spec 里，一直没人（包括我）意识到它根本不成立——**日志 / 注释里写着的
「会在 X 之后补上」，如果 X 不是一个真实事件源，那就是一句从未被验证过的话。**

### 改法：不再冻结任何东西

整行冻结从一开始就是**用整行级手段去解决一个只关乎行尾空白的问题**（J11 要防的就只有
`stripPrefix` 的 `\s+$` 把刚敲的空格吃掉）。本轮把手段本身换掉：

- `preserveLine` + `levelChangedSinceSnapshot` → **删**，换成 `preserveCursorLineTrailingSpace`：
  只把用户刚敲的行尾空白补回本轮结果，**编号照常写入**。不再需要快照、不再需要任何历史推断。
- 幂等性天然成立：补回后与上一轮落盘内容逐字节相同 ⇒ 下一轮无改动可写，不发空事务。
- 补回的空白不产生幻影改名——`parseHeadings` 的 `text` 本就去尾空白，快照与改名判定看的都是它。

**配套改 `writeLineDiff` 为最小范围改写**（新增 `lineChange()`）：不冻结意味着光标行会在用户正
敲字时被改写，而原先的**整行替换**变更范围覆盖光标位置，CM6 只能把光标甩到一端——那是换一种形式
的「抢键盘」。掐掉两端公共前后缀后，编号前缀落在行首是**纯插入**（`from.ch === to.ch`），与行尾的
光标天然不重叠。切点两端各回退一格避开 UTF-16 代理对（emoji 标题常见）。顺带缩小了 J6 的暴露面。

### 验证

`main.test.ts` J19 三例（新标题当轮编号 / 新标题带空格 / 写回范围断言，FakeEditor 加 `lastChanges`）
+ J11 五例重写（语义变了：**J11 现在期望"编号照写 + 空格保住"，不再是"整行原样"**）。全量 524 条
523 绿（唯一红是 `whitelist.test.ts:406` 的 ICU 本机假红）；fuzz 5000×80 记分板全程一致；
`tsc`/`lint`/`format:check` 全绿。**用户真机复验通过**（原话「完美」）。

### 教训（比改动本身重要）★

1. **上一轮把用户的反馈修窄了。** 用户上一次说的是「改层级后等不到编号」，就只针对
   「层级变化」造了个判据，而没有回头问「**冻结这个手段本身是不是从一开始就用错了**」。结果是
   同一个根因换个入口（新增标题）立刻复发。**症状驱动的补丁会把根因留在原地**——收到第二次同类
   反馈时，优先怀疑的应该是手段选错，而不是判据不够细。
2. **别信注释里那句「会在 X 之后补上」**，除非能指出 X 对应哪个真实事件源。这次的 X（光标移开）
   压根没有监听器，这句话在仓库里躺了 9 个版本没被质疑过。
3. **语义变更要显式改测试的期望值，不能只加新用例。** J11 原本断言「整行原样保留」，新语义下
   它应该断言「编号照写 + 空格保住」——如果只加 J19 不改 J11，两者会互相矛盾，而先跑通的那个会
   掩盖问题。

### 没做什么

- **没有引入光标 / 选区监听**（CM6 `updateListener` 一类）。本轮是绕开这条路解决的；spec
  Roadmap 里 hobeedzc 那条「脏标题行集合 + 离开该行才重排」仍未做，且已补注说明它依赖的正是这次
  绕开的事件源，真要做得重新估成本。
- **没动上一块的清理确认框相关代码**（勾选 / diff / 搜索），本次改动与它无交集。
- **没有移动 1.0.23 的 tag，也没有重发 Release** ★。用户要求本轮并入 1.0.23、不发 1.0.24，但
  1.0.23 的 tag 早在本轮修复**之前**就已推送、GitHub Release 也已建好。于是现在的状态是：
  **仓库 master 的 1.0.23 含本轮修复，线上 Release 的 1.0.23 不含**。要让线上一致，须
  `git tag -f 1.0.23 <新提交> && git push -f origin 1.0.23` 重新触发发布工作流——这是**改写已发布
  的 tag**，且已装 1.0.23 的用户因版本号未变**不会收到更新提示**，故未擅自执行，留给用户定夺。

### 下一步

1. **待用户真机复验**：新敲标题当轮编号、改层级当轮生效、行尾空格不被吞三条一起看。
2. **决定线上 1.0.23 怎么办**（见上）：移动 tag 重发 / 就此搁置 / 下次真有新功能时随新版本带出去。
3. 沿用的手验清单：P12 / E36 / O11① / O5f / H12 / H9 / Dataview；J18 的 DOM 交互。
4. 发版前照例 `git ls-remote --tags origin` 现场核对。

### 本周期派发

派发 3 次（全部 `quality-gate`：单测验证 ×1、fuzz ×1、收尾门槛 ×1）。诊断与改法设计主模型自持——
根因在「手段选错」这一层，需要同时持有 J11 的历史动机、1.0.23 的判据实现和 CM6 写回语义三者。

---

## 2026-08-09 用户体验反馈三连：光标保护精确化 + 清理外来编号逐条勾选（1.0.23）

用户实测反馈三点，逐一处理：

### 做了什么

**① 光标所在行保护精确化（testplan J16）**。用户反馈：改标题层级后若光标不移开，编号迟迟不更新，
"卡顿"。查代码发现根因不是防抖延迟本身，而是 `preserveLine`（1.0.15 为修 J11"行尾空格被吞"引入）
把光标所在行的**任何**差异都当打字噪音整行冻结，连结构性的层级变化也一并冻死；而"移开后补上"依赖
下一次 `editor-change`，单纯移动光标不触发任何事件，实测常等很久。找用户确认三种改法（精确保护 /
完全恢复原方案 / 保留整行冻结+新增光标离开监听）后，选了精确保护：借 `headingSnapshots`（backlink
改名判定本就在用的上一次写入基线）判断光标行标题**层级**相对基线是否变化——没变（行尾空白等打字
噪音）才冻结，变了（敲 `#` 的结构性改动）立即照常写入，不必等移开。用层级不用文本，是因为层级从
不受任何剥离/归一化影响，变了就一定是结构性改动。`main.ts` 新增 `levelChangedSinceSnapshot`；
`main.test.ts` 回归 2 例（层级变→立即生效 / 层级未变+行尾空格→仍受保护，后者是防止用 WJ 存在与否
当判据的更简单方案——那种方案会在"已编号标题追加空格"这个更常见的场景里重新引入 J11 的 bug）。

**② + ③ 清理外来编号确认框改为逐条勾选 + git 风格 diff 预览（testplan J17）**。用户反馈：J14 的
确认框只能看、不能选，要么全清要么全不清；且预览只显示"剥离后"的中间态，不是套模板后的真实效果；
视觉也偏紧凑。改动：

- `cleanup.ts`：`clearForeignNumberingContent` 加可选 `keepLines`（跳过指定行，默认行为不变）；
  `ForeignNumberingPreviewItem` 加 `lineIndex` 关联勾选状态。
- `main.ts` 新增两个方法：`computeForeignCleanupPreview`（选择性剥离 + 立即套模板，一份计算同时
  供预览与确认执行复用，避免"预览说改A、实际却改了B"）；`applyForeignCleanupSelection`（确认框
  专属执行路径，勾选的清理、取消勾选的保留原文但仍立即叠加模板前缀，单一事务写回，不影响原有
  `runClearForeignNumbering` 全量命令）。**关键点**：确认后全文必含至少一个 WJ，迁移守卫此后不会
  再对本文件命中——不存在"保留的那条下一轮又被拦一次"的问题。
- `ForeignNumberingCleanupModal.ts` 重写：每条候选前加勾选框（默认勾选=清理），勾选变化时整份
  重算重绘（成本换正确性——白名单 `subtree` 匹配依据标题文本判豁免，某条是否清理会联动影响子孙
  标题是否编号，没有更便宜的正确增量更新方式）；diff 改为 git 风格 −/+ 两行对照，"+"行展示套模板
  后的真实效果（含取消勾选时的"模板前缀+原文"双重编号预览）。
- `styles.css`：卡片式布局、留白宽松；红/绿配色用 Obsidian `--color-red-rgb`/`--color-green-rgb`
  浅色底；新增 `@media (max-width: 480px)` 断点，窄屏下勾选框与 diff 块纵向堆叠、勾选可点触区域
  加大到 22px。
- `i18n.ts`：确认框说明文案改讲勾选语义；新增逐条勾选框文案 + 确认执行后按清理/保留计数的动态
  Notice（中英对照）。

`main.test.ts` 重写 J14 原有 1 例为 2 例（全勾选一步到位套模板 / 取消勾选后双重编号+守卫不复发）；
`cleanup.test.ts` 补 `lineIndex` 断言 + `keepLines` 新例。

### 没做什么

- **spec.md 的置信度分级预览（Roadmap M9 一条）与光标保护覆盖面扩展（另一条 hobeedzc 建议）均未
  实现**——本周期两条都只是"往同一方向挪了一步"，不是那两条 Roadmap 项本身，已在对应条目补注说明
  两者关系，避免误读为已完成。
- ~~J17 的视觉与移动端堆叠留手验~~：**已由用户真机确认通过**（见下方补记）。
- **未处理本会话开始前就已存在的大量未提交改动**（`.claude/agents/*.md`、`CLAUDE.md`、`README*`、
  `src/numbering.ts` 等约 40 个文件、以及 `.gitignore` 的 3 行改动）——`npm run format` 全库跑了一遍
  把所有 CRLF 文件就地转 LF（本机环境坑，见下），这些文件因此在 `git status` 里显示为已改动，但
  `git diff` 内容为空；本次提交**只暂存本周期实际触碰的文件**，不碰这些无关改动，也不碰 `.codex/`
  与 `AGENTS.md`（按既有约定）。

### 本机环境坑：全库 format 后 ~40 个无关文件"显示已改"

`npm run format`（`prettier --write .`）按 `.prettierrc.json` 的 `endOfLine: "lf"` 把磁盘上是 CRLF
的文件就地转成 LF——这台机器 checkout 时看起来是整库 CRLF，于是几乎每个被 prettier 扫到的文件都在
`git status --short` 里冒出来。用 `git diff --stat` 核对后确认：只有本周期真正编辑过的 9 个文件有
实际内容变化，其余全部是纯换行符转换（git `autocrlf` 归一化后 diff 为空，`git add` 这些文件也不会
产生任何可见的提交内容）。与既有 memory 记录的坑同源，只是这次触发面更大——按同一姿势核对即可，
不必逐个排查。

### 补记：用户真机手验通过，顺带一处纯视觉微调（不 bump）

用户实机测试三条改动均确认通过，唯一反馈：确认框每条勾选框下方的"清理"文字标签多余，去掉即可。
处理：删掉 `ForeignNumberingCleanupModal.ts` 里对应的 `createSpan` 调用、`i18n.ts` 里不再使用的
`foreignGuardItemToggleLabel` 键（中英文都删，checkbox 的 aria-label 保留，不影响读屏）、
`styles.css` 里对应的 `.ah-foreign-guard-toggle-text` 规则与 `.ah-foreign-guard-toggle` 的多余布局
属性（原为给文案腾位置，现只剩 checkbox 一个子元素）。纯视觉、不涉及逻辑，用户明确说了不 bump，
仍是 1.0.23。

**追加一个小功能**（同一轮反馈里补的，同样不 bump、并入 1.0.23）：确认框顶部加搜索框（testplan
J18），按候选标题现状文本实时匹配，点击结果或搜索框内回车（取第一条匹配）把主列表滚动到对应条目
并短暂高亮（1.2s 渐隐），纯定位辅助、不改变任何勾选状态。`ForeignNumberingCleanupModal` 新增
`searchQuery` 状态与 `jumpTo`/`renderSearchResults`；`i18n.ts` 加两条文案；`styles.css` 加搜索框 /
结果列表 / 高亮动画样式。DOM 交互（滚动、高亮、点击结果）与 J17 视觉部分同样的限制——假编辑器环境
`Modal.open()` 是空实现，单测测不到，留手验。

质量门槛两轮都跑过（除已知 ICU 假红外全绿），`release/` 已重建。

### 下一步

1. 沿用上一周期遗留的手验清单：P12 / E36 / O11① / O5f / H12 / H9 / Dataview。
2. 未解决问题总账与竞品调研采纳清单见更早周期块与 spec Roadmap M9，未受本次影响。
3. 1.0.23 即将打 tag 发布——用户已明确指示推送并发布，发版前照例先 `git ls-remote --tags origin`
   现场核对远端已发布版本，不信日志旧结论。

### 本周期派发

派发 0 次（主模型全程自持）——本次是**用户直接反馈的体验问题**，涉及触发链改动方向的判断（三选一
问过用户）与"预览/执行必须逐条一致"这类跨文件设计约束，拆给子 agent 反而要重述完整上下文，不划算；
质量门槛验证按惯例派 `quality-gate`（本周期共 4 次：main.test.ts 单测 ×2、全量 test/lint/fuzz ×1、
format ×1）。

---

## 2026-08-09 社区 PR #7 审核并入：继承级数 inheritDepth（1.0.22）

> **接手者从这里开始读。** 本块是**第一次合入外部贡献**的完整记录——含「PR 基于旧版本该怎么核」的
> 复用姿势，以及本仓库要求而 PR 不可能自带的那部分收尾（文档 / testplan / 版本 / 产物）。

### 做了什么

合入 GitHub PR [#7](https://github.com/AArlert/obsidian-auto-headings/pull/7)「feat: add configurable heading
inheritance depth」，新增每级可选字段 `inheritDepth`：`inherit=true` 时**最多往上拼几个祖先段**。
缺省 / `null` = 继承到 `topLevel`（= 1.0.21 及以前的唯一行为，**老模板零迁移**）。
截取起点 `max(topLevel, level - inheritDepth)`，**永不越过 `topLevel`**。规格见 `spec.md` §3.6
「继承级数用途」，场景真值表见 `testplan.md` §P（P1–P12）。

**PR 作者交付的部分**（原样采纳，未改一行逻辑）：`template.ts` 的 `normalizeInheritDepth` +
`render.ts` `buildPrefix` 截取 + `numbering.ts` skipFill=none 检查范围收窄 + `schema.ts` 按物理层级
夹紧（h1→0…h6→5）+ `EditPanel.ts` 新增「继承级数」下拉 + i18n 中英文案 + `styles.css` 九列网格 +
`inherit-depth.test.ts`（220 行，13 例）+ `schema.test.ts` 补 24 行。

**本次补齐的部分**（PR 不可能自带）：`spec.md` §3.6 字段表 + 用途小节 + JSON 示例 + CR-14b；
`testplan.md` §P 十二行场景；README 中英各一条；`release-notes/1.0.22.md`；bump 1.0.21→1.0.22；
`release/` 重建；本块 + `status.jsonl`。

### 合并风险怎么核的（可复用姿势）★

PR 基于 `1ff21f8`（**1.0.13**），master 已到 1.0.21，中间隔 **14 个提交**。核查顺序：

1. `git fetch origin refs/pull/7/head:pr-7` → `git merge-base master pr-7` 定位基线。
2. **只比对 PR 触碰的那几个文件在 master 上的分叉**（`git diff --stat <base> master -- <files>`），
   而不是看 master 整体改了多少——本次 8 个源文件里 **4 个在 master 上一行没动**
   （`render.ts` / `template.ts` / `templates/schema.ts` / `EditPanel.ts`），风险面立刻收敛到 3 个。
3. 分叉的 3 个（`i18n.ts` / `numbering.ts` / `styles.css`）**全部自动合并无冲突**，但
   **`numbering.ts` 必须手工复核**——master 侧 1.0.17 的 `<!-- skip -->` 分支（issue #6）就落在
   PR 插入点的**紧邻下方**，自动合并「文本干净」不等于「语义正确」。复核结论：PR 的
   `skipCheckStart` 计算在 map 回调开头、skip 标记分支在其后，互不干扰，`slice(skipCheckStart - 1, -1)`
   落在正确的 skipFill=none 分支里。
4. 门槛：`tsc -noEmit` 干净；`vitest` 516 条 515 绿（唯一红是 `whitelist.test.ts` 的 ICU 排序，
   **Windows 本地老假红**，与本 PR 无关，master 上同样红）。

### 顺带修掉的一个既有缺陷

`buildPrefix` 里起始编号偏移原本判 `i === 0`（序列首段）。截取起点可变后，首段不再必然是
`topLevel` 段，PR 改判 `segLevel === top`——**这同时修正了原代码的语义**：偏移本就该跟着
「真正的 `topLevel` 段」走，而非「序列第一段」。testplan P5 锁住该行为。

### 订正：上一块的「发版状态」已过期 ★

上一块写着「线上商店仍是 1.0.13、1.0.14–1.0.21 全部未发布、tag 尚未推送」——**这条已不成立**。
本次收尾核对 `git ls-remote --tags origin` 与 GitHub Releases 页发现：**`1.0.21` 早已推送并发布，
且被标记为 Latest**（说明文本即 `1.0.21.md`，已含 1.0.14–1.0.21 全部用户可见改动）。

**教训**：`doc/log.md` 里的「发版状态」是**会被仓库外动作改变**的事实（用户可能在会话之外自己推了
tag），写进日志那一刻就可能开始腐坏。**发版前必须现场核**（`git ls-remote --tags origin`），
不能信日志里的旧结论。本次因此差点把 1.0.14–1.0.21 的说明重复塞进 1.0.22 的 Release
（会让用户把「单标题跳过编号」这类早已发布的功能当成新功能读第二遍），核对后已改回只讲本版新增。

### 没做什么

- **PR 分支未在 GitHub 上关闭**——本地合并后需推 master，GitHub 会自行识别；若不自动关闭需手动
  关并致谢（本机无 `gh` CLI）。
- **P12 的 DOM 手验没做**：「继承级数」下拉的置灰联动（H1 恒灰、取消「继承前级」时同步灰）
  是纯 UI，需真机。逻辑侧走同一 `buildPrefix`、已被 P1–P11 覆盖。
- **UVM 未纳入 `inheritDepth` 随机化**：`uvm/stimulus.ts` 目前根本不随机化任何**级内**格式字段
  （`inherit` / `numeral` / 分隔符都不动），不是本 PR 的遗漏，是压测框架既有的覆盖缺口。
- **tag 未推**：发版仍等用户指令，见下方发版状态。

### 下一步

1. **已发版**：`1.0.22` tag 已推送，工作流按 `doc/release-notes/1.0.22.md` 建 Release。
   该说明**只讲 inheritDepth**——因为 1.0.14–1.0.21 的改动已随 **1.0.21 Release 发布过**（见下）。
2. 待手验清单在上一块基础上**新增 P12**：E36 / O11① / O5f / H12 / H9 / Dataview / P12。
3. 未解决问题总账与竞品调研采纳清单见下一块与 `spec.md` Roadmap M9，未受本次影响。

### 本周期派发

派发 0 次（主模型全程自持）——本次是**外部代码审核**，判断合并风险与语义正确性需要完整持有
master 与 PR 两侧的上下文，拆给子 agent 反而要把上下文重述一遍，不划算。

---

## 目录结构约定（按职责分类）

```
obsidian-auto-headings/
├── src/                  ← 源代码（TypeScript）
│   ├── main.ts             插件入口：生命周期、命令、防抖、事务写回、Backlink 同步接线
│   ├── parser.ts           Markdown 标题解析（ATX；跳过区域判定委托 scan.ts）
│   ├── scan.ts             跳过区域扫描器：围栏代码块 + 注释块（%%…%% / <!-- -->），parser 与 numbering 共用
│   ├── numbering.ts        编号引擎编排（numberHeadings/renumberContent）+ 对外 barrel（↓四模块经它转发）
│   ├── template.ts         模板数据模型：类型/默认值/字段规范化
│   ├── count.ts            计数器状态机 HeadingCounter
│   ├── render.ts           序号渲染器 + 前缀拼装 buildPrefix + 面板预览
│   ├── strip.ts            三个剥离器（WJ 边界/清除全样式/清理外来）+ WORD_JOINER + stripWordJoiners
│   ├── whitelist.ts        白名单归一化/命中判定/面板预览分析
│   ├── backlinks.ts        Backlink 同步纯函数核心（改名表/锚点归一/链接重写）
│   ├── cleanup.ts          清除编号命令的内容级封装
│   ├── clipboard.ts        剪贴板净化纯逻辑（WJ 剥离/换行规范化/净化→原文 LRU，spec §2.8）
│   ├── pathrules.ts        路径规则 → 模板解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── settings/
│   │   ├── model.ts        设置数据模型（全局开关、防抖延迟、路径规则持久化）
│   │   ├── SettingsTab.ts  设置 GUI 壳：TAB 栏 + 分发（内容在 tabs/，M7 多 TAB 已拆完）
│   │   ├── ForeignNumberingCleanupModal.ts 迁移守卫 Notice 点击入口：清理预览确认框（testplan J14）
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关；复制净化 1.0.16 起恒开无开关）
│   │       ├── TemplatesTab.ts    模板列表（自绘 header：折叠/命名/删除）
│   │       ├── EditPanel.ts       模板编辑面板（级别格式网格 + 跳级/占位字符）
│   │       ├── WhitelistEditor.ts 白名单行编辑器（分段控件/行内编辑/命中角标）
│   │       ├── PathRules.ts       路径规则表（拖拽排序/建议弹窗/根规则/删模板确认）
│   │       ├── PathSuggest.ts     路径建议弹窗组件（非 TAB，供 PathRules.ts 用，1.0.4）
│   │       ├── DangerTab.ts       敏感操作（清除全库编号）
│   │       └── AboutTab.ts        关于/帮助/鸣谢
│   └── templates/
│       ├── schema.ts       模板 schema 校验/序列化/文件名安全化
│       └── TemplateStore.ts 模板文件 CRUD（vault adapter 读写 templates/*.json）
├── tests/                ← 测试
│   ├── dev_tests/          自动化单元测试（Vitest，无需 Obsidian 运行时，npm test 跑它）+ uvm/ 压测框架
│   └── user_tests/         可复制粘贴进 Obsidian 实测的 .md 样例（每个对应 testplan 某场景）
├── README.md             ← 面向读者的简介（核心功能 + Milestone 概览，入口文档）
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A；research/ 本地调研留档、.gitignore 排除不入库，见该目录 README.md）
├── release/              ← 可分发插件文件（main.js/manifest/styles/README；zip 本地生成不入库）★每周期必更新
├── scripts/
│   ├── sync-release.mjs    把构建产物同步到 release/（被 npm run release 调用）
│   ├── bump.mjs            一键版本号同步（npm run bump）
│   ├── fuzz.mjs            跨平台跑重型随机压测（npm run test:fuzz [-- --runs=/--ops=/--seed=]）
│   └── docs.mjs            文档维护：归档/滚动/摘要/守卫/交接（npm run docs [-- --handover|--check]）
├── .claude/
│   ├── agents/             SubAgent 定义（quality-gate / repo-scout / mech-editor / feature-coder）
│   └── skills/dev-cycle/   开发周期完整清单（十步 + 版本号规则；根 CLAUDE.md §4 只留一句话流程 + 指针）
├── manifest.json         ← 插件清单（Obsidian 约定须在插件根目录）
├── versions.json         ← 版本 → 最低 Obsidian 版本映射
├── styles.css            ← 面板样式源（构建时随插件加载，并复制入 release/）
├── package.json / tsconfig.json / esbuild.config.mjs / vitest.config.ts
├── .eslintrc.json / .prettierrc.json / .eslintignore / .prettierignore
└── LICENSE
```

构建/工具配置文件按惯例留在项目根（Obsidian 与 esbuild/tsc 默认从此处寻找）。

---

## 如何安装到 Obsidian 测试

将 `release/` 下的三个文件复制到你的 Vault：

```
<你的 Vault>/.obsidian/plugins/auto-headings/
├── main.js
├── manifest.json
└── styles.css
```

然后在 Obsidian：设置 → 第三方插件 → 启用 `Auto Headings`。首次启用会在该插件文件夹下
自动创建 `templates/default.json`。

> 重新生成产物：在项目根运行 `npm install && npm run release`，脚本会自动把
> `main.js`、`manifest.json`、`styles.css` 同步进 `release/`。
