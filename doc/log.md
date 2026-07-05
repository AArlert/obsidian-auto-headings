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

## 2026-07-05 1.0.7 迁移守卫：自动路径检测疑似外来编号，跳过写入+提示（claude/plugin-numbering-cleanup-check-d83sxc）

**做了什么**：用户提出的真实痛点——从其他编号插件 / 手写编号迁移过来的文件（如 `## 1 红米`），装上本插件
后全局自动编号一开，打开该文件就会被自动路径叠成 `## 1 1 红米`（方案A下无 WJ 一律当正文、直接叠加编号），
观感上与 bug 无异，而这恰恰是新用户接触自动编号的第一个时刻。上一轮讨论了三个方案（自动接管 / 跳过+
提示 / 全库常驻角标），采纳方案1（跳过写入 + 一次性提示，风险最低）：

1. **`src/cleanup.ts` 新增只读探测 `hasUnclaimedForeignNumbering`**：全文完全不含 Word Joiner（插件
   从未接触过这份内容）且至少一个标题被 `stripForeignNumbering` 判定为「像外来编号」时返回 true。
2. **`src/main.ts` 三处自动写入前接入守卫**（`scheduleRenumber` 防抖到期回调 / `renumberOnOpen` /
   `renumberActiveFile`）：命中即跳过本次 `applyRenumber`，改弹 Notice 引导执行「清理非本插件的标题
   编号」；新增 `foreignNumberingWarned`（内存 Set）把提示限制为每文件每会话一次，此后静默持续跳过；
   随文件 rename 迁移键、delete 移除、`onunload` 清空。**手动命令**（立即重新编号 / 清除编号 / 清理
   外来编号）**不查守卫**，绕过一切开关照常执行——与既有「Renumber now 绕过一切开关」原则一致。
3. **已知且接受的边界**：守卫的「从未接触过」判定是**整文件级**的——一旦文件已含任意 WJ（哪怕只有
   一个标题被本插件编过号），之后再粘贴进一段带外来编号的新内容，守卫**不会**再次拦截，该段落仍按
   方案A既有语义处理（当正文、叠加编号）。这是刻意的范围收窄（避免为「部分接管」引入按标题级的更
   复杂判断），已在 `main.test.ts` 补一条回归测试固化这个边界，不是遗漏。
4. `src/i18n.ts` 新增 Notice 文案 `noticeForeignNumberingGuard`（中英双语）。
5. `doc/spec.md` §3.9「打开文件即重排」段后补一段规格说明（命中条件、行为、范围、已知风险）；
   `doc/testplan.md` J 类新增 **J10** 场景行。

**没做的**：方案2（vault 级一次性 onboarding 提示）、方案3（面板常驻角标计数）——本轮只落地风险最低
的方案1；「部分接管文件里新增外来编号段落」这个已知边界（见上第3点）暂不处理，留待用户反馈是否值得
再投入按标题级判断的复杂度。

**验证方式**：`cleanup.test.ts` 补 5 条 `hasUnclaimedForeignNumbering` 纯函数单测；`main.test.ts` 补
6 条集成测试（`scheduleRenumber`/`renumberOnOpen`/`renumberActiveFile` 命中守卫跳过写入+仅提示一次、
已接管文件的边界行为、手动命令绕过、「先清理再自动接管」典型工作流往返）；`npm test`（353 全绿）、
`npm run lint`、`npm run format:check`、`npm run test:fuzz`（5000×80 全绿，两条记分板不变式均未受影响）、
`npm run release` 全过；`npm run bump` 同步至 1.0.7。

**下一步**：等待合并回 master；若用户反馈仍在「部分接管文件」场景撞到双重编号，再评估方案2/3或按标题
级判断的复杂度是否值得投入。M8a/M8b 仍未开工，按上一周期结论排期。

---

## 2026-07-05 1.0.6 README 中英双语改版：按调研报告拆「基础层/进阶层」（claude/plugin-readme-localization-mh62xy）

**做了什么**：按 `doc/README_UPDATE_REPORT.md`（0704 调研产出）§3 的结构提案，重写 `README.md` /
`README.zh.md`，两份结构、示例一一对应：

1. **重新分层**：原先「问题钩子 → 演示 → 功能清单（平铺）→ 原理 → quick start → 安装 → 命令 → notes」
   的时间线堆叠，改成「开场钩子 → **开箱即用**（零配置/标题层级神圣/防抖不打扰/性能边界/两层开关+
   frontmatter 覆盖/配置不入笔记/双语，收尾 Quick start）→ **深入定制**（rename+backlink 演示/模板系统/
   路径规则/白名单/清除命令）→ 工作原理 → 安装/命令表/notes/license」两层组织。
2. **融入报告 §1 列出的八处设计权衡**：标题层级神圣性从功能列表第 3 条提到「开箱即用」首位；
   frontmatter 不存配置的「打开笔记看不到插件痕迹」补进同一层；`ancestorNumeral` 补了一句说清
   它解决的是"中文书式 vs 提纲式"这一真实排版冲突，而非只列举两个选项名词；白名单子树重置补一句
   「基于主流引用规范调研（约 85%）的默认行为」；backlink 同步补一句"站在 Header Enhancer 已有实现
   之上做了几处改进"（不逐条列出四点，那是 spec 的活）；「按文件覆盖」与「清除命令」里的
   "Renumber now 绕过一切开关"合并成「开箱即用」层一段统一的"两层开关+手动兜底"陈述，避免读者
   在两节之间拼凑不出这是一套体系；性能边界补一句"模板/规则再多也不会有后台开销"；工作原理一节
   补充双哨兵自愈（0.7.20）一句话说明，并保留对 gurjar1/auto-heading-obsidian 的鸣谢惯例（原写法只
   讲了单哨兵）。
