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

## 2026-09-25 M14 虚拟编号模式 周期 2：渲染（1.2.0）

交接人：`claude/m14-virtual-mode`

### 做了什么

- **编辑视图**（新建 `src/virtual/editorExtension.ts`）：CM6 ViewPlugin。标题正文起点放编号 widget（`side: 1`，
  参照 Heading Decorator 在实时预览里的放法）；残留前缀用同一 widget `Decoration.replace` 替换并标残留样式，
  且登记为原子区（光标整体跨过）；不编号标题上的残留**不藏**。文档变化先 `map`，100ms 去抖后自发
  `virtualRefreshEffect` 重算；`view.composing` 期间顺延；编辑器换了文件立即重算，不映射上一篇的编号。
  「编号 → DecorationSet」是纯函数 `buildVirtualDecorations`。
- **阅读视图**（新建 `src/virtual/readingView.ts`）：post-processor 按 `getSectionInfo` 行号取编号并核对元素级别；
  按路径缓存上次原文、字符串比较命中；拿不到段落信息时读文件、按文本唯一命中兜底；残留前缀从第一个文本
  节点去掉（尾哨兵被毁则不画）。`NodeFilter.SHOW_TEXT` 写成常量，node 可测。
- **接线**（`main.ts`）：注册两个扩展；`refreshVirtualViews()` 向所有编辑器 dispatch 重算信号、阅读视图
  `rerender(true)`，挂在 `saveSettings`、`renumberActiveFile`（改模板 / 规则）、`onExternalSettingsChange`、
  清库与固化结束、仅显示文件的「立即重新编号」；新命令「清除本文件残留的插件编号」（`editorCheckCallback`，
  只在仅显示文件里出现，走 `clearPluginNumberingContent` + backlink 同步，不暂停）。
- `compute.ts` 的输出补 `level` / `text` 字段；`styles.css` 加 `.ah-virtual-number`（跟随标题、不可选中）与
  `--stale`（虚线下划线 + 悬停说明）；i18n 四个新 key；obsidian-mock 补 `registerEditorExtension` /
  `registerMarkdownPostProcessor` / `editorInfoField`。
- **测试**：新建 `virtual-render.test.ts`（13 条：装饰位置、残留替换、白名单残留不藏、map 后不漂移、越界、
  按行 / 按文本匹配、假 DOM 上的插入与残留剥离、缓存只算一次、兜底、门控不放行）；`main.test` +3（清除残留
  命令两条、刷新广播）。
- 已部署到用户测试库。本周期派发 1 次（quality-gate × 1：收尾 preflight）。

### 没做什么

- 没有 UI：规则的模式下拉框、切换确认框都在周期 3。真机测试要先手动在 data.json 里给规则加 `"mode": "virtual"`。
- 视觉、光标、输入法、PDF 导出、移动端、大文件性能都还没真机验证。

### 下一步

- 用户真机验 V27–V31（实时预览 / 源码 / 阅读视图、输入法、复制、PDF、嵌入与悬浮预览）；根据结果调整
  widget 位置或样式。
- **周期 3**：路径规则行的模式下拉框、切换确认 Modal（含删规则 / 改路径 / 改不编号入口）、固化按钮说明。

### 验证方式

- `npm run preflight`（见本周期提交前的 quality-gate 报告）；真机按下一步清单。

---

## 2026-09-25 M14 虚拟编号模式 周期 1：模型 + 纯逻辑 + 门控（1.2.0）

交接人：`claude/m14-virtual-mode`

### 做了什么

- **数据模型**（`src/pathrules.ts`）：`PathRule.mode?: "write" | "virtual"`（缺省即写入，零迁移）；`ruleMode`、
  `resolveNumberingMode`（与 `resolvePathRule` 同一套具体度，「不编号」/ 无规则返回 null）、`normalizeRuleModes`
  （非法值删字段）。
