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

## 2026-07-10 1.0.7 README 补披露 WJ 生态风险 + 修正商店安装现状（claude/plugin-eval-promotion-3sy3v4）

**做了什么**：用户带着实际反馈来源两处修正，本轮**纯文档修订**（README 双语 + `spec.md` §2.6/M7 核对状态），
不涉及 `src/`，未跑 `npm run bump`（沿用"上架后策略：仅行为/产物变化才 bump"）：

1. **「安装」节更新为商店真实现状**：此前 README 写的是"社区插件商店（一旦通过审核）"，用户核实后指出
   插件**已通过自动化检查、在商店内可搜索可直接安装**，只是 Obsidian 官方的人工/编辑审核还在排队——
   两语言版本均改为反映这个现状，不再用误导性的"一旦通过审核"措辞。同步更新 `spec.md` Milestone 7 该
   checklist 项，记录这一核实结果。
2. **README「工作原理」节补齐两处此前只记在 `spec.md` §2.6、未对用户披露的 WJ 生态风险**：
   - **Dataview**：`page.file.headers` 精确字符串匹配会被 WJ 打穿，补充 DataviewJS `.replace(/⁠/g, "")`
     清洗示例 + 改用 `.includes()` 匹配标题片段两种规避写法。
   - **跨平台剪贴板**：复制粘贴到微信/知乎/Notion/邮件客户端等第三方应用时字符处理未逐一验证过，
     按"已知风险、不承诺具体表现"的措辞披露，并给出目标应用内手动清理的兜底方式。
   - `spec.md` §2.6 风险表三行状态同步勾更新（外部检索/Dataview 两行标 README 已披露完成日期；剪贴板
     一行仍标注实测未做，只是披露措辞已补上）。
3. 双语版本（`README.md` / `README.zh.md`）逐句对应修改，未产生内容漂移。

**没做的**：不涉及任何 `src/` 代码改动；跨平台剪贴板风险的**真实客户端实测**仍未做（开发环境无法验证，
仍是 spec.md 里挂着的待办）；Backlink 批量同步的 Git diff 噪音、审阅模式仍是 M9 backlog，未改动。

**验证方式**：`node scripts/docs.mjs --check` 通过；`npx prettier --check README.md README.zh.md doc/spec.md`
通过。未跑 `npm test`/`lint`/`release`（无 `src/` 改动）。

**下一步**：跨平台剪贴板行为需要真实客户端（微信/Notion 等）实测后回填 spec.md §2.6；README 截图/GIF
仍是占位，留待用户在有桌面环境处补充。

---

## 2026-07-08 1.0.7 补齐 CR-18 Backlink 独立触发 + skipFill 预览缺口 + GUI「预览优先」原则（claude/obsidian-auto-headings-review-km307d）

**做了什么**：接上一周期"下一步"遗留的两项，用户确认要补进 spec 并追加了一条通用 GUI 设计原则，本轮
全部落进 `spec.md`，纯文档修订，不涉及 `src/`，未跑 `npm run bump`：

1. **CR-18 + §3.12 新增「独立于编号模板的触发」**：把上一周期已用代码验证过的架构结论（`backlinks.ts`
   核心纯函数不依赖模板，耦合点只在 `main.ts` 的 `applyRenumber` 触发入口，只被 `scheduleRenumber` /
   `runImmediateRenumber` 调用、且都要求 `getTemplateForFile` 命中模板）写成正式设计段落：目标新增
   一条不依赖模板解析的触发路径（复用 `headingSnapshots` 快照基线）+ 独立开关，Roadmap M9 挂一条
   backlog 项。
2. **§3.13 新增「预览优先于文字说明」设计原则**：能用渲染示例说清楚的地方不写说明文字，仅当预览无法
   表达"为什么这样设计"时才留一句话说明；把已知的第一个缺口——`skipFill`（fill/drop/none）目前只有
   文字描述、没有配对渲染示例——记为该原则的待补项，Roadmap M9 挂对应 backlog 项。
3. 两处都保持"一句话 + 一个 backlog 勾选项"的精简体量，没有比照 M10 那样铺开 ASCII 图/多方案对比表——
   前者是对既有已验证结论的正式落笔，后者是一个局部渲染缺口，体量本就不需要那么重。

**没做的**：不涉及任何 `src/` 代码改动；未碰 `testplan.md`（两项仍是"规划中/待补"，未落地没有可断言
的测试场景）；README 重排 + GIF、导出清 WJ 可行性调研仍未动手（上一周期已记录，本轮未新增进展）。

**验证方式**：`node scripts/docs.mjs --check` 通过；`npx prettier --check doc/spec.md` 通过。未跑
`npm test`/`lint`/`release`（无 `src/` 改动）。

**下一步**：`skipFill` 预览与 Backlink 独立开关均已有明确设计方向，下一次动代码时可以直接按 §3.12/
§3.13 的段落实现，不需要再补规格；「预览优先」原则后续新增面板控件时应默认遵循，不必每次都重新讨论。

---

## 2026-07-08 1.0.7 用户产品讨论落规格：M10 TOC burn-in + M8b 交互面补充 + 生态兼容性风险（claude/obsidian-auto-headings-review-km307d）

