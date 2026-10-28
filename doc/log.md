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

## 2026-10-29 标题本身就是编号时不再叠编号（未发版，交接：claude/auto-headings-plugin-review-1076f5）

### 做了什么

- 起因：Grok 外部测评用 Demo 笔记（`# 第一章` / `## 第一节` / `## 第二节` / `# 第二章`）套章节模板，仅显示模式渲染成「第一章 第一章」。核实：`第一章 概述` 这类早有守卫拦截；漏的是**整行只有编号**的标题——`stripForeignNumbering` 要求编号后跟分隔符，剥不掉它，于是过半判定没算它。
- `src/strip.ts` 新增 `isNumberOnlyHeading`：只认阿拉伯 / 中文数字 / 圈码，且须带 `第`、量词、括号、末尾标点或本身是圈码；`2024`、`三`、`1.2`、`API.`、`Summary:` 不算。
- `src/cleanup.ts`：`isMostlyForeignNumbered`（仅显示模式、ah-toc、大纲同源）把它计入过半；写入模式守卫 `hasUnclaimedForeignNumbering` 在「任一可剥的外来编号」之外加「过半（含纯编号）」——纯编号不按「一个就算」，否则个别一个就永远拦住整篇。
- 提示：命中但清理预览为空（全是纯编号）时，`main.ts` 改弹「这篇的标题本身就是编号（如「第一章」），本次没有自动 / 显示编号。」，不给「查看并清理」；11 种语言加 `noticeNumberOnlyGuard`。
- testplan J25 / J26 / V77；spec 3.22 补一条；单测 4 例。

### 没做什么

- 真机没复测（Demo 笔记打开看不叠编号、提示文案）。
- `npm run test:fuzz` 在 worktree 里找不到 vitest 入口没跑；新函数只接在守卫判定上，没进编号引擎。
- 测评里的其他条目没动：改语言后命令名需重载（spec 3.11 已知限制，可用同 id 重新注册修，待定）、「固化编号并交还所有权」文案待用户定。

### 下一步

- 真机打开 Demo 笔记确认 V77 / J26，随下个补丁版发。

### 验证方式

- `npx vitest run tests/dev_tests/cleanup.test.ts`（59 例全绿）；全量 1061/1062，唯一红是已知 ICU 排序假红（whitelist.test.ts）。

---

## 2026-10-28 发版 1.3.0：Quiet Outline 面板显示编号 + 只读目录块 ah-toc（M17-B）（交接：claude/quiet-outline-show-only-numbers-7330df → master，tag 1.3.0）

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
- 缩进：跳级的标题要与同级别的别处对齐（H3 下的 H5 对齐 H4 下的 H5）→ 第一版（嵌套 `ul` + 给跳级项补 `margin-left`）真机仍对不齐，根因是嵌套列表的缩进本就是「祖先层数」；改成**平铺列表**，每项 `--ah-toc-indent = 级别 − 最浅级别`（`TocNode.indent`），缩进 = 该值 × 1.5em，彻底与挂在谁下面无关。第二轮真机仍不齐（H3→H4 只缩一点、H4→H5 缩很多），根因是**样式特异性**：Obsidian 的 `.markdown-rendered li` 比 `.ah-toc-list` 高，我们的边距被盖掉，且给 li 写内联 `margin-left` 会替换掉 Obsidian 默认的 li 边距，只有 indent 0 保留默认 → 台阶不等。现在所有选择器带 `.ah-toc` 前缀、圆点自绘、用 `padding-inline-start` 与 CSS 变量，**每一级距离相等**（用户要求）。推翻了最初「缩进只看祖先层数」的结论。
- 滑块行压矮：第一版把滑块本身压扁了（头变成扁椭圆），用户指出应缩**外围空间**而不是滑块 → 恢复原生圆头，只收紧外边距 / 内边距（同样靠 `.ah-toc` 前缀盖过 Obsidian 的 `ul` 边距）。
- 插入命令名精简为「插入目录」（10 种语言同步）。

### 第三轮（用户实测反馈）

- **实时预览里拖滑块仍进源码**（`depth:` 落盘 + 重开保持都正常）：阻止冒泡不够——原生 `<input type=range>` 拿焦点，编辑器因焦点 / 选区进了块的渲染结果而把光标放进块。从 `app.js` 看到 Obsidian 自己用 `.interactive-child` 标记「别当成点进块」，且 LP 的代码块上下文提供 `getSectionInfo` / `replaceCode`。改成**自绘滑块（div 轨道 + 拇指，不可聚焦，指针捕获拖动）**，容器带 `interactive-child`。真机待复测。
- **目录项超链接**：`a` 补 `data-href`（Obsidian 识别内部链接、悬浮预览、PDF 导出转可点内部链接的依据）；点击 `stopPropagation` 防重复打开。PDF 里是否可点要真机导出看。
- **选中复制**：拦 `copy`，`text/plain` 与「复制编号大纲」同格式（带编号 / 缩进），`text/html` 带 `obsidian://` 超链接（`headingUri`）。
- **不抖动**：重画前算内容签名，没变不动 DOM（回答「文首放 toc、后面加标题会不会挤视角」：改字不会；加删标题多 / 少一行是固有代价）。

