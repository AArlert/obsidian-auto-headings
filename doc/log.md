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

## 2026-08-09 1.0.19 迁移守卫提示只为当前活动文件发声（真机反馈第二轮，找到真根因）

**背景**：1.0.18 发出去后用户第二轮真机反馈，给了完整复现：「打开一个外来编号的文件，没弹；
切换到一个自己写的文件，这时候就弹出提示；点击清理又说不需要清理」。三条症状同源，而且**前两版
（1.0.17 的 `file-open` 重置、1.0.18 的 `lastGuardedPath` 序列推导）都没打到根因**——它们都在
调整「**什么时候**该重新提示」，而真正的问题是「**这条提示说的是哪个文件**」。

**根因**：`guardForeignNumbering` 的发起方**不保证是用户正看着的那个文件**：

- `scheduleRenumber` 的防抖计时器捕获的是**安排那一刻**的 `path` 与 `editor`。用户在 a.md 里敲了
  字、300ms 还没到就切走，计时器在**切换之后**才到期 ⇒ 弹出的是 a.md 的提示，而屏幕上已经是
  b.md。这正是症状 ①②：打开 a 时没弹（那时还没打字、没有计时器），切到 b 才弹（a 的计时器到期）。
- `renumberActiveFile`（改模板后即时重排）直接遍历**全部**打开的叶子，后台脏文件同样会弹。
- 症状 ③ 随之而来：那条提示指向 a.md，而同标签页切换早把 a.md 换掉了 / 用户以为它在说 b.md，
  于是点进去看到的是「不需要清理」。

**做了什么**：

1. **提示的可见性收归 `showForeignNumberingGuardNotice` 一处裁决**，三条约束：
   - **只为当前活动文件发声**：`this.app.workspace.getActiveFile()?.path !== path` 直接不弹。
   - **同一文件至多一条**：已有一条在屏幕上就不重建——Notice 是 `duration: 0` 不自动消失的，
     用户持续打字会让防抖反复到期，每次重建会闪烁、且把用户正要点的那条抽掉。
   - **失效即收起**：切到别的文件（`renumberOnOpen` 最前面无条件调用
     `dismissGuardNoticeUnlessFor`）、或该文件已被清理干净（`guardForeignNumbering` 返回 false
     时 `dismissGuardNotice`）时主动 `hide()`。
2. **`lastGuardedPath` 删除**（1.0.18 引入的那个单变量）：它解决的是「什么时候重新提示」，而
   新机制里「切走时收起、回来时因无活动提示而重建」天然覆盖了这个诉求，不需要额外状态。
3. **`main.test.ts` 回归 6 例**，含真机链路逐条复现（计时器切走后到期不弹、批量刷新只弹活动的
   那个、连续打字只有一条、切走收起、切回重提、清理干净收起）。

**为什么前两版没测出来（值得记住的教训）**：测试替身 `app.workspace` **根本没有 `getActiveFile`
方法**，而 `main.ts` 里用的是 `getActiveFile?.()`（可选调用）——于是「活动文件」这个维度在单测里
**根本不存在**，两版实现都只能围绕「调用序列」做文章，测试也就只能验证调用序列。本轮给替身补上
了 `getActiveFile` 并新增 `setActiveFile` 驱动器，让「被检查的文件 ≠ 用户正看着的文件」这个真实
场景第一次变得**可表达**。**替身缺一个方法 = 一整类 bug 在单测里不可见**。

**没做什么 / 已知遗留**：

- **用户手动关掉提示后不会重新弹**：Obsidian 的 `Notice` 没有「被用户关闭」的回调，插件无从得知
  那条已经不在屏幕上，因而会一直认为「这个文件已有一条」。要等切到别的文件再回来才会重建。
  可接受（对比 1.0.15 之前的「静默永久跳过」仍是净改善），但记在这里备查。
（1.0.18 那轮遗留的「zip 被占用打不了包」已解除，本轮 `npm run release` 跑通，产物为 1.0.19。）

**下一步**：① 把 1.0.19 发给用户**第三轮**复验（重点复现本次那条链路：在外来编号文件里打字 →
立刻切走 → 观察是否还会误弹；以及切走再切回是否照常提示）；② 复验通过后推送、合并、打 tag
（只发 1.0.19）；③ 排队中的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（490 通过，唯一红灯仍是既知的 `whitelist.test.ts:406`
ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）全绿。

**本周期派发 0 次**（主模型亲自处理——根因判断依赖对触发链路时序的整体理解，不适合外包）。

---

## 2026-08-09 1.0.18 迁移守卫重新提示不再依赖 file-open 事件（真机验证反馈）

**背景**：用户拿 1.0.17 release 包真机测试后反馈：迁移守卫的「换到别的文件再回来即可再提示」
（J13）不一定真的弹出来。1.0.17 的实现按 `file-open` 事件重置「已提示」标志——单测里用「连续
调用两次 `renumberOnOpen`」模拟「切走再切回」，这个模拟本身就在假设 Obsidian 的 `file-open`
在标签页切换时每次都可靠触发，而这个假设从未在真实 Obsidian 里验证过（testplan J14 当时也承认
「🔲 手验 DOM」）。真机测出它不成立。

