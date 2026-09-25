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

## 2026-09-25 把 master 的 stripPrefix 修复合进 M14（1.2.0，交接：claude/m14-virtual-mode）

### 做了什么

- 用户决定 1.1.5 **不单独发版**，修复随 1.2.0 一起发。把 master（`1a84d17`，含 `claude/fix-wj-midtext`）合进 M14 分支。
- 冲突处理：
  - `src/cleanup.ts` `hasUnclaimedForeignNumbering`：先走修复加的结构性证据（`CLAIMED_LINE_RE` 行首 WJ +
    `hasPluginPrefix`），末行用 M14 的 `looksForeignNumbered`；M14 的 `isMostlyForeignNumbered` 原样保留，
    它按 `!startsWith(WJ)` 判归属，与修复同一口径。
  - 版本号文件取 1.2.0；`versions.json` **保留 `1.1.5` 条目**（仓库惯例：每次 bump 都登记，没发版的
    1.0.26–1.0.32 也在列）。
  - `log.md` / `status.jsonl`：修复周期块 / 概括行插在 M14 各块之上；两份 archive 以 M14 为准（已是超集）。
  - `release/` 重建。
- 同类排查：M14 新代码里判 WJ 归属的地方都只认行首 WJ。`computeVirtualNumbers` 的残留区间取自编号引擎
  剥出的纯文本，合入修复后，E39 形态（尾哨兵被毁 + 标题里有带 WJ 的链接）的残留区间从「一直吞到链接锚点」
  变成只含残缺前缀，自动受益；阅读视图 `decorateHeading` 只在首个文本节点里找尾哨兵（链接是独立元素），
  不受影响。
- `doc/release-notes/1.2.0.md` 补修复条目（中英）。
- testplan 里 `M18` 有两行重名，合并前三方就都是这样，未动。
- 本周期派发 1 次（quality-gate × 1）。

### 没做什么

- 没合并 master、没打 tag（发版须用户明确同意）。

### 下一步

- 发版前一轮开发（用户已选定）：H8（清全库 / 固化改走 `batchRewrite`）、「复制编号大纲」「复制当前小节链接」
  两条命令、**内置大纲面板显示虚拟编号**（原登记为 M14 二期，用户要求提前）。模板同名提示**不做**——用户
  认为 `default.json` 恒生效、冲突副本被忽略可以接受。

### 验证方式

- 分项跑（quality-gate）：`release` 通过；`npm test` 740 通过 / 1 失败（whitelist.test.ts:406 ICU 排序，Windows
  既有伪影）；`lint`、`format:check`、`docs --check` 通过；`test:fuzz` 三块记分板通过（31.9s）。

---

## 2026-09-25 修复标题中间 WJ 被当旧单哨兵致标题开头被吃（1.1.5，交接：claude/fix-wj-midtext）

### 做了什么

用户实测复现的**数据丢失** bug（1.1.4 已上线即有）：标题**中间**含 WJ 时——典型来源是标题里放了指向
「已编号标题」的链接，`displayAnchor` 把 WJ 写进锚点 `[[a#⁠1 ⁠概述]]`——编号时标题开头被吃：
`## 参见 [[a#…]]` → `## ⁠1 ⁠1 ⁠概述]]`；超出编号区间的 H1 更被 `bareHeading` 定点循环蚕食成 `# 概述]]`。

- **根因**：`strip.ts` 的 `stripPrefix` / `stripPrefixBroad` 把「首个 WJ 不在位置 0」一律当旧单哨兵，剥到该 WJ
  之后。同类第二处：首哨兵在、尾哨兵被毁时，「第二个 WJ」可能是正文链接里的（E14 删后缀操作发生在带链接的
  标题上），同样整段吃掉。
- **修法（strip.ts）**：
  - 新增 `isLegacyPrefixSegment`：首个 WJ 之前那段须**整段匹配**「前缀字面量? + 序号游程（段间必有间隔符）+
    后缀字面量? + 标题间隔符*」且不含 `[[` / `](` 才当旧单哨兵剥；否则原样返回（宁可不剥）。序号样式恒取
    全部（旧前缀可能写于另一模板，既有用例 `1.二.1 ⁠` 要求如此），安全性靠整段匹配 + 链接语法排除。
  - 首哨兵在时，第二个 WJ 之前若有 `[[` / `](` → 视为尾哨兵被毁，走既有有界剥离愈合。
  - **ReDoS**：初稿 `(?:[类]| )*` 在默认空格间隔符下指数回溯（长空白串实测卡死），改为：序号合成单字符类游程、
    段间间隔符必选、被字符类覆盖的间隔符字面量不再作分支。加了 5000 字符的回归用例。
  - 新增导出 `hasPluginPrefix`（只认行首哨兵或旧单哨兵）。
