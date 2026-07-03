# obsidian-auto-headings 开发日志与协作交接

本文件用于多 agent / 多人协作的**握手交接**：每个开发周期结束时，记录「做了什么、
没做什么、下一步干嘛」，让接手者无需通读全部代码即可继续。倒序排列（最新在最上）。

**接手前怎么读**（见根 [`CLAUDE.md`](../../CLAUDE.md) §3）：第一条命令跑 **`npm run docs -- --handover`**，
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

## 2026-07-03 0.7.23 路径规则禁止重复路径（GUI 阻断保存）（claude/obsidian-auto-headings-launch-uzdovw）

**做了什么**：修用户报告的另一处路径规则 GUI 不理想行为（testplan **K12**）：同时设置两条路径都是
`/` 的规则，一条投模板 A、一条投模板 B，插件会用其中「新建的」那条（即列表里更靠后的那条）套用
到全库并触发编号——用户认为不应静默生效，而应弹提示、不允许同一路径关联不同模板。这是有意的
产品决策（已用 `AskUserQuestion` 与用户确认范围）：**阻断保存、强制路径唯一**，且不限于根 `/`，
任何两条规则的路径模式归一化后相同都算。

- **新增纯函数** `findDuplicatePatternIndex(rules, index)`（`src/pathrules.ts`）：检测某规则的路径
  是否与列表中其它规则重复（归一化后完全相同；未配置的空串不参与判定，本就不匹配任何文件）。
- **GUI 接线**（`PathRules.ts` `commitPattern`）：路径输入框失焦提交时，若归一化后与其它行重复，
  **回退**输入框为改前的值、**不写入** `saveSettings`/不触发编号，弹 Notice「该路径已被第 N 条规则
  使用……」（中英双语，`i18n.ts` 新增 `pathDuplicateWarn`）。
- **既有机制降级为遗留兜底**：`resolvePathRule` 里「具体度并列时列表靠后者胜出」的 tie-break **没有
  删除**——它仍需应付两种情况：① 两条**不同**文件夹名恰好等长（如 `Ab/` 与 `Cd/`，无优劣可分，
  必须有个确定性结果，这是 testplan K5 的真实场景，与本次改动无关）；② 遗留/手改 `data.json`
  产生的真重复（GUI 阻断的只是**新建/编辑**路径，不回溯清理已存在的数据）。相应地把 spec.md §3.8
  第 3 条与 `pathrules.ts` 顶部文档注释的措辞从"鼓励用加规则覆盖"改成"仅确定性兜底、不推荐"。
- `doc/spec.md` §3.8 补一段说明；`doc/testplan.md` K5 措辞收窄为"不同文件夹名等长"、新增 K12。

**没做什么**：未处理"面板加载时已存在遗留重复数据"的场景（不主动扫描历史 `data.json` 报警，只挡
新的编辑）；未改动拖拽排序逻辑（拖拽不产生新路径文本，不会制造重复，无需拦截）；GUI 阻断的手感
（Notice 文案、输入框回退是否顺滑）仍待用户在真实 Obsidian 里点一遍。

**下一步**：用户实机验 K12（新建重复路径 `/` 确认阻断生效、Notice 可读）；连同上一周期遗留的
L17/L22/K11 及更早的 E14/E16 一并验收 → M7 截图/发布自检 → bump 1.0.0。

**验证方式**：`npm test`（319 passed，`pathrules.test.ts` 新增 `findDuplicatePatternIndex` 6 条 +
`resolvePathRule` 两条测试拆分为「等长不同文件夹」与「遗留重复数据」）；`npm run lint` /
`format:check` 全绿；`npm run release` 重建 `release/`。

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
<你的 Vault>/.obsidian/plugins/obsidian-auto-headings/
├── main.js
├── manifest.json
└── styles.css
```

然后在 Obsidian：设置 → 第三方插件 → 启用 `Auto Headings`。首次启用会在该插件文件夹下
自动创建 `templates/default.json`。

> 重新生成产物：在项目根运行 `npm install && npm run release`，脚本会自动把
> `main.js`、`manifest.json`、`styles.css` 同步进 `release/`。