### 第四轮（用户实测反馈）

- **复制粘进 Obsidian 的排版**：第一版 HTML 是带左边距的段落，Obsidian 转 Markdown 后层级全丢、一行一段 → 改成**嵌套列表**（深度 = min(相对缩进, 上一项 + 1)），纯文本仍与「复制编号大纲」逐字一致。
- **导出 PDF 里仍点不动**：从 `app.js` 查到 Obsidian 导出对所有 `a.internal-link` 执行 `removeAttribute("href")`，`data-href` 帮不上；标题元素也没有 `id`。改为导出时（块在 `div.print` 里）用普通 `a` + `#ah-h-下标`，并在块异步续跑时给导出 DOM 里对应标题补 `id`（`assignExportHeadingIds`，数量对不上不补）。依赖 Chromium 把 `<base>` 下指向本文档的 `#id` 转成 PDF 内部跳转，**待用户导出复测**。
- 用户反馈：新增 / 删除标题目录不影响视图（内容签名不变不重绘 + 增删时不抖），好。

### 没做什么

- 未试：写入模式文件的点击跳转（含 WJ 锚点）、边改边看的实时更新、导出 PDF、停用插件后块还原、与 Automatic Table Of Contents 同装（该库里它没启用）、浅色主题。
- 没写 README / user-guide：用户要手写围栏，**发版前必须补一节「怎么写 ah-toc 块」**，否则没人知道这个功能；没做插入命令（要动 10 种语言）。
- 标题里的行内标记（粗体 / 链接 / 行内代码）按纯文本显示，没渲染。

### 下一步

- 已补 user-guide 双语 + README + `doc/release-notes/1.3.0.md`；`npm run bump minor` 1.2.6 → 1.3.0（新功能，升次版本）；testplan / spec 的「未发版」回填为 1.3.0。
- 推 master 等 CI 绿 → 打 tag 1.3.0 → 内置浏览器点 Community Hub 的「Check for new releases」。
- 未真机验证、已在 testplan 标明的项：写入模式文件目录点击跳转（V55）、边改边看的目录更新（V56）、与 Automatic Table Of Contents 同装（V59）、停用插件后块还原（V62）。

### 验证方式

- `npx vitest run tests/dev_tests/toc-block.test.ts`；真机见上。

---

## 2026-10-28 Quiet Outline 面板显示仅显示编号（并入 1.3.0，交接：claude/quiet-outline-show-only-numbers-7330df）

### 做了什么

- **接入 Quiet Outline**（第三方，0.5.15 核对）：它是 Vue 树、没有条目对象，但节点 `id="no-N"` 的 N 即 `metadataCache` `headings` 下标；用它取行号后走与内置大纲相同的「行号 + 级别」配对。所示文件取自 `plugin.navigator.view.file`。固定开启、无设置项（`outlineView.ts` 抽出 `OutlineAdapter`，内置大纲与 Quiet Outline 各一个；`main.ts` 加 `cachedHeadings`；`styles.css` 把文字容器改 flex 让 `::before` 同行）。
- testplan V48–V53、spec §3.22、架构目录树同步；单测 `virtual-outline.test.ts` 22 条（含 7 条 Quiet Outline 假 DOM 用例）。
- 门槛：`docs --check` / `prettier` / `eslint` / `tsc` 绿；`vitest` 1021/1022，唯一红是已知 Windows ICU 假红。已 `npm run release` 并覆盖部署到 Oblivion 库（库内原为 1.2.6）。

### 没做什么

- **真机（Oblivion 库，深色主题，Quiet Outline 0.5.15）已看**：编号与标题同行、窄面板长标题换行后悬挂缩进、搜索过滤带编号、编辑加标题后面板实时更新，均正常。浅色主题用户实测通过，Quiet Outline 适配视为完成；**未专门试**：省略设置、彩虹线开关；节点 `id` 究竟挂在哪一层没读真实 DOM（渲染正确，无重复 id 的迹象）。
- 没写 README / user-guide（等真机确认可用后再补一句）。

### 下一步

- V53 已回填 ✅，随 1.3.0 发布；省略设置 / 彩虹线开关未专门试。

### 验证方式

- `npx vitest run tests/dev_tests/virtual-outline.test.ts`；真机见上。