**做了什么**：

1. **重新设计判断依据，不再绑定单一事件**（testplan J13 改版）：`foreignNumberingWarned`
   （`Set<string>`「已提示过」标志）换成 `lastGuardedPath`（`string | null`，最近一次被检查的
   文件路径）。`guardForeignNumbering` 在函数最前面**无条件**比较「这次要检查的路径」与
   `lastGuardedPath` 是否相同——不同就判定「刚从别处过来」，允许重新提示；相同则维持节流。
   这个比较**不依赖任何特定事件**：触发检查的除了 `file-open`（`renumberOnOpen`），编辑防抖
   到期（`scheduleRenumber`）同样会调用 `guardForeignNumbering`——只要用户在别的文件里打过字
   （哪怕 `file-open` 那次真的没触发），`lastGuardedPath` 照样会被更新，回到原文件继续编辑时
   一样能正确识别「离开过」。
   - **关键细节**：路径比较写在函数最前面、**无条件**执行（哪怕本次检查的文件其实内容干净、
     不含外来编号也照样刷新）——否则切去一个干净文件再切回来，`lastGuardedPath` 不会被那次
     「路过」更新，回来后反而识别不出离开过。
   - **为什么不是「每次检测都弹」**（用户最初的直觉修法）：`guardForeignNumbering` 在编辑防抖
     每次到期时都会被调用——用户在同一个疑似外来编号的文件里持续打字、多次停顿，若不做任何
     节流，会弹出多条 `duration:0`（不自动消失）的 Notice 堆在屏幕上，比原来的静默 bug 更烦人。
     `lastGuardedPath` 这个设计同时满足「同一文件内连续编辑只提示一次」与「换文件再回来必定
     重新提示」两个目标，且后者不再依赖事件的可靠性。
2. **改名 / 删除 / 卸载的配套维护**同步从 Set 操作改为单变量比较赋值（`rename` 时若
   `lastGuardedPath` 恰是旧路径则跟着改；`delete` 时若恰是该路径则清空；`onunload` 直接置 `null`）。
3. **`main.test.ts` J13 用例重写并新增**：原「连续调用两次 `renumberOnOpen`」用例本身就是在测
   一个不成立的假设，已改为「中途插入对另一文件的检查」；新增一条「完全不调用 `renumberOnOpen`、
   纯靠 `scheduleRenumber` 打字触发」的专项，直接对应用户反馈的真机场景；另加一条验证 `file-open`
   确实触发时也照常工作。共 4 例（原 2 例扩为 3 例 + 1 例新场景）。
4. **发行说明改写为 1.0.18.md**（`1.0.17.md` 原样留作历史草稿，不再是任何流程会读取的文件）：
   迁移守卫那条 bullet 的措辞从「重新打开文件」改为「切到别的文件再切回来」，与实际机制一致；
   版本区间从「1.0.14–1.0.17」延到「1.0.14–1.0.18」。

**没做什么 / 已知遗留**：

- **一个较窄的边界未处理**：若用户同时打开多个疑似外来编号的文件并快速轮流编辑（如分屏），
  `lastGuardedPath` 会在这些文件间来回变化，导致每次切回都被判定「离开过」而重新提示——即便
  用户其实没有真正离开太久。评估为可接受的权衡（对比原来的「静默永久跳过」是净改善），未做
  更复杂的「多文件访问历史」跟踪。
- **设置面板改模板触发的批量刷新**（`renumberActiveFile`，同样调用 `guardForeignNumbering`）
  在多个疑似外来编号文件同时打开时，会依次将 `lastGuardedPath` 指向每个文件，理论上可能让
  用户正在编辑的那个文件在批量刷新后被误判为「刚从别处过来」而多弹一次提示——同上，接受。
- release 包因用户机器上 `release/auto-headings.zip` 被 NanaZip 打开锁定，打包步骤本轮暂未跑通；
  平铺三件套（`main.js`/`manifest.json`/`styles.css`）已同步到 1.0.18，需在用户关闭该文件后补跑
  `npm run release` 重新打包 zip。

**下一步**：① 用户关闭锁定 zip 的窗口后补跑 `npm run release`，重新打包发给用户复验（含 J13 场景：
真实切换标签页测试）；② 复验通过后推送分支、合并回 master、打 tag（只发 1.0.18，之前的 1.0.14–17
均不单独发布）；③ 之前排队的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 标题支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（487 通过，唯一红灯仍是既知的 `whitelist.test.ts:406`
ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）全绿。

**本周期派发 0 次**（主模型亲自处理——涉及对真机反馈的根因判断与节流策略取舍，不适合外包）。

---

## 2026-08-09 1.0.17 单标题跳过编号（issue #6）+ 迁移守卫可见化 + UVM 注释块排雷

**背景**：三条线并行。① 用户 issue #6 提前排期到本周期；② 上周期 spec §2.8 补写的「迁移守卫两种
后果」分析里，更重的那一种（静默永久跳过、用户视角像插件坏了）本周期直接动手修；③ 1.0.14 遗留的
UVM 注释块激励缺口一并排掉。②③ 派 `feature-coder` 并发执行，①主模型亲自做（涉及解析核心与
backlink 锚点，不适合外包）。

