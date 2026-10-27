# obsidian-auto-headings 开发日志与协作交接

本文件用于多 agent / 多人协作的**握手交接**：每个开发周期结束时，记录「做了什么、没做什么、
下一步干嘛」，让接手者无需通读全部代码即可继续。倒序排列（最新在最上），当前状态与下一步以
最新一块为准。

**接手**：第一条命令跑 **`npm run docs -- --handover`**（见根 [`CLAUDE.md`](../CLAUDE.md) §3），一次打印
「当前版本 + 本文件最新块 + 近期周期索引 + testplan 待办」；更早的来龙去脉按需翻
[`log-archive.md`](./log-archive.md)，**不必从头通读**。周期块何时写、写什么，见
[`dev-cycle` 技能](../.claude/skills/dev-cycle/SKILL.md)（流程的唯一出处）。

> **注**：历史条目中出现的「README §X.Y」均指原规格文档（已更名为 `spec.md`，章节号不变）；
> 2026-09-26 起 spec / testplan 拆成「顶层索引 + 分节文件」，此前条目里的 `spec.md#锚点`、
> `testplan.md` 行号指当时的单文件，请按 § 号 / 场景 ID 查 [`spec.md`](./spec.md)、[`testplan.md`](./testplan.md) 索引。

---

## 2026-10-28 只读目录块 ah-toc（M17-B，不 bump、未合并，交接：claude/quiet-outline-show-only-numbers-7330df）

### 做了什么

- **§2.2 澄清 + 新规格 [3.25](spec/3.25-只读目录块.md)**：用户手写 `ah-toc` 围栏，插件只读渲染成目录（不写文件），边界与「不生成物理目录」不冲突。围栏名不用 `toc`（会与 Automatic Table Of Contents 抢处理器），唯一参数 `levels: A-B`。
- **实现**：`src/virtual/tocBlock.ts`——纯函数 `parseTocLevels` / `buildTocTree`（相对级别栈式嵌套、按行号 + 级别配虚拟编号、残留旧编号不叠加）+ `TocBlockRenderer`（代码块处理器、块登记、元数据 / 设置变化原地重画）；`main.ts` 接入并加 `openHeadingLink`；样式 `.ah-toc-list`。无设置项。
- testplan V54–V62；单测 `toc-block.test.ts` 13 条。门槛：docs / prettier / eslint / tsc 绿；`vitest` 1034/1035，唯一红仍是已知 ICU 假红。
- 真机（Oblivion 库，深色）：阅读视图与实时预览都渲染带编号的嵌套目录，`levels: 2` 生效，点击跳转并高亮目标。

### 追加（同日，用户反馈）

- **层级滑块**：块里写 `slider` 带滑块，**浮动、默认隐藏**（鼠标移入目录块 / 键盘焦点进入才淡入，触屏常显，打印隐藏）；刻度按**现存级别的序号**布置（只有 H3–H5 就是 3 档，H3 + H5 就是 2 档）。
- **状态落盘**：拖动即时只重画列表，**松手才把 `depth: N` 写进块内**（用户定：状态记在代码块里）；写前校验围栏 / 内容与渲染时一致 / 行区间，不符就放弃只留内存选择，`vault.process` 原子改写，CRLF 保持。§2.2 与 spec 3.25 的「只读」措辞相应改为「渲染只读、唯一写入是拖滑块」。
- **插入命令**：「插入目录」（命令面板 + 编辑器右键，需编辑器焦点）插入带 `slider` 的块；10 种语言补 `cmdInsertToc`。
- **导出 PDF**：代码块处理器改异步、**等首次渲染完才返回**（导出管线等 Promise 才截 DOM，否则会导出空块 / 源码）；CSS 打印隐藏滑块。
- **边界**：缩进是**相对**的（栈式嵌套，只看祖先层数，与 H 几无关；只有 H3–H5 时 H3 是顶层）；跳级 / 乱序已单测。testplan V63–V73；单测 29 条。真机（滑块悬停显隐、实时预览拖动、落盘、插入命令、PDF）**待用户测**。

### 再追加（用户首轮真机反馈）

- 滑块位置：浮动在右上角会与实时预览代码块的 `</>` 重叠 → 改回目录**上方靠左**，仍默认隐藏、悬停淡入、隐藏时占一行不让目录跳动。
- 缩进：跳级的标题要与同级别的别处对齐（H3 下的 H5 对齐 H4 下的 H5）→ `buildTocTree` 给节点加 `gap`（比父级下一级多跳的级数），渲染时 `margin-left` 补缩进；基准是收录的最浅级别。推翻了上一版「缩进只看祖先层数」的结论。
- 插入命令名精简为「插入目录」（10 种语言同步）。

### 没做什么

- 未试：写入模式文件的点击跳转（含 WJ 锚点）、边改边看的实时更新、导出 PDF、停用插件后块还原、与 Automatic Table Of Contents 同装（该库里它没启用）、浅色主题。
- 没写 README / user-guide：用户要手写围栏，**发版前必须补一节「怎么写 ah-toc 块」**，否则没人知道这个功能；没做插入命令（要动 10 种语言）。
- 标题里的行内标记（粗体 / 链接 / 行内代码）按纯文本显示，没渲染。

