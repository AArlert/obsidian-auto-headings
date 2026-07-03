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
> 均可整读）；仍大的 `main.ts`（~800 行）与 `i18n.ts`（~600 行）先 `grep` 定位、别整读。

> 一句话：**改代码 → `npm run bump` → 写本文件新块 + `status.jsonl` → `npm run preflight`（= docs + release + test + lint + format:check）→ 提交（含 `release/`）。**

---

## 2026-07-03 0.7.26 上架前审计：manifest id 违规修复 + 文档漂移订正（用户要求，claude/plugin-repo-audit-avuhui）

**做了什么**：用户要求全面审计本仓库能否上架 Obsidian 社区插件目录、交叉检查各文档、动手修复问题。

- **发现并修复硬性拦下项**：查证 Obsidian 官方规则（`docs.obsidian.md` 提交要求）明确
  「manifest id 不能包含 `obsidian`」，而本插件 `id` 一直是 `obsidian-auto-headings`——会被商店
  审核直接拦下。仓库尚未发布过任何 GitHub Release、也未提交过商店，改的成本最低；征得用户同意后
  改为 **`auto-headings`**（`name` 早已合规，不含 "Obsidian"/"Plugin"，未动）。同步更新：
  `README.md`/`README.zh.md` 手动安装路径示例、`src/templates/TemplateStore.ts` 注释、
  `scripts/sync-release.mjs` 注释、`spec.md` 开发环境搭建示例。**不改**的：frontmatter 开关键
  `obsidian-auto-headings`（`SWITCH_KEY`，用户数据协议，与 manifest id 无关，改它才是真破坏性变更）、
  `package.json` name 与 GitHub 仓库名 `AArlert/obsidian-auto-headings`（仓库标识，不受该规则约束）。
- **核实提交机制已变更**：`spec.md` M7 原描述的「提交至 `obsidianmd/obsidian-releases` PR」流程已被
  Obsidian 2026-05 上线的 Community Hub（`community.obsidian.md`）取代，改为网页端提交 + 自动化 /
  人工审核；已更新 spec.md 对应条目并保留前置要求（manifest 在默认分支 HEAD、GitHub Release 资产
  齐全、release name 与 manifest version 一致不带 `v` 前缀）。
- **`CLAUDE.md` 全文订正**（用户指出并授权）：本仓库是从私有 monorepo 迁移出的独立发布仓库，
  却仍原样携带 monorepo 版 `CLAUDE.md`——里面描述的多 Addon 结构（`chrome-tab-tree/` 等）、
  `<addon>/` 路径前缀、SessionStart 钩子/`.githooks/`/CI workflow 在本仓库均不存在。逐节核实后
  重写：`§1` 改为单项目结构说明、`§3.1` 路径去掉 addon 前缀、`§6` 多 Addon 表格改为指向
  `status.jsonl`/`log.md` 的一句话、`§7` 如实说明本仓库当前**没有** pre-commit/CI 自动化。
- **交叉检查发现的文档漂移一并修复**：`doc/log.md`/`doc/testplan.md` 中 `[CLAUDE.md](../../CLAUDE.md)`
  链接因迁移少了一层目录嵌套，实际应是 `../CLAUDE.md`（GitHub blob 相对路径验证过，`README.md` 里
  `../../releases/latest` 因 `/blob/<branch>/` 路径段的存在则确认无误、未动）；`README.zh.md` 安装段落
  漏了英文版有的「（一旦通过审核）」限定语，补齐中英一致。
- **代码层面顺带发现一处待修**（**未改代码**，只登记 backlog）：`clearAllVaultNumbering`（面板
  [清除全库编号]）逐文件用 `vault.read`+`vault.modify`，而非 M18 刚验证过更安全的 `vault.process`/
  编辑器内存写回路径——若目标文件此刻被打开且有未落盘编辑器改动，理论上与 M18 修复前同源竞态。
  未实测复现（窗口很窄），登记 `testplan.md` **H8** + `spec.md` §3.10，不阻塞本轮发布。
- **审计代码是否符合 Obsidian 官方开发规范**（`Plugin guidelines`）：`console.*`、`innerHTML`/
  `outerHTML`/`insertAdjacentHTML`、全局 `app`（非 `this.app`）、默认快捷键、Node/Electron API
  引入等逐项 `grep` 排查，均**未发现违规**；`isDesktopOnly: false` 的声明属实。