**做了什么**：

1. **单标题跳过编号 `<!-- skip -->`**（issue #6 phase 1，testplan E30–E36，spec §3.21 新节）：
   `parser.ts` 新增 `hasSkipMarker`（行尾 HTML 注释，大小写/空白容错），接到 `numbering.ts` 里
   **白名单豁免的同一分支**——不新造机制：命中即不编号、不推进计数器、不作重置边界，但**剥离
   已有编号**（给已编号标题事后补标记，下次重排会摘掉那个号，不会冻结成僵尸编号）。选形态的
   四条理由（阅读视图不可见/复用 1.0.14 R2 语义/必须行尾避免误判正文批注/与 gurjar1 刻意同形
   零迁移成本）与两条未定项（phase 1 只跳本行不含子树；内链锚点表现待实机）写进 spec §3.21。
   新增 `tests/user_tests/11-单标题跳过编号.md` 夹具，README 双语补充说明（按 §3.20 判据：
   手写只是兜底，不当卖点售卖）。
2. **迁移守卫可见化**（testplan J13/J14）：`foreignNumberingWarned` 从「每会话一次、之后永久
   静默」改为「每次 `file-open` 重新允许提示一次」（`renumberOnOpen` 函数体最前清空，它是
   file-open 在自动路径上的唯一入口）。Notice 改用 `createFragment` 构造可点击文案（Obsidian
   官方 API，`Notice` 原生支持 `DocumentFragment`，`duration:0` 常驻到用户点击），点击后打开
   `ForeignNumberingCleanupModal`——逐条列出「现状→清理后」对照（`previewForeignNumberingCleanup`，
   与实际清理同一套 `stripForeignNumbering`，保证预览与结果一致），**不做无预览的一键清理**：
   清理命令与守卫共享同一误伤面（`## API 设计`这类正常标题也会被判成疑似外来编号），无预览
   执行等于本插件一直在批评竞品的「吃用户内容」缺陷本身。
3. **UVM 注释块激励排雷**（1.0.14 遗留三颗雷全部拆除，见下方独立小节）。
4. **LRU 上限 50→200**（`clipboard.ts`，上周期净化降级方案 A 的第一步，减少同会话内的条目逐出）。

**UVM 排雷细节**：先用临时探索脚本（未入库）对 `renumberContent`/`backlinks.ts` 做了 13 组对照
实验，摸出关键点——注释块「事后包住已编号标题」时自动重编号会清 WJ 残留（按 §3.17 分区域分治），
围栏则原样冻结；据此① SAFE/MESSY 碎片投毒按「行内配对闭合进默认模式、未配对裸定界符进 explore」
分区；② `deleteLine` 补删注释定界行的覆盖率标记（本无保护，只是没统计）；③ R3 形态标题走
backlink 往返实测天然安全，不必如原设想限制进 explore 池。`oracles.ts` **未改**过滤逻辑——已证明
现有正则够用，但依赖「注释相关碎片池都是良构（无 `]`/`#`/`|`）」这条隐性前提，以后扩碎片池要留意。

**没做什么 / 已知遗留**：

- **单标题 skip 只做识别，没有写入侧**：phase 2（标题旁浮动菜单一键切换）等 M8a/M8b GUI 落地。
- **内链锚点表现未验**（testplan E36）：带标记标题的 backlink 快照与锚点归一化看到的是含标记
  文本，Obsidian metadataCache 怎么处理 HTML 注释锚点本地无法验证，登记待用户真机手验。
- **迁移守卫 Modal 的 DOM 渲染未测**（沿用仓库既有约定：`Modal.open()` 从不触发 `onOpen`，
  单测只覆盖构造参数与回调，DOM 细节留手验）。
- **净化降级方案 A 只做了 LRU 上限**：真正的「不再静默永久跳过」已经是本周期的迁移守卫改造
  （两者是同一类问题的不同入口，此次一并解决）；「未命中时剥净编号再插入」仍未做。
- 1.0.14–1.0.17 **都还没打 tag 发布**；release-notes 待补。

**下一步**：① 打包 release 交给用户本机验证（O11①/H12/H9/O5f/Dataview/E36 一起验，见 status
`next`）；② 用户验证通过后推送分支、合并回 master、打 tag（**只发最新版本**）；③ Setext 标题
支持（spec Roadmap 已登记，优先级待定）。

**验证方式**：`npx tsc --noEmit` / `npm test`（485 通过，本机唯一红灯是既知的
`whitelist.test.ts:406` ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）
全绿；三条并行改动经 `git status` 确认零文件级冲突，合并后重跑全部门槛复核无交互问题。

**本周期派发 2 次**（feature-coder × 2，UVM 排雷 + 迁移守卫可见化，均并发执行；单标题 skip 主模型
亲自实现）。两次派发均因 auto-mode 分类器故障被意外中断过一次，确认无残留改动后原样重派成功。

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
