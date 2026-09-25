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

## 2026-09-25 M14 虚拟编号模式 周期 4（文档部分）：对外文档与发版准备（1.2.0）

交接人：`claude/m14-virtual-mode`

### 做了什么

- **真机补测**：用户确认中文输入法组合正常（V28）；我用电脑操作测了悬浮预览（Ctrl + 悬停 `[[基础#概述]]` 与 `[[基础]]`），
  小节与整篇都按全文编号（V29）。
- **README 中英**：卖点首条改为「可以完全不改文件」；快速上手改为「显示编号、文件不变」；新增「只显示，或者写进文件」
  一节；「全自动编号」按两种模式分述；命令表加「清除本文件残留的插件编号」；FAQ「会往笔记里加隐藏的东西吗？」按
  模式分答、「不想用了」补仅显示直接卸载；**新增 FAQ「占资源吗？」**，只写已核实的事实（`src/` 无网络请求，只有
  关于页的链接；启动时本地读一遍全库标题用于链接建议、可关；标题索引 5 万条、剪贴板缓存约 2MB）。
- **使用指南中英**：新增「两种模式：仅显示与写入文件」一节（对照表、默认值、按文件夹混用、切换确认框、残留、
  手写编号过半、立即重新编号、固化）；订正「无论库多大都没有后台开销 / 从不扫描全库」的旧说法；「工作原理」节
  注明只适用于写入模式；导出节更新（仅显示下内置 PDF 实测带编号）；命令表、干净离开节补仅显示。
- **release notes** `doc/release-notes/1.2.0.md`（双语）。
- **manifest description** 改为「可只显示 / 写入 + 链接跟随」打头（191 字符，M12 该项勾掉），同时勾掉 M12
  「README 资源与隐私承诺」。
- 本周期派发 1 次（quality-gate × 1：收尾 preflight）。

### 没做什么

- **没合并 master、没打 tag**：打 tag 会触发 Release 工作流、向所有用户发布，须用户确认；另一个会话正在 master 上修
  stripPrefix 截断标题的数据丢失 bug（1.1.5），建议等它合并后再合 M14，让 1.2.0 一并带上这个修复。
- 移动端未测。

### 下一步

- stripPrefix 修复合进 master 后：把 master 合进本分支（版本号保持 1.2.0；`log.md` / `status.jsonl` / `testplan.md` /
  `release/` 按两边合并、release 重建；release notes 补一句该修复），跑 preflight + fuzz，再按 §5.1 合并 master。
- 用户确认后打 `1.2.0` tag；Community Hub 索引滞后时去维护者面板点「修复」。

### 验证方式

- `npm run preflight`（见本周期提交前的 quality-gate 报告）。

---

## 2026-09-25 M14 虚拟编号模式：真机实测修复（1.2.0）

交接人：`claude/m14-virtual-mode`

### 做了什么

用户反馈「渲染问题很多，切换和显示有种半掺杂的感觉」，授权我用电脑操作直接在 Oblivion 库里实测。只在新建的
`Claude测试/` 文件夹里操作（规则第 4 行 `Claude测试/` → 仅显示），测了实时预览 / 源码 / 阅读视图、模式来回切换、
确认框、残留、手写编号、复制、PDF 导出、整篇与小节嵌入、2000 标题大文件。发现并修复：

- **阅读视图新旧编号混杂**（「半掺杂」的主因）：Obsidian 只重渲染改过的段落，前面插一个标题后，后面没改的
  段落还挂着旧编号。`readingView.ts` 改为 `VirtualReadingRenderer`：每个含标题的段落登记为 `MarkdownRenderChild`，
  段落重渲染看到新原文、元数据更新、设置变化时，把同一篇的登记段落按各自当前的段落信息原地重新核对；编号 span
  可反复加 / 去，残留前缀去编号时还回文本。设置变化不再整页 `rerender`。参考了 Heading Decorator 的段落登记机制
  （MIT，只借鉴思路）。
- **源码模式显示虚拟编号**：会让人以为编号写进了文件。改为只在实时预览显示（`editorLivePreviewField`）。
- **手写编号**：原先只要一个标题像手写编号，整篇就不显示，而仅显示模式永远没有解除的出口（`## 2024 总结`
  就能卡死）。改为过半判定 `isMostlyForeignNumbered`；被拦下时打开文件弹仅显示版提示，清理框只剥不写。
- **「已清除 0 个文件」**：只有「仅显示 → 写入」时也跑了清除并提示。没有离开写入的文件就不清除、不提示；
  确认框的清除开关也只在有文件离开写入时才默认打开。
- **小节嵌入从「一」重数**：段落信息只含片段。新增 `locateSection`：与文件全文比对，是其中一段就按全文算并加
  行号偏移，对不上按文本兜底。
- 真机确认正常的：新增 / 删除标题后编辑视图即时更新、确认框计数、切换写入 / 仅显示时已打开文件只显示一层编号、
  清除只剥插件编号、残留虚线提示、复制不带编号、PDF 带编号、大文件流畅。
