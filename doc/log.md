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

## 2026-07-18 1.0.10 复制净化落地：同步净化 + 内存映射双通道（用户拍板新方案，claude/clipboard-paste-spike-impl）

**做了什么**：

1. **方案翻案（用户认可后定案）**：spike 判死的只是「从 OS 剪贴板读自定义格式」；「是不是我们
   净化过的内容」这一判断改问插件自己——copy/cut 净化时把 `规范化(净化文本) → 原文` 记入**插件
   内存 LRU**，paste 时同步读 `text/plain`（标准格式在 paste 事件语境同步可读，spike 已证）查表，
   命中才 `preventDefault()` + 还原原文。双通道复活，隐藏通道从 OS 剪贴板搬进内存；原「不接管
   paste、O9 降已知限制」的 2026-07-15 裁定被本方案取代。`spec.md` §2.8 整节改写（spike 实测
   保留为历史依据），§2.6「剪贴板投毒」行改记「主动消解已实现」，Roadmap M11 该项勾选。
2. **实现（1.0.10，行为变化已 bump）**：
   - 新增 `src/clipboard.ts`（纯逻辑：`stripWordJoiners`/`stripWordJoinersFromHtml`/
     `normalizeClipboardText`/`ClipboardOriginalCache` LRU，条数 50 + 总字符 2M 上限，仅内存
     不持久化——隐私考量见 spec §2.8）；
   - `main.ts` 接线：`registerClipboardSanitizer`（copy/cut 冒泡监听，主窗口 + window-open
     弹窗；`defaultPrevented` 区分 CM6 编辑器路径=覆写 text/plain+text/html 并记 LRU、阅读模式
     路径=DOM 选区自构造净化 payload 不记 LRU）与 `restoreSanitizedPaste`（editor-paste 五道
     同步守卫：他人已处理 / 未命中 / 目标编号未生效 / 多光标 / 开关关，全过才整段还原原文）；
   - 设置开关 `sanitizeClipboard`（默认开，GeneralTab + i18n 中英 + loadSettings 迁移兜底）；
   - README 双语：「粘贴到其他应用」改为已消解 + 开关位置，「导出与外发」复制行改「已消除」。
3. **测试**：`tests/dev_tests/clipboard.test.ts` 28 例——纯函数 / LRU（含 CRLF 规范化命中、
   逐出与刷新序、超限不驻留）/ O9 内容级回归（还原→重排等价裸文本追加、反例出现 `3 1` 双重
   编号证明还原必要）/ 插件级 copy/paste 守卫矩阵（经 obsidian-mock 直调私有方法）。
   `testplan.md` O8/O9 改写为新方案并升 ⚠️（逻辑已单测、实机待 §7.1），O10 改写降级语义。

**没做什么 / 环境注记**：O4/O8 实机字节检查、O10 移动端实机仍待 §7.1 环境。本机（Windows）有
两处**预存**环境性红灯，与本次改动无关、CI（Ubuntu）为准：① `whitelist.test.ts:406` 排序断言
随本地 ICU collation 失败（stash 干净基线复现）；② `format:check` 对未跟踪 `.codex/`、`.claude/`
配置与部分历史文件报换行符差异。本次触碰的全部文件已单独 `prettier --check` 全绿。

**验证方式**：`clipboard.test.ts` 28/28、`npm run lint`、`test:fuzz` 5000×80、触碰文件
prettier 全绿；`npm test` 除上述预存红灯外全过；合并后以 master CI 结果为最终门槛。

**追记（同周期第二笔提交）**：Release 工作流升级——`gh release create` 的说明优先取仓库内
`doc/release-notes/<tag>.md`（人写双语说明、随代码入库可追溯），缺文件回退 `--generate-notes`；
新增 `doc/release-notes/1.0.10.md`（本版复制净化的用户向双语说明）。动机：本机无 gh CLI，
发布说明走「入库 + CI 发布」通道，顺带沉淀为常设机制。

**本周期派发 3 次（quality-gate × 3）**。

**下一步**：M11 其余项（导出验证矩阵、Canvas O1、E8 拍板、Backlink 审阅模式、H8+清库撤销、
CM6 原子区域）；§7.1 实机环境就绪后回填 O4/O8/O9/O10 实测结论。

---