**做了什么**：多轮用户产品讨论（① 上架现状与宣传短板评估 → ② 插件命名/卖点、Backlink 能否脱离编号
模板独立使用、四条 WJ 生态兼容性痛点、README 改版方向、GUI 预览缺口 → ③ 稳定性/兼容性想法批量输出
（导出清 WJ、Dataview 检索适配、全库清除可撤销、扫描修复历史断链、批量重编 UX、TOC burn-in）→ ④ TOC
监视机制细化 + 主编辑器 gutter 升降级按钮/拖放把手新想法），本轮把结论落进 `spec.md`，**纯文档修订，
不涉及 `src/`、未跑 `npm run bump`**（沿用"上架后策略：仅行为/产物变化才 bump"）：

1. **§2.2 非目标翻案**：「生成目录」不再是非目标——单文件内 burn-in 真实文本的目录，Dataview（渲染层、
   依赖额外插件）与 Table of Contents（一次性插入、不持续同步）都做不到，与本插件"写入真文本"的核心
   哲学一致；跨文件聚合视图仍非目标，继续走 M9 Dataview 集成路线，两者范围不同、互不替代。
2. **新增 §2.6 已知生态兼容性风险（待验证）**：四条——外部全文检索/正则因 WJ 断词失效（已用
   `render.ts` 代码核对成立）、跨平台剪贴板渲染 U+2060 异常（待真实客户端验证）、Dataview
   `file.headers` 精确匹配受 WJ 影响（已在 M9 候选①，待验证+出文档）、Backlink 批量同步引发 Git diff
   噪音（新发现，缓解方向并入 M9「Backlink 审阅模式」候选）。
3. **新增 §3.16 + CR-17 + Roadmap M10「原生风格 TOC burn-in」**：专属 `toc` 围栏代码块，复用编号引擎
   防抖触发路径；**关键约束**——TOC 块行数会随标题增删变化，打破"整文件重写永不增删行"的既有不变量
   （`backlinks.ts` 改名配对逻辑依赖这条不变量），技术方向待验证（CM6 事务位置映射能否在增删行场景
   下自动保持光标/滚动位置）；层级折叠复用 M8a 动态层级滑块的判定逻辑（同一纯函数，不重新实现）；
   四个未决问题（围栏语法/链接形式复用 `backlinks.ts` displayAnchor/多块支持/白名单是否收录）留待
   详细设计。M10 排期不早于 M8b 的"允许增删行整文件重写"基础设施到位。
4. **§3.15（M8b）补充设计**：新增"交互面选址"——在原有侧栏树拖拽之外，追加主编辑器 gutter 内嵌控件
   （∧/V 升降级按钮 + 拖放把手，与 Obsidian 原生标题折叠三角共存、不改变原有布局）；升降级按钮是否
   级联调整子标题层级列为未决问题；拖放把手复用既有"纯函数层 `moveHeadingBlock` + DOM 手势层"拆分，
   只是手势识别挂载点从侧栏树 DOM 换成 CM6 gutter widget。顺手修正 Roadmap 里一处过期表述（白名单子树
   拖入边界，Roadmap checklist 仍写"待实现时二选一"，与 §3.15 正文早已定案的"直接禁止"不一致）。
5. **M9 backlog 补充/细化**：多文件批量重新编号命令补 UX 定案（路径规则行右侧按钮+确认对话框）；新增
   「清除全库编号支持撤销」（与 testplan H8 读盘竞态同一段代码，建议一并修，插件自建快照/还原、非
   `Ctrl/Cmd+Z`）；新增「manifest description 卖点重排」（backlink 前置，低风险纯文案）。

**没做的**：
- **「Backlink 独立于编号模板单独可用」尚未落进 spec.md**——上一轮已用代码验证架构可行（`backlinks.ts`
  核心纯函数本就不依赖模板，耦合点只在 `main.ts` 的 `applyRenumber` 触发入口），但结论目前只在对话
  记录里，还没写成正式的 CR / Milestone 章节，需要用户确认是否也要本轮补上。
- 「skipFill 跳级预览缺口」（GUI 各处加预览的一个具体案例，已用代码确认 `EditPanel.ts` 目前无此预览）
  同样只在对话记录里，未写入 spec.md。
- README 实际重排（Feature 列表 + 跳转 + 配图）与 GIF 制作均未动手——GIF 需要真实 Obsidian 实例操作
  录屏，当前环境无法产出，需要用户自行录制或留待有桌面环境的会话。
- 「导出时清除 WJ」的可行性未验证——Obsidian 核心导出流程是否开放公共钩子给社区插件介入未经查证，
  spec.md 里未新增章节记录这条（仅在对话中给出"手动命令兜底"的降级方案建议，未落规格）。
- M10/M8b 新增内容均为规划阶段的规格文字，不涉及 `testplan.md`（未落地就没有可断言的测试场景）。

**验证方式**：`node scripts/docs.mjs --check` 通过（周期块/概括行计数未超限，目录结构约定未受影响）；
`npx prettier --check doc/spec.md` 通过。未跑 `npm test`/`lint`/`release`（无 `src/` 改动）。

**下一步**：向用户确认是否要把「Backlink 独立开关」与「skipFill 预览缺口」也补进 spec.md；若确认，
比照本轮体例（CR 表 + 非目标/风险表 + §3.x 详细规格 + Roadmap checklist）补齐。M10 与 M8b gutter 交互
的未决问题拍板后，才能拆解出可估工时的 checklist，目前仍停留在"规划中/构思阶段"。

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
