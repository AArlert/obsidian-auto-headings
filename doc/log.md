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
> 均可整读）；仍大的 `main.ts`（~970 行）与 `i18n.ts`（~650 行）先 `grep` 定位、别整读。

> 一句话：**改代码 → `npm run bump` → 写本文件新块 + `status.jsonl` → `npm run preflight`（= docs + release + test + lint + format:check）→ 提交（含 `release/`）。**

---

## 2026-07-10 1.0.8 SubAgent 派发体系落地 + 清理 sync-plugin-repo 迁移遗留（claude/subagent-harness-dispatch）

**做了什么**（纯 harness/文档周期，无插件行为变化，按上架后策略不 bump）：

1. **CLAUDE.md §0 从三行准则改写为可执行派发协议**：派发表（任务类型 → agent → 返回上限）、
   输出契约（结论先行 / file:line / 禁整段粘贴 / 超长返工）、升级路径（haiku 两败 → sonnet → 主模型）、
   主模型保留事项清单。
2. **新建 `.claude/agents/` 四个仓库级定义**（随 git 入库）：`quality-gate`（haiku，跑质量门槛压缩返回，
   分验证档/收尾档）、`repo-scout`（haiku，内置 §3 定位菜谱的检索员）、`mech-editor`（haiku，机械改动，
   带禁区清单 + 歧义即停）、`feature-coder`（sonnet，边界清晰的编码，testplan-first，收尾归主模型）。
3. **删除已失效的 `scripts/sync-plugin-repo.mjs`**（引用不存在的 `publish/` 目录跑必崩，职能已被
   `release.yml` tag 发布工作流取代）+ 删 `package.json` 的 `publish:repo` + 修缮本文件目录树块
   （删 publish/ 与 sync-plugin-repo 两行、补 `.claude/agents/` 行）。此项由 mech-editor 试点执行。

**没做什么**：feature-coder 定位存疑（价值是上下文隔离而非省钱）——按约定观察 2~3 个周期，
使用率为零则删；新 agent 定义**本会话不生效**（注册表会话启动时固定），`/agents` 加载确认留待下个新会话。

**验证方式（A/B 实测）**：全绿时 `npm test` 完整输出 89 行 vs quality-gate 契约 ≤25 行（失败时全量
输出会膨胀数百行，收益更大）；repo-scout 试点查 spec §3.11 走了 grep+sed 菜谱而非整读 178KB 文件，
~2.8 万 token 检索开销隔离在子上下文；mech-editor 试点三处改动 diff 抽查干净、`docs.mjs --check` + lint 绿。
quality-gate 试点跑收尾档 preflight：4 项通过，唯一 test 失败为既有 ICU 环境差异（`whitelist.test.ts`
filterSortWhitelist，前两周期已登记非回归）；release/ 无变化，佐证不 bump 正确。

**本周期派发 3 次**（mech-editor ×1、repo-scout ×1、quality-gate ×1 收尾档 preflight）。

**下一步**：不变，M11 信任包（见 status 首行）；顺带在下个编码周期实测 4 个 agent 的会话内加载与派发表执行率。

---

## 2026-07-10 1.0.8 文档体系重整：grill 收编 spec 附录 A + 叙事倒转 + M0–M7 压缩 + 移除跨项目沉淀（claude/doc-consolidation-grill）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **删除跨项目知识沉淀**：`doc/harness-workflow-ic-verification.md` 与 `doc/workflow.html`（用户
   指示，内容与插件规格无关）；log.md 目录结构约定块同步。
2. **grill.md 收编为 spec 附录 A**（用户指示，替代此前「长期独立保留」决定）：全文标题降级
   （§N → §A.N）、内部自指补 `A.` 前缀、对 spec 的指称改「本文」；spec 内 11 处
   `[grill.md](./grill.md)` 引用改附录锚点；CLAUDE.md §3.1 表删行；testplan §O 来源注与
   marker-contract.md 定位注改指附录；原文件删除。
3. **spec 叙事倒转落到门面**：顶部简介与 §1 背景改为「① 改标题不断链（第一价值，全社区最可靠的
   改名检测引擎）② 最强编号（第二层价值，burn-in 哲学）」两层结构，链接附录 A §A.1 论证；如实
   标注 CR-18 开关默认关、「装上即不断链」零配置目标待稳定后翻默认兑现。
4. **Roadmap M0–M7 压缩**：八个已完成里程碑 93 行 checklist 压为 16 行单表（细节指向本文各功能节
   与 log-archive，不留双份），Community Hub 提交机制保留一行；执行顺序表状态更新为
   「已通过官方审核，商店正式上架」（用户 2026-07-10 确认）。
5. **CR-18 全文状态回填**：§2.1 需求表、§3.12 设计段、M12 首项三处标注 1.0.8 落地（开关
   `backlinkStandaloneTrigger` 默认关、常规路径已处理本轮时不重复跑、testplan M19–M26）。
6. **锚点全量修复**：修 14 处含 `.` 的既有死锚点（GitHub slug 删点号：`m71.0`→`m710`、
   `0.7.20`→`0720`、`burn-in-m10`→`burn-inm10`）；目录补 §2.4–2.7 与附录 A 条目；§3.12 一处
   已失效的「M8 backlog」死链改指 M12。

**没做什么**：README 未按叙事倒转改版（与截图/GIF 一起做，需用户桌面环境）；manifest description
卖点重排仍按 M12 计划随下一个行为版本 bump；marker-contract.md 维持独立英文文件（用户拍板：下游
可见性本身是信任叙事的一部分）。

**验证方式**：自写脚本校验 spec 全文内部锚点 0 死链（58 个标题）；`node scripts/docs.mjs --check`
通过；`npx prettier --check` 改动的五个文档全绿；`npm run preflight` 全绿（test 359/360，唯一失败
为既有 ICU 环境差异，与本轮无关，见上一周期记录）。

