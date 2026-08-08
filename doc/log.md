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

## 2026-08-09 1.0.16 复制净化取消开关（恒开）+ 订正「移动端独占」错误论点

**背景**：竞品调研（本周期另一条线，见下）顺带核出 spec 附录 A.11 里两句不成立的对外论点；用户同时
拍板取消复制净化开关——**「不往用户剪贴板里塞隐形字符」是插件的固有承诺，不是可选项**，留着开关
等于承认「关掉也算一种正当配置」，而那个状态正是 §2.6 登记的 WJ 外泄风险本身。

**做了什么**：

1. **`sanitizeClipboard` 开关全面移除**（testplan O11 ✅，spec §2.8 新增「无开关」小节）：删设置字段
   与默认值（`settings/model.ts`）、GeneralTab 的开关 UI、`i18n.ts` 中英两套文案键、`main.ts` 两处
   门控（copy/cut 端与 paste 还原端）。**旧配置走迁移删键**（`delete merged.sanitizeClipboard`，
   与既有的 `backlinkStandaloneTrigger` 同一姿势）——1.0.10–1.0.15 期间显式关掉过的用户升级后同样
   恒净化，键在下次 `saveSettings` 时从 `data.json` 消失。
   - **为什么不是「保留开关但默认开」**：默认开只消解了一半。M11 信任包的目标是把 WJ 风险从「披露」
     升级到「主动消解」，而开关的存在本身就是在说「这事可以不做」。行为面本就可控：WJ 守卫保证不含
     编号的复制粘贴零介入，降级路径保证任何失败都退回「等于本功能不存在」。
2. **vault 内往返补两条回归**（testplan O12 ✅）：① 同一份内容**连续粘贴两次**都必须命中还原——
   `lookup` 命中只刷新 LRU 新旧序、不消费条目，若哪天改成消费式这条即红；② 旧配置残留
   `sanitizeClipboard:false` 时净化端与还原端都照常工作。另加一条 `loadSettings` 迁移用例，
   断言旧键确实被删。
3. **订正 spec 附录 A.11 两处错误论点**（2026-08-09 复核五家 `manifest.json`）：原文写「移动端可用是
   本插件在活跃竞品中的**独占优势**」「活跃竞品中**唯一**移动端可用」——**实际只有 gurjar1 一家是
   `isDesktopOnly: true`**，header-enhancer / number-headings / title-serial-number /
   auto-numbered-headings 四家均为 `false`。改为「最活跃的对手 gurjar1 桌面端限定，本插件移动端可用」
   并就地加了「不可写成『唯一』或『独占』」的护栏。这条原文明写着是留给 README 竞品对比节与迁移
   向导取用的，**若照原样上架就是一条会被当场证伪的承诺**。

**没做什么 / 已知遗留**：

- **净化的残余降级面没有收窄**（spec §2.8「残余已知限制」照旧）：LRU 未命中时（Obsidian 重启后、
  条目被逐出、文本在外部改过）粘贴回来的是净化文本，裸序号会被当正文、叠新前缀，且触发外来编号
  守卫拦下该文件的自动编号。**开关取消后这条没有逃生口了**，三个可选缓解（提高 LRU 上限 / 未命中
  时改为剥净编号再插入 / 持久化 LRU——最后一条 2026-07-18 已因隐私否决）都**未动**，等用户拍板。
- 竞品调研（codex 源码级 + subagent issue 挖掘）结论**未进 spec**，按用户要求只留在会话与
  scratchpad 报告里；其中「单标题 skip 标记」已有我方 issue #6 认领，是下一个功能的明确候选。
- 1.0.14 / 1.0.15 / 1.0.16 **都还没打 tag 发布**。

**下一步**：① 用户手验 H12 / H9 / O5f / Dataview；② 决定上面三条净化降级缓解做不做；
③ 打 tag 发版（release-notes 需补 1.0.16）；④ 单标题 skip 标记（issue #6，已回复用户「后续版本」）。

**验证方式**：`npx tsc --noEmit` / `npm test`（466 通过，新增 3 例）/ `npm run lint` / `npm run preflight`；
本机唯一红灯仍是既知的 `whitelist.test.ts:406` ICU 排序噪音。

**本周期派发 3 次**（quality-gate × 2、general-purpose(sonnet) × 1 挖竞品 issue；另调用本机 codex CLI
× 1 做竞品源码级功能对比——沙箱内联网需绕开 schannel，见 memory `codex-cli-local-dispatch`）。

---

## 2026-08-09 1.0.15 CLAUDE.md 瘦身：开发周期正文下沉为 `dev-cycle` 技能

