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

## 2026-08-19 Community Hub 审核修复（1.1.3）

### 做了什么

用户贴出 Obsidian Community Hub 自动代码检查报告（1 error + 5 warning），逐条核实现状后修复
真正仍存在的问题（发现报告本身**部分过期**——ForeignNumberingCleanupModal.ts / PathRules.ts /
WhitelistEditor.ts 的多处 `prefer-create-el` 位置当前代码早已用 `createEl`，报告引用的是旧快照，
应与 [[obsidian-community-hub-distribution]] 记录的 Community Hub 索引滞后是同一根因）：

- **`no-static-styles-assignment`（error，阻断项）**：`VcIntegrationSection.ts` 复制回退用的临时
  textarea 两行 `.style.x=` 改 `setCssStyles`；顺手排查全仓库 `.style.` 赋值，额外发现报告**未提及**
  的 `PathSuggest.ts`（路径建议弹窗定位，3 行）同类写法一并改掉，避免下次扫描再次因同一条规则挂掉。
- **`prefer-create-el`（warning）**：核实后仅 3 处仍是真问题——`VcIntegrationSection.ts:28`
  （随上面一起改，`document.body.createEl` 顺带消掉一次多余的 `appendChild`）、`WhitelistEditor.ts:129`
  （行内编辑输入框，改用 `row.createEl(...)` 而非 `activeDocument.createElement`——`row` 就是
  `textEl` 的实际父节点，同文档无歧义，`replaceWith` 同步执行不会闪烁）。`main.ts:2152`
  （`renderSelectionHtml` 的分离容器）**特意保留不改**：该函数以 `doc: Document` 为形参正是为了
  单测可注入 mock（`clipboard.test.ts`「阅读模式路径」用例），而单测环境 `vitest.config.ts` 是
  `environment: "node"`、`obsidian-mock.ts` 不提供全局 `createEl`——换了会让该用例静默退化（异常
  被 `sanitizeClipboardEvent` 的降级 catch 吞掉，`preventDefault`/`setData` 都不会发生）。已在代码
  加注释说明，接受这一条 warning 长期挂着。
- **`editor-paste` 的 `defaultPrevented` 检查 + `preventDefault` 位置（warning ×2）**：根因是检查
  工具做不了跨函数静态分析——真实逻辑早就正确（`restoreSanitizedPaste` 内部本就先判
  `defaultPrevented`、只在全部守卫通过时才 `preventDefault`），只是这层判断裹在私有方法里、
  检查工具看不见注册处那个箭头函数字面量里有没有这两行。改法：注册处内联 `defaultPrevented`
  前置判断 + 按 `restoreSanitizedPaste` 返回值决定是否 `preventDefault`；方法本身改回返回
  `boolean`（原为 `void`），**内部仍保留一份 `defaultPrevented` 早退**（防御性冗余，换来该方法被
  单测直接单独调用时仍安全——见下）。
- 同步改了 `tests/dev_tests/clipboard.test.ts`：本地 `ClipboardInternals` 接口的
  `restoreSanitizedPaste` 返回类型 `void → boolean`；「全守卫通过」用例把
  `expect(evt.defaultPrevented).toBe(true)` 改成断言返回值（该方法自己不再触发
  `preventDefault`，那是调用方注册处的职责）。其余 9 个 O9 守卫矩阵用例逐条核对过，均不依赖
  「方法自身调用 preventDefault」这个已变化的细节，未改。
- `getSettingDefinitions()`（warning，SettingsTab.ts:40，Obsidian 1.13.0 新增声明式设置搜索
  API）**判断为超出本次范围，未实现**：读了已安装的 `node_modules/obsidian/obsidian.d.ts`
  确认真实签名——一旦 `getSettingDefinitions()` 返回非空数组，Obsidian 1.13+ 就**不再调用**
  `display()`，整页改由声明式定义渲染；本插件设置页现状是 4 个手写 TAB（含路径规则表、
  可行内编辑/带命中角标的白名单编辑器等高度动态 UI），贸然只声明部分设置会让未声明的部分在
  1.13+ 用户面前直接消失，是真实破坏性风险而非纯新增。API 本身留了退路——
  `SettingDefinitionPage.page?: () => SettingPage` 允许某个子页保持命令式渲染（`SettingPage`
  是 `abstract class { containerEl; abstract display(): void }`，形状与现有 `renderXxxTab(tab,
  containerEl)` 函数很接近，理论上可行），但四个 TAB 该拆成纯声明式 / 保留命令式 page、
  manifest 最低版本 1.8.7 意味着 `display()` 兜底还得长期共存——这是架构决策，留给用户拍板
  是否值得开一个新 Milestone，本周期只记录调研结论，不擅自实现。
