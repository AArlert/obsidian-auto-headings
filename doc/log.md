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

## 2026-08-19 i18n 与面板文案全面瘦身（1.1.1）

### 做了什么

用户反馈设置面板与弹窗说明「过于繁琐、文字看得头疼」，本轮把 `src/i18n.ts` 的**全部长文案
（中英双语同步）**压缩为「一眼看出关键句」的精要版：

- **设置项 desc**：`autoNumberDesc` / `debounceDesc` / `updateBacklinksDesc` /
  `headingLinkSuggestDesc` / `vcCoexistDesc` / `vcModeDesc` / 模板编辑各字段 desc /
  白名单 desc / 危险区各 desc 等，删冗余从句与括号补述，只留动作 + 关键警告（如
  「不在撤销历史内」）。
- **分区导语**：`sectionSuggestDesc` 等压成一句；`vcCoexistFallbackHint` 去掉后半句
  「开启联动后即会真让路」（选项行本身已讲）。
- **确认框**：`vcAutoConfirmPoints` 五点各压到一行（保留「上限 2 万条 / 只抬不降 /
  全局项」等关键约束）；`freezeVaultModalBody` 五件事保留①②③④⑤编号但逐条砍到最短；
  `batchModalBody` / `foreignGuardModalBody` 同理。
- **Notice**：`noticeBacklinksIntro` / `noticeClearedAndPaused` / `noticeFrozenVault` 等
  缩短；**测试断言的短语一字未动**（`noticeRenumberedAndResumed` / `noticeNoRule` /
  `noticeClearedVault` / `noticeBatchDone` / `noticeBacklinksUpdated` / 「已清除编号」/
  「词典已截断」等），单测零改动。
- 鸣谢段（About TAB）三条各压成一句，去掉「——」长破折号补述。

英文版逐条镜像中文，删冗余从句与破折号补述，保留全部关键信息（警告/默认值/边界）。

### 没做什么

- **没动任何行为逻辑**：纯文案改动，键集与函数签名不变（`Messages` 接口零改动）。
- 没动短标签/按钮/tooltip（本就精要）。

### 下一步

- 用户真机复测：过一遍设置面板四个 TAB + 各确认框，确认「一眼看清关键句」的观感达标。
- 既有待办不变：P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM 交互；
  M13 收官的「重跑自动配置后打『交』应见两条同名标题」真机复测。

### 验证方式

`npm run format` / `npm run lint` 绿；`npm test` 623 通过，唯一失败仍是
`whitelist.test.ts:406` Windows ICU 已知假红（localeCompare 排序差异，与本次改动无关）；
`npm run bump 1.1.1` 已同步 package.json / manifest.json / versions.json / lockfile /
release/manifest.json；`npm run release` 重建产物入库；写 `doc/release-notes/1.1.1.md`
（双语，发布说明本身也保持精要）并打 tag `1.1.1` 触发 Release 工作流。本周期派发 0 次。

---

## 2026-08-19 M13 收官：同名标题被 VC 的条数上限挤出列表（1.1.0，发版）

### 做了什么

用户实测 1.0.32：同名标题确实都进了 VC 的词典，但**要一路打到「交叉矩阵」全名，
`交叉矩阵.md` 里那条才出现**；短查询（「交」「交叉」「交叉矩」）下只有 `交叉矩阵 (axi)`。

**根因是我上一轮的后缀撞上了 VC 的排序 + 条数上限**（`provider/suggester.ts:304-306` 与 `:319`）：

```ts
if (a.value!.length !== b.value!.length) return a.value!.length > b.value!.length ? 1 : -1;
...
.slice(0, maxNum)   // maxNum = settings.maxNumberOfSuggestions，VC 默认仅 5
```

VC 把**全部来源**（当前文件词 / 全库词 / 自定义词典 / 内部链接）混在一起，按**显示文本长度
升序**排序后直接截断。为绕开 VC 的去重（它对 customDictionary 只比 `value`），同名标题必须带
`(文件名)` 后缀——而后缀让这两条恰好成了最长候选：打「交」时被「交叉」「交叉矩阵」这类短词
挤出前 5；查询越长竞争者越少，才勉强挤进来。**排序键是 VC 写死的，我们无法让带后缀的条目变短。**

修法：自动配置时把 `maxNumberOfSuggestions` **只抬不降**到 `MIN_VC_MAX_SUGGESTIONS = 10`
（用户显式设得更大就尊重原值；字段缺失或脏值按需补齐）。这是本轮唯一能做的补偿，且与
`displayedTextSuffix` 同属 VC 的**全局显示项**——照既有惯例在 `vcAutoConfirmPoints` 单列一条，
写明「全局项，只抬不降」。**只在自动配置时写，不在启动时反复重写**：否则用户日后特意把它调回 5，
每次启动都会被我们覆盖，变成跟用户抢设置。

