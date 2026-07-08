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

## 2026-07-08 1.0.7 竞品调研驱动的 M8/M9 Roadmap 修订（claude/obsidian-plugin-integrations-hcky0m）

**做了什么**：三轮讨论（① 本插件可与哪些 Obsidian 插件联动 → ② grep M8/M8a/M8b 评审 Roadmap →
③ 用户点出 M8 是对 Quiet Outline 的模仿改良、要求调研其用户痛点并发散看其他插件），本轮把结论落进
`spec.md`，纯文档修订，不涉及 `src/`：

1. **调研证据链**（结论已写入 spec.md 对应位置，此处存证据来源）：
   - **Quiet Outline**（guopenghui/obsidian-quiet-outline）：README + issues 调研，确认「彩虹配色」
     是真实痛点——社区专门有 CSS 片段仓库（replete/obsidian-minimal-theme-css-snippets）把它的彩虹
     色改成主题色，作者原话"用它替代官方 Outline 面板"；"不支持跨级标题 h1→h3→h4"是结构性 bug（本
     插件 `parser.ts` + 模板 `skipFill` 已经正确处理同类跳级场景）；另有焦点滞留侧栏、状态持久化
     文件与 iCloud 同步冲突（#308）等交互细节问题。
   - **Modern Outline**：minimap-on-edge 范式的大纲插件，作为 QO 的替代形态调研后**不采用**——与
     本插件已定的侧栏树形态是两个不同产品方向，不同时做（用户本轮明确"不考虑做 minimap"）。
   - **Table of Contents**（hipstersmoothie，21.5 万次下载）：验证了"生成式目录"需求盘子很大，但
     用户决定改走"支持 Dataview"而非自建生成器命令，与 §2.2 非目标"生成目录是独立关注点"保持一致
     （用户本轮明确"先只考虑支持 dv"）。
   - **Number Headings**（onlyafly，8.5 万次下载）：issues 里"排除文件夹编号"（#81）、"跳过注释块内
     标题"（#72）两条现状缺口，转成 M9 候选项。
   - **Obsidian 核心 Outline / Outliner 插件**的拖拽历史（含 Obsidian v1.4.5"带 frontmatter 时拖放
     失效"回归）：转成 M8b 的一条显式测试场景要求。
   - **带编号导出**（PDF/Pandoc）：用户本轮明确"作为调研项"，即只记录待验证问题、不承诺实现范围。
   - 主要来源：<https://github.com/guopenghui/obsidian-quiet-outline>、
     <https://github.com/replete/obsidian-minimal-theme-css-snippets>、
     <https://community.obsidian.md/plugins/modern-outline>、
     <https://github.com/hipstersmoothie/obsidian-plugin-toc>、
     <https://github.com/onlyafly/number-headings-obsidian/issues>

2. **`spec.md` 修订清单**：
   - §2.2 非目标：「生成目录」补跨引用到 M9「Dataview 集成」。
   - §3.14（M8a）：呈现形态锁定侧栏树形（非 minimap，附否决记录指回本条）；标题树解析改为**直接
     复用 `parser.ts`**（不重新实现，避免 QO 同款跳级 bug）；搜索框需**复用 `main.ts` 现有
     `imeComposing` 模式**；「高亮」补非目标"不做按级别彩虹配色"；「其余交互」补"跳转后焦点还给
     编辑器"；「层级滑块」补状态持久化约束——只进单一 Settings，不做逐文件 side-car（避免 QO #308
     同款云同步冲突）。
   - §3.15（M8b）：白名单子树拖入边界从"实现时二选一"改为**锁定决策"直接禁止"**；移动端触摸拖拽
     明确列为"可独立延后、不阻塞 M8b 桌面端验收"；测试策略补一条"带 frontmatter 文件做拖放"的显式
     场景。
   - M9 候选清单：新增「Dataview 集成」（替换原「侧栏生成目录块」表述，定位"验证 + 写文档"而非新增
     插件代码）；「带编号导出」降级为"调研项，非承诺功能"；新增「路径规则不编号伪模板」「注释块内
     标题跳过」两条候选。

**没做的**：不涉及任何 `src/` 代码改动；未碰 `testplan.md`（M8a/M8b/M9 候选项仍是"规划中/候选"，未
落地就没有可断言的测试场景）；未跑 `npm run bump`（沿用"上架后纯文档改动不 bump"策略，见 0.7.26
之后历次纯文档周期）。Dataview 是否有开箱即用的标题字段、导出链路里 WJ 字符的实际表现，均未动手
验证，spec.md 里已显式标注"待验证"，不是调研结论。

**验证方式**：`node scripts/docs.mjs --check` 通过。未跑 `npm test`/`lint`/`release`（无源码改动，
`doc/` 本就在 `.prettierignore` 里，不受 `format:check` 管辖）。

**下一步**：若采纳「Dataview 集成」候选，第一步应是找一个真实 vault 手动验证 WJ 字符在 DataviewJS
里的实际表现（而非继续纯调研）；「路径规则不编号伪模板」与「注释块内标题跳过」是两个低成本、不依赖
M8 的独立小任务，可随时排期；M8a/M8b 本身仍未开工。

---

## 2026-07-06 1.0.7 补充追问二则至 Harness 文档：脚本串联链路 + 省 token 机制（claude/harness-workflow-architecture-4vyme3）

**做了什么**：用户在上一周期基础上追问两个问题——「进入本仓库的 Agent 工作流用哪些脚本
串起来」「这套工作流省上下文/省 token 是靠什么实现的」，把两问两答追加进
`doc/harness-workflow-ic-verification.md` 作为 §7/§8：

1. **§7 脚本串联链路**：从 SessionStart 钩子（自动）→ `npm run docs -- --handover`（接手
   读盘）→ 手写工作步骤 → 质量自检（test/lint/format）→ `npm run release` → `npm run bump`
   → 写交接记忆 → `npm run docs`（或合并为 `preflight`）→ 提交（pre-commit 软门禁）→
   push（CI 硬门禁）→ 合并 master 的完整时间线图 + 脚本职责速查表，并点明 `release`/
   `bump`/`docs` 三者是**手动触发、非自动串联**，真正自动串联的只有 `preflight` 组合命令
   与 pre-commit/CI 内部固定跑的 `docs.mjs --check`。
2. **§8 省 token 六机制**：分层摘要（首行+最新块恒定入口成本）、归档不删除但默认不进
   上下文、脚本算摘要代替整读计数（testplan 非 ✅ 清单）、`--handover` 单命令聚合三处、
   grep 定位菜谱替代整读 + 源码按职责拆分、结构化数据+字数上限逼出信息密度；归纳为
   "上下文消耗从随项目历史增长改造成随项目历史保持恒定"。

**没做的**：本次仍是纯知识沉淀的追加，不涉及插件行为，未跑 `npm run bump`。

**验证方式**：`npx prettier --check doc/harness-workflow-ic-verification.md` 通过；
`node scripts/docs.mjs --check` 通过。未跑 `npm test`/`lint`/`release`（无源码改动）。

**下一步**：本仓库侧无遗留任务；后续若用户在 IC 验证项目侧有新的迁移细节讨论，可继续
追加进本文档对应章节。

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