- 回答用户「Obsidian 允许 vibe coding（AI 辅助）插件吗」：查证无禁止性规定，官方 2026-05
  Community Hub 用自动化扫描 + 人工复核把关**代码质量与安全**，不问写作方式；已有插件在商店说明中
  公开披露部分代码由 AI 辅助编写的先例。

**没做什么**：未生成截图 / GIF（README 占位仍在，需实机 Obsidian）；未跑 `npm run bump 1.0.0`
（M7 尚有 J9/K12/L17/L22/K11/E14/E16 等待用户实机手感验证，未到转正时机）；未提交
Community Hub、未打 GitHub Release；未修复新登记的 H8（vault.modify 竞态）——留给下一周期评估是否
值得在 1.0 前动手。

**下一步**：用户实机手感验证遗留项 → 补截图/GIF → `npm run bump 1.0.0` → 在
`community.obsidian.md` 提交并打 `v1.0.0` Release → 视时间决定是否顺手修 H8。

**验证方式**：`npm test`（328 passed）/ `npm run lint` / `npm run format:check`（含本次修复
`CLAUDE.md`/`README.md` 的既存格式化漂移）全绿；`npm run bump` → `npm run release` 确认
`release/manifest.json` id 已更新为 `auto-headings`、zip 重命名为 `auto-headings.zip`；
`npm run docs` 校验通过（周期块 3/3、状态行 13/13、目录树与磁盘一致）。

---

## 2026-07-03 0.7.25 修复「清除编号」自链接竞态致清除不生效（testplan M18，用户实测报告）（claude/numbering-clear-bug-fix-e4woim）

**做了什么**：修复用户实测报告的 bug：文件已格式化 → 关全局自动编号 + 单文件 `fm:false`（编号冻结，
符合预期）→ 跑「清除编号」→ Notice 提示「已清除编号」但文件其实**没变**（预期外）→ 切到别的文件再
切回、重跑「清除编号」才真的清掉。

- **根因定位**：正文里有一条指向本文件自己标题的内链（如 TOC 常见的 `[[#1 简介]]`）时，
  `syncBacklinks` 把「引用方 = 本文件自身」这一支也交给 `vault.process` 处理——但 `vault.process`
  读的是 vault 缓存 / 磁盘内容，而本文件此刻的 `editor.transaction`（刚做的清除）**尚未被 Obsidian
  自动保存**，二者异步竞态：`vault.process` 读到旧内容，写回覆盖掉刚发生的清除。Notice 在 transaction
  那一刻已经据实弹出（清除确实发生过），只是随后被这次读盘覆盖悄悄撤销，故用户看到「说清了但没变」。
  `spec.md §3.12` 此前已把这类冲突登记为「已知限制」，本轮实修而非继续搁置。
  再次切换文件重跑能成功，是因为第二次 `syncBacklinks` 用的改名表基线（`headingSnapshots`）已对齐
  第一轮清除后的状态、算出**空改名表**，从而完全跳过了那次会覆盖内容的 `vault.process` 调用——纯属
  巧合而非设计如此，验证了竞态假说但并非可依赖的绕过方式。
- **`main.ts` 新增 `foldSelfBacklinks(target, oldContent, newContent)`**：本文件自身这一支不再走
  `vault.process`——改名表在手（`computeSnapshotRenames`/`computeHeadingRenames`，与原 `syncBacklinks`
  同一套口径）后，直接对**内存里的** `newContent` 做 `rewriteBacklinksInContent` 字符串重写，随原
  编号/清除**同一个** `editor.transaction` 一起写回。不读盘、不异步，天然无竞态。`applyRenumber` /
  `runClearNumbering` / `runClearForeignNumbering` 三处写回入口统一接入。
- **`syncAndSnapshot`/`syncBacklinks` signature 简化**：改名表由 `foldSelfBacklinks` 算好传入，
  不再各自重算；`syncBacklinks` 只处理**别的**引用文件，且显式 `sourcePath === target.path` 时
  `continue`（避免万一 `getBacklinksForFile` 报出自身、重新踩回竞态）；本文件自链接命中数并入最终
  Notice 合计。