3. **删除已落地的调研报告** `doc/README_UPDATE_REPORT.md`——按其自身开头注记与 `CLAUDE.md` 的
   「单一事实源」纪律，结论落地到新版 README 后原件即删，不留副本。
4. **未做的**：报告 §3 开放问题里的截图/GIF——沿用 M7 发布前已做的决定"文字说明已足够，截图/GIF
   留作后续可选补充"，本轮未动手（做的话需要先确认录屏/截图生成方式，工作量独立评估，不与本次结构
   调整捆绑）；`spec.md`/`testplan.md` 未改动——报告已确认这是纯文档重组，不涉及行为变更，故也
   **未跑 `npm run bump`**（1.0.6 早已过 1.0.0，遵循"上架后策略：仅行为/产物变化才 bump"）。

**验证方式**：`npx prettier --check README.md README.zh.md` 通过；手动核对中英两份标题层级、内部锚点
（如 `#out-of-the-box`/`#开箱即用`、`#notes`/`#说明`）一一对应且未失效；`node scripts/docs.mjs --check`
通过（目录结构约定与磁盘一致、周期块/概括行计数未超限）。未跑 `npm test`/`lint`/`release`（无源码改动）。

**下一步**：等待用户确认是否需要补充截图/GIF；M8a/M8b 仍按上一周期结论排期。

---

## 2026-07-04 1.0.6 M8 规格重整：修文档漂移 + 拆 M8a/M8b + 内容迁移（claude/spec-m8-feasibility-8f233f）

**做了什么**：应用户要求审查 `spec.md` Milestone 8（侧栏大纲导航 + 结构编辑）的可行性，本周期是讨论
产出的落地，**未改任何源码/测试**。

1. **修文档漂移**：`spec.md` 中有三处写着「审阅模式 / 全库扫描修复留 M8」（§3.12 两处 + 旧 M7 Roadmap
   一处），但实际这两项内容一直在 Milestone 9 候选清单里，M8（8.0–8.7）自身从未提过它们——三处引用
   已改为「留待 M9」，与实际落点对齐。
2. **拆分 M8a / M8b**：可行性审查发现 M8 原文把「大纲导航（只读展示/搜索/跳转）」与「拖放重排+行内
   编辑（结构性写入）」混在一个 milestone 里，后者引入的是当前写入模型（「整文件重写、从不批量扫库」）
   之外的新写入路径（剪切—拼接—重排—同步 backlink），边界情况数量级预计超过 M6/M7 已加固的「原地改
   标签」场景，且拖拽手势/动画完全没有自动化验证手段。故拆成 **M8a**（低风险，可独立发布）与 **M8b**
   （高风险，架构新增最多，建议独立排期）。
3. **内容迁移**：原先整段 UI 设计稿 + 详尽 bullet list 直接堆在 Roadmap §5 里（与项目「单一事实源」
   纪律相悖——其余 milestone 的 Roadmap 条目都只是一行 + 链接，详细设计在 §3）。本次把实质内容迁到
   新增 **§3.14 侧栏大纲导航（M8a）**、**§3.15 拖放重排与结构编辑（M8b）**，§2.1 核心需求表补
   CR-15/CR-16，§4 架构设计补一段「M8 规划中」注记（新增 `views/OutlineView.ts` 是本仓库第一次引入
   Leaf/View 基础设施）；Roadmap §5 的 M8a/M8b 只留精简 checklist + 链接。
4. **测试基建可行性结论**（本次审查的重点发现，已写入 §3.14/§3.15/§4）：
   - `vitest.config.ts` 固定 `environment: "node"`，`obsidian-mock.ts` 的 `containerEl` 只是空对象——
     现状对这类面板完全没有自动化验证空间。M8a 落地时可按新增测试文件用
     `// @vitest-environment jsdom` 引入最小 jsdom 依赖（不影响既有测试），覆盖树构建/搜索过滤/键盘
     导航等结构性断言；但真实 CSS 过渡/fade 效果 jsdom 验证不到，维持交给 `user_tests` 手验，与
     testplan 现有「面板类交互无文本语义、留手验」原则一致。
   - M8b 风险最高的拖放重排，建议**架构上**把「结构变更执行」拆成独立纯函数（如
     `moveHeadingBlock(content, source, target)`，不碰 DOM）与「拖放手势识别」（DOM 事件层）两层——
     前者可以按 `tests/dev_tests/uvm/` 现有的约束随机序列模式**新增一种随机操作**（随机移动标题），
     配套不变量做回归，是 M8 里少数能被机器持续验证、而非仅靠人工点击的部分。这个拆分建议已写进
     §3.15「测试策略」，值得在真正实现 M8b 前就定下来，而不是先写成一个揉在一起的 DOM 事件处理函数。

**没做什么**：M8a/M8b 均未开工，`views/` 目录、`moveHeadingBlock` 均不存在；这是规格/可行性层面的
整理，不是实现。

**下一步**：等待用户决定何时排期 M8a；M8b 实现前先按 §3.15 的建议把纯函数层设计出来再动手写 DOM
拖拽逻辑，以便从第一天起就能接入 UVM。

**验证方式**：纯文档改动，无代码变更。`npx prettier --check doc/spec.md` 通过；内部锚点链接（3.14/3.15
及新增交叉引用）逐一核对生成的 slug 与既有同风格标题（如 3.12/3.13）一致。未触发 `npm test`/`lint`/
`release` 重建（无源码改动，遵循「上架后策略：仅行为/产物变化才 bump」，本次不 bump 版本号）。

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
