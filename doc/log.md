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

## 2026-07-10 1.0.9 Backlink 两开关合一（用户指示，claude/backlink-switch-consolidation-j7mol6）

**做了什么**：

1. **设置模型合并**（`src/settings/model.ts`）：删除 `backlinkStandaloneTrigger` 字段与
   `DEFAULT_SETTINGS` 对应默认值；`updateBacklinks` 字段注释改为「全局生效，与是否命中编号模板 /
   是否实际写入编号无关」。
2. **触发逻辑合并**（`src/main.ts`）：`shouldBacklinkStandaloneTrigger` 判据从
   `!backlinkStandaloneTrigger || !updateBacklinks` 简化为仅 `!updateBacklinks`——独立于编号模板的
   触发路径（CR-18）不再需要额外 opt-in，随总开关一起全局生效；仍受 frontmatter `false` 与
   `vaultClearInProgress` 约束（未变）。`loadSettings` 迁移逻辑删掉旧字段的默认值回填，改为
   `delete merged.backlinkStandaloneTrigger` 清理存量 data.json 里的死字段。
3. **GUI 精简**（`src/settings/tabs/GeneralTab.ts` + `src/i18n.ts`）：删除第二个开关
   「无模板/未编号时也同步链接」（`backlinkStandaloneTriggerName/Desc`，中英文接口 + 两语言实现）；
   保留的「同步内部链接（Backlink）」开关描述改写为说明「全局生效，与是否编号无关」，用户不再需要
   理解两层开关语义。
4. **测试同步**（`tests/dev_tests/main.test.ts`）：测试辅助 `PluginInternals`/`makePlugin` 选项删除
   `backlinkStandaloneTrigger` 字段；原「M19–M25」用例矩阵重写为「M20–M25」——M19（独立触发关+无模板）
   与 M23（总开关关）语义合并（现在只有一个总开关，关闭即两种效果都不触发），其余用例改为断言单开关
   下的全局生效行为，不再传 `backlinkStandaloneTrigger` 选项。
5. **文档同步**：`doc/spec.md` §3.12 三处（`updateBacklinks` 设计原则段、CR-18 详述段、CR-18 表格行）
   + Roadmap M12 打勾项，改写为「1.0.8 落地独立开关 → 1.0.9 并入单开关」的演变叙事，说明两层开关是
   「无谓认知负担」；`doc/testplan.md` §M 开头 blockquote + M19–M26 场景行同步重写，删除 M19（并入
   M23）与 M26（GUI 面板行，因第二个开关已不存在）。

**没做什么**（用户明确本轮范围之外）：剪贴板 WJ 污染问题（复制到 Obsidian 外应清除所有 WJ 标记、
复制到 Obsidian 内应保留 WJ 以便识别「这是本插件已编号的内容」避免重复编号）本轮**只讨论不动代码**——
用户原话「干净导出属于讨论任务」。现状：`main.ts` 依旧无任何 `clipboard`/`copy`/`paste` 事件钩子
（`repo-scout` 定位确认），该问题连「插件能否识别被清除 WJ 的内容」这一前提都未探明，留待后续周期
单独立项讨论（候选落点：spec.md §2.6 已知生态兼容性风险 或 M11 信任包「复制净化」项，见 status.jsonl
`next`）。

**验证方式**：`npm test`（359 通过）/ `npm run lint` / `npm run format:check` 三项全绿（quality-gate
子代理跑的收尾档）；`npm run release` 重建 `release/` 三件套 + zip，`tsc -noEmit` 随 build 隐式过一遍
类型检查（设置模型删字段后接口收窄，若有遗漏引用会在此处报错，实测无报错）。未做 Obsidian 内实测
（远程环境无 GUI，纯代码 + 单测层面验证）。

**本周期派发 2 次**（repo-scout ×1 定位两开关与 WJ 剪贴板现状、quality-gate ×1 收尾档 test+lint+format）。

**下一步**：M11 信任包内「复制净化」讨论——需要先探明「插件能否从被清除 WJ 的编号标题正确识别/恢复
编号状态」这一前提是否成立，成立的话方案可以简化（无需区分粘贴目的地，插件自适应识别即可）；不成立
再回到「复制到 Ob 内保留 WJ / 复制到 Ob 外清除 WJ」的双路径设计。

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