同时发版 **1.1.0**（M13 首次进入 tag 发布）：写了 `doc/release-notes/1.1.0.md`（双语），
Release 工作流打 tag 时按 `<tag>.md` 取用。

### 没做什么

- **没有缩短区分后缀**去迎合长度排序：后缀是用户拍板的「标题行带 (文件名)」，且
  `descriptionOnSuggestion` 可能被用户关掉，此时它是唯一能分辨来源的东西，不能为排名牺牲。
- **没有在启动同步里重放 VC 设置写入**（见上，会跟用户抢设置）——代价是用户升级后需**重跑一次
  「自动配置」**才能拿到新的上限，这一点已在交付说明里讲明。
- 没有动去重消歧、让路判定、观感对齐（1.0.31 / 1.0.32 的结论均不变）。

### 下一步

- 用户真机复测：重跑一次「自动配置」（确认框应多出「抬高条数上限」那条），然后打「交」即应
  同时看到两条同名标题。
- M13 至此收官。既有待办不变：P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM 交互。

### 验证方式

`npx tsc --noEmit` 干净；`npm test` 623 通过（唯一失败仍是 `whitelist.test.ts:406` Windows ICU
已知假红）——新增 `maxNumberOfSuggestions` 三例（低于下限抬到 10 / 用户设更大时尊重原值 /
schema 校验拒非数字）；`npm run test:fuzz` 5000×80 三块记分板全绿；lint / format:check / release
重建单独复跑。本周期派发 0 次。

---

## 2026-08-19 M13 第七轮：VC 框里补齐同名标题 + 两个建议框观感统一（1.0.32）

### 做了什么

用户实测 1.0.31（VC 启用 + 词典联动开 + 让路生效）后提出三点，并明确了目标：「VC 的候选里既有
VC 自己的也有本插件的标题，同时出现，不管本文件还是其它文件都要有；标题 icon 是 H；不要
`交叉矩阵 => ...` 这种显示」。同时确认「VC 关闭、仅本插件时所有功能都在预期内」。

**先把 VC 侧的机制查清（源码 clone `doc/research/various-complements-src`，只读）**，三条硬约束
决定了哪些能做、哪些根本做不到：

1. **同名标题只出一条 ≠ 我们的 bug**：VC 的 `jsonToWords` 把 `value` / `displayed` **对调**
   （内部 `Word.value` 存的是我们给的 `displayed`，原 value 进 `insertedText`，
   `provider/CustomDictionaryWordProvider.ts:48-57`），而去重谓词 `suggestionUniqPredicate`
   （`ui/suggester.ts:27-45`）对 customDictionary **只比 `value` + type group**，不比
   `createdPath`、也不比 `insertedText` ⇒ 两条 `displayed` 相同的词条必被砍掉一条
   （落点 `ui/AutoCompleteSuggest.ts:602`）。**让 `displayed` 本身不同是唯一规避途径**；
   第二行小字不参与去重，救不回被删那条。
2. **`=> ...` 是 VC 设置项 `displayedTextSuffix` 的默认值本身**（字面量 `" => ..."`，
   `setting/settings.ts:223`），条件是「customDictionary + `insertedText` 非空 + 该设置非空」。
   我们**必须**给 `displayed`（否则 VC 拿整串 `[[...]]` 去匹配，用户打「交叉」根本匹配不上），
   `insertedText` 必然非空 ⇒ 只能置空那个设置。
3. **VC 框的 icon 改不了**：`::before` + base64 SVG，class **只按词条 type** 加，DOM 里没有任何
   per-word / per-dictionary 钩子（`ui/AutoCompleteSuggest.ts:1204-1224`）。想改成 H 只能覆盖整个
   customDictionary 类型的 CSS，**会误伤用户自己其它词典的条目**。VC 也没有任何面向第三方的
   扩展点（无 API、不挂 window、provider 硬编码）。

三点都需用户拍板，用 `AskUserQuestion` 摆出代价后用户定了：**冲突项才加区分后缀 + 下方小字写
来源** / **自动配置时写入清空** / **不覆盖 VC 的 CSS，改把本插件自己的框对齐 VC 的样式**（放弃 H）。

据此落地四件事：