- **同类排查（cleanup.ts）**：「清理非本插件编号」/ 预览 / 迁移守卫原按 `includes(WJ)` 判归属——手写
  `## 1. 参见 [[a#…]]` 被当插件的跳过清理；**正文里一条带 WJ 的链接就废掉整份文件的迁移守卫**。改用
  `hasPluginPrefix` + 「某行以 WJ 哨兵起头」的结构性证据。`cleanDemotedResidue` 只处理 WJ 起头行，靠
  stripPrefix 修复自动受益；`main.ts` 的 WJ 用法（剪贴板净化、空标题 `endsWith`）无此问题。
- **Pandoc filter**（`assets/pandoc/strip-autoheadings.lua`）同病：本机 pandoc 实跑，未编号标题
  `# 参见 [[a#…]]` 导出成 `# 概述]]`。`pickTarget` 改为：行首 WJ 才认双哨兵（前缀属地须纯文本且无链接语法），
  中间 WJ 仅当前一段全是序号 / 分隔字符才认旧单哨兵；已实跑验证 6 种标题（testplan O5h）。
- **标记契约 / spec 订正**：契约原称「WJ 不会出现在正文」「未编号标题不含 WJ」与事实不符（链接锚点带 WJ），
  改为「只有标题首字符的 WJ 才标记前缀」；「剥整前缀」配方从全局 `/…/g` 改为行首锚定（否则会剥掉标题内链接
  锚点的 WJ 对）。这是事实描述与配方的订正，格式本身未变，不涉主版本迁移。spec §2.5 配套取舍、§A 契约摘要同步。
- **顺修 fuzz 超时**：`random_sequence.test.ts` 的内联 30s 超时**覆盖** `fuzz.mjs` 的 `--testTimeout`，M13
  记分板 5000×80 在本机约 25–30s 撞线（与本修复无关，已对照基线同速）。改为内联读 `AAH_FUZZ_TIMEOUT`，
  `fuzz.mjs` 传 600000。
- testplan：新增 E37–E41、O5h（先 ❌ 后 ✅），§3.1 已修 bug #15。
- 本周期派发 2 次（quality-gate × 2）。

### 没做什么

- 基于 master 做（独立 worktree `../obsidian-auto-headings-wjfix`），**未碰 M14 分支**。
- 未改 M14 的 `clearPluginNumberingContent` / `computeVirtualNumbers`（M14 分支，已刻意只认 WJ 起头）；前者调
  `stripPrefixBroad`，合并后自动获得「第二个 WJ 属链接」防护。
- 未打 tag / 未发版。

### 下一步

- 打 1.1.5 tag 发版（Release 工作流需 `doc/release-notes/1.1.5.md`，本周期未写）。
- **M14 分支合回 master 前先 merge 本修复**：预计冲突 ① `cleanup.ts` `hasUnclaimedForeignNumbering` 末行（M14 改成
  `looksForeignNumbered`，本修复改了其上方几行）——保留两边：先结构性证据判定，末行用 `looksForeignNumbered`；
  ② 版本号文件（M14 已 1.2.0，取 1.2.0）；③ log.md / status.jsonl 周期块并存。M14 新增的 `isMostlyForeignNumbered`
  用 `!startsWith(WJ)` 判归属，与本修复口径一致。

### 验证方式

- `npm test`：657 通过 / 1 失败（whitelist.test.ts:406 ICU 排序，Windows 既有伪影）；`lint`、`format:check` 通过；
  `npm run test:fuzz` 5000×80 通过（标题索引记分板 ~25.6s）。
- 回归用例：`numbering.test.ts`「标题中间的 WJ 属于正文」、`known_bugs.test.ts` E37–E41、`cleanup.test.ts`「非本插件
  判定不看链接锚点里的 WJ」。
- Pandoc：`pandoc x.md -t markdown -L assets/pandoc/strip-autoheadings.lua`（两种模式）实跑核对 O5h。

---

## 2026-09-25 M14 虚拟编号模式 周期 4（文档部分）：对外文档与发版准备（1.2.0）

交接人：`claude/m14-virtual-mode`

### 做了什么

- **真机补测**：用户确认中文输入法组合正常（V28）；我用电脑操作测了悬浮预览（Ctrl + 悬停 `[[基础#概述]]` 与 `[[基础]]`），
  小节与整篇都按全文编号（V29）。
