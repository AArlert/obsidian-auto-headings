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

## 2026-08-09 1.0.21 判断依据改为文件自身内容（真机反馈第四轮；用户直接点出了正解）

**背景**：1.0.20 的 `setTimeout(0)` 不够。用户第四轮给了一个非常干净的复现，直接把规律指出来了：
「a、b 是正常文件，C 是外来编号。那么 **a→C 无提示，C→b 弹提示且没什么可清理**」——
**编辑器内容正好落后一个文件**。并且直接提了正解：**「为什么不能做成打开 C 就弹出？打开 a、b
不弹出？就是只检测当前打开的文件，然后立马弹出提示」**。

**根因（终于对上）**：`file-open` 那一刻 `view.file` 已换、编辑器缓冲区还显示上一篇，而且这个
滞后**不止一个事件循环**——1.0.20 推迟一个宏任务再读，读到的仍是上一篇。所以「读编辑器」这条路
本身就是错的，推迟多久都是在猜。

**做了什么**：`renumberOnOpen` 不再读 `editor.getValue()`，改用 **`vault.cachedRead(file)`**——
它按 `TFile` 取**这个文件自己的内容**，与编辑器换没换到位**完全无关**，是时序无关的判据。
守卫与提示全部基于它，于是「打开 C 就弹、打开 a/b 不弹」自然成立。

- **写入侧另加一道闸**：`applyRenumber` 必须经编辑器写，故只有在编辑器确实已显示该文件、
  且 `editor.getValue() === content` 时才动手；不一致说明尚未换到位（或有未落盘改动），
  本轮**只判断不写入**。1.0.20 记录的那个「可能把 A 的编号写进 B」的潜在数据损坏，到这里才真正
  堵死——之前只是靠守卫恰好拦住。J9 的语义不受影响：内容一致时照常重排，不一致时由用户随后的
  第一次编辑经防抖路径补上。
- **`main.test.ts` J15 重写为 6 例**，直接按用户给的 a→C / C→b 两个方向建模，**去掉修复后这两条
  确实变红**（已实测）。

**教训（连着四轮，根因每轮都更深一层）**：1.0.17 调「何时重新提示」→ 1.0.18 换判据仍在调时机 →
1.0.19 加「提示归属哪个文件」的门 → 1.0.21 才发现**喂给判断的内容本身就是错的**。四轮的单测全绿，
根子是同一个：**测试替身里「文件内容」与「编辑器内容」永远相等**，而真实 Obsidian 在换页瞬间恰恰
不等。本轮给替身补上 `vault.cachedRead`、并让它能与编辑器内容**故意不一致**，这个维度才第一次
可表达。**替身比真实环境「更整齐」的地方，就是 bug 的藏身处**——这条已经连续验证两次了。

**没做什么 / 已知遗留**：

- **未落盘改动的边角**：用户在某文件里打了字（未保存）后切走再切回，`cachedRead` 读到的是上次
  落盘的内容，可能与屏幕上不完全一致。守卫判据因此可能略滞后一步；随后的第一次编辑会经防抖
  路径按编辑器真实内容重新判断，故只影响「刚切回来那一瞬的提示」，不影响正确性。
- 1.0.19 遗留的「用户手动关掉提示后不会重新弹」（Obsidian 的 `Notice` 无关闭回调）仍在。

**下一步**：① 把 1.0.21 发给用户**第五轮**复验（原样跑 a→C、C→b 两步）；② 通过后推送、合并、
打 tag（只发 1.0.21）；③ 排队中的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（496 通过，唯一红灯仍是既知的
`whitelist.test.ts:406` ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）
全绿；J15 新用例经「去掉修复 → ①② 变红 → 恢复 → 转绿」实测确认有效。

**本周期派发 0 次**。

---

## 2026-08-09 1.0.20 `file-open` 时编辑器内容尚未换到位（真机反馈第三轮；**方向对、药量不够**——见 1.0.21）

**背景**：1.0.19 发出去后第三轮真机反馈：「在外来编号的文件里敲个字、立刻切去**已经由本插件
接管**的文件，弹出，但点击后还是显示没有什么可以清理——提示依然是过时的。切回来也不弹出。」
1.0.19 加的「只为当前活动文件发声」那道门**确实生效了**（提示挂在了 b.md 上、`getActiveFile()`
也确实是 b.md，所以门放行了），但它挡不住真正的毛病：**内容是错的**。