**下一步**：M11 信任包为当前重点（用户指示，事关插件信任度）——八项中建议先动纯验证/拍板项
（导出验证矩阵、Canvas O1 拍板、E8 拍板），代码项（审阅模式、H8+清库撤销、复制净化、CM6 原子
区域）按 spec §5 顺序排期；README 改版 + GIF 待用户桌面环境。

---

## 2026-07-10 1.0.8 Backlink 同步独立于编号模板触发（CR-18，M12 首项，claude/m9-backlink-standalone-trigger）

**做了什么**：实现 spec.md §3.12「独立于编号模板的触发」既定设计（CR-18，M12 首项，规格早已定案，
本轮只落地代码），修复「当前 `applyRenumber` 唯一入口只被 `scheduleRenumber`/`runImmediateRenumber`
调用、且都要求 `getTemplateForFile` 命中模板」导致的盲区——无模板文件 / 全局自动编号关闭场景下，
标题改名不触发 Backlink 同步：

1. **新增独立开关 `backlinkStandaloneTrigger`**（`settings/model.ts`，默认**关**，opt-in——这是对既有
   触发面的扩展，比默认开的 `updateBacklinks` 更保守）：`loadSettings` 补迁移回退（缺失字段→false）。
2. **`main.ts` 新增两个方法**（不新增编号逻辑，纯复用既有 `headingSnapshots`/`foldSelfBacklinks`/
   `syncAndSnapshot`）：`shouldBacklinkStandaloneTrigger`（门控：独立开关 + `updateBacklinks` 总开关 +
   非 `vaultClearInProgress` + `frontmatter !== false`——**显式 `fm:false` 优先于独立触发**，覆盖一切
   自动路径，与 `shouldAutoTrigger` 对 `fm:false` 的处理口径一致）与 `applyBacklinkStandaloneSync`
   （跳过 `renumberContent`，只走 `foldSelfBacklinks` + 无条件 `syncAndSnapshot`——与 `applyRenumber`
   对称，即便本轮无改名也要刷新/播种快照基线，否则首次触发因无基线永远检测不到改名）。
   `scheduleRenumber` 改为「常规编号路径本轮未处理（无模板命中 / 不够格自动触发编号）时才尝试独立
   触发」，避免同一次改动被处理两遍（M25 回归覆盖）。
3. **顺手抽出 `writeLineDiff` 辅助方法**：`runClearNumbering`/`runClearForeignNumbering`/
   `applyRenumber`/新增的 `applyBacklinkStandaloneSync` 四处原先重复的「整文件按行 diff 后单一事务
   写回」逻辑合一，减少重复而非新增第四份拷贝。
4. **GUI**：`GeneralTab.ts` 新增开关，紧跟既有「同步内部链接（Backlink）」开关（面板位置符合规格
   要求）；`i18n.ts` 补中英文案，描述里用具体改名示例（`## 计划`→`## 项目计划`）说明生效条件，遵循
   §3.13「预览优先」原则（无法用纯渲染示例表达的复合生效条件保留一句话说明，属该原则明确的例外）。
5. **`testplan.md` M 类新增 M19–M26** 共 8 条场景（默认关无回归 / 无模板同步 / 全局关且非
   `fm:true` 仍同步 / `fm:false` 优先 / 依赖总开关 / 清库压制 / 不重复同步 / GUI 位置），全部落地为
   `main.test.ts` 新 describe 块（7 个自动化用例）+ GUI 一条标注需 Obsidian 手验 DOM。

**没做的**：`runImmediateRenumber`（手动「立即重新编号」命令）与 `renumberOnOpen`（打开文件自动重排）
未接入独立触发——前者是显式编号命令，无模板时弹 Notice 提示用户是既有预期行为；后者只在活动视图打开
时触发，标题改名场景本就靠实时编辑（`scheduleRenumber`）覆盖，范围收在 CR-18 描述的「标题文本被
改写」这一真正的盲区（编辑触发），未扩大到这两条路径——如后续需要可另开场景单独评估。M12 其余六项
（多文件批量重编号 / 不编号伪模板 / 注释块跳过 / 断链修复命令 / description 重排 / 公开改名事件 API /
迁移指南）未动。

**验证方式**：`npm test`（359/360 通过，唯一失败 `whitelist.test.ts` 的
`filterSortWhitelist`localeCompare 排序断言与本轮改动无关——`git stash` 到改动前同样失败，环境
ICU/locale 差异导致，非回归）；`npm run lint` 全绿；`npm run format:check` 全绿；`npm run test:fuzz`
（5000×80）全绿；`npm run bump` 1.0.7→1.0.8。

**下一步**：M12 其余六项已有明确定案或待细化设计，可按 spec.md §5 Milestone 12 顺序继续；`main.ts`
已增长到 ~970 行，若后续再扩几个触发路径建议评估按职责拆分（如把 `schedule*`/`apply*`/`should*`
一类触发判定函数拆到独立模块），暂未到非拆不可的程度。

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
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + marker-contract 下游契约，见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A）
├── release/              ← 可分发插件文件（main.js/manifest/styles/README；zip 本地生成不入库）★每周期必更新
├── scripts/
│   ├── sync-release.mjs    把构建产物同步到 release/（被 npm run release 调用）
│   ├── bump.mjs            一键版本号同步（npm run bump）
│   └── docs.mjs            文档维护：归档/滚动/摘要/守卫/交接（npm run docs [-- --handover|--check]）
├── .claude/agents/       ← SubAgent 定义（quality-gate / repo-scout / mech-editor / feature-coder）
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