## 2026-07-15 1.0.9 剪贴板 WJ 净化：paste 端 spike 完成，OS 剪贴板隐藏通道判死（Codex 会话，claude/clipboard-paste-spike-impl；收尾由 2026-07-18 会话补记）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **paste 端真机 spike**：在真实 Obsidian 桌面客户端（Electron 37.10.2 / Chromium
   138.0.7204.251，Windows）DevTools Console 实测四步，结论回填 `spec.md` §2.8：
   - `event.clipboardData.types`（同步）与 `paste` 事件内的异步 `navigator.clipboard.read()`
     **都看不到** `"web "` 自定义格式（只见 `text/plain`）——Chromium 对 paste 事件语境的既有
     安全限制，非本地环境异常；
   - `keydown` 层拦截后事件外 `read()` **能**读到自定义格式（证明写入本身成功），但该方案要求
     无差别接管所有 Ctrl+V 并合成 `paste` 事件（`isTrusted=false`），跨插件兼容风险与功能定位
     不成比例，否决。
2. **范围裁定（用户决策）**：paste 端不接管，只做 copy/cut 端净化；O9（粘贴回同 vault 已编号
   文件的双重编号）降为已知限制。

**没做什么**：未写代码；本周期收尾三件套（log 块 / status 行 / 提交）当时缺失，由 2026-07-18
接手会话补记——**该裁定随后即被 2026-07-18 周期的「内存映射双通道」新方案推翻**，见上一块
（倒序在本块之上）；本块保留 spike 实测事实作为历史依据。

**验证方式**：纯文档改动；spike 结论以 `spec.md` §2.8 回填文本为准。

**本周期派发 0 次**（Codex 会话直接实测）。

**下一步**：按裁定实现 copy/cut 端净化（后被新方案取代，见后续周期块）。

---

## 2026-07-10 1.0.9 剪贴板 WJ 净化：3 个留白问题拍板 2 个（用户指示，claude/clipboard-wj-pollution-mecppf）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **PR #5 已建并订阅**（上一周期，`claude/clipboard-wj-pollution-mecppf` → `master`，草稿）：
   CI 绿、无 review 评论，承接本周期继续讨论。
2. **对 spec §2.8 留白的 3 个问题逐一讨论，定案 2 个、1 个转为「实现周期第一步 spike」**：
   - **copy/cut 端触发判断（定案）**：监听器只能全局挂载（无从预知选区内容），内部第一步做同步
     廉价判断——选区文本 `.includes(WORD_JOINER)` 为假即完全放行、为真才 `preventDefault()` 接管；
     不做「是否完整标题行」的结构解析，净化对任意字符串都成立。
   - **隐藏通道 payload（定案）**：存完整原始选区文本，不用「净化文本+WJ 位置索引」差异编码——
     省空间在此没有真实约束，索引方案想兜底的「外部改过再粘贴回来」场景本该走「找不到隐藏通道
     即当新内容处理」的降级路径，不需要索引介入。
   - **paste 端触发判断 + `clipboard.read()` 权限提示（合并为一个未定案问题）**：
     `preventDefault()` 必须同步调用、但「有没有隐藏通道」的判断要么靠 `clipboardData.types`
     同步可见性、要么靠异步 `read()`——这两条路都没有查到 Obsidian/Electron 环境下的确切行为，
     必须在真实 Obsidian 渲染进程里跑最小 spike 实测，结果直接决定 paste 端最终方案（或降级到
     「只做 copy 端净化、不接管 paste」，但那样会带回「粘贴回已编号 vault 双重编号」的已知回归）。
3. **`doc/spec.md` §2.8 回填三段讨论结论**，把「留给实现周期拍板的问题」从 3 项收窄为 1 项（paste
   端 spike），copy/cut 端与隐藏通道两项已可直接按定案实现，不需要在下个编码周期重新讨论。

**没做什么**：仍未写代码——spike 本身也是下个周期的第一步工作，不在本轮纯讨论周期做。

**验证方式**：纯文档改动，无代码变更；`npm run docs` 归档 + 内部锚点校验。

**本周期派发 0 次**（用户全程直接对话讨论）。

**下一步**：合并本 PR 到 master（用户本轮已指示）；下一个编码周期开工第一步是 paste 端 spike
（验证 `clipboardData.types` 同步可见性 + `clipboard.read()` 权限提示行为），根据结果实现桌面端
双通道 copy/paste 钩子并补单测（重点 O9 双重编号回归），移动端能力探测降级路径同期实现。

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
│   ├── clipboard.ts        剪贴板净化纯逻辑（WJ 剥离/换行规范化/净化→原文 LRU，spec §2.8）
│   ├── pathrules.ts        路径规则 → 模板解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── settings/
│   │   ├── model.ts        设置数据模型（全局开关、防抖延迟、路径规则持久化）
│   │   ├── SettingsTab.ts  设置 GUI 壳：TAB 栏 + 分发（内容在 tabs/，M7 多 TAB 已拆完）
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关、复制净化开关）
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
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A）
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