- **`doc/spec.md §3.12`**：流程步骤改写为「①算改名表 → ②同文件内链就地折叠（新）→ ③反查别的引用方
  → ④重写 → ⑤写回」；「已知限制」条目划掉标注 0.7.25 已修，写清根因与修法。`doc/testplan.md` 新增
  **M18**。

**没做什么**：未处理「**别的**文件正被打开且有未保存改动」这类更广的竞态（testplan M12，仍 🔲）——
那是「引用方 ≠ 本文件」的情形，`vault.process` 依然是唯一可行的写回方式（我们管不到别的文件的编辑器
缓冲区），属不同性质的限制，留 backlog。未改 `rewriteBacklinksInContent`/`computeHeadingRenames` 等
纯函数本身（无 bug，问题完全在 `main.ts` 的写回时机与路径选择）。

**下一步**：用户实机复验 M18（按报告的完整操作序列：关全局自动 + `fm:false` → 清除编号 → 确认 Notice
与文件内容一致，不必切换文件即可成功）；连同上一周期遗留的 J9/K12/L17/L22/K11（及 E14/E16）一并
验收 → M7 截图/发布自检 → bump 1.0.0。

**验证方式**：新增 `main.test.ts` 两条回归（328 passed）——①自链接随清除编号原子写回（同一事务，
`txnCount===1`）；②竞态哨兵值：即便 mock 的 `getBacklinksForFile` 把本文件自身也列为引用方、且
vault 侧有一份「未落盘旧内容」的哨兵值，清除后哨兵值**不被触碰**（证明不再经 `vault.process` 读改写
自身）。用临时切回旧版 `main.ts` 复验：同样两条测试在旧实现下确实失败（自链接完全未更新），确认
测试真实捕获了该 bug。`npm test`（328 passed）/ `npm run lint` / `format:check` / `npm run test:fuzz`
（5000×80）全绿；`npm run release` 重建 `release/`。

---

## 2026-07-03 0.7.24 打开文件即按当前模板自动重排（testplan J9，用户需求）（claude/obsidian-auto-headings-launch-uzdovw）

**做了什么**：落地用户提出的新需求：路径规则改投了模板（或模板本身改了样式）后，该路径下**尚未打开
过/编辑过**的文件，此前必须等用户敲一下键盘（触发 `editor-change` 防抖）才会按新格式重排；用户希望
**只要打开文件就自动刷新**，不必先手动编辑或跑「立即重新编号」命令。

- **`main.ts` 新增 `renumberOnOpen(file)`**：挂在 `file-open` 事件上，走与实时编辑**完全一致**的自动
  路径门控（`shouldAutoTrigger` + `getTemplateForFile`），命中则调用既有的 `applyRenumber`。不新增
  设置项——「是否该自动」的判定逻辑与「自动触发」共用一套规则，语义上是把同一套资格判定接到了新的
  触发事件（打开）上，而非引入新概念。
- **幂等 no-op 免费获得**：`applyRenumber` 只在内容确有变化时才发起事务（既有机制），已是最新格式的
  文件打开时重排前后内容相同，静默跳过，不产生多余撤销记录，也不会每次切换标签页都抖一下光标。
- **与 file-open 内既有的「标题快照播种」（M14 基线）顺序**：`renumberOnOpen` 放在前面——若它写回，
  `applyRenumber` 内部的 `syncAndSnapshot` 会把快照刷新为写回后的状态，紧随其后的播种逻辑因
  `headingSnapshots.has()` 已为真而自然短路，不会用「重排前」的旧内容重复播种一份过时快照。
- `getActiveViewOfType(MarkdownView)` 取活动视图后校验 `view.file?.path === file.path`，防御
  「打开事件与实际活动编辑器不一致」（如后台预览、极快速切换）的场景，此时不强行处理。
- `doc/spec.md` §3.9 补充说明；`doc/testplan.md` 新增 **J9**。

**没做什么**：未加开关让用户关掉这个行为——判断是它和「自动触发」共享同一套门控（全局开关/frontmatter），
关掉自动编号或设 `fm:false` 天然就会连打开也不触发，无需再造一个开关；若后续用户反馈想要「自动编号开
但打开不重排」这种更细粒度的诉求，再补选项。未处理"文件已打开但插件是后来才装/重载"的追平（重载后
第一次 `file-open` 才补，这与现有 M7 的 N1 修复模式一致，无需特殊处理）。

