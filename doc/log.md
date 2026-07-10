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

## 2026-07-10 1.0.7 拷问式方向审查落盘：grill.md + 契约 + Roadmap 重排 M11/M12 + 实机环境规划（claude/plugin-review-infra-swtxdk）

**做了什么**：用户发起对插件的拷问式全方位审查（定位/生态适配/导出/Milestone/infra 化路径），全部认可
审查结论并全权委托落盘，本轮**纯文档大修**，不涉及 `src/`、不 bump（上架后策略）：

1. **新增 `doc/grill.md`**（长期保留的方向审查记录，单一事实源纪律的用户指定例外——落点放结论、
   本文件放推理与否决理由）：七方面拷问（定位倒转/WJ 义务/触发面盲区/Backlink 信任敞口/导出/
   Milestone 倒挂/infra 差距）+ 本轮专题 **§8「WJ 能否被 CM6 原子区域替代」**。§8 结论：原子区域
   答不了跨会话/设备的「身份」问题（纯模式匹配、位置 sidecar、会话内追踪三条去 WJ 路线逐一枪毙），
   **不能替代、应当叠加**——防护栈三层变四层（原子区域→方案A→双哨兵→清除命令）；真正零 WJ 的
   诚实路径是「虚拟编号模式」（opt-in 渲染层第二哲学，进 M9 候选）。
2. **新增 `doc/marker-contract.md`**（英文，面向下游开发者/工具作者）：WJ 双哨兵字节格式、四条
   稳定性承诺（格式/键名/永远可退出/互操作配方）、剥 WJ 与剥整前缀代码片段、Pandoc Lua filter、
   与 gurjar1 插件共存不受支持声明。
3. **`spec.md` 系列修订**：§2.2 虚拟编号翻案候选注记；§2.3「前缀可手改」修订预告；§2.5 CM 行升格
   说明；§2.6 风险表 4→8 行（Canvas 引用方靠巧合、Publish 锚点、外部写入陈旧快照、WJ 无命名空间，
   均已代码核对或标注待实测）+ 拷问追加注记；新增 §2.7 契约中文摘要；§3.12 CR-18 升格注记；
   **§5 Roadmap 重排**——执行顺序总览表（M11→M12→M8a→M8b→M10，编号不再暗示顺序）+ 新增
   **Milestone 11 信任包**（审阅模式/H8+清库撤销/复制净化/导出验证矩阵/大库性能/CM6 原子区域/
   Canvas 拍板/陈旧快照评估/E8 拍板）与 **Milestone 12 独立价值包**（CR-18/批量重编号/伪模板/
   注释块跳过/断链修复/description 重排/公开改名事件 API/Number Headings 迁移指南），M9 清池九项。
4. **新增 `spec.md` §7.1 实机验证环境规划**（用户决定：后续在装有 Obsidian 实体的 Ubuntu 环境用
   Claude Code 开发）：专用测试 vault 约定、CDP 自动化驱动（`--remote-debugging-port` + Playwright
   attach 执行 `app.commands`）→ URI+xdotool → 纯手动三级降格、O 组/导出矩阵/性能/README 截图的
   执行清单、`tests/machine_tests/` 目录纪律。
5. **`testplan.md` 新增 O 组**（生态与外部写入，O1–O7 全 🔲）：Canvas/外部改写陈旧快照/WJ 插件
   共存/剪贴板净化/导出矩阵/原子区域交互面/公开 API 事件。
6. **README 双语三新节**：「导出与外发」（Pandoc 双重编号预警 + Lua filter 指引 + PDF/Publish 待实测
   如实标注）、「从 Number Headings 迁移」（三步接管，吃停更竞品存量）、「如何干净地离开」（卸载
   三步 + 字节级可退出性承诺）；「工作原理」补共存互斥与契约链接两条。
7. CLAUDE.md §3.1 表与本文件目录结构块登记两个新文档。

**没做的**：不涉及任何 `src/` 改动——M11/M12 全部是规划，一行代码未写；O 组场景全部 🔲 未执行
（等实机环境）；manifest description 重排刻意不动（属产物，须随下一个行为版本 bump）；doc/
harness-workflow* 两个知识沉淀文件核实为用户有意保留，未动。

**验证方式**：`node scripts/docs.mjs --check` 通过；`npx prettier --check README.md README.zh.md`
通过；`npm test` / `npm run lint` 通过（未动源码，例行核验）。

**下一步**：用户将在装有 Obsidian 实体的 Ubuntu 环境用 Claude Code 继续开发——接手 agent 第一步按
spec §7.1 搭实机环境（测试 vault + CDP 驱动），然后按新执行顺序开工 **M11 信任包**（建议首件：
导出验证矩阵 O5 + 剪贴板 O4，纯验证零风险，实机环境一到位即可跑；随后审阅模式/H8 动代码）；
M12 里《从 Number Headings 迁移》长文与论坛发布不依赖实机，可随时做。

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
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + grill 方向审查 + marker-contract 下游契约，见 CLAUDE.md §3.1；harness-workflow* 为跨项目知识沉淀，不属插件规格）
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