### 下一步

- 补 user-guide 双语 + README 一句；补真机未试项；用户定后合并。

### 验证方式

- `npx vitest run tests/dev_tests/toc-block.test.ts`；真机见上。

---

## 2026-10-28 Quiet Outline 面板显示仅显示编号（不 bump、未提交，交接：claude/quiet-outline-show-only-numbers-7330df）

### 做了什么

- **接入 Quiet Outline**（第三方，0.5.15 核对）：它是 Vue 树、没有条目对象，但节点 `id="no-N"` 的 N 即 `metadataCache` `headings` 下标；用它取行号后走与内置大纲相同的「行号 + 级别」配对。所示文件取自 `plugin.navigator.view.file`。固定开启、无设置项（`outlineView.ts` 抽出 `OutlineAdapter`，内置大纲与 Quiet Outline 各一个；`main.ts` 加 `cachedHeadings`；`styles.css` 把文字容器改 flex 让 `::before` 同行）。
- testplan V48–V53、spec §3.22、架构目录树同步；单测 `virtual-outline.test.ts` 22 条（含 7 条 Quiet Outline 假 DOM 用例）。
- 门槛：`docs --check` / `prettier` / `eslint` / `tsc` 绿；`vitest` 1021/1022，唯一红是已知 Windows ICU 假红。已 `npm run release` 并覆盖部署到 Oblivion 库（库内原为 1.2.6）。

### 没做什么

- **真机（Oblivion 库，深色主题，Quiet Outline 0.5.15）已看**：编号与标题同行、窄面板长标题换行后悬挂缩进、搜索过滤带编号、编辑加标题后面板实时更新，均正常。浅色主题用户实测通过，Quiet Outline 适配视为完成；**未专门试**：省略设置、彩虹线开关；节点 `id` 究竟挂在哪一层没读真实 DOM（渲染正确，无重复 id 的迹象）。
- 没写 README / user-guide（等真机确认可用后再补一句）。

### 下一步

- 用户定先不合并；V53 已回填 ✅。合并前如有空可再试省略设置 / 彩虹线。

### 验证方式

- `npx vitest run tests/dev_tests/virtual-outline.test.ts`；真机见上。

---

## 2026-10-27 发版 1.2.6：标题菜单层级子菜单 + 阅读视图落盘 + 菜单开关（交接：claude/title-menu-level-adjust-c3cecb → master，tag 1.2.6）

### 做了什么

- **设置开关**：全局设置新增「菜单」分组——标题菜单（`headingMenuEnabled`）、状态栏菜单（`statusBarMenuEnabled`），默认开，说明各一句话；关标题菜单时手柄 / 手机「⋯」/ 阅读视图右键 / 编辑器右键标题项都不介入（S39）。
- **层级子菜单**：标题菜单里「调整此标题的层级」「调整整节的层级（含子标题）」右侧展开 H1–H6，越界层级置灰（`reachableLevels`，不压扁、不记状态，评估过「压扁再回溯」后弃，理由见 spec §3.24）；子菜单走未公开的 `MenuItem.setSubmenu`，认不出时退化平铺；新增命令「升级 / 降级当前标题（不含子标题）」（S36 / S40）。
- **阅读视图落盘**：只在阅读视图打开时改走 `vault.process`，读写以弹菜单时磁盘快照为准（`readingheadingmenu.ts` `fileBackedEditor` + `applyTextChanges`）；真机探针抓出隐藏编辑器缓冲不随落盘更新，旧缓冲会让连续两次调整算偏列位置（S37）。
- **返回对齐**：「返回」置底，本篇菜单与标题菜单左下角对齐（`alignToParent`）；先后踩了两个坑——替换静默失败仍用了最初右键坐标、改按点击坐标后 x 方向仍不齐，最终按两菜单外框对齐，真机量得左下角坐标一致（S38）。
- 10 种界面语言补键；testplan S36–S40、spec §3.24、user-guide 双语、`doc/release-notes/1.2.6.md` 同步；`npm run bump` 1.2.5 → 1.2.6，testplan / spec 的「未发版」回填为 1.2.6。
- 门槛：`docs --check` / `prettier --check` / `eslint` / `tsc` 全绿；`vitest` 1014/1015，唯一红仍是已知 Windows ICU 假红（`whitelist.test.ts` CJK 排序）。真机：用户手测子菜单、预览 / 编辑视图、置灰、对齐均通过；探针 `tests/probes/heading-menu.js`。

### 没做什么

- 阅读视图下本篇菜单里「立即重新编号 / 复制大纲 / 清理」等仍走原编辑器路径，用户手测未反映问题，若有再按 `fileBackedEditor` 思路处理。
- 阅读视图下的改动进不了撤销栈（代价，已写进 spec 与发布说明）。
- 手机端子菜单 / 菜单对齐未看；`heading-menu.js` 探针在窗口不在前台时阅读视图懒渲染不出标题会失败（环境因素，探针已加等待）。

### 下一步

- 推 master 等 CI 绿 → 打 tag 1.2.6 → 到 Community Hub 维护者面板点「Check for new releases」送审。

### 验证方式

- 单测见上；真机探针与用户手测见上；`git tag` 与 `manifest.json` 版本一致（Release 工作流会校验）。