- 质量门槛：`npm run build`（tsc + esbuild）、`npm run lint`（eslint）全绿；`npm test`
  636/637——唯一失败是 [[windows-env-quirks]] 记录的 `whitelist.test.ts:406` zh-CN locale
  排序环境伪影，与本次改动无关，`clipboard.test.ts` 30/30 全过（含改动最直接触及的「全守卫
  通过」「他人已 preventDefault」两条）。本周期派发 1 次（quality-gate × 1，验证本次改动）。

### 没做什么

- 未实现 `getSettingDefinitions()`——原因见上，判断为独立 Milestone 量级的架构决策。
- 未处理 `main.ts:2152` 的 `prefer-create-el` warning——原因见上（单测可注入性 vs lint 合规的
  取舍，已判断为不值得，代码内联注释说明）。
- 未改任何用户可见行为——本周期全部改动是 DOM 构造方式 / 内部函数签名的等价重构，不涉及
  编号、Backlink、剪贴板还原等功能逻辑本身。
- 未验证 Community Hub 重新扫描后是否真的转绿——这需要 tag/Release 真正发布后由 Community
  Hub 侧重新抓取，本机看不到。

### 下一步

- 已 `npm run bump` → `1.1.2 → 1.1.3`（纯合规修复，无用户可见行为变化，但 Community Hub 的
  审核大概率是照已发布 Release 的内容扫描，1.1.2 的 tag 已指向旧提交，不出新版本这批修复它
  看不见——判断为需要新 tag 才能让审核转绿，而非常规「仅行为改动才 bump」的例外）。已写
  `doc/release-notes/1.1.3.md`（双语，如实说明「无用户可见行为变化，修复审核发现」）。
- 待 `npm run preflight` 全绿后提交 + 打 `1.1.3` tag 并推送，`release.yml` 会自动创建 GitHub
  Release（同 1.1.1/1.1.2 的自动化路径，见上一块记录）。
- 用户可在打完 tag 后回 Community Hub 维护者面板重新触发检查，确认这批修复真的清掉了对应
  条目（本机没有手段验证 Community Hub 侧的重新扫描结果）。
- `getSettingDefinitions()` 迁移：若用户认为值得做，建议开新 Milestone（当前最大到 M13），
  按上面记的 API 形状（`SettingDefinitionPage.page` 命令式子页 + `display()` 长期共存）评估
  工作量再排入 Roadmap，不建议下个周期直接动手实现。

### 验证方式

- `npm run build` / `npm run lint` 全绿；`npm test` 636/637（唯一失败为既有 locale 环境伪影，
  基线同样失败）；`clipboard.test.ts` 30/30（quality-gate 代跑，见本块「做了什么」的门槛记录）。
- `main.ts` 的 `restoreSanitizedPaste` 契约变化（`void → boolean`，`preventDefault` 调用点从
  方法内部移到调用方）逐条核对过全部 10 个「paste 端守卫矩阵」用例：仅 1 个直接依赖旧契约
  （已同步改断言），其余 9 个不受影响。
- VcIntegrationSection / PathSuggest / WhitelistEditor 三处 DOM 构造改动**无自动化测试覆盖**
  （这几个渲染函数向来是仓库既定的手验范围，`obsidian-mock.ts` 的 `PluginSettingTab.display()`
  与 `Modal.open()` 都是空实现，见该文件注释）——只靠人工审代码逻辑确认等价，建议用户在真机
  过一遍：复制词典路径按钮、白名单词条点击行内改名、路径规则输入框的建议弹窗定位。

---

## 2026-08-19 M27：PR #8 审核与合入前修复（1.1.2）

### 做了什么

外部 PR #8「feat: 支持 Markdown 标题链接同步」（@nestealin，单 commit `d29c8eb`，21 文件 +718/−134）
完成两轮独立审核（quality-gate 实测门槛 + 独立深度审查逐函数验证），结论「功能扎实、可合入」，
但发现 1 个已实测的性能必改项与 3 个低危语义偏差，按用户指示修复后合入 master：