- **新装判据**（`main.ts` `loadSettings` / `isFreshInstall`）：data.json 为空且没有 `templates/` 才算新装，根规则设
  `virtual`（`settings/model.ts` 的 `freshInstallPathRules`）；只改内存不落盘；探测失败按升级处理。新增
  `onExternalSettingsChange`（同步改写 data.json 时重新载入）。`pluginDir()` 抽成方法，onload 注释写明
  loadSettings 必须先于 `templateStore.init()`，并有源码顺序锁测试。
- **写入隔离**：新增 `shouldAutoWrite(content, path)` = `shouldAutoTrigger` 且非仅显示文件，替换全部 6 处自动路径
  判断（防抖、到期复核、打开即编号、改模板即时重排、粘贴还原、清除命令的暂停判定）。仅显示文件于是自动落到
  backlink 独立同步分支，**没新写同步路径**。「立即重新编号」对仅显示文件只弹说明；批量重编号跳过被仅显示
  规则覆盖的文件。
- **纯逻辑**（新建 `src/virtual/compute.ts`）：`computeVirtualNumbers`（显示编号 + widget 位置 + 残留前缀区间，只认
  WJ 打头的前缀）、`resolveNumberingAction`（自动路径门控，渲染器与 UVM 共用）；`main.ts` 的
  `virtualNumberingFor(path, content)` 供周期 2 渲染器调用（含外来编号拦截）。
- **新清除函数** `clearPluginNumberingContent`（`cleanup.ts`）：只剥 WJ 打头的插件前缀，手写编号、标题中间的 WJ
  （链接）、围栏里的残留都不动，不碰 frontmatter。
- i18n：`noticeVirtualModeFile` 中英各一。devDependencies 显式锁 `@codemirror/state` 6.5.0 / `view` 6.38.6。
- **规格订正两处**（spec §3.22、testplan V11 / V24，核对代码后发现周期 0 写错了）：
  - frontmatter `true` 压不过「不编号」规则（K15 既有行为），不是「跟随根规则模式」；
  - 「固化编号」照常处理仅显示文件（它们里面指向写入文件的链接也带 WJ，跳过会断链），代价是仅显示的编号随
    插件离场消失，按钮说明要写清楚。
- **测试**：`virtual.test.ts`（新，13 条）、`settings`（+8：判据 / 不落盘 / 同步重载 / 顺序锁）、`pathrules`（+4）、
  `cleanup`（+7）、`main`（+9：不写 / 链接跟随 / Notice / 批量跳过 / 清除不暂停 / 门控 / 外来编号）、
  `clipboard`（+1 粘贴不还原）。UVM 加 `setRuleMode` 激励与**虚拟记分板**（显示编号 = 写入模式会写的前缀、
  文件不被改写、门控同源），覆盖率新增 3 个 bin。两处反向验证：去掉仅显示判断 → 5 条红；故意让显示编号出错 →
  UVM 两条序列红。
- **顺带发现一个已上线的数据丢失 bug**（与 M14 无关）：标题中间带 WJ 链接时，`stripPrefix` 把 WJ 之前的正文当旧
  单哨兵前缀截掉（`## 参见 [[a#…1 …概述]]` → `## 1 1 概述]]`）。已开独立任务处理，本分支的新代码已绕开。
- 已部署到用户测试库（Oblivion）。本周期派发 1 次（quality-gate × 1：收尾 preflight + fuzz）。

### 没做什么

- 没有任何渲染（周期 2），所以装上 1.2.0 的新库暂时**看不到编号**；老库（有 templates/）行为不变。
- 没有 UI（mode 下拉框、切换确认框，周期 3）。

### 下一步

- **周期 2**：`src/virtual/editorExtension.ts`（CM6 widget + 残留 replace + 输入法暂停 + 广播刷新）、
  `readingView.ts`（post-processor + 字符串比较缓存 + `getSectionInfo` 兜底）、样式、「清除本文件残留编号」命令。

### 验证方式