- 测试：`virtual-render.test` 重写阅读视图部分（段落登记、插入标题回归、删除标题回归、设置刷新、卸载、小节
  嵌入、`locateSection`），`cleanup.test` +4（过半判定），`main.test` +3。反向验证：去掉「看到新原文就重新核对」，
  插入标题回归用例变红。
- 本周期派发 1 次（quality-gate × 1：收尾 preflight + fuzz）；实测与修复由主模型完成。

### 没做什么

- 中文输入法组合：本机输入法被系统切到 ENG，电脑操作切不回来，留给用户手测。
- 悬浮预览、移动端没测。
- 确认框在用户主题下半透明（背后文字透出），原有批量重编号确认框也一样，判断为主题问题，未改。
- 发现用户库里 `templates/` 有 `default.json` 与 `default(1).json` 两个同名「默认」模板（疑似 iCloud 冲突副本），
  未处理，已告知用户。

### 下一步

- 用户手测输入法、悬浮预览、移动端；没问题就进周期 4（README / 使用指南 / release notes / 合并 / tag）。
- 用户测试完可以删掉 `Claude测试/` 文件夹和第 4 条规则。

### 验证方式

- `npm run preflight`（见本周期提交前的 quality-gate 报告）；真机见上。

---

## 2026-09-25 M14 虚拟编号模式 周期 3：设置界面与模式切换（1.2.0）

交接人：`claude/m14-virtual-mode`

### 做了什么

- **模式切换的纯逻辑**（新建 `src/virtual/modeSwitch.ts`）：`diffNumberingModes(before, after, paths)` 比较改动前后
  每个文件的有效模式，得出 `toVirtual` / `toNone` / `toWrite`；不区分入口（改下拉框、删规则、改路径、改「不编号」、
  拖拽），天然排除被更具体规则覆盖的文件。`cloneRules`、`isQuietTransition`。
- **main.ts**：批量通道重构成接收变换函数的 `batchRewrite`（编辑器事务 / `vault.process` 两条通道不变，含 backlink
  同步），`renumberFiles` 与新的 `clearPluginNumberingInFiles` 共用；`batchRenumberRule` 改用 `renumberFiles`。
  新增 `planModeTransition`（「离开写入」只计真有插件编号的文件，内容优先取已打开编辑器）与
  `applyModeTransition`（按勾选清除 / 立即写入，链接 Notice 汇总一次）。`cleanup.ts` 新增 `hasPluginNumbering`。
- **设置界面**（`settings/tabs/PathRules.ts`）：每行加「模式」下拉框（写入文件 / 仅显示，「不编号」行置灰）；
  「仅显示」行的批量重编号置灰；所有改规则的操作统一走 `commitRules`：在副本上试改 → 有文件换模式就弹
  `ModeTransitionModal`（两个开关：清除本插件写入的编号 / 立即写入）→ 确认后才替换设置、落盘、执行；取消或
  Esc 规则原样。改路径时没改动就不存盘。新规则的模式跟随根规则。表格加一列（CSS 网格与最小宽度）。
- i18n 新增 13 个 key；固化按钮说明补「仅显示的编号会随之消失」。spec §3.22 补「实现（周期 3 定稿）」。
- **测试**：新建 `modeswitch.test.ts`（6 条）；`main.test` +4（规划只列真有编号的文件、清除只剥插件编号且不碰更具体
  规则、链接跟随、不勾清除则不动、立即写入）。
- 已部署到用户测试库。本周期派发 1 次（quality-gate × 1：收尾 preflight）。

### 没做什么

- 确认框、下拉框的真机交互没验证；周期 2 的渲染也还在等用户实测反馈。
- 对外文档（README、使用指南、release notes）在周期 4。

### 下一步

- 等用户真机反馈（渲染 V27–V31 + 设置界面切换 V15–V19），按反馈修；然后周期 4：README / 使用指南 / release
  notes 1.2.0、合并 master（注意与 stripPrefix 修复分支的版本号与 docs 冲突）、打 tag。

### 验证方式

- `npm run preflight`（见本周期提交前的 quality-gate 报告）；真机按下一步清单。

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
│   ├── pathrules.ts        路径规则 → 模板 / 编号模式解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── virtual/            虚拟编号模式（M14，只显示不写文件，spec §3.22）
│   │   ├── compute.ts      纯逻辑：每个标题的显示编号 + 残留前缀区间 + 自动路径门控 resolveNumberingAction
│   │   ├── editorExtension.ts 编辑视图：CM6 ViewPlugin + 编号 widget + 重算信号（纯函数 buildVirtualDecorations）
│   │   ├── readingView.ts  阅读视图：markdown post-processor + 缓存 + 兜底匹配
│   │   └── modeSwitch.ts   规则变动引起的模式切换：改动前后逐文件比较有效模式（纯函数）
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
├── README.md / README.zh.md ← 商店门面（卖点 + 上手 + 命令 + FAQ，技术细节下沉 doc/user-guide*.md）
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + user-guide(.zh).md 面向用户的完整使用指南 + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A；research/ 本地调研留档、.gitignore 排除不入库，见该目录 README.md）
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