- **O(L²) 性能修复（必改）**：`rewriteMarkdownBacklinks` 对「单行大量未闭合 `[` / `[x](`」的病理输入
  逐候选重扫到行尾（实测单行 10 万 `[` → 8.2s，2 万 `[x](` → 1.8s，该函数跑在 `vault.process` 写回路径上）。
  改为**行级配对表**（`buildBracketPairs` / `buildParenPairs`，`src/backlinks.ts`）：一次线性扫描为整行
  所有 `[`→`]`、`(`→`)` 算好配对（转义 / 嵌套 / `<...>` / 引号 title 语义与原逐候选扫描逐字符一致），
  主循环查表 O(1)；修复后 2 万未闭合 `[` 毫秒级。
- **`[[wikilink]](text)` 双改写（低危）**：主循环遇 `[[…]]` 整段跳过（wikilink 已由 `WIKILINK_RE` 先行
  处理），括号段按字面文本保留，计数不再重复（此前 `[[Target#旧]](Target.md#旧)` 双通道各改一次）。
- **`%%…%%` / `<!--…-->` 注释区（低危）**：新增 `commentRanges` 并入排除区（与 scan.ts 注释状态机
  同语义：`%%` 优先、未闭合延伸到文件尾、围栏内状态冻结）；注释内链接不改，注释同行结束后链接照常改。
- **未闭合反引号（低危，保持现状）**：偏差方向（改了渲染为代码的文本）写进 `inlineCodeRanges` 注释明示。
- testplan 先加 M27 场景行；`backlinks.test.ts` 补 4 个回归用例（注释区 / wikilink 括号段 / 嵌套未闭合
  label 内层仍改 / 2 万未闭合 `[` 性能），42/42 通过；`M26` 的 9 例 + 既有用例全部保持。

### 没做什么

- 未改 `main.ts` 的触发 / 反查 / `vault.process` 写回路径，也未改 Wikilink 语义与计数口径。
- 未处理 whitelist locale 排序脆弱性（`whitelist.test.ts:406`，本机 zh-CN 下 `localeCompare` 排序与断言
  不符）——master 基线同样失败，属既有环境相关用例，非本次引入；CI（Linux en-US locale）不受影响。
- 未对 PR 做线上操作：未批准 CI（GitHub 上 `action_required`，需维护者手动批准）、未在 PR 留言。

### 下一步

- ~~已打并推送 `1.1.2` tag；GitHub Release 待维护者创建~~——**订正**：`release.yml` 在 tag push 后
  自动创建，无需手动步骤；此前误判「需网页手动创建」并写错下一步，导致用户一度看到 Obsidian
  端「manifest 版本无匹配 release」的过期提示。已用 GitHub API 核实 Release 1.1.2：`draft=false`
  `prerelease=false`、tag 精确匹配（无 `v` 前缀）、`main.js`/`manifest.json`/`styles.css` 三个资产均
  `state=uploaded`，资产内 manifest.json 版本号也是 `1.1.2`，发布于 `2026-08-19T05:33:37Z`——现状正常。
- **新发现（用户实报「没人能下载插件」触发排查）**：真正卡住的不是 GitHub，是 **Community Hub**
  （`community.obsidian.md/plugins/auto-headings`，2026-05 起取代 `obsidian-releases` PR 机制，见
  `spec.md` M7 一行）——公开页面用浏览器 `read_page` 核实：插件确实「已上架且可搜索安装」，但
  `Current version` 卡在 `1.1.0`、`Updates` 计数 16（=1.1.0 为止的历史发布数），未拉到 1.1.1/1.1.2
  （二者 GitHub Release 均已核实 `draft=false`/`prerelease=false`/资产齐全，1.1.1 发布于
  `2026-08-19T00:44:07Z`、1.1.2 于 `05:33:37Z`）。用户贴出的「manifest 版本无匹配 release / 修复」
  卡片应是 Community Hub **登录后的维护者面板**（公开页无此横幅，登录态我无法代登）——GitHub 侧
  现已全部满足匹配条件，**下一步需用户本人登录 community.obsidian.md 打开该插件的维护者面板，
  点击「修复」触发重新校验**，预期会通过并拉到 1.1.2。若点击后仍失败，需要用户描述面板具体
  报错以便继续排查（可能是索引节流 / webhook 未触发之类的新问题）。
  另：网页摘要曾误报「Obsidian's manual/editorial review is still pending」——用真实浏览器
  `read_page` 复核后，DOM 中并无此文本（页面上是 `Review: Satisfactory` 评分项），已判定为
  fetch 摘要幻觉，未采信；`community-plugins.json`（legacy）已确认对本插件不再是准源，排查同类
  问题时直接查 Community Hub 页面，不要查这个旧文件（6760 条大文件用一次性摘要 fetch 会截断，
  需 `curl` 落盘 + 本地 grep/node 解析才可信）。