**背景**：根 `CLAUDE.md` 每次会话全量进上下文，而「十步清单 + 版本号规则 + 钩子/CI 细节」只在真正
动手改代码时才用得上——常驻成本高、使用频率低。技能（skill）按需加载，正好承接这类「用时才读」的
流程正文。本周期只搬运不改语义。

**做了什么**（分支 `feat/m11-export-m12-retire`）：

1. 新建 `.claude/skills/dev-cycle/SKILL.md`：原 §4 十步清单 + §4.1 版本号规则（`0.M.*` 格式、
   `npm run bump` 三形态、上架后仅行为改动才 bump）原样搬入，`description` 写明触发时机
   （开工做实质改动 / 准备收尾提交）。
2. 根 `CLAUDE.md` 减 46 行：§4 只留「一句话流程 + 读技能」指针，并强调 **bump 与 preflight 一步都不能省**
   （最容易被省的正是这两步，故留在常驻文件里）；删 §1 仓库结构（目录树的单一事实源是本文件
   「目录结构约定」块）、§7 钩子/CI 细节压成三行、两段 monorepo 迁移历史备注（迁移早已完成）。
3. `.claude/agents/feature-coder.md` 的「按 CLAUDE.md §4 流程干活」改指 `dev-cycle` 技能——§4 已无正文，
   子 agent 照旧引用会读到一句话流程而漏掉 testplan-first。
4. 本文件「目录结构约定」块登记 `.claude/skills/dev-cycle/`；订正上一周期块与 `status.jsonl` 首行日期
   （07-25 → 07-29）。

**没做什么**：

- **未 bump**（上架后策略：只碰 `doc/` 与 `.claude/`，`src/` 一行未动，不向线上用户推空更新）。
- `AGENTS.md` 与 `.codex/`（Codex 镜像）按既定约定不改不删不提交——其中的 §4.1 引用因此与
  `CLAUDE.md` 现状不同步，**属预期**，需要时由用户侧自行重生成。

**下一步**：仍是上一周期块那三条 —— ① 用户手验 H12（固化确认框）/ H9（真库内链）/ O5f（内置导出
PDF）/ Dataview 样例；② 竞品 auto-heading(gurjar1) 源码级调研并入 spec 附录 A.11；③ 打 tag 发
1.0.14 / 1.0.15（tag 最新仍停在 1.0.13，release-notes 均已备好）。

**验证方式**：`npm run preflight`（docs 归档 + release 重建 + test + lint + format:check）。

**本周期派发 1 次**（quality-gate × 1）。

---

## 2026-07-29 1.0.15 三处「用户已表态、插件仍自作主张」：清除即暂停 / 不抢键盘 / 迁移守卫误伤

**背景**：用户在真机使用中报了两条体感问题（「清除当前编号是个摆设」「标题后写空格会被自动清掉」），
本周期把它们连同顺带挖出的第三条一起修掉。三者同源：**插件在用户明确表态之后仍然自作主张**。
规格集中写在 spec §3.19（新节），入口从 §3.2 / §3.10 指过去。

**做了什么**：

1. **「清除当前文件编号」此前是摆设**（testplan H13–H16 ✅）：`runClearNumbering` 只取消了该文件
   **当前那一个**待处理防抖计时器，下一次按键即重新 `scheduleRenumber` 把编号编回去——只要「全局
   自动编号」开着，这条命令**永远不可能产生持久效果**。现在清除时若该文件确实还会被自动重编号
   （`shouldAutoTrigger` 够格 + 命中模板），把 frontmatter `obsidian-auto-headings: false` **并进同一个
   `editor.transaction`**，一次撤销整体回退；反之一个字都不写。恢复走「立即重新编号」（顺带移除该键，
   该键是唯一一项时整个 `---` 块一并移除）。
   - **复用既有单文件开关而非新造暂停状态**：它写在文件里、用户看得见改得动、跨重启存在，且每条
     自动触发路径本就尊重它。新造 `pausedPaths` 则是隐形状态，还要挂文件重命名事件重映射路径——
     正是 1.0.14 离场提示条那条教训（「不能在用户不知情时一声不吭地什么都不做」）所指。
   - **写入侧只产出「编辑计划」不直接改字符串**（`frontmatter.ts` 的 `planPauseFileSwitch` /
     `planResumeFileSwitch` → `SwitchEdit`）。因为 `writeLineDiff` 按「整文件重写永不增删行」做逐行
     索引比对，往顶部插几行会让其后所有行错位；交回 `main.ts` 翻译成一条 `EditorChange` 后，CM6
     变更集按原文档坐标计算，与行替换天然互不干扰。该模块此前是纯只读的，本次首次有了写入侧。

