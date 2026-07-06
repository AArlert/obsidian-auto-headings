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

## 2026-07-06 1.0.7 新增知识沉淀文档：Harness 工作流思想提炼（面向 IC 验证 Agent）（claude/harness-workflow-architecture-4vyme3）

**做了什么**：用户要求把本仓库自身的多 Agent 协作 Harness 机制（`CLAUDE.md` 交接协议、
`log.md`/`status.jsonl` 分层记忆、`scripts/docs.mjs` 机械脚本化、pre-commit/CI 两级门禁、
`testplan.md` §4 已借用的 UVM 约束随机测试思想）提炼成通用架构原则，用于其在 IC 设计验证
领域的 Agent 工作。新增 `doc/harness-workflow-ic-verification.md`：

1. 十条可迁移的核心原则表（单一事实源、分层记忆、机械/语义解耦、两级门禁、状态转移优先、
   约束单向放松、多记分板互补、显式登记未覆盖项、已知边界钉回归测试、产物随源码入库）。
2. 分层记忆架构图与 `scripts/docs.mjs` 五件事的抽象模式（归档/滚动/摘要/校验/目录树守卫）。
3. §5 单独整理本仓库测试层已借用的 UVM 方法论内核（参考模型 scoreboard、多记分板互补、
   约束随时放松的单向棘轮、覆盖率驱动缺口分析、显式"不入随机框架"清单）——这部分与
   IC 验证同源，可直接对齐，不需要类比转译。
4. §6 给出迁移到 IC 验证 Agent 工作的具体落地设计：`doc/` 文件角色映射表、`testplan.md`
   验证维度模板、`scripts/vplan.mjs` 脚本职责、门禁分层（含 IC 验证比软件多出的"夜间全量
   回归"一层）、Agent 交接协议模板、最小可行落地清单。

**没做的**：本文档是纯知识沉淀/外部参考，不涉及插件自身行为或规格变化，故未跑 `npm run
bump`（沿用 1.0.6 README 重组周期确立的"上架后策略：仅行为/产物变化才 bump"）；未改动
`spec.md`/`testplan.md`——内容与本插件的编号引擎规格无关，不适合并入两者。

**验证方式**：`npx prettier --check doc/harness-workflow-ic-verification.md` 通过；
`node scripts/docs.mjs --check` 通过（周期块/概括行计数未超限，目录结构约定未受影响——
本次未新增 `.ts`/`.mjs` 源文件）。未跑 `npm test`/`lint`/`release`（无源码改动）。

**下一步**：待用户在 IC 验证项目一侧落地 `scripts/vplan.mjs` 与 `testplan.md` 等价物时，
如需进一步定制脚本原型可另行支持；本仓库侧无遗留任务。

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