- **README 中英**：卖点首条改为「可以完全不改文件」；快速上手改为「显示编号、文件不变」；新增「只显示，或者写进文件」
  一节；「全自动编号」按两种模式分述；命令表加「清除本文件残留的插件编号」；FAQ「会往笔记里加隐藏的东西吗？」按
  模式分答、「不想用了」补仅显示直接卸载；**新增 FAQ「占资源吗？」**，只写已核实的事实（`src/` 无网络请求，只有
  关于页的链接；启动时本地读一遍全库标题用于链接建议、可关；标题索引 5 万条、剪贴板缓存约 2MB）。
- **使用指南中英**：新增「两种模式：仅显示与写入文件」一节（对照表、默认值、按文件夹混用、切换确认框、残留、
  手写编号过半、立即重新编号、固化）；订正「无论库多大都没有后台开销 / 从不扫描全库」的旧说法；「工作原理」节
  注明只适用于写入模式；导出节更新（仅显示下内置 PDF 实测带编号）；命令表、干净离开节补仅显示。
- **release notes** `doc/release-notes/1.2.0.md`（双语）。
- **manifest description** 改为「可只显示 / 写入 + 链接跟随」打头（191 字符，M12 该项勾掉），同时勾掉 M12
  「README 资源与隐私承诺」。
- 本周期派发 1 次（quality-gate × 1：收尾 preflight）。

### 没做什么

- **没合并 master、没打 tag——用户明确说「先别着急发新版」**，要在 1.2.0 发布前再做一轮开发。打 tag 会触发
  Release 工作流向所有用户发布，任何时候都须用户明确同意。
- 另一个会话正在 master 上修 stripPrefix 截断标题的数据丢失 bug（1.1.5，见 `spawn_task` 那条），尚未合并。
- 移动端（V31）未测；可请用户用手机打开 iCloud 库里的仅显示笔记看一眼。

### 下一步（交接，2026-09-25 会话因上下文将满在此结束）

**接手先跑 `npm run docs -- --handover`。** 分支 `claude/m14-virtual-mode`，相对 master 7 个提交，已推送、未合并；
用户 Oblivion 库里跑的就是本分支的 1.2.0 构建。

1. **1.2.0 发布前的一轮开发**——已向用户推荐下面三项（都小），**等用户选定再做**（用户倾向先做，但新会话开工前确认一句）：
   - **H8 修复**：`clearAllVaultNumbering`（`main.ts:1388`，1411 `vault.read` / 1417 `vault.modify`）与
     `freezeVaultNumbering`（`main.ts:1450`，1466 / 1469）改走周期 3 抽出的 `batchRewrite`（`main.ts:1628`，
     已打开走编辑器事务、未打开走 `vault.process`），变换函数分别是 `clearNumberingContent` 与 `stripWordJoiners`。
     **行为变化要先定案**：现在的清全库**不同步其他笔记里的链接**（只刷新快照），指向带编号标题的链接清完会断；
     走 `batchRewrite` 会顺带同步链接（修掉这个断链，但全库清除会多出链接写入）。固化本来就全文剥 WJ（链接两侧
     一致），走 `batchRewrite` 时变换函数要保持「全文剥 WJ」而不是只剥标题。保留两者现有的顺序约束：清库先持久关
     `autoNumber`、全程 `vaultClearInProgress`；固化先落盘 `retired`；结束后 `refreshVirtualViews()`。testplan H8 行改 ✅。
   - **两条借鉴命令**：「复制编号大纲」「复制当前小节链接」（spec Roadmap M12「迁移向导自动配置 + 两条借鉴命令」，
     参考见 spec 附录 A.11 对 gurjar1 `commandRegistry.ts` 的记录）。两种模式都要能用：仅显示用
     `virtualNumberingFor` 的 label，写入模式用标题文本剥 WJ；testplan 先登记新场景。
   - **模板同名冲突提示**：`TemplateStore.reload`（`src/templates/TemplateStore.ts:63`）对与「默认」同名的其它文件
     **静默跳过**（`default.json` 恒生效——用户库里的 `default(1).json` 就是 iCloud 冲突副本，被静默忽略），其它
     同名模板则后读到的覆盖先读到的。改为发现同名时提示一次、说明哪个生效。（本会话曾对用户说「谁生效看加载
     顺序」，对「默认」而言说错了，已当面更正。）
   - 之后 1.3.0 的主打：内置大纲面板显示虚拟编号（M14 二期，风险在于改 Obsidian 核心大纲 DOM，要可关、失败静默）、
     内置三套预设模板（M12）。拆 `main.ts`（约 2400 行）不单独做，改到相关代码时顺手拆。
2. **stripPrefix 修复合进 master 后**：把 master 合进本分支（版本号保持 1.2.0；`log.md` / `status.jsonl` /
   `testplan.md` / `release/` 按两边合并、release 重建；`doc/release-notes/1.2.0.md` 补一句该修复），跑 preflight + fuzz。
