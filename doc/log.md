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
- **J17 的视觉与移动端堆叠留手验**：假编辑器环境下 `Modal.open()` 是空实现（`onOpen`/DOM 渲染从不
  真正执行），单测只能覆盖到"构造参数正确 + 回调行为正确"这一层，卡片留白是否真的舒适、窄屏堆叠
  是否真的可用，需要真机点一次确认。
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

### 下一步

1. **待手验**：J17 的卡片视觉 + 窄屏纵向堆叠（见上）；沿用上一周期遗留的 P12 / E36 / O11① / O5f /
   H12 / H9 / Dataview。
2. 未解决问题总账与竞品调研采纳清单见更早周期块与 spec Roadmap M9，未受本次影响。
3. 发版仍等用户指令；发版前照例先 `git ls-remote --tags origin` 现场核对，不信日志旧结论。

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

## 2026-08-09 会话收尾：未解决问题总账 + 竞品调研路线调整（无版本变化，纯文档）

> **接手者从这里开始读。** 本块是 2026-08-09 那次长会话（1.0.15 → 1.0.21，七个版本）的收尾总账，
> 只汇总**状态与去向**，不复述细节——每条都指向真正的事实源。

### 本次会话产出（七个版本）

| 版本 | 一句话 |
| --- | --- |
| 1.0.15 | `CLAUDE.md` 瘦身 46 行，开发周期十步下沉为按需加载的 `dev-cycle` 技能（纯文档，未 bump） |
| 1.0.16 | 复制净化取消开关、改为恒开（旧配置迁移删键）+ 订正附录 A.11 两处「移动端独占 / 唯一」错误论点 |
| 1.0.17 | 单标题跳过编号 `<!-- skip -->`（issue #6 phase 1）+ 迁移守卫可见化 + UVM 注释块排雷三颗雷 |
| 1.0.18–1.0.21 | 迁移守卫提示的**四轮真机修复**，详见下方「那条 bug 的四轮教训」 |

### 发版状态 / git tag ★

- **线上商店仍是 1.0.13**；`git tag` 最新也是 `1.0.13`。1.0.14–1.0.21 **全部只在仓库里，未发布**。
- **用户已拍板：只发最新那一个版本**（不逐版本补发）。故 `doc/release-notes/` 里**只有
  `1.0.21.md` 是会被取用的**——它已把 1.0.14–1.0.21 的全部用户可见改动合并成一份双语说明。
  `1.0.10.md`–`1.0.17.md` 均为历史草稿，**不会被任何流程读取**，保留仅作留档。
- **发布姿势**（本机无 `gh` CLI，走 tag 触发工作流）：确认 `manifest.json` 版本 = `1.0.21` →
  `git tag -a 1.0.21 -m "1.0.21"`（**不带 `v` 前缀**，Obsidian 约定）→ `git push origin 1.0.21`。
  `.github/workflows/release.yml` 会自动构建、按 `doc/release-notes/1.0.21.md` 建 Release 并附三个
  产物。**截至收尾时 tag 尚未推送**——等用户明确指令再发（推 tag = 面向全体用户公开发布）。

### 未解决问题总账

**A. 待用户真机手验**（本地无从验证，都需要真实 vault）

| 项 | 内容 |
| --- | --- |
| testplan `E36` | 带 `<!-- skip -->` 的标题，`[[文件#` 补全给出哪种形态、已有内链是否解析。夹具已备好：`tests/user_tests/11-单标题跳过编号.md` 最后一节 |
| testplan `O11①` | 设置 → 全局设置里确认**不再有**「复制净化」开关（纯 UI，1.0.16 已删代码） |
| testplan `O5f` | Obsidian **内置**「导出为 PDF」是否残留 WJ。**这条卡着一个需求的决策**：结论出来才能定「渲染层剥 WJ」做不做 |
| testplan `H12` / `H9` | 固化编号确认框 / 离场提示条；真库内链不断 |
| Dataview 样例 | README 里给的查询写法需在真实 Dataview 上验一遍 |

**B. 待决策**

- **复制净化未命中时的降级**（spec §2.8「残余已知限制」）：LRU 未命中（重启后 / 条目逐出 /
  外部改过）时粘贴回来的是净化文本。1.0.17 已把上限 50→200 吃掉「同会话逐出」这一类；
  **剩下「跨重启」这一类未处理**——曾评估的「未命中时剥净编号再插入」会改变粘贴语义，未做；
  「持久化 LRU」已因隐私 + 多端同步冲突**两次否决**，不要再翻案。