2. **不在用户正敲字的那一行下手**（testplan J11 ✅）：`stripPrefix` 会把标题文本的行尾空白归一化掉
   （`strip.ts` 的 `s+$`，幂等所必需），而自动路径此前**没有任何光标守卫** ⇒ 用户在标题末尾敲一个
   空格、停顿超过防抖时长，空格就被静默吃掉。新增 `preserveLine`：自动路径把光标所在行的改动从本次
   事务里剔除、**其余行照常重排**，该行在光标移开后的下一次触发补上。
   - **不整轮顺延**（与 J8 的 IME 分支形状不同）：顺延会在光标停在标题行不动时无限期地重排计时器。
   - **保护必须发生在折叠自链接之前**——被保护的行标题文本没变就不该产生改名，更不该据此改写指向
     它的内链（否则链接指向一个文件里并不存在的标题）。快照因此记的始终是真正落盘的内容。

3. **迁移守卫误伤**（testplan J12 ✅，**写 J11 用例时撞出来的既有缺陷**）：
   `hasUnclaimedForeignNumbering` 拿 `stripForeignNumbering(rawText)` 与 `rawText` **直接**比较，而前者
   末尾也带一道 `s+$` 归一化 ⇒ 一个全文无 WJ、无任何编号的文件，只要某个标题行尾有空格就被判成
   「像外来编号」，该文件的自动编号被整个拦下、并弹出误导性的「请先执行『清理非本插件的标题编号』」。
   修法：比较基准同样去掉行尾空白。**这条是第 2 项的第二个独立成因**——只修光标守卫治不好它。

4. **`fm: false` 的含义收窄为「不自动编号」**（testplan I8 ✅，M22 用例反转）：第 1 项让「清除编号」
   开始写这个键，而它此前**同时**关掉 backlink 独立触发 ⇒ 清一次编号会连「改名不断链」一起停掉，
   等于用一次编号清理换掉附录 A 里定位的第一价值。故 `shouldBacklinkStandaloneTrigger` 不再检查该键。
   **这是对已上架语义的有意收窄**，由用户拍板（理由：backlink 本就是独立的全局功能，任何时候都该 sync）。
   要彻底静默请关 `updateBacklinks` 总开关。

**没做什么 / 已知遗留**：

- **竞品 auto-heading（gurjar1）的调研只落到了会话里，未进 spec 附录 A**。本次派 subagent 做了源码级
  核实（真实仓库是 `gurjar1/auto-heading-obsidian`，此前 memory 记的地址 404），拿到设置面板 41 个控件
  逐项表、三套标题旁可视化 UI（CM6 widget 行内工具条 / gutter 徽标 / 顶部 breadcrumb 条）、24 条命令、
  状态栏与右键菜单清单。**下一步应把它并进 spec 附录 A.11 并重排 M12 那条「两条借鉴命令」**。
- **未验证 O5f**（Obsidian 内置「导出为 PDF」是否残留 WJ）——用户表示自己手验，故本周期未推进
  「自动识别 pandoc 导出并临时清 WJ」那条需求。结论已给：**「清了再放回」这条路应否掉**（Obsidian
  没有导出开始/结束事件，且崩溃/取消会把库停在被剥光的状态，而剥 WJ 不进撤销历史）；真正的杠杆是
  `registerMarkdownPostProcessor` 渲染层，且**必须只碰文本节点、不碰 `data-heading` 与链接 href**。
  等 O5f 结论出来再决定是否值得做。
- **UVM 激励仍未扩到注释块**（1.0.14 遗留），三颗雷未拆：SAFE_FRAGMENTS/MESSY_FRAGMENTS 投毒、
  deleteLine 删注释定界行、R3 形态标题进 backlink 往返。
- 1.0.14 与 1.0.15 **都还没打 tag 发布**。

**下一步**：① 用户手验 H12（固化确认框/离场提示条）、H9（真库内链不断）、O5f（内置导出 PDF）、
Dataview 样例；② 竞品调研并入 spec 附录 A.11；③ 打 tag 发 1.0.15（release-notes 已备好）。

**验证方式**：`npx tsc --noEmit` / `npm test`（新增 22 条：main 12 + frontmatter 11 - 重合，另反转 M22、
改 I6 与三条清除路径断言）/ `npm run lint` / `npm run test:fuzz` 全绿；本机唯一红灯是既知的
`whitelist.test.ts:406` ICU 排序噪音（见 memory `windows-env-quirks`）。

**本周期派发 2 次**（quality-gate × 2；另派 general-purpose × 1 做竞品调研）。主模型亲自做了设计决策、
frontmatter 写入侧、光标保护接线与全部文档。

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
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关、复制净化开关）
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
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A）
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