- 推送 master 后批准 PR #8 的 GitHub Actions 首次运行，确认 CI 全绿（本机 format:check 的 CRLF 检出
  伪影在 Linux/LF 检出下不存在；test 的 locale 用例同样只在 zh-CN locale 失败）。
- 建议在 PR 上留审核评论（性能修复已随合入落地，@nestealin 可对照）。
- 用户可在 NesDev 继续验证 1.1.2 候选产物；若后续补 Obsidian 冒烟（含 `( ) ! ' * ~` 的标题 fragment
  编码），可顺手验证 M26/M27 运行态。

### 验证方式

- `backlinks.test.ts` 42/42（含 M26 9 例 + M27 4 例）；全量 `npm test` 636/637（唯一失败为 whitelist
  locale 环境伪影，基线同样失败）；`npm run lint` 0 错误；`npm run format:check` 全绿（工作区统一 LF 检出）。
- `npm run test:fuzz`：默认、explore、M13 标题索引三块记分板各 5000 条 × 80 步，3/3 通过。
- 修复代码与 master 基线 wikilink 路径逐字对照无行为回归；`release/` 重建产物与源码一致。

---

## 2026-08-19 M26：Markdown 标题链接同步（1.1.2，待上游评审）

### 做了什么

Backlink 同步原先只覆盖 `[[file#heading]]` / `![[file#heading]]`；用户使用可移植的标准 Markdown
链接 `[label](file.md#heading)` 时，标题编号或改名后 fragment 会停在旧值。本轮先把实现从旧工作基线
重新移植到最新 `upstream/master`（1.1.1，`52b41a2`），再补齐 Markdown inline link/image：

- `rewriteBacklinksInContent` 新增小型 Markdown 扫描器，支持同文件、跨文件、相对路径、URL 编码文件名
  与 fragment、嵌套 label、平衡括号、`<destination>`、引号 title、image/embed；只替换 destination 的
  fragment，新 fragment 统一 URL 编码，label / path / title / `!` 原字节保留。
- 外部 scheme / protocol-relative URL、纯文件链接、块引用、多级 fragment、坏 URL 编码、转义链接、
  行内代码与 fenced code 保守不改；既有 Wikilink 改写与统一 Notice 计数保持原行为。
- 先补 `backlinks.test.ts` 的 M26 用例并观察到 8 个预期失败、30 个既有用例通过，再落实现使该文件
  38/38 通过；补双语 README / 设置文案 / spec / testplan / 手验夹具与双语 release note。
- `npm run bump 1.1.2` 同步版本文件，`npm run release` 重建可安装产物。

### 没做什么

- 这仍是“标题发生变化时同步引用”的确定性修复，不猜测或追溯修补已经陈旧的历史断链。
- 不改块引用 `^id`、多级锚点、重复标题的保守策略，也不把普通段落引用伪装成标题能力。
- 没有改 `main.ts` 的触发、反查和 `vault.process` 原子写回路径，也没有改变 Wikilink 语义。

### 下一步

- 提交上游 PR，跟进 GitHub CI 与维护者评审；若需调整，以保持现有安全边界和兼容性为前提收敛。
- 上游评审期间可继续在 NesDev 使用 1.1.2 候选产物，不另行维护分叉发布线。

### 验证方式

- Node 22.20.0：`npm run preflight` 全绿；其中全量 `npm test` 18 个文件、633/633 通过，
  build / docs / lint / format:check / release 全部通过。
- `npm run test:fuzz`：默认、explore、M13 标题索引三块记分板各跑 5000 条 × 80 步，3/3 通过。
- NesDev / Obsidian 1.12.7：1.1.2 候选产物对 9 个标题引用完成真实命令验证（同文件 2、跨文件 5、
  相对路径 2；Markdown 5、Wikilink 4），MetadataCache 的目标文件与标题 fragment 全部精确命中；
  8 类保守跳过项原字节保持，`dev:errors` 无错误。
- `release/` 与 NesDev 已安装的 `main.js` / `manifest.json` / `styles.css` 三份 SHA-256 分别一致。

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