**根因**：`renumberOnOpen` 同步跑在 `file-open` 处理器里，而**那一刻 Obsidian 已经把
`view.file` 换成了新文件、编辑器里的内容却还是上一篇的**。于是：

- `view.file?.path === "b.md"` ✅ 通过 → `editor.getValue()` 返回的却是 **a.md 的内容** →
  `hasUnclaimedForeignNumbering(a 的内容)` = true → 提示**挂在 b.md 的路径上**弹出。
- 点击时 `markdownContextForPath("b.md")` 重新读 b.md 的**真实**内容（此时已换到位、带 WJ）
  → 预览为空 → 「没有什么可以清理」。
- 切回 a.md 时同理：编辑器又还停在 b.md 的内容上 → 判定为干净 → 不但不提示，还顺手
  `dismissGuardNotice("a.md")`。三条症状全部对上。
- **更危险的潜在后果**：若那份陈旧内容恰好是「干净但没编号」的，`applyRenumber` 会把
  **a.md 的编号写进 b.md 的编辑器**。这次是守卫恰好拦住才没发生——属于侥幸，不是设计。

**做了什么**：

1. **`renumberOnOpen` 推迟一个宏任务**（`window.setTimeout(…, 0)` → 新的
   `renumberOnOpenSettled`），在那时**重新解析**活动视图、并**重新确认**它就是本次打开的文件
   （用户可能在这一瞬又切走了）。J9「打开即按当前模板重排」的语义不受影响——它本来就不要求
   同步完成。
2. **`scheduleRenumber` 计时器加作废闸**：到期时若 `info.file?.path !== path`，说明这个叶子在
   防抖窗口内已切到别的文件（同一个 `MarkdownView`/`Editor` 实例会被复用来显示新文件），
   **整轮作废**。此前只靠 1.0.19 那道「活动文件」门挡提示，写入侧并没有挡。
3. **`main.test.ts` 新增 J15 三例**，其中一例把「`view.file` 已换、`editor` 内容未换」那一瞬
   **精确建模**（同一个 editor 实例，推进事件循环时才换内容）——**去掉修复后该用例确实变红**，
   已实测确认它抓得住这个 bug，不是写完就绿的摆设。

**教训（第三轮才修对，值得记住）**：三轮修复分别在调「什么时候重新提示」（1.0.17 `file-open`
重置 / 1.0.18 `lastGuardedPath`）、「这条提示说的是哪个文件」（1.0.19 活动文件门），**都对，但都
不是根因**——根因是「判断所依据的内容本身就是错的」。前两轮的单测之所以全绿，是因为测试替身
里**编辑器内容与文件路径永远是一致的**，而真实 Obsidian 在 `file-open` 那一瞬恰恰不一致。
**替身比真实环境「更整齐」的地方，就是 bug 的藏身处。**

**没做什么 / 已知遗留**：

- **`setTimeout(0)` 是否足够**取决于 Obsidian 换内容的时机，本地无法验证。若第四轮仍复现，
  下一步应改为「用 `metadataCache.getFileCache(file)` 的 headings 与编辑器内容交叉校验」，
  内容对不上就跳过本轮——那是不依赖时序的判据，但实现更重，故先用延后这条轻的。
- 1.0.19 遗留的「用户手动关掉提示后不会重新弹」（Obsidian 的 `Notice` 无关闭回调）仍在。

**下一步**：① 把 1.0.20 发给用户**第四轮**复验（原样复现这次那条链路）；② 通过后推送、合并、
打 tag（只发 1.0.20）；③ 排队中的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（493 通过，唯一红灯仍是既知的
`whitelist.test.ts:406` ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块
记分板）全绿；新增回归经「去掉修复 → 变红 → 恢复 → 转绿」实测确认有效。

**本周期派发 0 次**（主模型亲自处理——根因判断依赖对 Obsidian 事件时序的整体推理）。

---

## 2026-08-09 1.0.19 迁移守卫提示只为当前活动文件发声（真机反馈第二轮；**当时以为是根因，实际不是**——见 1.0.20）

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