**下一步**：用户实机验 J9（改路径规则模板 → 切到其它笔记再切回 / 冷启动打开该路径下笔记 → 确认自动
刷新且无多余撤销记录）；连同上一周期遗留的 K12/L17/L22/K11 及更早 E14/E16 一并验收 → M7 截图/发布
自检 → bump 1.0.0。

**验证方式**：`npm test`（326 passed，`main.test.ts` 新增 `renumberOnOpen` 7 条：正常重排 / 幂等
no-op / 全局关门控 / fm:false 门控 / 无路径规则命中 / 打开文件与活动视图不一致 / 无活动视图不抛错）；
`npm run lint` / `format:check` 全绿；`npm run release` 重建 `release/`。

---

## 目录结构约定（按职责分类）

```
obsidian-auto-headings/
├── src/                  ← 源代码（TypeScript）
│   ├── main.ts             插件入口：生命周期、命令、防抖、事务写回、Backlink 同步接线
│   ├── parser.ts           Markdown 标题解析（ATX、代码块边界）
│   ├── numbering.ts        编号引擎编排（numberHeadings/renumberContent）+ 对外 barrel（↓四模块经它转发）
│   ├── template.ts         模板数据模型：类型/默认值/字段规范化
│   ├── count.ts            计数器状态机 HeadingCounter
│   ├── render.ts           序号渲染器 + 前缀拼装 buildPrefix + 面板预览
│   ├── strip.ts            三个剥离器（WJ 边界/清除全样式/清理外来）+ WORD_JOINER
│   ├── whitelist.ts        白名单归一化/命中判定/面板预览分析
│   ├── backlinks.ts        Backlink 同步纯函数核心（改名表/锚点归一/链接重写）
│   ├── cleanup.ts          清除编号命令的内容级封装
│   ├── pathrules.ts        路径规则 → 模板解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── settings/
│   │   ├── model.ts        设置数据模型（全局开关、防抖延迟、路径规则持久化）
│   │   ├── SettingsTab.ts  设置 GUI 壳：TAB 栏 + 分发（内容在 tabs/，M7 多 TAB 已拆完）
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关）
│   │       ├── TemplatesTab.ts    模板列表（自绘 header：折叠/命名/删除）
│   │       ├── EditPanel.ts       模板编辑面板（级别格式网格 + 跳级/占位字符）
│   │       ├── WhitelistEditor.ts 白名单行编辑器（分段控件/行内编辑/命中角标）
│   │       ├── PathRules.ts       路径规则表（拖拽排序/补全/根规则/删模板确认）
│   │       ├── DangerTab.ts       敏感操作（清除全库编号）
│   │       └── AboutTab.ts        关于/帮助
│   └── templates/
│       ├── schema.ts       模板 schema 校验/序列化/文件名安全化
│       └── TemplateStore.ts 模板文件 CRUD（vault adapter 读写 templates/*.json）
├── tests/                ← 测试
│   ├── dev_tests/          自动化单元测试（Vitest，无需 Obsidian 运行时，npm test 跑它）+ uvm/ 压测框架
│   └── user_tests/         可复制粘贴进 Obsidian 实测的 .md 样例（每个对应 testplan 某场景）
├── README.md             ← 面向读者的简介（核心功能 + Milestone 概览，入口文档）
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive，见 CLAUDE.md §3.1）
├── release/              ← 可分发插件文件（main.js/manifest/styles/README；zip 本地生成不入库）★每周期必更新
├── publish/              ← 对外发布仓库的专属模板（双语 README、精简 package.json；npm run publish:repo 同步）
├── scripts/
│   ├── sync-release.mjs    把构建产物同步到 release/（被 npm run release 调用）
│   ├── sync-plugin-repo.mjs 同步到独立的对外发布仓库（npm run publish:repo，开发/发布分离）
│   ├── bump.mjs            一键版本号同步（npm run bump）
│   └── docs.mjs            文档维护：归档/滚动/摘要/守卫/交接（npm run docs [-- --handover|--check]）
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
