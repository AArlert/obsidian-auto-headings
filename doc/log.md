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

## 2026-07-10 1.0.9 剪贴板 WJ 净化：技术选型定案（用户指示，claude/clipboard-wj-pollution-mecppf）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **承接上一周期的遗留讨论**（剪贴板 WJ 污染净化，见 status 首行 `next`）：本周期继续只讨论
   方向，验证了「插件能否识别被清除 WJ 的内容」这一悬而未决的前提——答案是**不能安全识别**：
   `hasUnclaimedForeignNumbering`（`src/cleanup.ts:112-118`）的外来编号探测是**全文件级**的，
   只要目标文件别处还有一个 WJ 就不生效；净化后的无 WJ 内容粘贴进已编号 vault 会被 `stripPrefix`
   当纯正文、叠加新前缀，产生 `## 2 1 标题` 式双重编号（与 U1/U2/J10 系列历史 bug 同构）。据此
   否决了「单通道净化」（复制时无条件清 WJ），转向「双通道」方向。
2. **摸清双通道的技术选型**（WebSearch 调研 + 用户拍板）：
   - Electron 原生 `clipboard.writeBuffer` 一次只挂一个自定义格式、与 `writeText` 无法原子共存
     （Electron issue #41462 未解决），**不适用**。
   - 改用标准 Async Clipboard API（`navigator.clipboard.write` + `ClipboardItem`），自定义格式走
     `"web "` 前缀（Chrome 104+，Obsidian Electron 内核远超此版本），对外部应用默认不可见。
   - Obsidian 官方论坛确认插件在 Android/iOS WebView 沙箱内写自定义剪贴板数据默认被拦截——
     **移动端只能靠运行时能力探测 + 静默完全跳过**，不能退化成单通道（会重现①的双重编号 bug）。
3. **设计落盘 `doc/spec.md` §2.8「剪贴板净化设计」**（新增小节，2.6/2.7/目录/Roadmap M11「复制
   净化开关」条目同步链接）：范围边界（只覆盖交互式 `copy`/`cut`，不含 Pandoc/静态站点生成器/
   Publish 等文件级导出——那类工具直接读磁盘、不经过剪贴板事件，已由 M11「导出验证矩阵」与附录
   A §A.5 单独覆盖）、copy/paste 两端设计、移动端能力探测降级、降级默认值（任何一步失败一律不
   介入、维持现状，不做单通道半吊子方案）、三个留给实现周期拍板的未决问题。
4. **`doc/testplan.md` §O 补场景**：O8（桌面端外部粘贴净化）/ O9（粘贴回已编号 vault 验证双通道
   避免双重编号）/ O10（能力探测失败静默跳过），O4 改写为指向三者的入口行。

**没做什么**：仍未写任何代码——用户本轮要求「先规划如何开工、文档写好」，不是实现。三个「留给
实现周期拍板」的问题（触发范围、隐藏通道 payload 内容、`clipboard.read()` 是否弹权限提示）故意
留白，等下一个编码周期在真实 Obsidian 渲染进程里边做边定，不在纯设计阶段瞎猜。

**验证方式**：纯文档改动，无代码变更，不适用 `npm test`/`lint`；`npm run docs` 归档 + 内部锚点
校验（新增 §2.8 锚点 `#28-剪贴板净化设计m11复制净化开关技术选型2026-07-10-定案未实现` 与
Roadmap/testplan 三处引用手动核对一致）。

**本周期派发 0 次**（用户全程直接对话讨论 + 主模型自己读代码验证 `hasUnclaimedForeignNumbering`
判据范围，未派 SubAgent）。

**下一步**：进入实现周期——按 spec §2.8 设计实现桌面端双通道 copy/paste 钩子，拍板三个留白问题，
补 `tests/dev_tests/` 单测（重点覆盖 O9 的双重编号回归）与 O8/O10 的实机验证方式；testplan O8–O10
状态回填。其后回到 M11 其余项（导出矩阵、Canvas O1、E8、审阅模式、H8+清库撤销、CM6 原子区域）。

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