- **Setext 标题支持的优先级**（spec Roadmap M12 已登记）：做与不做未定；真要做**必须连
  frontmatter 结尾 `---` 被误判成 Setext H2 那个坑一起做**（竞品 gurjar1 的同类缺陷至今 open）。
- **`doc/research/` 的可移植性**：它是 `.gitignore` 排除的**本地留档**，换机器/重新克隆就没了。
  当初这么定是因为本仓库是**公开发布仓库**、放不得逐条点名竞品的拆解材料。若要跨机器保留，
  需另择存放处——这个取舍用户知情但未最终拍板。

**C. 待做（已定性，等排期）**

- **单标题 skip 的 phase 2**：标题旁浮动菜单里一键切换，标记由插件写入。等 M8a/M8b GUI 落地。
  纪律见 [spec §3.20](./spec.md)：**手写标记只是兜底，不得当卖点售卖**。
- **竞品调研的采纳清单 8 项**：已全部立项进 [spec Roadmap M9](./spec.md)「竞品源码级调研的采纳
  清单」，含工作量 / 风险 / 与既有设计的冲突点。**不要照抄竞品实现**，每条都写明了不可照抄的
  地方（尤其 backlink 回滚的并发写、低置信度编号接管）。

**D. 已知限制（接受，不修）**

- 迁移守卫的提示：**用户手动关掉后不会重新弹**（Obsidian 的 `Notice` 无「被关闭」回调），
  需切到别的文件再回来。
- 迁移守卫的判据（`stripForeignNumbering`）有**固有误伤面**：`## API 设计`、`## TODO 清单`
  这类正常标题会被判成疑似外来编号 ⇒ 弹提示、跳过自动编号。正因如此，清理**必须**走预览确认框，
  **绝不可做成无预览的一键清理**（否则就是把 `API` 从用户标题里吃掉）。
- 未落盘改动下，`cachedRead` 读到的是上次落盘内容，切回来那一瞬的守卫判断可能滞后一步；
  用户一开始打字即经防抖路径按编辑器真实内容重新判断，不影响正确性。
- 本机 `whitelist.test.ts:406` 的 ICU 排序断言**恒红**，是 Windows 环境差异，不是回归。

### 那条 bug 的四轮教训 ★（最值得下一个接手者读的一段）

同一个「迁移守卫提示不对」的问题修了四轮，每轮都以为找到根因：

1. **1.0.17** 按 `file-open` 事件重置「已提示」标志 → 真机说切回来不一定弹。
2. **1.0.18** 改按「最近检查的路径」推导，不依赖事件 → 真机说切到干净文件反而弹。
3. **1.0.19** 加「提示只为当前活动文件发声」的门 → 真机说提示依然是过时的。
4. **1.0.21** 才发现：**喂给判断的内容本身就是错的**——`file-open` 那一刻 `view.file` 已换、
   编辑器缓冲区还显示上一篇，且滞后**不止一个事件循环**（1.0.20 推迟一个宏任务仍读到上一篇）。
   改用 `vault.cachedRead(file)` 取文件自身内容，时序无关，问题消失。

**四轮的单测全绿，根子是同一个**：测试替身里「文件内容」与「编辑器内容」**永远相等**、且
`app.workspace` **根本没有 `getActiveFile`**，于是「被检查的文件 ≠ 用户正看着的文件」「文件内容 ≠
缓冲区内容」这两个维度在单测里**根本不可表达**。
**⇒ 替身比真实环境「更整齐」的地方，就是 bug 的藏身处。** 往 `obsidian-mock.ts` 里补方法时，
优先补那些能让「不一致」被表达出来的，而不是让一切都自洽。
本轮新增的回归都做了**「去掉修复 → 确认变红 → 恢复 → 转绿」**的实测，不是写完就绿的摆设——
这个动作值得成为习惯。

### 接手指引

1. 第一条命令仍是 `npm run docs -- --handover`。
2. 本分支 `feat/m11-export-m12-retire` 的改动**已全部合并回 `master`**（见下方「验证方式」）。
3. 竞品调研的**结论**在 [spec Roadmap M9 采纳清单](./spec.md)；**原始报告**在 `doc/research/`
   （本地、不入库），需要溯源细节时才翻。

**验证方式**：全程 `npx tsc --noEmit` / `npm test` / `npm run lint` / `npm run format:check` /
`npm run test:fuzz` 五项门槛；唯一红灯是既知的 ICU 排序噪音。1.0.21 已由用户真机确认解决。

**本周期派发 0 次**（收尾整理，主模型亲自做）。

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