3. **发版**（按 §5.1 合并 master + 打 `1.2.0` tag）须用户明确同意；Community Hub 索引滞后时去维护者面板点「修复」。
4. **用户库里的测试残留**：`Claude测试/` 文件夹（基础 / 残留 / 手写编号 / 嵌入 / 大文件五篇）与路径规则第 4 行
   `Claude测试/`（仅显示），用户可自行删除；第 3 行 `未命名/`（仅显示）是用户自己的测试规则。
5. 操作经验已存进记忆：电脑操作实测 Obsidian 的坑（`obsidian-computer-use-testing`）、heredoc 转义坑
   （`windows-env-quirks` 第 8 条）、部署前先核对库里版本（`deploy-release-to-icloud-vault`）。

### 验证方式

- `npm run preflight`（见本周期提交前的 quality-gate 报告）。

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
│   ├── headingindex.ts     标题索引（M13：剥前缀原文 → 位置，排序数组 + 二分查找，增量维护）
│   ├── headingtrigger.ts   标题链接建议的触发边界/上下文屏蔽/排序/链接构造（纯函数，M13）
│   ├── headingsuggest.ts   标题链接建议 EditorSuggest 薄适配层（M13，DOM/CM6 交互留真机手验）
│   ├── vcintegration.ts    Various Complements 联动（探测/词典生成/分层防御写入，M13）
│   ├── pathrules.ts        路径规则 → 模板 / 编号模式解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── virtual/            虚拟编号模式（M14，只显示不写文件，spec §3.22）
│   │   ├── compute.ts      纯逻辑：每个标题的显示编号 + 残留前缀区间 + 自动路径门控 resolveNumberingAction
│   │   ├── editorExtension.ts 编辑视图：CM6 ViewPlugin + 编号 widget + 重算信号（纯函数 buildVirtualDecorations）
│   │   ├── readingView.ts  阅读视图：markdown post-processor + 缓存 + 兜底匹配
│   │   ├── outlineView.ts  内置大纲面板：条目上挂属性 + CSS 画编号，MutationObserver 跟大纲刷新（1.2.0）
│   │   └── modeSwitch.ts   规则变动引起的模式切换：改动前后逐文件比较有效模式（纯函数）
│   ├── settings/
│   │   ├── model.ts        设置数据模型（全局开关、防抖延迟、路径规则持久化）
│   │   ├── SettingsTab.ts  设置 GUI 壳：TAB 栏 + 分发（内容在 tabs/，M7 多 TAB 已拆完）
│   │   ├── ForeignNumberingCleanupModal.ts 迁移守卫 Notice 点击入口：清理预览确认框（testplan J14）
│   │   └── tabs/           七个 TAB 的实现 + M13 联动设置区（VcIntegrationSection，挂在 GeneralTab 末尾）
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关、标题链接建议开关；复制净化 1.0.16 起恒开无开关）
│   │       ├── TemplatesTab.ts    模板列表（自绘 header：折叠/命名/删除）
│   │       ├── EditPanel.ts       模板编辑面板（级别格式网格 + 跳级/占位字符）
│   │       ├── WhitelistEditor.ts 白名单行编辑器（分段控件/行内编辑/命中角标）
│   │       ├── PathRules.ts       路径规则表（拖拽排序/建议弹窗/根规则/删模板确认）
│   │       ├── PathSuggest.ts     路径建议弹窗组件（非 TAB，供 PathRules.ts 用，1.0.4）
│   │       ├── VcIntegrationSection.ts VC 联动三态选择器 + 手动/自动两个确认 Modal（M13）
│   │       ├── DangerTab.ts       敏感操作（清除全库编号）
│   │       └── AboutTab.ts        关于/帮助/鸣谢
│   └── templates/
│       ├── schema.ts       模板 schema 校验/序列化/文件名安全化
│       └── TemplateStore.ts 模板文件 CRUD（vault adapter 读写 templates/*.json）
├── tests/                ← 测试
│   ├── dev_tests/          自动化单元测试（Vitest，无需 Obsidian 运行时，npm test 跑它）+ uvm/ 压测框架
│   └── user_tests/         可复制粘贴进 Obsidian 实测的 .md 样例（每个对应 testplan 某场景）
├── README.md / README.zh.md ← 商店门面（卖点 + 上手 + 命令 + FAQ，技术细节下沉 doc/user-guide*.md）
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + user-guide(.zh).md 面向用户的完整使用指南 + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A；research/ 本地调研留档、.gitignore 排除不入库，见该目录 README.md）
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