1. **`disambiguateVcDisplayed`（`src/vcintegration.ts`）**：标题全库唯一 → 保持纯净；冲突组 →
   加 `(来源)`。**区分形态按「组」统一决定**——组内文件名互不相同就整组用文件名，只要有重名文件
   就**整组**升级为完整路径。这一条是单测当场逼出来的：初版逐条贪心地各判各的，`x/同.md` 与
   `y/同.md` 会得到「一条 `(同)`、一条 `(y/同)`」的参差列表，用户读不出这是同一维度的区分。
   仍撞（同文件两个同名标题、或与某个纯净标题撞车）→ 挂 ` #2`。后缀只能在**尾部**：VC 首字母
   桶键取 `value.charAt(0)`，前缀化会让「交叉」直接查不到。**先截断到 2 万条再消歧**，否则被
   截掉的孪生项会给幸存者留下一个毫无意义的后缀。
2. **词条加 `description = 路径`**：VC 官方字段，渲染为条目第二行小字，与本插件建议框的
   「标题 / 来源」两行对齐。它受用户全局设置 `descriptionOnSuggestion` 控制（设为 `None` 时不
   显示）——**不代改**（它同时管 internalLink 等，用户可能是刻意关的），改为
   `readVcDescriptionOnSuggestion` 只读探测 + 设置面板如实提示一句。正因为它可能被关掉，
   同名区分才必须落在标题行而不是只靠这一行。
3. **自动配置清空 `displayedTextSuffix`**：`VcSettingsShape` + `isValidVcSettingsShape` 加该字段，
   仿 `applyTriggerThreshold` 新增 `applyDisplayedTextSuffix`（现值非空串才写），活体与文件两条
   写入路径各调一次。这是 VC 的**全局显示项**，`vcAutoConfirmPoints` 单列一条并写明「你其它
   自定义词典的候选也不再带 ` => ...`」；手动模式不写 VC 配置，故在 `vcManualConfirmBody` 补一句
   让用户自己清。
4. **本插件建议框对齐 VC 观感**：`ICON_CANDIDATES` 由 `["heading","hash","link"]` 改为
   `["library","book","heading"]`（书架语义），第二行字号/配色由 `--font-ui-smaller`/`--text-faint`
   改为 VC 的 `0.75em`/`--text-muted`。**刻意不照搬 VC 样式表里的 base64 资产**（第三方资产 +
   署名问题），用 Obsidian 内置 lucide 的同语义图标，顺带自动跟随主题。

### 没做什么

- **没有覆盖 VC 的图标 CSS**（用户否决）：省掉一整块依赖 VC 私有 class 名的脆弱代码。
- **没有用零宽字符做不可见消歧**（用户否决）：能骗过去重且视觉零噪音，但
  `descriptionOnSuggestion=None` 时两条候选长得一模一样、无法选择，且词典文件被看不见的字符污染。
- 没有代改 `descriptionOnSuggestion`，没有碰 VC 的其它设置。
- 没有动让路判定（1.0.31 的三条件不变）、没有动 `MIN_QUERY_LENGTH`。

### 下一步

- 用户真机复测：① 重走一次「自动配置」，确认框应多出「清空显示后缀」那条，确认后 `=> ...` 消失；
  ② 打「交叉」，VC 框里应同时出现 `交叉矩阵 (axi)` 与 `交叉矩阵 (交叉矩阵)`，各带来源第二行，
  且 VC 自己的候选照常在列；③ 关 VC 或切「本插件优先」，看本插件的框是否已换成书架图标 + 对齐字号。
- 既有待办不变：P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM 交互。

### 验证方式

`npx tsc --noEmit` 干净；`npm test` 621 通过（唯一失败仍是 `whitelist.test.ts:406` Windows ICU
已知假红）——新增 `disambiguateVcDisplayed` 6 例（唯一项纯净 / 跨文件同名 / 同名文件不同目录整组
升级 / 同文件重复挂序号 / 与「原文长得像后缀」撞车 / 确定性）+ `buildVcDictionaryJson` 同名场景与
`description` 断言 + `isValidVcSettingsShape` 与 `enableAutoIntegration` 的 `displayedTextSuffix`
四例；同步改了 `main.test.ts` 里断言词典条目形状的旧用例（新增字段属语义变更，必须显式改期望值而
不是只加新用例）。`npm run test:fuzz`（5000×80）三块记分板全绿；lint / format:check / release
重建单独复跑。本周期派发 3 次（Explore ×2 查 VC 词条模型与渲染机制、Plan ×1 出实施方案）。

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
│   ├── pathrules.ts        路径规则 → 模板解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
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
├── README.md             ← 面向读者的简介（核心功能 + Milestone 概览，入口文档）
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A；research/ 本地调研留档、.gitignore 排除不入库，见该目录 README.md）
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