- `npm run preflight` + `npm run test:fuzz`（结果见本周期提交前的 quality-gate 报告）。
- 真机：老库升级到 1.2.0 行为应与 1.1.4 完全一致（写入模式照常编号）。

---

## 2026-09-25 M14 虚拟编号模式 周期 0：计划审计 + 文档先行（1.1.4，纯文档不 bump）

交接人：`claude/m14-virtual-mode`

### 做了什么

- **审计远端交来的计划** `doc/plan-m14-virtual-mode.md`：派 repo-scout 逐条核对源码引用（13 处全部属实），
  对照竞品商店数据与 README 复核（2026-09-25：Heading Decorator 5,388 纯显示、计划原先漏了它；gurjar1 2,406
  虚拟非默认、只在编辑器里显示；Number Suite 355；Heading Keeper 54 默认虚拟，作者即 PR #8 贡献者）。
  修订了 7 处设计，先单独提交（`c8fe091`），要点：
  - 模式切换清除**不复用**清除命令路径（会剥手写编号、会写 `fm:false` 关掉虚拟渲染、走 `vault.modify`
    有 H8 同类竞态），改为新纯函数 `clearPluginNumberingContent`（只剥 WJ）+ 批量通道（已带 backlink 同步）；
  - 删规则 / 改路径 / 改「不编号」也会让文件落到仅显示模式，同样弹确认框；残留前缀不许悄悄盖掉，
    要有 stale 样式提示 + 单文件清除命令；
  - 新装判据补多设备同步竞态对策（新装不立即落盘 + `onExternalSettingsChange`）；核实 `loadSettings`
    （main.ts:169）先于 `templateStore.init()`（190），判据可用，要加顺序锁测试；
  - frontmatter `true` 碰上「不编号」规则时跟随根规则模式；
  - 输入法组合期间暂停重算；阅读视图缓存改字符串比较、补 `getSectionInfo` 为 null 的兜底；
  - README 原定的「从不在后台扫描全库」**不成立**（`buildInitialHeadingIndex` 启动时读全库），改如实口径；
  - 大纲面板从「做不到」改为「一期不做」；周期 1 即 bump 到 1.2.0。
- **周期 0 文档先行**：
  - `spec.md`：§2.2 非目标翻案；新增 §3.22「虚拟编号模式（M14）」（设计定案全文）；目录补 3.20–3.22；
    §5 Roadmap 重排（M14 → M11 → M12 → M8a → M8b → M10 → M13），新增 Milestone 14 节（5 个周期清单 + 二期候选）；
    M9 的「虚拟编号模式」「只读装饰预览」两条并入 M14 只留指针，新增候选「把虚拟编号一次性烧录成纯文本」；
    M12 新增「内置三套预设模板」「README 资源与隐私承诺」；附录 A.8.5 / A.9 同步。
  - `testplan.md`：新增 V 组 V1–V32，全部 🔲。
  - 按单一事实源纪律**删除** `doc/plan-m14-virtual-mode.md`（内容已全部落进 spec §3.22 与 Roadmap M14）。
- 本周期派发 2 次（repo-scout × 1：计划源码引用核对；quality-gate × 1：收尾 preflight）。

### 没做什么

- 没写任何代码，没 bump（纯文档）。
- 竞品只读了 README 与商店统计，没深读源码（Heading Keeper / Number Suite 的实现细节留待周期 2 渲染时按需参考）。

### 下一步

- **周期 1**（见 spec Roadmap M14）：`PathRule.mode`、新装判据与延迟落盘、`onExternalSettingsChange`、
  `resolveNumberingMode`、`src/virtual/compute.ts`、`shouldAutoTrigger` 对虚拟文件返回 false、
  `clearPluginNumberingContent`；配套单测与 UVM oracle；`npm run bump minor` → 1.2.0；跑 `test:fuzz`。

### 验证方式

- `npm run preflight` 全绿（纯文档改动）。

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
│   │   └── readingView.ts  阅读视图：markdown post-processor + 缓存 + 兜底匹配
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
