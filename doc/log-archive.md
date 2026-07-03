# obsidian-auto-headings 开发日志归档（log-archive）

> 本文件是 `log.md` 滚动出去的**历史周期块**（倒序，新的在上）。平时不必读；
> 需要某次改动的来龙去脉时再来翻。当前活跃日志见 [`log.md`](./log.md)。

---

## 2026-07-03 0.7.24 打开文件即按当前模板自动重排（testplan J9，用户需求）（claude/obsidian-auto-headings-launch-uzdovw）

**做了什么**：落地用户提出的新需求：路径规则改投了模板（或模板本身改了样式）后，该路径下**尚未打开
过/编辑过**的文件，此前必须等用户敲一下键盘（触发 `editor-change` 防抖）才会按新格式重排；用户希望
**只要打开文件就自动刷新**，不必先手动编辑或跑「立即重新编号」命令。

- **`main.ts` 新增 `renumberOnOpen(file)`**：挂在 `file-open` 事件上，走与实时编辑**完全一致**的自动
  路径门控（`shouldAutoTrigger` + `getTemplateForFile`），命中则调用既有的 `applyRenumber`。不新增
  设置项——「是否该自动」的判定逻辑与「自动触发」共用一套规则，语义上是把同一套资格判定接到了新的
  触发事件（打开）上，而非引入新概念。
- **幂等 no-op 免费获得**：`applyRenumber` 只在内容确有变化时才发起事务（既有机制），已是最新格式的
  文件打开时重排前后内容相同，静默跳过，不产生多余撤销记录，也不会每次切换标签页都抖一下光标。
- **与 file-open 内既有的「标题快照播种」（M14 基线）顺序**：`renumberOnOpen` 放在前面——若它写回，
  `applyRenumber` 内部的 `syncAndSnapshot` 会把快照刷新为写回后的状态，紧随其后的播种逻辑因
  `headingSnapshots.has()` 已为真而自然短路，不会用「重排前」的旧内容重复播种一份过时快照。
- `getActiveViewOfType(MarkdownView)` 取活动视图后校验 `view.file?.path === file.path`，防御
  「打开事件与实际活动编辑器不一致」（如后台预览、极快速切换）的场景，此时不强行处理。
- `doc/spec.md` §3.9 补充说明；`doc/testplan.md` 新增 **J9**。

**没做什么**：未加开关让用户关掉这个行为——判断是它和「自动触发」共享同一套门控（全局开关/frontmatter），
关掉自动编号或设 `fm:false` 天然就会连打开也不触发，无需再造一个开关；若后续用户反馈想要「自动编号开
但打开不重排」这种更细粒度的诉求，再补选项。未处理"文件已打开但插件是后来才装/重载"的追平（重载后
第一次 `file-open` 才补，这与现有 M7 的 N1 修复模式一致，无需特殊处理）。

**下一步**：用户实机验 J9（改路径规则模板 → 切到其它笔记再切回 / 冷启动打开该路径下笔记 → 确认自动
刷新且无多余撤销记录）；连同上一周期遗留的 K12/L17/L22/K11 及更早 E14/E16 一并验收 → M7 截图/发布
自检 → bump 1.0.0。

**验证方式**：`npm test`（326 passed，`main.test.ts` 新增 `renumberOnOpen` 7 条：正常重排 / 幂等
no-op / 全局关门控 / fm:false 门控 / 无路径规则命中 / 打开文件与活动视图不一致 / 无活动视图不抛错）；
`npm run lint` / `format:check` 全绿；`npm run release` 重建 `release/`。

---

## 2026-07-03 0.7.23 路径规则禁止重复路径（GUI 阻断保存）（claude/obsidian-auto-headings-launch-uzdovw）

**做了什么**：修用户报告的另一处路径规则 GUI 不理想行为（testplan **K12**）：同时设置两条路径都是
`/` 的规则，一条投模板 A、一条投模板 B，插件会用其中「新建的」那条（即列表里更靠后的那条）套用
到全库并触发编号——用户认为不应静默生效，而应弹提示、不允许同一路径关联不同模板。这是有意的
产品决策（已用 `AskUserQuestion` 与用户确认范围）：**阻断保存、强制路径唯一**，且不限于根 `/`，
任何两条规则的路径模式归一化后相同都算。

- **新增纯函数** `findDuplicatePatternIndex(rules, index)`（`src/pathrules.ts`）：检测某规则的路径
  是否与列表中其它规则重复（归一化后完全相同；未配置的空串不参与判定，本就不匹配任何文件）。
- **GUI 接线**（`PathRules.ts` `commitPattern`）：路径输入框失焦提交时，若归一化后与其它行重复，
  **回退**输入框为改前的值、**不写入** `saveSettings`/不触发编号，弹 Notice「该路径已被第 N 条规则
  使用……」（中英双语，`i18n.ts` 新增 `pathDuplicateWarn`）。
- **既有机制降级为遗留兜底**：`resolvePathRule` 里「具体度并列时列表靠后者胜出」的 tie-break **没有
  删除**——它仍需应付两种情况：① 两条**不同**文件夹名恰好等长（如 `Ab/` 与 `Cd/`，无优劣可分，
  必须有个确定性结果，这是 testplan K5 的真实场景，与本次改动无关）；② 遗留/手改 `data.json`
  产生的真重复（GUI 阻断的只是**新建/编辑**路径，不回溯清理已存在的数据）。相应地把 spec.md §3.8
  第 3 条与 `pathrules.ts` 顶部文档注释的措辞从"鼓励用加规则覆盖"改成"仅确定性兜底、不推荐"。
- `doc/spec.md` §3.8 补一段说明；`doc/testplan.md` K5 措辞收窄为"不同文件夹名等长"、新增 K12。

**没做什么**：未处理"面板加载时已存在遗留重复数据"的场景（不主动扫描历史 `data.json` 报警，只挡
新的编辑）；未改动拖拽排序逻辑（拖拽不产生新路径文本，不会制造重复，无需拦截）；GUI 阻断的手感
（Notice 文案、输入框回退是否顺滑）仍待用户在真实 Obsidian 里点一遍。

**下一步**：用户实机验 K12（新建重复路径 `/` 确认阻断生效、Notice 可读）；连同上一周期遗留的
L17/L22/K11 及更早的 E14/E16 一并验收 → M7 截图/发布自检 → bump 1.0.0。

**验证方式**：`npm test`（319 passed，`pathrules.test.ts` 新增 `findDuplicatePatternIndex` 6 条 +
`resolvePathRule` 两条测试拆分为「等长不同文件夹」与「遗留重复数据」）；`npm run lint` /
`format:check` 全绿；`npm run release` 重建 `release/`。

---

## 2026-07-03 0.7.22 修路径规则「未填路径先选模板」误当根规则套用全库（claude/obsidian-auto-headings-launch-uzdovw）

**做了什么**：修用户报告的路径规则 GUI bug（testplan **K11**）：在设置面板「路径与模板」TAB 点
[+ 添加规则] 新增一行后，该行路径输入框尚为空（`pattern: ""`），此时若先在模板下拉里选了一个模板
（还没来得及输路径），插件立刻把这条规则当**根规则 `/`**处理、套用到全库并触发当前文件重新编号。

- **根因**：`src/pathrules.ts` `normalizePattern` 把空串 `""` 与显式根 `/` 一并折算为 `/`（本意是
  「用户清空根规则那行的路径输入框，仍应保留为根」的兼容处理），但这条归一化对**新增行的初始空串**
  同样生效——两种「空」的语义被混为一谈：一个是「用户明确要根」，一个是「用户还没填」。
- **修法**：`normalizePattern` 对真正的空串单独返回 `""`（不再折算为 `/`），`ruleMatches` 遇到该
  归一化结果直接返回 `false`（不匹配任何文件）。连带修正 `hasRootRule`——未配置行不再被误判为
  已存在根规则，「无根规则兜底缺失提示条」在这种情况下仍会正确显示。显式输入 `/`（或 `./`）依旧
  正常归一化为根，未改变该分支行为。
- `doc/spec.md` §3.8 补一段「未配置行不等于根规则」的澄清；`doc/testplan.md` §K 新增 K11（❌ → ✅）
  并在 §3.1 已修 bug 汇总表追加第 11 条。

**没做什么**：未改动 GUI 层（`PathRules.ts`）的事件处理——修复落在数据层 `pathrules.ts` 的匹配逻辑，
`select.addEventListener("change", …)` 里仍会对空路径行调用 `renumberActiveFile()`，但因该规则现在
恒不匹配任何文件，实际是无操作，不需要在 GUI 层额外加「路径未填时跳过保存/编号」的判断。

**下一步**：与上一周期遗留一致——用户实机验 L17/L22（及 E14/E16）手感 → M7 截图/发布自检 →
bump 1.0.0；本次新增的 K11 也建议实机复现一遍确认（新增规则行→先选模板→确认当前文件未被误编号）。

**验证方式**：`npm test`（313 passed，含 `pathrules.test.ts` 新增 5 条：`ruleMatches`/`resolvePathRule`/
`hasRootRule` 对空串场景的断言）；`npm run lint` / `format:check` 全绿；`npm run release` 重建 `release/`。

---

## 2026-07-03 0.7.21 白名单选中态 + TAB 切换过渡动画（claude/whitelist-highlight-tab-style-pyz88x）

**做了什么**：修用户实测反馈的两处设置面板 GUI 样式 bug（均为 testplan L 类，此前状态 🔲 未手验）：

- **白名单分段控件选中态不常驻**（L17）：用户反馈 `=`（全部）/ `≈`（部分）/ `▸`（子树）三个匹配方式按钮
  的选中高亮无法稳定区分当前生效的是哪种匹配。`.ah-wl-seg-active` 本身逻辑正确（用 Playwright 起浏览器
  加载 `styles.css` 静态验证：选中态背景确实解析为 `--interactive-accent`），但部分 Obsidian 主题会对裸
  `button` 元素加高特异性或 `!important` 的背景规则，足以吃掉我们单类选择器的选中态样式。修法：
  `.ah-wl-seg-active`/`:hover` 的 `background`/`color` 补 `!important` 强制生效，颜色仍是 Ob 主题强调色
  `var(--interactive-accent)` + `var(--text-on-accent)`，未改用固定色值。
- **GUI TAB 切换背景色无过渡动画**（L22，及 L9/L21 相关）：`SettingsTab.ts` 原先每次点击 TAB 都调用整个
  `display()`，`containerEl.empty()` 把 TAB 栏按钮全部销毁重建——新建元素没有「旧状态」可过渡，CSS
  `transition` 无从播放。改为 TAB 按钮元素**跨切换复用**：`display()` 只在首次打开面板时创建按钮（存入
  `tabButtons: Map`），新增 `switchTab()` 只切换按钮的 `ah-tab-active` class 与文字标签子节点、并单独
  重绘 `bodyEl` 内容区，不再重建整个 TAB 栏。配合 `.ah-tab` 补 `transition: background-color .15s ease,
  color .15s ease`，切换时背景色渐变；`.ah-tab-active` 背景同上加 `!important` 防主题覆盖。
- 同时把 `.ah-wl-seg-btn:hover`/`.ah-wl-seg-active` 一带修的样式变动跑了 `npm run format` 格式化。

**没做什么**：未改动 TAB 内容渲染本身（General/Templates/Danger/About 四个 TAB 内部逻辑不变）；未给
`.ah-wl-row`、命中数角标等其他 UI 元素加 `!important`——只加固了本次用户点名的两处。真实 Obsidian 内多主题
下的实机验证仍待用户（本地仅能静态验证 CSS 级联逻辑，见下）。

**下一步**：用户实机验 L17（多个社区主题下选中态是否稳定高亮）/ L22（TAB 切换动画手感）；连同上一周期
遗留的 E14/E16 一并验收 → M7 截图/发布自检 → bump 1.0.0。

**验证方式**：`npm test`（310 passed）/ `npm run lint` / `npm run format:check` 全绿；额外用 Playwright
起 headless Chromium 加载项目 `styles.css` 静态验证 `.ah-wl-seg-active` 在无外部覆盖时的计算样式（背景
= 强调色、非仅 hover 才生效），确认原 CSS 级联逻辑本身无自相矛盾，问题定位在外部主题覆盖风险上。

---

## 2026-07-03 0.7.20 双哨兵自愈：根治「删后缀致序号重复」+ 降级残留清理（claude/chinese-text-formatting-8wgljv）

**做了什么**：修用户报告的编辑期 bug——`## 一、⁠标题2` 从 `、` 开始删（连同不可见的尾哨兵 WJ 一起删）
后，下轮编号叠成 `## 一、⁠一标题2`（序号 `一` 重复）。根因是方案 A 的固有张力：WJ 是唯一边界证据，被
编辑破坏后残留序号字与真实正文无从区分。采**双哨兵**方案（用户点名的 ②）：

- **② 双哨兵**（`render.ts`）：`buildPrefix` 前缀改为**首尾各一个 WJ 哨兵**（`⁠前缀内容⁠`）。尾哨兵贴正文、
  最易在改后缀时被误删；此时**首哨兵**（行首 `#` 后、远离编辑点）幸存，作「此处确有插件前缀」的结构性
  证据。`stripPrefix`（`strip.ts`）据此在**有证据**前提下启用 `boundedStripDamagedPrefix` 有界剥离，把孤儿
  序号剥净愈合——安全地把方案 A 禁止的宽松剥离在证据约束下重新引回，不误伤无证据的正文（E5 `2024` 不碰）。
- **③ 降级残留清理**（`numbering.ts` `cleanDemotedResidue` 共享 helper）：把 `## 标题` 删光 `#` 降级为正文后，
  行里残留的 WJ 哨兵 + 编号被清净。`renumberContent`（模板感知）与「清除编号」命令（`cleanup.ts`，全样式并集）
  **共用**该 helper——保证任何「整理文档」的操作都不留插件残留。
- **①（精确去重）弃用**：实测发现它在「双哨兵均毁、无证据」时会把 `## 1。2024总结` 的正文起头 `1。` 当孤儿
  吃掉，回归 E5/U2 误伤。而报告场景的首哨兵并未被删，② 已完整愈合，① 无安全且非冗余的形态。取舍写进 spec §2.5。
- **UVM 扩充**：新增 `demoteHeading` 激励 + `demote-heading` 必达覆盖 bin（`uvm/framework.ts`）。降级后 bare 是
  干净 raw 段，**现有参考模型记分板自动校验 ③ 残留清净**，无需新不变量。压测**逮出真实一致性缺口**：清除
  编号命令原先不清正文残留 → 修为共享 `cleanDemotedResidue`。5000×80 两记分板全绿。
- 测试：新增 `known_bugs.test.ts` E14–E18（报告场景愈合 / 仅删尾哨兵 / 降级清理 / 清除命令一致 / E5 不回归）
  + `numbering.test.ts` stripPrefix 双哨兵单元测试（完好 / 首哨兵幸存有界剥离 / 旧单哨兵兼容）。共 310 passed。
- 既有 golden 断言随双哨兵机械升级（codemod：每个前缀补首哨兵 WJ；backlink 锚点随 `displayAnchor` 保留 WJ →
  链接变 `[[a#⁠1 ⁠简介]]`）。

**没做什么**：
- **首尾哨兵均被毁**（要连行首附近首哨兵也删掉，罕见）不自愈——与真实正文无从区分，强行猜测重蹈 E5，保留
  现状由「清除编号」兜底（spec §2.5 已记）。
- CodeMirror 原子区域方案未采用（只护当前编辑器、护不住文件与清除命令，且违背「前缀可手改」原则），横评见对话。
- 旧单哨兵（0.6.4–0.7.19）存量标题首次触发会被补写首哨兵（一次性升级，无线上用户，无需迁移脚本）。

**下一步**：
1. 用户实机（Obsidian）验 E14/E16 手感——尤其确认真实编辑器里「删后缀」确会连带删尾哨兵（本次以文本模型
   模拟）；如手感 OK，M7 上架冲刺继续（截图 → 发布自检 → bump 1.0.0）。
2. 若将来要「用户手感上碰不坏编号」，可在双哨兵之上叠 CodeMirror 原子区域作纯体验增强（非必需）。

**验证方式**：`npm test` 310 passed；`npm run test:fuzz` 5000×80 两记分板全绿（含新 `demote-heading` bin）；
`npm run lint` / `format:check` 全绿；端到端脚本确认报告场景愈合、降级清净、E5 不误伤。

---

## 2026-07-03 0.7.19 README 重定位：前置 Backlink 同步卖点（claude/gpt-plugin-feedback-6925m7）

**做了什么**：改 `publish/README.md` + `README.zh.md`（发布物料，不涉源码/行为）。起因是用户拿一份
外部 GPT 对本插件的产品评价来问——诊断「工程强但用户感知弱、卖点被模板/规则等功能盖住」基本准确，
但其「把高级功能全部隐藏」的药方过度（会砍掉真实用户在用的能力）。采纳「前置差异化卖点」，不采纳
「阉割功能」：

- 开场一句话从「可定制模板驱动」改为直接点出 **Backlink 同步**（改标题文字，引用自动跟，不止编号变化）。
- 新增「Rename freely — links follow」示例小节（纯 Markdown 代码块，改动前/改动后/引用自动跟三段），
  作者原话验证过这一点确实比竞品（仅同步编号、不同步文字）强。GIF 占位符仍留 TODO，示例先补文字版。
- `亮点` 列表把 Backlink 同步从第 5 条提到第 2 条（仅次于「开箱即用」），模板/路径规则/白名单等原样保留，
  未删减任何条目——不采纳 GPT「藏起来」的建议，理由见上。
- `说明`/Notes 新增 **Backlink 同步边界**一条：据 spec §3.12 如实列出保守跳过的情况（重复标题 / 块引用
  `^id` / 多级锚点 `#A#B`）+ 开关不回溯历史断链——避免 GPT 建议的「Ever/永远不断」这类过度承诺。
- `npx prettier --write` 两个文件时发现它会递归格式化 `` ```md `` 语言标记的代码块（在示例注释后插入
  空行），改为去掉语言标记（纯 ` ``` `）避免这一行为，两轮验证 prettier 幂等。

**没做什么**：
- Hero GIF/截图仍是 TODO 占位——文字示例可先用，真正的对比动图需要用户本地录制。
- `release/README.md`（发布产物副本，`sync-plugin-repo.mjs` 从 `publish/` 同步到独立发布仓库时才用）
  未同步改动——这是分发流程的另一份文件，非本次任务范围（用户只要求改 `/publish` 下两份）。
- 根目录 `README.md`（仓库自身说明，非面向插件用户）未动，与本次无关。

**下一步**：
1. 用户录制/截取「Rename freely」场景的实际 GIF，替换 `assets/hero.gif` TODO。
2. 若认可本次改动方向，可视需要把 `release/README.md` 也同步（走 `npm run publish:repo` 或手动）。
3. 按 M7 剩余项（用户本地首推发布仓库 → 实机截图 → 发布自检 → bump 1.0.0 → 社区 PR）继续。

**验证方式**：`npx prettier --check` 两文件通过（幂等）；人工通读中英两版确认信息对称、无断链
markdown 语法错误；`npm test`/`lint`/`format:check` 全绿（合并时随本分支代码零改动一并跑过）。

（本条改动分支起点早于 0.7.18 的文档防漂移加固，合并时按 `npm run bump` 顺延为 0.7.19，
版本号语义仅表示提交顺序，两个周期内容彼此独立、互不覆盖。）

---

## 2026-07-03 0.7.18 文档防漂移加固：docs.mjs 三新守卫 + handover 模式（claude/obsidian-headings-workflow-review-22p3jj）

**做了什么**（用户要求「修复工作流检查发现的全部问题，使后期开发不再漂移」）：

- **修 `docs.mjs` 摘要误报**：testplan 统计只扫 §2 场景清单区间且首格须是场景 ID——此前 §0.1
  读者表的「❌ = 已知 bug…」被当成一条待修场景（❌1），§4 UVM 覆盖表的 ⚠️/🚫 行也被误计。
  现在 §2 计 152 条、❌0。
- **`--handover` 接手模式（只读）**：一条命令打印「status 首行总览 + log 最新块 + testplan 待办
  + 深入指引」，代替手动读三个文件；根 CLAUDE.md §3 已改为接手第一条命令。
- **status.jsonl 滚动归档**：首行外只留最新 12 行概括，更旧滚入新文件 `status-archive.jsonl`
  （本次滚出 38 行）；`--check` 超限拦提交。
- **目录树守卫**：log.md「目录结构约定」块与磁盘 .ts/.mjs **双向比对**，漏登记/幽灵文件即
  `--check` 失败（已用临时文件做过反向验证）。
- **常青块修缮（漂移清账）**：交接指引 CLAUDE.md §4→§3 改正；省 token 注更新（SettingsTab 早已
  拆成壳 + tabs/，旧注仍写「~1000 行待拆」）；目录树补齐 `settings/tabs/` 七个 TAB、
  `scripts/sync-plugin-repo.mjs`、`publish/`、`status-archive.jsonl`。
- **单一事实源收敛**：testplan §5 不再复述通用周期步骤（唯一事实源 = 根 CLAUDE.md §4），只留
  fuzz/UVM 约束、§3 回填、摘要三条本文档特有规则。
- **根 CLAUDE.md 同步**：接手命令、grep 定位菜谱（按状态决定读多少）、§3.1 表补 status-archive
  与专项文档引用规则、§7 守卫描述更新；新增仓库级 `doc/workflow.html`（面向人类的工作流可视化
  单页，Claude 视觉风格 + 动态流水线/终端回放/守卫脉冲）。

**没做什么**：插件源码零改动（301 passed 不变）；上周期遗留的实机手验 / 发布仓库首推照旧。

**下一步**：同 0.7.17——用户本地首推发布仓库 → 实机截图 + 手验（L 类全量）→ 发布自检 →
bump 1.0.0 → 社区 PR。

**验证方式**：`npm run docs`（❌ 误报消失、目录树守卫通过、status 滚动至 12 行）；
`npm run docs -- --handover` 打印三段；`touch src/zz.ts` 后 `--check` 非零退出（守卫生效）；
preflight 全绿。workflow.html 用浏览器打开查看动效。

---

## 2026-07-03 0.7.17 GUI 五连修 + IME 感知 + 清库先关开关（claude/obsidian-plugin-repo-setup-steypn）

**做了什么**（用户五点 GUI 优化 + 追加一点清库直觉修正，全部落地）：

- **TAB 栏窄屏溢出修复**（L21）：`.ah-tabs` overflow-x:auto + nowrap + flex-shrink:0——栏自身横向
  滑动，设置页绝不被撑宽。
- **TAB 图标化**（L22）：lucide 图标（`setIcon`，SVG currentColor 黑白随主题；不用 emoji——系统
  emoji 字体固定彩色不吃 CSS，用户认可）。未激活仅图标（aria-label/title 出名称），激活 = 图标 +
  文字 + 强调色背景。映射：settings / folder-cog / alert-triangle / info。
- **IME 感知**（J8/L25）：① document 级 compositionstart/end 维护 `imeComposing`，防抖到点若在
  组合中则**顺延一个周期**（main.test J8 ✅）；② 设置面板全部文本输入（textCell 前后缀/间隔符、
  占位字符、白名单添加/搜索/行内编辑）`isComposing` 期间不提交，compositionend 后提交一次；
  IME Enter（确认候选）不再误触发添加/提交。占位字符输入改原生监听（TextComponent.onChange 无法
  感知组合，组合中 setValue 回写会打断输入法）。
- **模板编辑面板重排**（L23）：折叠钮（▸/▾）**前置**作展开标志、模板名紧随（点击均可切换）；
  展开时整行变**大框**扩住标题行+面板，面板缩进 26px 与模板名左对齐；「跳级缺失层级/占位字符」
  上移到网格前归组；网格装入「级别格式」子框（新 i18n 键 levelFormatHeading），与白名单子框对称
  （白名单整块也加了框）。TemplatesTab 标题行由 Setting 改为自绘 header（chevron+name+desc+删除）。
- **序号标签精简**（L24）：下拉由「阿拉伯数字 (1, 2, 3)」改为纯示例「1, 2, 3」，七样式双语同值。
- **白名单分段控件修复 + 默认 A–Z**（L15/L17）：弃 `all:unset` 改显式重置（appearance:none 等）——
  移动端 Obsidian 按钮默认样式曾令选中高亮失效；选中态强调色背景+加粗。`wlSort` 默认 "added"→"az"。
- **清库先关全局自动编号**（H7，用户追加）：确认清库 → `settings.autoNumber=false` 落盘（面板即时
  刷新）→ 再清——否则清完开关还开着、一编辑又被编回去，反直觉。双语 desc 与确认对话框注明；
  frontmatter true 不受全局开关约束，故清库中的临时压制（vaultClearInProgress）保留。
  main.test H7 ✅。
- **mock**：补 `setIcon` 空实现与 `Plugin.registerDomEvent`。测试 +2，**301 passed**。

**没做什么**：L21–L25/N9/F10 等 DOM 项待实机手验；README 截图 / 发布仓库首推，同前遗留。

**下一步**：用户本地首推发布仓库 → 实机截图 + 手验（L 类全量）→ 发布自检 → bump 1.0.0 → 社区 PR。

**验证方式**：`npm test` 301 passed；preflight 全绿。Obsidian 手验：窄屏 TAB 栏可滑不撑宽；TAB 仅
图标、激活变强调色底+文字；中文打拼音时前后缀输入与正文标题都不再逐键刷新；模板行 ▸ 前置、展开成
大框、名称与内容对齐；序号下拉纯示例；白名单选中分段高亮、默认 A–Z；清库后「全局自动编号」应变关。

---

## 2026-07-02 0.7.16 白名单行布局 + 分段控件 + TAB 改名（claude/obsidian-plugin-repo-setup-steypn）

**做了什么**（白名单视觉优化讨论定案：行布局 + 分段控件 + tooltip + 行内编辑 + 空态引导；
文本模式不做；另 TAB 改名与分区节头强化）：

- **白名单行布局**（WhitelistEditor 重写，替代 chips，testplan L16）：每条一行 = 词语（弹性占满、
  溢出省略号）+ 匹配方式**分段控件**（`=`/`≈`/`▸` 三项常驻、单击切换、选中强调色高亮、tooltip 复用
  matchExact/Partial/Subtree 双语文案，L17）+ 命中数角标（**tooltip 列出命中标题**，超 8 条截断加
  `…(+N)`，L19）+ ⚠ 告警 + ✕ 删除。行容器带边框圆角、行间分隔线、hover 高亮。删除 / 改匹配仍按
  **原始下标**回查（过滤排序视图下不错位）；搜索 + 排序工具栏与既有语义不变。
- **行内编辑**（L18）：点击词语变输入框，Enter/失焦提交、Escape 取消；空 / 未变更 / 与他条重复
  （同词语+匹配方式）时还原不写入；提交即保存 + 重编当前文件。
- **引擎**：`analyzeWhitelist.perEntry` 新增 `matches: string[]`（命中标题剥前缀后的展示文本，
  与 count 等长；whitelist.test.ts +1 例，含带 WJ 旧前缀剥净断言）。
- **空态引导**：wlEmpty 由「（暂无条目）」改为一句引导文案（双语）。
- **TAB 改名**：「路径与模板」→「路径模板」（仅中文；en 仍 Paths & templates）。
- **分区节头强化**（L20）：路径规则 / 模板两节头挂 `ah-section-head`——左侧强调色竖条 + 加大字号。
- **决策**：`.gitignore` 式前缀语法「文本模式」**不做**（与模板 JSON 手改重复 + `=`/`~`/`>` 开头词语
  转义歧义），已记 spec §3.7。
- 测试 +1，**299 passed**。

**没做什么**：L16–L18/L20 的 DOM 手验（实机）；README 截图 / 发布仓库首推，同前遗留。

**下一步**：用户本地首推发布仓库 → 实机截图（顺带手验 L9–L20/N9/F10）→ 发布自检 → bump 1.0.0 → 社区 PR。

**验证方式**：`npm test` 299 passed；preflight 全绿。Obsidian 手验：白名单应为带边框行列表，
每行 `=`/`≈`/`▸` 分段控件选中项高亮；点词语可改；命中角标 hover 列标题；「路径模板」TAB 内
两节头带左侧竖条。

---

## 2026-07-02 0.7.15 skipFill 第三策略「不编号」（claude/obsidian-plugin-repo-setup-steypn）

**做了什么**（用户问「跳级标题是否有完全不编号的需求」——判定有：H5/H6 常被当**样式性小标题**用，
跳级正是该用法的结构信号，白名单按文本、bottomLevel 按固定层级都覆盖不了「按上下文」的这种情形）：

- **`skipFill` 新增 `{mode:"none"}`**：跳级出现的标题（top 与本级之间有缺失段）**完全不编号、
  保持原样**（仅剥旧前缀）；仍推进计数器作重置边界；**正常嵌套的同级标题照常编号**。
  判定在 `numberHeadings`（缺失段 = 中间计数为 0）；抽出 `bareHeading` 助手与「超出编号区间」
  分支共用循环剥离到定点逻辑。`buildPrefix` 防御性兜底：none 下直调（如预览）按 drop 处理。
- schema / normalizeSkipFill 收口 none；GUI 跳级下拉加第三项「不编号（保持原样）」（占位字符输入
  仍仅 fill 显示）；skipFillDesc 双语改述。
- **UVM**：setSkipFill 改三策略等概率随机，新增 skipFill=none 覆盖 bin；500×60 + 5000×80 全绿。
- testplan 新增 **F7–F9**（none 基本 / 正常嵌套照编 / fill→none 状态转移，均 ✅）+ F10（DOM 手验 🔲）；
  spec §2.3 / §3.6 / 模板 JSON 字段说明同步三策略。测试 +3，**298 passed**。

**没做什么**：README 截图 / 发布仓库首推 / DOM 手验（F10、L14/L15、N9），同前遗留。
发布 README 的 skipped-level 表述是泛称、无需改。

**下一步**：同 0.7.14——用户本地首推发布仓库 → 实机截图 → 发布自检 → bump 1.0.0 → 社区 PR。

**验证方式**：`npm test` 298 passed；`npm run test:fuzz` 全绿。Obsidian 手验：跳级下拉应见三项；
选「不编号」后 H3→H5 的 H5 应剥净裸出、H2→H3→H4→H5 的 H5 应编 `1.1.1.1`。

---

## 2026-07-02 0.7.14 startIndex 下拉收窄为 0 / 1（claude/obsidian-plugin-repo-setup-steypn）

**做了什么**（用户指示：2–9 无明确需求，先只留 0/1，需求大再放开）：

- EditPanel 起始编号数字下拉由 0–9 收窄为**仅 0 / 1**；JSON 手改的其他值（引擎仍支持 [0,9999]）
  继续作为额外选项列出、不被静默改写。spec §3.4 / testplan N9 同步改述。
- 引擎与 UVM **不动**：`normalizeStartIndex` 全域不变；UVM `setStartIndex` 激励保留 2/5 等非 GUI 值，
  持续压引擎全域行为（GUI 收窄不缩小验证空间）。

**没做什么**：README 截图 / 发布仓库首推 / DOM 手验，均同 0.7.13 遗留。

**下一步**：同 0.7.13——用户本地首推发布仓库 → 实机截图 → 发布自检 → bump 1.0.0 → 社区 PR。

**验证方式**：`npm test` 295 passed；preflight 全绿。Obsidian 手验：下拉应只见 0 / 1；
手改模板 JSON `startIndex: 5` 重开面板应见 5 在列且当前选中。

---

## 2026-07-02 0.7.13 startIndex 下拉 + UVM 随机化 + MOB-1 结案（claude/obsidian-plugin-repo-setup-steypn）

**做了什么**（用户三点指示）：

- **startIndex GUI 改下拉**（EditPanel）：数字输入 → **下拉 0–9**（覆盖常见诉求、免输入校验）；
  JSON 手改的更大值（引擎仍支持至 9999）会作为额外选项列出、不被静默改写。选择即保存 + 重编 +
  `refreshPreviews()` 刷新各级预览。testplan N9 改述。
- **UVM 纳入 startIndex 随机化**（framework.ts）：新增 `setStartIndex` 激励（`[0,0,1,1,2,5]` 随机，
  偏 0/1），进 config 激励池与 allOps；覆盖率新增 **startIndex=0** / **startIndex-non-default** 两个
  bin（500×60 默认闭合）。记分板无需改动——参考模型与 DUT 共用同一模板对象重编裸文档。
  默认 500×60 + fuzz 5000×80 全绿。
- **MOB-1 结案**：用户移动端实测确认已解决、未再复现——判定由 0.7.2「遍历 `getLeavesOfType('markdown')`
  全部打开叶子」修复覆盖，未发现额外根因。testplan §3.4 行 ✅、spec M7 调查项勾除、README M7 行更新。

**没做什么**：README 实机截图 / GIF 仍待补；发布仓库首次推送仍留用户本地；L14/L15/N9 的 DOM 手验未做。

**下一步**：用户本地首推发布仓库（`npm run publish:repo`）→ 实机截图补进发布 README →
发布自检（user_tests 全量手测，含 L9–L15/N9）→ bump 1.0.0 → 社区 PR（repo 指向发布仓库）。

**验证方式**：`npm test` 295 passed（UVM 覆盖含新 bin，缺 bin 会报 missing）；`npm run test:fuzz`
5000×80 全绿；preflight 全绿。Obsidian 手验：编辑面板「起始编号数字」应为下拉 0–9，选 0 后预览
首段变 0；手改模板 JSON `startIndex: 12` 重开面板应见 12 选项在列。

---

## 2026-07-02 0.7.12 M8 批次 1 提前完成 + 独立发布仓库落地（claude/obsidian-plugin-repo-setup-steypn）

**做了什么**（用户指示：恢复此前取消的 M8 批次 1 与独立发布仓库，两项均落地）：

- **startIndex 起始编号数字**（模板级，默认 1）：**仅首段**（topLevel 对应段）从该值起、深层仍从 1 起
  （设 0 得 `0.1.1`）。实现为 `buildPrefix` **渲染期偏移**（计数器恒 1 起，0 仍是跳级哨兵、占位符不受
  偏移影响；剥离靠 WJ 边界与字形无关）。`normalizeStartIndex` 夹 [0,9999]、缺失回退 1（旧模板兼容）；
  schema 收口；GUI 在编辑面板「结束编号层级」后加数字输入（仅数字、空按 1、预览即时跟随——文本输入
  不走 tab.display() 整页重绘防丢焦点，`refreshPreviews` 只刷预览格）。规格 spec §3.4；testplan 新增
  **N 类 9 行**（N1–N8 ✅ + N9 GUI 手验 🔲）。
- **白名单编辑器搜索 / 排序**：`filterSortWhitelist` 纯视图函数（whitelist.ts）——过滤与命中判定同一套
  归一化（NFKC/小写/折叠空白），排序 添加顺序 / A–Z（localeCompare）/ 匹配方式（exact→partial→subtree
  稳定分组）；**不改存储数组**，视图携带原始下标（删除 / 改匹配 / 命中数按原下标回查）。GUI：chips 上方
  工具栏（搜索框 + 排序下拉），键入只重绘 chips 区域，视图态挂 SettingsTab 跨重绘保持。testplan
  **L14/L15**（逻辑 ✅ / DOM 手验 🔲）。
- **独立发布仓库 + 同步脚本**：`publish/` 模板目录（英文主 README + README.zh.md 互链、`.gitignore`、
  tag 触发的 Release 工作流、精简 package.json）+ `scripts/sync-plugin-repo.mjs`（`npm run publish:repo`）：
  build → 白名单同步 src/+产物+模板到发布仓库克隆 → `release: <version>` 提交推送，`--tag` 打 tag 触发
  草稿 Release；`--dry-run`/`--no-push`/`--repo`/AAH_PLUGIN_REPO。已用本地临时 git 仓库验证：同步后文件树
  干净（无 doc/tests/scripts）且 `npm install && npm run build` 独立构建通过。
- **发布物料**：商店**无** README 按语言自动切换机制（只渲染仓库 README.md），采「英文主 + 中文互链」，
  「自动切换」由插件界面 i18n 承担；README 含 WJ 显式披露、默认 1.1.1、安装/命令/撤销说明、截图占位。
  manifest `description` 转英文、补 `authorUrl`。
- **测试**：+15（numbering N1–N8+预览、whitelist filterSort ×5、schema startIndex），**295 passed**；
  fuzz（5000×80）全绿。

**没做什么**：README 截图 / GIF（需实机 Obsidian，占位注释已留）；发布仓库**首次推送**（本会话 GitHub
权限仅限本仓库，由用户本地跑 `npm run publish:repo` 完成）；L14/L15/N9 的 DOM 手验；UVM 未把 startIndex
纳入随机化（参考模型需同步扩展，留后续）；MOB-1 未动。

**下一步**：用户本地首推发布仓库 → M7 收尾：MOB-1 移动端复现诊断 → 实机截图补进发布 README →
发布自检（user_tests 全量手测，含 L9–L15/N9）→ bump 1.0.0 → 社区 PR（repo 指向发布仓库）。

**验证方式**：`npm test` 295 passed；`npm run test:fuzz` 全绿；preflight 全绿。脚本验证：
`npm run publish:repo -- --repo <临时git仓库> --no-push` 后目标可独立 build。Obsidian 手验：编辑面板
应见「起始编号数字」（设 0 → 预览 `0 / 0.1`）；白名单条目上方应见搜索框 + 排序下拉。

---

## 2026-07-02 0.7.11 多 TAB 设置页 + Backlink 默认开（claude/m7-design-plugin-repo-ufjphg）

**做了什么**（M7 剩余两大代码项，规格新增 spec §3.13、§3.12 更新决策注）：

- **设置面板多 TAB 重构**：`SettingsTab.ts`（原 1029 行）拆为**壳**（TAB 栏 + 分发 + 视图态，~130 行）
  + `settings/tabs/` 五分区（GeneralTab / TemplatesTab / PathRules / EditPanel / WhitelistEditor /
  DangerTab / AboutTab，均 <300 行可整读）。四 TAB：全局设置 / 路径与模板 / 敏感操作 / 关于。
  - **敏感操作 TAB**：⚠ 说明 + 三个清除入口——「清除当前文件 / 清理外来编号」补面板入口（走
    `main.activeMarkdownContext()`：`getActiveViewOfType` 为 null 时按 `getActiveFile()` 回退，N1 同源；
    无文件弹 Notice）；「清除全库」二次确认保留，且**清除期间临时压制全局自动编号 + 取消全部待处理
    防抖**（`vaultClearInProgress` 内存标志，完毕含异常恢复）——否则批量写回触发 editor-change，刚清掉
    的编号会被编回去（testplan **H6** ✅）。旧「危险区域默认折叠」由 TAB 隔离取代（L8 改述）。
  - **配套**：预览每级 3 例 → **2 例**；全部设置说明**一句话化**（长解释下沉 spec）；模板网格与路径
    表格窄屏横向滚动（styles.css overflow-x）；**默认模板显示名随语言**（GUI 显示「默认」/「Default」，
    存储名 / default.json / 规则引用不变，`templateDisplayName()`）；「关于」TAB 出版本 + 仓库 / Issues 链接。
- **Backlink 开关曝光度**（决议 + 落地）：`updateBacklinks` **默认开**（`DEFAULT_SETTINGS` + loadSettings
  迁移：缺失字段视为开、显式 false 保留）；**首次实际改写引用文件时弹一次说明 Notice**（12s，说明改动
  不在被改文件 undo 内 + 在哪关；`backlinksIntroShown` 持久化只弹一次）；面板上紧跟「全局自动编号」、
  作普通设置项**自然呈现**（按用户指示不做高亮）。testplan **M17/M18** ✅、M 节头注更新。
- **测试**：+4（settings 默认值 ×2、Backlink 首次 Notice、清库压制防抖），280 passed；main.test 假 vault
  补 `getMarkdownFiles/read/modify` 三接口。

**没做什么**：M8 批次 1（startIndex、白名单 Filter/Sort）与「独立发布仓库」**按用户指示取消**（本周期
中途实现过 startIndex + Filter/Sort，已全部回退，不留代码）；MOB-1 未动。

**下一步**：M7 收尾——MOB-1 移动端复现诊断 → 英文 README（含 WJ 披露）+ 截图 → 发布自检
（user_tests 全量手测，含 L9–L13 多 TAB 手验）→ bump 1.0.0 → 社区 PR。

**验证方式**：`npm test` 280 passed；preflight 全绿。Obsidian 手验：设置页应见四 TAB；敏感操作 TAB
三按钮可用；新装（删 data.json）Backlink 默认开、首次同步弹说明；模板预览每级两例。

---

## 2026-07-02 0.7.10 D1 落地：子树白名单块后计数器重置（claude/obsidian-auto-headings-review-0vwqat）

**做了什么**：实现决策 **D1**（2026-07-02 已定，调研 ~85% 文档规范支持）——**子树**豁免块视为独立结构
（如附录），块结束后计数器**整体重置**、其后编号重新开始（旧行为沿用块前计数，会得到令人困惑的 `3.2`）：

- **`src/whitelist.ts`**：新增 `computeWhitelistExemptionDetail`（返回 `{ exempt, subtreeMembers }`，
  子树块的根与子孙记入 `subtreeMembers`）；`computeWhitelistExemptions` 改薄封装，既有 API 不变。
- **`src/numbering.ts`**：`numberHeadings` 引入 `pendingSubtreeReset`——遇子树块成员置位，下一个
  **参与计数**的标题先 `counter.reset()` 再 bump。语义边界：① `exact`/`partial` 单标题豁免**不**重置、
  也**不打断**重置（夹在块与下一编号标题之间照常重开）；② 显式 `isWhitelisted` 回调（单测注入）无
  子树信息 → 不触发重置，注入语义不变；③ 不设开关（法律文书连续编号场景不用子树白名单）。
- **GUI 文案**：`i18n.ts` 中英 `whitelistDesc` 注明「子树块视为独立结构，其后编号重新开始」。
- **测试**：`whitelist.test.ts` 新增 D9/D10 组 5 例（重开+子级重开 / 多块间隔 / exact 对照不重置 /
  夹豁免不打断 / 幂等），D4 首例期望按新语义更新（小结 2→1，注明 0.7.10 前行为）。276 passed（+5）。
- **文档**：testplan D9/D10 → ✅；spec CR-05 / §3.5 / §3.7 决策注（→已实现）/ Roadmap M7 打勾；
  README 白名单条目与 M7 行同步。

**没做什么**：M8 的「子树重置 opt-out 开关」仍留观察（依上线后反馈）；MOB-1、多 TAB 未动。

**下一步**：M7 按序——MOB-1 移动端复现诊断 → 多 TAB 设置页（顺带拆 SettingsTab）+ 预览/文案精简 +
清全库临时关自动 + 默认模板名随语言 → 英文 README（含 WJ 披露）→ 发布自检（user_tests 全量手测，
含 D9 新场景）→ bump 1.0.0 → 社区 PR。

**验证方式**：`npm test` 276 passed；`npm run test:fuzz` 5000×80 全绿（UVM 参考模型与 DUT 同引擎，
D1 两侧一致）；preflight 全绿。Obsidian 手验：给模板加「附录」子树白名单，附录块后的同级标题应从 1 重新编号。

---

## 2026-07-02 0.7.9 源码按职责拆分 + 移除 codemap（claude/obsidian-auto-headings-review-0vwqat）

**做了什么**（结构性重构，**零行为变化**——所有逻辑与注释原样搬移，271 测试一字未改全绿）：

- **编号引擎四职拆分**：`numbering.ts`（1115 行）拆为五个 <300 行、单文件可整读的模块——
  `template.ts`（数据模型/默认值/规范化）、`count.ts`（HeadingCounter）、`render.ts`（渲染器 +
  buildPrefix + previewLevel）、`strip.ts`（三剥离器 + WORD_JOINER + 新抽 `StripAffixOptions`）、
  `whitelist.ts`（归一化/命中/预览）。`numbering.ts` 保留 numberHeadings/renumberContent 编排并
  **作对外 barrel 全量转发**——13 个引用文件（src+tests）import 零改动，拆分对调用方透明。
  依赖单向：template ← count ← strip ← render / whitelist ← numbering，无环。
- **settings 同名消歧**：`src/settings.ts` → `src/settings/model.ts`（数据模型与 GUI 同住
  `settings/`），3 处 import 更新。
- **移除 codemap**（源码已可直读，止痛药下岗）：删 `scripts/codemap.mjs` + `doc/codemap.md`；
  `docs.mjs` 去掉 syncCodemap（--check 不再比对新鲜度）；package.json 删 `codemap` 脚本；
  CI 步骤名与 CLAUDE.md §3 / 本文件读盘纪律同步改写——新纪律：**源码按职责拆到单文件可整读**
  （>~500 行且多职责 = 拆分信号），不靠派生文档止痛。
- 常青块「目录结构约定」与 spec §4 架构图更新为新模块布局。

**没做什么**：`SettingsTab.ts`（~1029 行）刻意未拆——它是 M7「多 TAB 设置页」重构的对象，届时
按 TAB 自然切分，现在拆会白做一遍。`i18n.ts`（501 行）是纯文案表，无拆分价值。

**下一步**：M7 按序——D1 子树白名单后计数器重置（先写 testplan D9/D10 断言）→ MOB-1 移动端复现 →
多 TAB 设置页（顺带拆 SettingsTab）+ 预览/文案精简 → 英文 README（含 WJ 披露）→ 发布自检 → 1.0.0。

**验证方式**：`npm test` 271 passed（测试文件零改动）；`npm run test:fuzz` 5000×80 全绿；
tsc / lint / format / build / `docs --check` 全绿。

---

## 2026-07-02 0.7.8 修 M14：Backlink 纯文本改名同步（快照基线）（claude/obsidian-auto-headings-review-0vwqat）

**做了什么**：修复 M7 必修项 **M14**（用户只改标题正文、编号不变时，指向该标题的 `[[a#…]]` 链接不更新）。
根因：改名表比较「编号前 vs 编号后」，用户改名发生在快照之前、两侧文本相同 → 检测不到。修法：

- **`src/backlinks.ts`**：新增 `HeadingSnapshot` / `snapshotHeadings`（level+text 快照）与
  `computeSnapshotRenames`（**按标题顺序**配对——基线与现内容之间正文行可能增删，行号不可靠；
  仅当结构一致〔数量 + 逐个层级相同〕才配对，否则返回 `null` 让调用方回退）。歧义剔除 / from 剥 WJ /
  to 保留 WJ 等规则抽成共用 `buildRenames`，`computeHeadingRenames` 改为薄封装（行为不变）。
- **`src/main.ts`**：新增 `headingSnapshots`（path → 快照，**与 `updateBacklinks` 开关无关地维护**）。
  播种：`file-open` 时 `cachedRead`（此刻是「用户改名之前」的状态）；刷新：统一入口
  `syncAndSnapshot`（先取旧基线、再写新快照、后异步 `syncBacklinks`——顺序不可反），挂
  `applyRenumber` + 两个清除命令；`clearAllVaultNumbering` 对已有基线的文件同步刷新；
  `vault.on("rename"/"delete")` 迁移 / 清理快照键；`onunload` 清空。
  **关键行为变化**：`applyRenumber` 即便编号无变化（无写回、txn=0）也走同步——纯文本改名正是这种情形。
  `syncBacklinks` 加 `baseline?` 参数：有快照优先 `computeSnapshotRenames`，null（无快照 / 结构变化）
  回退 `computeHeadingRenames`（编号侧改名仍同步）。
- **测试**：`backlinks.test.ts` +7（快照改名表：纯文本 / 文本+编号同变 / 行号移位按序配对 /
  数量·层级变化返 null / 歧义剔除 / 无变化空表）；`main.test.ts` +4（M14 链式改名连续有效、
  M15 白名单改名一步到位、结构变化保守回退、开关关不触碰）。FakeEditor 加 `setValue` 模拟用户编辑。
- **文档**：testplan M14/M15 → ✅、新增 M16（结构同轮变化回退，⚠️ 取舍）；spec §3.12 边界更新 +
  Roadmap M7 该项打勾；README/competitive 同步「纯文本改名已补」。

**没做什么**：M13（手敲时就不匹配的既有断链）不属本修复——无标题变更可触发，全库扫描修复留 M8。
审阅模式（决策 D2）留 M8。D1 子树计数器重置、MOB-1、多 TAB 面板未动（下一轮按序做）。

**下一步**：M7 继续按序——D1 子树白名单后计数器重置（先把 testplan D9/D10 写成断言再改引擎）→
MOB-1 移动端复现 → 多 TAB 设置页 + 预览/文案精简 → 英文 README（含 WJ 披露）→ 发布自检 → 1.0.0。

**验证方式**：`npm test` 271 passed（+11）；`npm run test:fuzz` 5000×80 三记分板全绿；
`npm run preflight` 全绿。Obsidian 手验：开 `updateBacklinks`，A 文件改标题正文（不动编号），
B 文件 `[[A#1 ⁠旧名]]` 应在防抖后变为 `[[A#1 ⁠新名]]`。

---

## 2026-07-02 0.7.7 文档与工作流调理：对账去陈旧 + ideas 落位 + CI/preflight（claude/obsidian-auto-headings-review-0vwqat）

**做了什么**（纯文档 + 脚本 + 仓库工作流，**未碰 `src/`**，插件行为零变化）：

- **ideas-analysis 结论落位后删除**（单一事实源纪律，已写入根 CLAUDE.md §3）：
  - **P0 → testplan M14**（❌，M7 必修）：纯文本改名 backlink 不同步——改名表比较「编号前 vs 编号后」，
    用户改名发生在快照之前检测不到；修法方向（缓存上次标题状态）写入 spec §3.12。配套 M15（🔲）。
  - **P1 → testplan §3.4 MOB-1**（🔲）：移动端改模板后部分打开文件未刷新，待 iOS 复现。
  - **P2/D1 → spec §3.7 决策注 + testplan D9/D10**（🔲）：子树白名单块后计数器**重新开始**（调研 ~85%
    规范支持，不设开关）；「全部/部分」豁免不受影响。
  - M7 UX（多 TAB 面板 / 预览精简 / 清全库时临时关自动 / 默认模板名随语言）与 M8（startIndex /
    白名单 Filter·Sort / backlink 审阅模式）全部并入 spec §5 Roadmap；「不做」项并入 §2.2 非目标。
- **spec 对账**：双语表述修正（简介 / CR-13 / 非目标）；§4 架构图 `cleanup.ts`「尚未实现」等陈旧注
  改为已落地并补 `backlinks.ts`/`i18n.ts`；Roadmap M6 复选框补勾、M7 重写（Backlink 编号触发 ✅ +
  新任务清单，含 WJ 用户级披露、Backlink 默认关曝光度重估、上架后版本策略）。
- **testplan 修陈旧**：E5/E12 改 ✅（方案A 已根治，`known_bugs.test.ts` 佐证）；§3.2 取舍表 L1/P1
  标注已随方案A失效；C4/C5 表格列错位修正；UVM 约束表字母样式行改「历史约束，放开留下轮专项」。
- **README 重写**：55 行变更日志式功能清单 → 分类简介（无版本号），细节指向 spec。
- **UVM 蓝图去重**：`uvm/README.md` 的蓝图长文（与 testplan §4.1 重复）压成指针 + 一句话现状。
- **status.jsonl 瘦身**：删除重复的 0.5.0 行；全部历史行压成真正的一句话（细节在 log-archive 无损）；
  `docs.mjs` 新增全行 JSON 校验 + summary 超 200 字警告。
- **工作流**：新增 **`npm run preflight`**（docs + release + test + lint + format:check 一条命令）；
  新增 **GitHub Actions CI**（`.github/workflows/ci.yml`，文档守卫 + 门槛全绿，pre-commit 的机器兜底）；
  **release zip 移出 git**（.gitignore + rm --cached，本地 `npm run release` 即时生成）；
  release/README 与 user_tests 索引（03/09 描述）去陈旧，新增「手动回归记录」表。
- **CLAUDE.md**：一句话流程改用 preflight；新增「单一事实源纪律」「上架后仅行为变化 bump」；
  §6 进度表 M3→M7；§7 补 CI 说明。

**没做什么**：全部代码类修复未动——M14（backlink 纯文本改名）、D1 引擎实现、MOB-1 复现、
多 TAB 面板、UVM 字母样式约束放开、孤儿残留 explore 专项，均留后续代码轮（顺序见 status「下一步」）。

**下一步**：M7 代码轮按序：**修 M14（必修）** → D1 子树计数器重置（先加 testplan D9/D10 断言）→
MOB-1 复现 → 多 TAB 设置页 + 预览/文案精简 → 英文 README（含 WJ 披露）→ 发布自检（跑 user_tests
手动回归表）→ bump 1.0.0 → 社区 PR。

**验证方式**：`npm run preflight` 全绿（260 passed 不变，纯文档/脚本改动）；CI 首跑绿即兜底生效。

---

## 2026-06-30 0.7.6 UVM 扩展阶段 2：World→Vault 多文件+多模板+路径规则+S7（缺口③）（claude/obsidian-headings-uvm-test-y8wdjh）

**做了什么**：按用户「搞定阶段 2，考虑尽可能多的真实用户操作」，把 `framework.ts` 的 `World` 从「单文件单模板」
重构为**多文件 + 多模板 + 路径规则的仓库模型**，纳入缺口③的全部真实用户操作：

- **多文件**：`files[]`（各文件独立 bare/rendered/frontmatter）+ `cur` 当前文件 + `switchFile` 切换。
  `bare`/`rendered`/`frontmatterState` 改为 getter/setter 委托到当前文件，原编辑/触发逻辑零改动复用。
- **多模板**：`templates[]` 命名模板集（锚点「默认」+ 随机 1–2 个，**共享前后缀候选池** → 固定剥离并集恒为
  真实 `strippableAffixes()` 上界）。config 类激励改**随机挑一个模板** `tpl` 的字段（原 `this.template` 全替换）。
  生命周期：`createTemplate`（≤3 个）/ `deleteTemplate`（锚点不可删，引用其的规则降级·改投·连删）/
  `renameTemplate`（改名 + 同步规则）。
- **路径规则**：`pathRules[]` + `addRule`/`deleteRule`/`editRulePattern`/`setRuleTemplate`/`reorderRule`；
  当前文件经真实 `resolvePathRule` + 查找解析生效模板（= 插件 `getTemplateForFile`），删根规则/无命中 →
  无模板（自动静默 / 手动无操作，I7/K6）。
- **S7 模板解析记分板** `checkResolution`：① 无悬挂引用（每条规则引用的模板都存在 → 生命周期同步正确）；
  ② 锚点恒在；③ 真实 `resolvePathRule` 与**独立参考解析** `expectedResolve` 一致（具体度 + 并列取后者）。
- 跨模板残留（B2/B3 真实形态）由参考模型**每文件**压测；trigger 用解析模板，`check`/`checkIdempotent`/
  `detectWhitelistCoverage`/`exemptBareIndices` 改接收模板参数。`finish` 补根规则后逐文件手动触发结算。
- 新增覆盖率 bin（multi-template / cross-template-switch / null-resolution / resolve-root·folder·file /
  9 个生命周期 op + file-switched）500×60 闭合。

**压力测试结果（不 debug 只记录）**：8000×80 + **20000×80** 三记分板（参考 + 幂等 + Backlink，叠加 S4/S5/S6/S7）
**全绿，未发现引擎 bug**。修了一处**框架自身**边界（非引擎）：`deleteTemplate` 连删可能把 `pathRules` 清空，
`editRulePattern`/`setRuleTemplate` 取 `rng.int(0)` 越界 → 加空数组守卫。

**没做什么**：未改任何 `src/`（只改 `framework.ts` + 文档）——插件行为零变化，260 测试不变。缺口④（Backlink 开关
门控）属集成层（main.ts `syncBacklinks` + 半公开 API），与 `getBacklinksForFile` 适配同源，留 `main.test`（M2）。
**剥离并集**取共享候选池上界（方案 A）；放开「各模板用不同候选 + 按活模板动态算并集 → 删模板孤儿残留」留 backlog。

**下一步**：UVM 扩展蓝图阶段 1+2 全部落地，验证空间已覆盖「用户实际会触及」的绝大多数操作。回到 M7 上架
冲刺主线：用户 Obsidian 复测 M11 → 英文 README → bump 1.0.0 → 提交社区 PR。

**验证方式**：`npm test` 260 passed；`AAH_FUZZ_RUNS=20000 AAH_FUZZ_OPS=80` 三记分板全绿；lint / format / 覆盖率闭合全绿。
复现单条：`AAH_FUZZ_SEED=<n> AAH_FUZZ_RUNS=1 AAH_FUZZ_OPS=80 npx vitest run tests/dev_tests/random_sequence.test.ts`。

---

## 2026-06-30 0.7.5 UVM 扩展阶段 1：清除命令 S4/S5 + 两层门控 S6（缺口①②）（claude/obsidian-headings-uvm-test-y8wdjh）

**做了什么**：按用户「1、2 都做，跑压力测试，不 debug 只记录」落地扩展蓝图**阶段 1**——把两类真实用户操作
纳入 `framework.ts` 激励空间与记分板（原框架只压 `renumberContent`）：

- **缺口①清除命令**：新增激励 `clearNumbering`（DUT `clearNumberingContent`）/ `clearForeign`
  （DUT `clearForeignNumberingContent`），配 **S4 清除还原律**（清除编号 → 还原裸文档）+ **S5 清外来不动律**
  （清外来 → 不动自家 WJ 编号）。守卫：只在「裸文档为 clear 定点」（`clear(bare)===bare`）时施加并断言，
  自动排除自食前缀 / 白名单豁免 / 像外来编号的裸标题；且**仅参考模式**施加。
- **缺口②两层触发门控**：新增 `setFrontmatterSwitch`（true/false/非法/删除，渲染成真实 `---` 块）/
  `setAutoNumber`（全局开关）。触发分**手动**（`manualTrigger`，绕过门控，对应「立即重新编号」）/**自动**
  （`trigger`，过真实 `readFileSwitch` + 全局开关的 `shouldAutoTrigger`）。**S6 门控**：门控关时 `rendered`
  冻结（自动触发不应用）、且真实 `readFileSwitch` 解析与结构化 fm 状态一致（`checkGate`）。
- 新增覆盖率 bin（gated-off / fm=false·true·illegal / autoNumber-off-trigger / manual-trigger /
  clear-restore(S4) / clear-foreign-noop(S5)），500×60 默认运行**闭合**。

**压力测试结果（不 debug 只记录）**：8000×80 两记分板（参考 + explore 幂等）+ S4/S5/S6 **全绿，未发现引擎 bug**。
唯一记录的边界：explore 模式 `mutatePrefix` 故意抹掉 WJ 后，「清外来」剥掉失去 WJ 的残缺前缀属**预期**
（用户破坏了编号、插件靠 WJ 认不出是自家的），S5「无操作」前提随之不成立——故 S4/S5 仅在参考（干净）模式
施加。登记为 testplan §3.2 取舍 **S5b**（非 bug）。

**没做什么**：未改任何 `src/`（只改 `tests/dev_tests/uvm/framework.ts` + 文档）——插件行为零变化，260 测试不变。
缺口③（多文件 + 多模板 + 路径规则，S7）、缺口④（Backlink 开关门控）属结构性升级，留**阶段 2**（World→Vault）。

**下一步**：评审阶段 1 后按 testplan §4.1.5 做阶段 2（`World→Vault` 多文件多模板 + S7 模板解析稳定律 +
真实 `strippableAffixes()` 并集）。M7 上架冲刺主线（Obsidian 复测 M11 → 英文 README → 1.0.0 → 社区 PR）并行不受影响。

**验证方式**：`npm test` 260 passed；`AAH_FUZZ_RUNS=8000 AAH_FUZZ_OPS=80` 两记分板全绿；lint / format / 覆盖率闭合全绿。
复现单条：`AAH_FUZZ_SEED=<n> AAH_FUZZ_RUNS=1 AAH_FUZZ_OPS=80 npx vitest run tests/dev_tests/random_sequence.test.ts`。

---

## 2026-06-30 0.7.4 UVM 扩展蓝图（纯文档·待评审，未碰 src/测试）（claude/obsidian-headings-uvm-test-y8wdjh）

**做了什么**：应需求「把插件展现给用户的**全部**操作纳入 UVM 验证框架」，先做**分析 + 书面方案**
（用户选 D：先交付蓝图评审，暂不写代码）。逐文件核对了用户操作面（main.ts 命令/门控、SettingsTab
全部 GUI 操作、pathrules/frontmatter/cleanup 语义），与现框架 `OpKind` 激励空间对照，定位四大缺口：
①清除命令（`clearNumberingContent`/`clearForeignNumberingContent`）整个 DUT 家族零覆盖；②两层触发门控
（frontmatter×全局 autoNumber）UVM 永远无条件触发；③多模板+路径规则+多文件（真实 `strippableAffixes()`
并集从未跑到，现用假并集近似）；④Backlink 开关门控未在随机空间建模。为每个缺口配恒成立新记分板
S4 清除还原律 / S5 清外来不动律 / S6 门控冻结律 / S7 模板解析稳定律，并给出 `World→Vault` 结构升级、
新增 `OpKind` 清单、需求驱动约束（非盲目随机）、覆盖率 bin、分阶段实现路线。

**落点**：`doc/testplan.md` 新增 §4.1「扩展蓝图」（人类操作全清单×覆盖状态表 + 缺口排序 + 四不变量 +
World→Vault 设计 + 分阶段）；`tests/dev_tests/uvm/README.md` 新增「升级蓝图」摘要（指向 testplan §4.1）。
全部明确标注**规划/待实现**，不暗示已有测试。bump 0.7.3→0.7.4。

**没做什么**：未改 `framework.ts` / 任何 `src/` / 任何测试——行为零变化，260 测试与 8000×80 不受影响。
未实现 S4–S7 任何一条。

**下一步**：评审本蓝图后按 §4.1.5 落地。建议**阶段 1 先行**（清除命令新激励 + S4/S5 + 两层门控 + S6，
单 `World` 内增量，风险低），跑 explore 实测确立 S4/S5 的排除项（自食前缀/白名单豁免/空标题）；
阶段 2 再做 `World→Vault` 多文件多模板重构 + S7 + 真实并集。M7 上架冲刺主线（Obsidian 复测 M11 →
英文 README → bump 1.0.0 → 社区 PR）不受影响，UVM 扩展属并行的验证强化。

**验证方式**：纯文档改动，`npm test` / `lint` / `format:check` 应仍全绿（行为未变）；`npm run docs` 归档自检。

---

## 2026-06-30 0.7.3 修 Backlink 实测断链：写入链接保留 WJ（M11 根治）（claude/obsidian-auto-headings-release-lfniw0）

### 背景

用户实测 0.7.2 backlink：开开关后，指向**编号标题**的内部链接「没更新 / 不生效」，唯独在被引用文件里手动跑
「清除编号」命令才生效。关键线索：**清除后是裸标题（无 WJ）→ 链接生效；编号态（含 WJ）→ 链接失效**。

### 根因（M11 落实为真 bug）

编号写入的标题含不可见 Word Joiner（`## 1 ⁠标题`）。0.7.1 的 `linkAnchor` 在**写入侧也剥 WJ**，于是写出
`[[a#1 标题]]`（无 WJ）。**Obsidian 标题锚点解析按字节比对、不剥 WJ**，故剥了 WJ 的链接解析不到含 WJ 的标题
→ 显示断链（用户感知「没更新」）。清除编号得裸标题，链接（无 WJ）反而能解析——正是用户观察到的现象。

### 做了什么

- **`src/backlinks.ts` 拆双口径锚点**：
  - `linkAnchor`（**匹配用**：改名表 `from` + 引用链接 subpath）：仍**剥 WJ**，含不含 WJ 的既有链接都能匹配。
  - 新增 `displayAnchor`（**写入用**：改名表 `to`）：**保留 WJ** + 去 `[ ] # | ^` + 折叠空白（WJ 不在 `\s` 内，
    不受折叠影响）。写出的链接 `[[a#1 ⁠标题]]` 与真实标题字节对齐 → Obsidian 必然解析（裸标题无 WJ 时两者等价）。
  - `computeHeadingRenames`：`from=linkAnchor(旧)`、变化判定 `linkAnchor(新)`、`to=displayAnchor(新)`（仅 WJ 差异不算变化）。
- **测试**：`backlinks.test.ts` 加 `displayAnchor` 块 + 改 `computeHeadingRenames` 期望（`to` 带 WJ）；`main.test.ts`
  集成期望链接含 WJ。UVM 往返记分板**无需改**（两侧都过 `linkAnchor` 比较，WJ 无关），8000×80 全绿。260 passed（+2）。
- 文档：spec §3.12 锚点归一改「匹配/写入双口径」+ M11 标已修；testplan M11→✅(待 Obsidian 复测)、新增 M13（只在编号
  改写标题时同步，对「已编号后手敲的不匹配链接」不主动修——设计取舍）。bump 0.7.2→0.7.3。

### 没做什么

- 未改 WJ 在标题里的存在本身（方案 A 核心，保留）；只改链接生成口径。
- 「已编号态、之后手敲不匹配链接」不主动修（需真实标题变更触发）——属设计取舍，登记 testplan M13。

### 下一步

1. **用户 Obsidian 复测 M11**：编号标题 + 别处链接 → 改动标题（增删上方标题致重排）→ 链接应自动跟新且**可点开解析**。
2. 无碍后英文 README → bump 1.0.0 → 提交社区 PR。

### 验证方式

- `npm test` 260 passed；8000×80 两记分板 + backlink 往返全绿；lint / format / build / release 全绿。
- `displayAnchor` 保留 WJ、`linkAnchor` 剥 WJ 由 `backlinks.test.ts` 钉死；集成链接含 WJ 由 `main.test.ts` 覆盖。

---

## 2026-06-30 0.7.2 修三个实测 GUI / 触发 bug（改模板不刷新 / 新增模板卡顿 / 整行可拖动）（claude/obsidian-auto-headings-release-lfniw0）

### 背景

用户实测 0.7.1 报三个 bug（其中 N1 导致 backlink 无法实测，因为改模板不触发重排）：

### 做了什么

- **N1 改模板样式后已编号标题不刷新**（一→①，根因，连带 backlink 测不了）：`renumberActiveFile` 原用
  `getActiveViewOfType(MarkdownView)`，**设置面板是模态层、打开时活动视图常为 `null`** → 静默跳过。
  改为遍历 **`getLeavesOfType("markdown")` 全部打开叶子**逐个重排（仍按 shouldAutoTrigger + 路径解析模板门控），
  顺带支持多文件同时刷新。`main.test.ts` 加两条回归（一→①刷新、多叶子同时重排）。
- **N2 新增模板卡顿 / GUI 不第一时间显示**：新增按钮原 `await templateStore.create()`（含磁盘写入）后才
  `display()`，慢盘 / 同步库阻塞。`TemplateStore.create` 改**同步加内存 + 后台落盘**（`void write().catch()`），
  点击即重绘；落盘失败仅退化为「重启丢该模板」，无破坏。按钮 onClick 去掉 await。
- **N3 路径规则整行可拖动**：`draggable` 原设在整行 `row`（妨碍路径输入框选词）。改为 `draggable` +
  `dragstart`/`dragend` 只挂 `⠿` 手柄，行仅作放置目标（dragover/drop 不变）。新增 i18n `dragHandleTooltip`。

### 没做什么

- 未碰编号引擎 / backlink 核心（纯触发层 + GUI + TemplateStore）。
- 白名单预览的 `currentFileHeadings/currentFilePath` 仍用 `getActiveViewOfType`（同源潜在问题，但未被报告、
  且「当前文件」预览语义在多叶子下本就模糊，留观察）。

### 下一步

1. 用户重测：改模板样式即时刷新 → 进而**实测 M11**（WJ 链接能否被 Obsidian 解析，1.0 前必验）。
2. 无碍后英文 README → bump 1.0.0 → 提交社区 PR。

### 验证方式

- `npm test` 258 passed（+2）；lint / format / build / release 全绿。
- N1 回归：`main.test.ts` 改样式后 `## 一 ⁠章`→`## ① ⁠章`、多叶子各自 `## 1 ⁠X`。

---

## 2026-06-30 0.7.1 Backlink 同步落地（M7 核心，opt-in 默认关）+ UVM 纳入往返不变量（claude/obsidian-auto-headings-release-lfniw0）

### 背景

承 0.7.0 立项：Backlink 同步是上架前唯一硬短板。先扒了竞品 **Header Enhancer** 的 `src/backlinks.ts` 实现
（命令驱动 / `getBacklinksForFile` 反查 / `vault.read`+`vault.modify` 写回 / 子串匹配 / 不处理别名与重复标题），
确认架构可抄、四处可做得更稳。spec §3.12 已据此补全（4 改进 + 2 风险规避）。本周期落地实现。

### 做了什么

- **新增 `src/backlinks.ts`（纯函数核心，可纯单测）**：
  - `linkAnchor`：标题→锚点归一（剥 WJ + 去 `[ ] # | ^` + 折叠空白 + trim），**两侧同口径**故含不含 WJ 都匹配，写出链接剥 WJ 干净。
  - `computeHeadingRenames(old,new)`：两侧 `parseHeadings` 按 `lineIndex` 配对（编号不重排行），取变化且非空者；**重复旧锚点歧义剔除**（保守不改）。
  - `rewriteBacklinksInContent`：正则扫 `[[…]]`/`![[…]]`，basename 命中 + subpath 归一命中才改，**保留别名 `|alias` 与嵌入 `!`**；块引用 `^`/多级锚点 `#A#B`/同文件内链分别处理。
- **接线 `src/main.ts`**：新增 `syncBacklinks(target,old,new)`——`updateBacklinks` 开 + 改名表非空才进入（日常打字零开销）；`getBacklinksForFile` 取 `.data` Map 反查、`vault.process` **原子**写回（优于 Header Enhancer 的 read+modify）；半公开 API 缺失静默降级、**绝不打断编号**。挂到 `applyRenumber`（自动/手动/改模板三路径）+ 两个清除命令。
- **设置 / i18n / GUI**：`settings.updateBacklinks`（默认 false + loadSettings 迁移）；i18n 加 `updateBacklinksName/Desc` + `noticeBacklinksUpdated`（中英）；SettingsTab 防抖滑块下加开关。
- **比 Header Enhancer 改进 4 处**（spec §3.12）：原子 `vault.process` / 保留别名嵌入 / 重复标题保守不改 / 自动路径 gate。规避 2 风险：未文档化 API 适配降级、不用子串匹配。
- **扩大 UVM 验证范围**：framework 新增**第三块记分板** `checkBacklinkRoundTrip`（两 oracle 都跑）——断言改名表幂等 + 链接重写往返一致（`[[Target#旧]]` 重写后恰指向同标题新名），覆盖率加 `backlink-rename` bin。**8000×80 全绿**（撞出并修正一处不变量边界：标题被编号吃成空锚点时按设计不改名，排除出断言）。
- **测试**：新增 `backlinks.test.ts`（20，纯函数：归一/改名表/重写各边界）；`main.test.ts` +4（集成：开关开/关、清除同步、幂等不改）。**256 passed**（+24）。
- 文档：spec §3.12 重写 + TOC、testplan 新增 **M 类**（M1–M12）+ §4 三记分板、README 功能条 + Milestone。bump 0.7.0→0.7.1。

### 没做什么

- **未在 Obsidian 内实测 WJ 链接解析**（testplan M11，**user_tests 必验**）：写出的链接剥 WJ、真实标题含 WJ，需确认能解析；若否，改为生成侧保留 WJ（`linkAnchor` 仅匹配侧剥），一行可切。
- 重复同名标题精确消歧（`#标题-1`）、多级锚点 `#A#B`、全库扫描修历史断链：**保守跳过**，留 M8 backlog。
- 同文件内链 `[[#锚点]]` 在「本文件正编辑且有未保存改动」时与编辑器缓冲的冲突：边角，登记已知限制。
- 未 bump 1.0 / 未提交社区 PR：**依然内测打磨**（M7 进行中）。

### 下一步

1. **user_tests 实测 M11**（WJ 链接解析）+ M7/M12（同文件内链、大库性能）——这是 1.0 前最后的运行时确认。
2. 实测无碍后：英文 README + 截图 → `npm run bump 1.0.0` → 打 `v1.0.0` Release → 提交 `obsidian-releases` PR。

### 验证方式

- `npm test` 256 passed；`AAH_FUZZ_RUNS=8000 AAH_FUZZ_OPS=80` 两记分板 + backlink 往返全绿；lint / format / build / release 全绿。
- backlink 纯函数边界（别名/嵌入/块引用/多级/basename/重复/同文件）由 `backlinks.test.ts` 钉死；触发接线由 `main.test.ts` 集成覆盖。

---

## 2026-06-30 0.7.0 上架冲刺立项：竞品分析 + Roadmap 重构 + Backlink 定为 1.0 前置（claude/obsidian-auto-headings-release-lfniw0）

### 背景

用户决定上架 Obsidian 社区。两轮深度竞品调研（Number Headings / Auto Heading / Header Enhancer /
Auto Numbered Headings）结论：①龙头 Number Headings 已停更 ~2.5 年、38+ issue 堆积，**窗口开放**；
②我们的差异化（自定义模板 / 按路径选模板 / 清除·清理外来编号）**竞品全无**；③**唯一硬短板 = Backlink 同步**
（改标题后 `[[file#heading]]` 断链，社区呼声第一，仅 Header Enhancer 解决）。用户拍板：**Backlink 必做、
版本号必 bump**。轻度用户「过度设计」质疑由「默认模板 + `/` 根规则（最低优先级）」开箱即得 `1.1.1` 化解——
非新功能，是定位答案。

### 做了什么（纯文档规划周期，未碰 src / 测试）

- **新建 `doc/competitive.md`**：竞品全景 + 功能对比矩阵 + 社区痛点排序 + 定位结论 + 发布策略。
  数据来自各竞品仓库 / Release / Issues / 论坛（2024–2026），下载量为调研约值（标注）。
- **`spec.md` 新增 §3.12 Backlink 同步**（1.0 前置）：问题 / 设计原则（挂编号写回后、opt-in、WJ 锚点边界）/
  四步流程（改名表 → 反查 backlink → 单事务重写锚点 → Notice）/ 边界（重复标题消歧 `#标题-1`、块引用、
  大库性能、undo 一致性、历史断链）。
- **`spec.md` Roadmap 重构**：M6 标 ✅ 完成；**M7 改为「上架冲刺」**（Backlink 核心 + 英文 README + `1.0.0` 转正
  + 提交 `obsidian-releases` PR + 发布自检）；原 backlog（批量 / 导出 / 预览）下沉**新建 M8**，并加「扫描修复历史
  断链」「（观察）Visual-only」两项。
- **README Milestone 表**同步：M6→完成、M7→上架冲刺(进行中)、M8→Backlog；版本说明补「M7 完成转 1.0.0」+ 指向 competitive.md。
- **bump 0.6.9 → 0.7.0**（`npm run bump minor`，进入 M7）。

### 没做什么

- **未实现 Backlink**（本周期只立规格 + 排期）；未碰任何 `src/` 逻辑、未改测试（232 passed 不变）。
- 未写英文 README（M7 物料阶段做）；未提交社区 PR。
- §3.12 的开放问题（重复锚点消歧、undo 合批与否）留实现期定夺并登记 testplan。

### 下一步

1. **实现 Backlink 同步**（M7 核心）：先在 `numbering` 输出「旧→新标题文本」改名集；新增 `backlinks.ts`
   走 `metadataCache.getBacklinksForFile` 反查 + 单事务重写锚点；opt-in 开关进 settings + SettingsTab。
2. testplan 先加 Backlink 场景行（含重复标题 / 块引用 / undo 边界）再动代码。
3. Backlink 绿后：英文 README + 截图 → `npm run bump 1.0.0` → 打 `v1.0.0` Release → 提交 `obsidian-releases` PR。

### 验证方式

- 本周期纯文档：`npm test`（232 passed）/ `npm run lint` / `npm run format:check` / `npm run release` 全绿（行为未变）。
- spec / README / competitive 三处 Roadmap 口径一致（M6✅ / M7 上架冲刺 / M8 backlog）。

---

## 2026-06-30 0.6.9 代码符号地图（codemap）自动生成 + 接入文档守卫（claude/workflow-optimization-discussion-v8tdxg）

### 背景

承接 0.6.8「grep 优先、禁整读大文件」纪律——但 Agent 得先知道有哪些函数名可 grep。
方案评估后选「自动生成 + 守卫 + grep 查询」（手维护必漂移；纯 rg 现查抓不准类方法）。

### 做了什么

- **新增 `scripts/codemap.mjs` + `npm run codemap`**：用已装的 `typescript` compiler API 走 AST，
  扫 `src/` 全部 .ts，产出 `doc/codemap.md`。选 AST 而非正则的理由：最大文件 `SettingsTab.ts`（1016 行）
  几乎全是**类方法**，正则抓类方法很脆，AST 能准确拿 function / 类方法 / class / interface / type。**零新依赖**。
- **`doc/codemap.md` 两段式**（本次 146 符号 / 267 行）：
  - **全局索引**（覆盖全部文件）：`符号 → 文件:行号` 表，按名排序——解决「这函数在哪个文件」，
    一次 grep 命中，替代全仓 content grep。
  - **大文件大纲**（仅 > 300 行：numbering/SettingsTab/main/i18n）：逐符号一行，带签名 + JSDoc 首行意图
    （§2 已强制中文 JSDoc，白送）。Agent 读这行就知道函数干嘛，不必读函数体。
- **接入既有基建**：`docs.mjs` 加 `syncCodemap()`——`npm run docs` 默认重新生成 codemap；
  `docs --check`（pre-commit 守卫调用）比对新鲜度，**改了源码没重生成 codemap 就拦下提交**。漂移归零。
- **CLAUDE.md §3 + 本文件强制规则**：补「grep 大文件前先查 `doc/codemap.md` 拿函数名/位置」。

### 没做什么

- 小文件（< 300 行，9 个）不出大纲——直接 grep 源码已够便宜，只进全局索引。
- 未碰任何 `src/` 逻辑、未改测试（codemap 是纯派生产物，无产品行为改动）。
- 意图行偶有空 `{@link}` 残留（JSDoc 内联标签被剥后留「见 / 」），无害，未特殊处理。

### 下一步

- 实测：改某函数后 `npm run docs` 重生成 codemap，pre-commit 守卫能否拦下「忘了重生成」。
- 可选：若以后 i18n 文案表的非函数符号噪声大，可在大纲里按 kind 过滤。

### 验证方式

- 生成器确定性：连跑两次 `md5sum doc/codemap.md` 一致。
- 守卫三态退出码：codemap 最新 → `docs --check` exit 0；篡改 → exit 1；`npm run docs` 修复 → exit 0。
- `doc/` 已在 `.prettierignore`，prettier 不改 codemap.md（md5 不变），守卫不误报。
- `npm test`（232 passed）/ `npm run lint` / `npm run format:check` / `npm run release` 全绿。

---

## 2026-06-30 0.6.8 工作流瘦身：文档归档 + 版本号一键同步脚本（claude/workflow-optimization-discussion-v8tdxg）

### 背景

单次任务的 Claude 额度越来越高，根因是「只增不减的叙事仪式」+「宽改动面」：`log.md` 已 1458 行/37 块、
`testplan.md` 439 行/129 场景，每次任务都得在海量信息里找重点；小改动也要手改 4~5 处版本号。
本周期把「机械整理」脚本化，让 Agent 跑一行命令挪动、只写语义部分。**经讨论确认：测试体系（引擎单测 + UVM/fuzz）全保，它是省 token 的保险，不在瘦身范围内。**

### 做了什么

- **新增 `npm run bump`（`scripts/bump.mjs`）**：一条命令把版本号同步进 `package.json` / `manifest.json` /
  `package-lock.json`（顶层 + `packages[""]`）/ `versions.json`（追加 `<新版本>: minAppVersion`）/ `release/manifest.json`。
  支持 `bump`（打磨递增 `*`）/ `bump minor`（进新 Milestone，`*` 归零）/ `bump 0.7.0`（显式）。本周期用它 0.6.7 → 0.6.8。
- **新增 `npm run docs`（`scripts/docs.mjs`）**：每周期收尾跑一次，三件事——
  1. **归档 log.md**：只保留最新 N 个「带日期周期块」（默认 N=3），更旧的整体移入 `doc/log-archive.md`（倒序）。
     按标题是否含日期 `YYYY-MM-DD` 区分「周期块」与「常青块」（强制规则 / 目录结构约定 / 安装说明），常青块永不归档。
  2. **testplan 摘要**：扫真值表按状态计数，并列出全部**非 ✅** 行（ID + 行号）——Agent 读这份摘要即可，不必整读 439 行。**只读不改，零信息损失**（不删 ✅ 行，避免丢 user_tests 映射）。
  3. **校验 status.jsonl** 首行为合法状态 JSON。
  支持 `--keep N` 改保留数、`--check` 只检查不挪动（CI 友好）。
- **本周期归档**：log.md 由 37 块滚动到「最新 3 周期块 + 3 常青块」，旧 31 块进 `log-archive.md`。
- **`status.jsonl` 首行减肥**：从 ~200 token 的密集 blob 砍成「版本 + 一句话现状 + 下一步」，细节下沉 log。
- **CLAUDE.md（根）§4 / §4.1 + 本文件强制规则**：写入新的脚本化周期流程（写新块 → `bump` → `docs` → `release`）与「grep 优先、禁整读大文件」纪律。
- **pre-commit 文档守卫**（`.githooks/pre-commit`）：提交时对每个「有 `scripts/docs.mjs` 且本次有暂存改动」的 Addon 跑 `docs --check`，
  log.md 周期块超标（写了新块忘归档）就**拦下提交**。配套把 `docs.mjs --check` 改为「超标非零退出 + 安静模式」（不再刷 testplan 摘要）。
  `.claude/hooks/session-start.sh` 自动 `git config core.hooksPath .githooks`（本地/远程均启用）；CLAUDE.md §7 记录。

### 没做什么

- 未拆 `numbering.ts`（1114 行）/ `SettingsTab.ts`（1015 行）大文件（属激进档，本轮不做）。
- 未删 / 未折叠 testplan 的 ✅ 行（改用摘要脚本达到同等 token 收益，不做有损删除）。
- i18n 冻结不扩展，但**不回头删**（已落地，删它换零用户价值）。
- 无产品行为改动，故 testplan 场景与 dev_tests 断言未动。

### 下一步

- 实测验证脚本化流程在下个真实开发周期顺手（写块 → bump → docs → release），以及 pre-commit 守卫在真实提交时是否顺手。

### 验证方式

- `npm run bump` 后五处版本号一致（已验 0.6.8）。
- `npm run docs` 后 log.md 仅剩 3 周期块 + 常青块，log-archive.md 含 32 旧块且倒序；重复跑幂等（无新归档）。
- 守卫退出码：`docs --check`（3 块）exit 0 静默；`docs --check --keep 2`（模拟超标）exit 1 报错。`.githooks/pre-commit` 手动执行触发 obsidian-auto-headings 守卫并通过。
- `npm test` / `npm run lint` / `npm run format:check` / `npm run release` 全绿。

---

## 2026-06-30 0.6.7 修 U4（标题前导空白非幂等）+ explore 转正回归（claude/heading-numbering-idempotency-equdp0）

### 做了什么

- **修 U4**（`src/numbering.ts`）——根因：`stripPrefix` 按 WJ 剥离后，正文可能带前导 ASCII 空白（脏编辑/破坏前缀残留）；白名单/超界分支输出 `${hashes} ${text}` 时多一个空格，下次 parser `[ \t]+` 贪婪吞掉全部前导空格，两次解析出不同 `rawText`，非幂等。修法：
  - `stripHeadingPrefix` 末尾追加 `.replace(/^[ \t]+/, "")`（去首 ASCII 空白），覆盖白名单分支和编号分支。
  - `numberHeadings` 超界分支（`level < top || level > bottom`）的 `text` 同样追加 `.replace(/^[ \t]+/, "")`。
  - 仅去 ASCII `[ \t]`（不动全角空格 U+3000），与 parser `HEADING_RE` 的 `[ \t]+` 对称，修复现有全角空格白名单测试（`## 　目录　`）。
- **4 条回归测试**（`tests/dev_tests/numbering.test.ts`，「U4：标题正文含 WJ 后前导空白时幂等」块）：白名单分支 / 超界分支 / 编号分支 / 多前导空格极端情况，全部幂等。
- **explore 转正**（`tests/dev_tests/random_sequence.test.ts`）：U4 是 explore 记分板最后一个未修 bug，修后 seed=95 单跑通过、8000×80 全绿无新 bug；去掉 `it.skip` 门控，explore 幂等性记分板变为常规 CI（500×60）。`AAH_FUZZ_MODE` 环境变量保留但不再作 skip 门控。
- **testplan §3.2 U4**：状态 ⚠️→✅，补根因说明与修复方案。
- **版本**：0.6.6 → 0.6.7，release/ 重建。

### 没做什么

- 未改其他模块（编号逻辑 / 白名单 / 路径规则 / i18n / 设置面板）。
- U3（字母样式吞英文起头标题）属设计取舍，explore 框架内部通过 `EXPLORE_GEN` 约束规避，未作修改。

### 下一步

- 手验：① 插件写出 `## 1 ⁠  - 列表式标题`（前导空格）后两次触发结果相同；② explore 8000×80 常绿监控。
- 可选：清理 `random_sequence.test.ts` 中已过时的 `MODE` 常量（不再使用，但无害）。

### 验证方式

`npm test`（232 passed / 0 skipped）、`npm run lint`、`npm run format:check`、`npm run release` 全绿。
`AAH_FUZZ_RUNS=8000 AAH_FUZZ_OPS=80 npx vitest run tests/dev_tests/random_sequence.test.ts`：2 tests passed。

---

## 2026-06-30 0.6.6 方案A(WJ 边界根治正文被吃) + UVM 真实白名单升级 + 清理外来编号命令 + 白名单集成修复（claude/obsidian-auto-headings-polish-gvq9cf）

### 做了什么（按用户给的顺序：先升框架、再方案A、再修 bug，外加新命令）

- **UVM 框架升级（`tests/dev_tests/uvm/framework.ts`）**——把「插件全部可设置 + 用户可操作」更全地纳入激励空间：
  - **真实白名单驱动**：删去旧版注入的 `isWhitelisted` 回调，改由 `template.whitelist`（随机 0–2 条、匹配方式含 **exact/partial/subtree**）驱动引擎 `computeWhitelistExemptions`——旧版**完全没覆盖子树 / 部分匹配 / 子标题随根豁免**。新增 `setWhitelist` 激励（增 / 删 / 改条目）。
  - **bottomLevel 维度**：新增 `setBottomLevel` 激励（[topLevel,6] 随机）+ topLevel 抬高时联动抬 bottomLevel。
  - **覆盖率新 bin**：whitelist-exact/partial/subtree、subtree-带子标题、bottomLevel-narrowed（默认 500×60 闭合）。
  - **撞 bug**：默认（参考模型）8000×80 全绿 → 证实引擎 exact/partial/subtree 豁免在「带历史前缀 vs 裸文档」两侧一致、无前缀敏感分叉（即用户报告的子树 bug **不是引擎 bug**）。explore（叠加脏编辑）撞出 **U4**（标题以**空白**起头时连续触发非幂等，parser `[ \t]+` 收拢所致），登记 testplan §3.2 未修。
- **方案A（`src/numbering.ts`，用户拍板「直接默认、不适配历史」）**——`stripPrefix` 改为**纯 Word Joiner 边界**：含 WJ → 精确剥到标记后；**无 WJ → 整段视为正文、原样返回**（不再正则猜前缀）。删去不再使用的容差正则机器（`tolerantSeparator`/`tolerantInnerSeparator`/`innerSegmentToken`/`lastSegmentToken`/`unionToken`/`ALWAYS_STRIPPABLE_STYLES`）。**根治**「2024 年度总结 / API 设计 等正文被当编号吃」整类问题（U1/U2/U3 一并消除，known_bugs.test 三条转为「正文保留+幂等」回归）。`stripPrefixBroad`（「清除编号」用）保持激进正则不变。`level/template/options` 三参降级为签名兼容（`_` 前缀）。
- **新命令「清理非本插件的标题编号」（用户追加需求，配合方案A）**——`src/numbering.ts` 加 `stripForeignNumbering`（更广手写惯例正则：全样式 + `第…章` + 成对括号 `(1)`/`（一）`/`[1]`/`【1】` + `1.`/`1)`/`一、`，序号后须跟分隔/右括号才剥，故 `100`/`三` 不误剥）；`src/cleanup.ts` 加 `clearForeignNumberingContent`（**只剥不含 WJ 的标题**、保留插件自己写的 WJ 编号）；`main.ts` 注册命令 `clear-foreign-numbering` + `runClearForeignNumbering`；i18n 加 `cmdClearForeign`/`noticeForeignCleared`/`noticeNoForeign`。
- **白名单子树「集成 bug」修复（WL-int）**——定位为**预览口径不一致**（白名单编辑器预览的是「正在编辑的模板」，文件却按路径规则解析到另一个模板编号）。修：`SettingsTab` 白名单预览在「当前文件实际模板 ≠ 正在编辑模板」或「无命中模板」时显示 ⚠ 提示、预览标注「假设」（i18n `wlPreviewOtherTemplate`/`wlPreviewNoTemplate` + `.ah-wl-mismatch` 样式）；`main.test.ts` 加集成回归（子树白名单经自动触发路径正确豁免根+子标题、幂等；并附「机制说明」用例）。
- **测试**：numbering（stripPrefix/2024 折中块/C3/空标题等约 8 组改写为方案A 语义 + bottomLevel 区间块沿用）、known_bugs（U1/U2/U3 转正）、cleanup（新增 clearForeignNumbering 7 例 + C3 调整）、main（strippableAffixes 改 WJ + 子树集成 2 例）、whitelist（D7 改 WJ）、i18n（形状一致自动校验新键）。
- **文档**：spec §2.3（2024 行）/§2.4（标「方案A 已落地」+ 改锚点）/§3.5（方案A 剥离）/§3.10（三入口 + 新命令 + stripForeignNumbering）/Roadmap M7；testplan §3.2（U1/U2/U3→✅ 方案A 根治 + U4 登记）/§3.3（WL-int→✅）；README / release/README（新命令 + 方案A）。

### 没做什么

- **U4 未修**（标题正文以空白起头 → parser `[ \t]+` 收拢致非幂等）：explore 专属脏输入边角，正常输入不触发，登记 testplan §3.2 待后续。
- explore 模式仍 `it.skip`、不进 CI（撞 U4）；默认模式（参考模型）才是 CI 常绿网。
- 历史（0.6.4 前无 WJ）前缀不再被常规重排识别——用户明示「无线上用户、不适配」。

### 下一步

- 手验：① `## 2024 年度总结` 触发后 `2024` 保留；② 导入带手写 `1.2 ` 编号的文档 → 命令「清理非本插件的标题编号」清掉 → 再自动编号；③ 在「模板 A」白名单编辑器里，当前文件用「模板 B」时面板出现 ⚠ 模板不一致提示。
- 可选：修 U4（标题前导空白）；放开 explore 对应约束转回归。

### 验证方式

`npm test`（227 passed + 1 skipped）、`npm run test:fuzz`（默认 5000×80 全绿；explore 仅撞 U4）、`npm run lint`、`npm run format:check` 全绿；`npm run build` + `npm run release` 重建 release/。版本 0.6.5→**0.6.6**。

---

## 2026-06-29 0.6.5 编号区间 + 中英双语 + 路径 GUI 打磨 + 危险区折叠（claude/obsidian-auto-headings-polish-gvq9cf）

### 做了什么

完成用户提的 1–4 项打磨需求（第 5 项「保留正文起头数字」按要求仅分析、未动手）：

- **③ 结束编号层级 `bottomLevel`（编号区间下界）** —— `src/numbering.ts`：
  - 新增 `DEFAULT_BOTTOM_LEVEL=6`、`normalizeBottomLevel`（夹 [1,6]，缺失/非法回退 H6=无下界）；`Template` 加 `bottomLevel` 字段，`DEFAULT_TEMPLATE` 补 6。
  - `numberHeadings`：把「`level < top` 走非编号分支（bump+循环剥离+不写前缀）」扩展为 `level < top || level > bottom`，对称处理超下界标题（仍作重置边界、剥残留旧前缀）。`previewLevel` 同步加区间守卫。
  - `src/templates/schema.ts`：`normalizeTemplate` 加 `bottomLevel`；**顺手修 0.6.3 遗留 bug**——`NUMERAL_STYLES` 校验枚举漏了 `lower-roman`/`upper-roman`，导致罗马样式存盘后被打回 arabic，现补全。
- **④ 中英双语 i18n** —— 新建 `src/i18n.ts`：`Lang`/`LangSetting`、`detectObsidianLang`（读 `localStorage["language"]`，zh 前缀判中文，失败回退 en）、`resolveLang`、`Messages` 接口 + `zh`/`en` 两套形状一致文案、`getMessages`。`settings.ts` 加 `language: LangSetting`（默认 `auto`）。`main.ts`：命令名 onload 取一次语言、Notice 调用时取（即时生效），`loadSettings` 迁移非法 language→auto，新增 `messages()` 访问器。`SettingsTab.ts` 全量接入（`this.t` 访问器 + numeral/match 标签函数），顶部加「语言」下拉（切换即重绘）。
- **① 路径规则 GUI 打磨** —— `SettingsTab.renderPathRules`/`renderPathRuleRow`：
  - 列表**可纵向滚动**（`.ah-path-table` max-height 280px + overflow-y，表头 sticky 吸顶）。
  - **分层路径补全**：每行独立 `<datalist>`，`updatePathDatalist` 按输入里最后一个 `/` 取「基目录」、只列其**直接子项**（文件夹带尾 `/`、根补 `/`，上限 50），输入逐层展开。
  - 每行加**「✕ 清空此路径」**按钮（`.ah-input-clear`，只清输入框、不删规则）。
  - **删除整条规则的 ✕** 由 `<button>` 改 `<span>`（`.ah-path-del` 去掉椭圆按钮背景）。
- **② 危险区域默认折叠** —— `renderDangerZone`：`dangerExpanded`（默认 `false`），标题带 chevron、可点击展开，折叠时不渲染「清除全库编号」。
- **⑤ 「2024 年度总结」分析（仅分析）** —— spec.md 新增 §2.4：评估 4 方案，推荐**模板级 opt-in「保留正文起头数字」复用 WJ 标记**（默认关、不影响现有行为），本轮不实现、列入 M7 backlog；testplan §3.1 新增 P1 行登记取舍。

### 没做什么

- 第 ⑤ 项未写任何产品代码（按用户「先分析、不动手」）。
- bottomLevel 引擎层不强制 `bottom ≥ top`（仅 GUI 下拉强制）；空区间退化为「无层级编号」，无害。
- i18n 命令名改语言需重载插件才更新（onload 时机所限，面板已注明）；未做命令热重载。
- UVM explore 脏标题约束、U3 仍按前轮保留，未碰。

### 下一步

- 手验（DOM 层，见 testplan L 类）：语言切换、路径列表滚动/分层补全/清空键、删除键外观、危险区折叠、起始/结束层级下拉联动。
- 可选：落地 M7「保留正文起头数字」opt-in（spec §2.4 方案 D）。

### 验证方式

`npm test`（216 passed + 1 skipped，新增 numbering bottomLevel 6 例、schema 2 例、i18n 10 例、settings 1 例）、`npm run test:fuzz`（5000×80 全绿）、`npm run lint`、`npm run format:check` 全绿；`npm run build` + `npm run release` 重建 release/。版本 0.6.4→**0.6.5**（package/manifest/versions/lock + manifest/package 描述改为「中英双语」）。

---

## 2026-06-29 0.6.4 Word Joiner 写入前缀输出，彻底消除分隔歧义（claude/obsidian-auto-headings-0.6.3-xdeojz）

### 做了什么

- **`src/numbering.ts`**：
  - **`buildPrefix` 末尾追加 WJ**：`return fmt.prefix + numberStr + fmt.suffix + fmt.titleSeparator + WORD_JOINER`。每个由插件写出的前缀末尾都携带 Word Joiner（U+2060，不可见），作为精确结束标记。
  - **JSDoc 同步更新**：`WORD_JOINER` 常量说明改为「`buildPrefix` 在每个前缀末尾追加该字符，0.6.4 起始终写入」；`buildPrefix` 函数注释补充 WJ 追加说明；`stripPrefix`/`stripPrefixBroad` 的 WJ 快速路径注释去掉「尚未写入」的前向兼容说明，改为「0.6.4 起写入，此路径生效」。
- **测试（全部更新以含 WJ 的新格式为断言基准）**：
  - `tests/dev_tests/numbering.test.ts`：所有输出带编号前缀的断言更新（`previewLevel`、`buildPrefix`、`numberHeadings`、`renumberContent` 等约 30 处）。
  - `tests/dev_tests/whitelist.test.ts`：导入 `WORD_JOINER`，`prefixes()` 断言与 `renumberContent` 非白名单断言更新。
  - `tests/dev_tests/main.test.ts`：导入 `WORD_JOINER`，幂等性测试与各集成场景（J4/J1/J3/J7/I1/I3/I6/J5 等）更新。
  - `tests/dev_tests/cleanup.test.ts`：导入 `WORD_JOINER`，C3 系列断言更新（含 C3 深层调高 / 幂等性 / 裸 H1 不受影响）。
  - `tests/dev_tests/known_bugs.test.ts`：导入 `WORD_JOINER`，U2/U3 断言更新含 WJ。
- **文档**：
  - `testplan.md`：「2024 折中」说明块追加 0.6.4 根治说明（WJ 写入 + 快速路径精确截断）；E5b 行更新预期与状态；E13 行更新为「0.6.4 `buildPrefix` 写入 WJ，完全幂等」。
  - `doc/log.md`（本文件）：本条。
  - `doc/status.jsonl`：插入 0.6.4 概括行，更新首行。
- 版本号 0.6.3→**0.6.4**（package.json / manifest.json / versions.json / package-lock.json）。
- `npm run release`：release/ 已更新（main.js / manifest.json / styles.css / zip）。

### 没做什么

- **清除器（`clearNumberingContent`）不写 WJ**：清除器负责将带前缀标题剥成裸标题，输出无前缀无 WJ，这是期望行为。
- **U3 未修**（字母/罗马样式吞英文词起头标题）：属 L1 同源取舍，特征化钉住，与 0.6.4 无关。
- **explore 模式脏标题约束未放开**：U1/U2 已修，但脏标题还会撞 U3，留后续。

### 下一步

- 手验：手动装载 release/ 插件，触发带数字正文的标题（如 `## 概述`→`## 1 ⁠概述`；`## 1 ⁠2024 总结` 再触发稳定）。
- 可选：放开 explore 脏标题约束（U1/U2 已修，U3 取舍钉住即可）。
- 可选：处理 U3（字母/罗马样式吞英文词），属下一轮。

### 验证方式

`npm test`（197 passed + 1 skipped）、`npm run test:fuzz`（5000×80 全绿）、`npm run lint`、`npm run format:check` 全绿。

---

## 2026-06-29 0.6.3 罗马数字样式 + 修复 U1/U2 + Word Joiner 验证（claude/obsidian-auto-headings-0.6.3-xdeojz）

### 做了什么

- **`src/numbering.ts` 核心引擎**：
  - **罗马数字样式**（G8/G9，论文用户）：`NumeralStyle` 新增 `"lower-roman" | "upper-roman"`；实现 `ROMAN_MAP` + `toRoman()` 函数（标准减法规则，1→i/I…1994→mcmxciv/MCMXCIV）；`renderNumeral` 扩展两个 `case`；`numeralTokenPattern` 扩展 `[ivxlcdm]+` / `[IVXLCDM]+`；`ALL_NUMERAL_STYLES` 加入两款；`lastSegmentToken` 同字母样式一样**条件纳入**（仅模板在用时才参与剥离，避免 `CDI module` 等词被误剥）。
  - **Word Joiner 验证（U+2060）**：导出 `WORD_JOINER = "⁠"` 常量；在 `stripPrefix` 与 `stripPrefixBroad` 开头加 WJ 快速路径（精确截断到标记后）——当前写出路径尚未插入 WJ（不改 `buildPrefix`/`numberHeadings` 输出），快速路径是前向兼容预留，已验证概念正确性（E13）。
  - **修复 U1/C6（高优先级）**：`numberHeadings` 对 `level < top` 的分支改为**循环调用 `stripPrefix` 到不变点**（原：单次 `stripHeadingPrefix`）。首次触发一次性剥净所有可识别层（`1 2024 总结` → 循环剥成 `总结`），之后幂等；裸标题无数字前缀循环立即停止（C1/E5 不受影响）。
  - **修复 U2/B10（中优先级）**：引入 `tolerantInnerSeparator(numberSep, charClass, titleSep)` 函数；当 `titleSep` 字符落在 `NUMBER_SEPARATOR_CLASS` 里时，为容差分支加否定前瞻 `(?!titleSep)`，阻止 `。`/`、` 等标题间隔符被当作段间分隔符消费；`stripPrefix` 对内层分隔符改用此函数。`titleSep=space` 时退化为原逻辑（空格本就不在 `NUMBER_SEPARATOR_CLASS`）。
- **`src/settings/SettingsTab.ts`**：`NUMERAL_OPTIONS` 新增 `"lower-roman"` / `"upper-roman"` 两个下拉选项。
- **测试**：
  - `tests/dev_tests/known_bugs.test.ts`：U1/U2 断言从「错误特征化」改为「修复后正确」回归测试；U3 保留特征化。
  - `tests/dev_tests/numbering.test.ts`：新增 G8（小写罗马 17 值）、G9（大写罗马 5 值）、E13（WJ 快速路径 3 个断言）；导入 `WORD_JOINER`。
  - `tests/dev_tests/uvm/framework.ts`：`NUMERALS_WITH_ALPHA` 加入 `"lower-roman"` / `"upper-roman"`（explore 模式）。
- **文档**：
  - `testplan.md`：B10→✅（修复）、C6→✅（修复）、G8/G9（新增 ✅）、E13（新增 ✅）；§3.2 U1/U2→✅、修复说明；约束表注释同步；UVM 底部注加 0.6.3 结果。
  - `doc/log.md`（本文件）：本条。
  - `doc/status.jsonl`：插入 0.6.3 概括行，更新首行。
- 版本号 0.6.2→**0.6.3**（package.json / manifest.json / versions.json / package-lock.json）。
- `npm run release`：release/ 已更新（main.js / manifest.json / styles.css / zip）。

### 没做什么

- **U3 未修**（字母/罗马样式吞英文词起头标题，如 `## API 设计`→`## A 设计`）：属 L1 同源取舍，特征化钉住。
- 罗马数字的 `numeralTokenPattern` 用宽字符类 `[ivxlcdm]+`（同字母样式），不做严格正则校验——条件纳入已保证误伤面可控，严格罗马正则过于复杂且超出需求。
- Word Joiner 未写入 `buildPrefix`/`numberHeadings` 输出——会导致约 50–100 个断言级联更新 + UVM 参考模型偏差（E5b 场景两侧行为分叉），代价过大；快速路径已验证概念，日后写出路径就绪时直接可用。
- explore 模式的 UVM 默认约束（脏标题维度）未放开——U1/U2 已修，但 explore 脏标题还会撞 U3（字母自食），且 UVM 参考模型对循环剥离的幂等性与 tolerantInnerSeparator 的混合场景未建完整参考，留后续再放开。

### 下一步

- 手验：在真实 Obsidian Vault 里试罗马数字样式（选 `小写罗马`，设 H2=lower-roman，看 `i`/`ii`/`iii` 渲染）。
- 手验：把 topLevel 调高（如 H2→H3），含 `1 2024 总结` 的 H2 标题，触发后确认一次到定点 `总结`，再触发不变。
- 手验 U2 修复：把某级 titleSeparator 改为 `。`，标题含 `1。2024 总结`，触发后应保留 `1。2024 总结`。
- 可考虑的后续：放开 explore 模式脏标题约束并建立对应的幂等性参考——需给 UVM 参考模型加循环剥离逻辑（或改用幂等性记分板兜）；处理 U3（罗马样式也有同款问题）。

---

## 2026-06-29 0.6.2 UVM 框架升级 + 撞出 3 个新 bug（claude/obsidian-uvm-test-coverage-czbyd6）

### 做了什么

- **升级 UVM 框架 `tests/dev_tests/uvm/framework.ts`**（用户诉求：覆盖的用户操作不够全面、步数不够多、发现 bug 能力不够强）：
  - 抽出 `GenConfig` 生成器配置 + `DEFAULT_GEN`（常绿）/ `EXPLORE_GEN`（找 bug）两套；`runSequence` 新增第四参数 `cfg`。
  - **新增两类真实激励**：`editTitleInPlace`（在**已带前缀**的标题行里继续改文本、旧前缀仍留行上——模拟「在 md 里怎么打字」，是 strip 最易错处；旧框架只有把整行清空重打的 `retitle`）；`mutatePrefix`（手动删字符/去空格/改数字破坏前缀区——模拟「怎么删」）。
  - **放开约束**：默认序列步数 40→60；新增 explore 模式放开字母样式 / inherit×非空前后缀 / 脏标题（分隔符·数字·字母起头）/ 手动破坏前缀。
  - **新增第二记分板 `checkIdempotent`**（`renumber∘renumber===renumber`，恒成立、容脏输入），补旧「裸文档参考模型」是**单次施加等价性**、看不见**多次施加侵蚀**的结构盲区。两记分板互补：默认用参考模型守干净空间，explore 用幂等性在脏空间找 bug。
- **`tests/dev_tests/random_sequence.test.ts`** — 默认 500×60；新增 `AAH_FUZZ_MODE=explore` 门控的 explore 用例（默认 `it.skip`，会撞 U1/U2/U3，不进 CI）。
- **用升级后的框架在 20000×80 explore 里撞出 3 个 bug（本轮按用户要求一律不修）**：
  - **U1（高优先级）**：低于 topLevel 的标题，文本含多层「数字+空格」时被**逐次蚕食**、非幂等（`## 1 2024 总结`→`## 2024 总结`→`## 总结`…）。根因：C3 的「低于 topLevel 剥一层但不补回前缀」分支没有定点。
  - **U2**：标题间隔符设成标点（`。`/`、`/`-`…）时，E5b「保留 2024」承诺失效、吞掉标题首段数字（`## 1。2024 总结`→`## 1。总结`）。
  - **U3**：启用字母样式时英文起头标题被吞（`## API 设计`→`## A 设计`，E5 的字母版，属 L1 同源取舍）。
- **顺带确认 B8 无 bug**：放开「inherit×非空前后缀」约束后，参考记分板 20000×80 全绿 → testplan B8 从 🔲 改 ✅，并把该约束在默认模式正式放开（扩大覆盖）。
- **`tests/dev_tests/known_bugs.test.ts`（新建）** — 把 U1/U2/U3 的最小复现钉成**通过**的特征化测试（快照当前错误输出 + 给未来修复者目标，保持 CI 常绿；修好会变红即信号）。
- **文档**：`doc/testplan.md` 新增 §3.2（U1/U2/U3 表 + 根因 + 修复方向）、新增场景行 C6/B10/E12、B8→✅、改写 §4（框架升级、两模式两记分板、约束表）；`tests/dev_tests/uvm/README.md` 加「0.6.2 升级」节 + 约束表更新；`tests/user_tests/09-UVM新发现的侵蚀类bug.md`（新建，可在真实 Vault 复现 U1/U2/U3）+ README 索引补 08/09。
- 版本 0.6.1→0.6.2（manifest/package/lock/versions 同步），`npm run release` 重建 `release/`。

### 没做什么

- **未修任何 bug**（用户明确要求本轮只发现+登记）。U1/U2/U3 全部留给后续。
- 未碰编号引擎 `src/numbering.ts`、`parser.ts`、`main.ts` 等任何**产品代码**——本轮纯测试基建 + 文档 + 版本。
- explore 模式的字母样式仍只在 explore 跑（默认约束未放开，因 U3 未修）。

### 下一步

- 修 **U1**（最严重，静默丢用户内容）：低于 topLevel / 白名单的标题剥离应**剥到定点**（循环剥净所有插件前缀样式段）而非只剥一层，或引入「记录插件写过什么」的状态。注意别和 C1/E5「不误伤裸标题」冲突。修好后：翻 testplan C6/§3.2 U1 → ✅、改 `known_bugs.test.ts` 对应断言为「幂等」期望、考虑在 explore 缩小对应脏维度或把 explore 转正。
- 修 **U2**：标题间隔符匹配应仅切「序号 token 之后第一个分隔单元」，不让段间 `(?:sep)*` 越过界。
- 验证方式：`AAH_FUZZ_MODE=explore AAH_FUZZ_RUNS=20000 AAH_FUZZ_OPS=80 npx vitest run tests/dev_tests/random_sequence.test.ts`（找 bug）；修完跑 `npm run test:fuzz` + 默认 `npm test` 全绿。

---

## 2026-06-29 0.6.1 frontmatter 布尔化（claude/obsidian-auto-headings-m6-ik65hm）

### 做了什么

- **`src/frontmatter.ts`** — `FileSwitch` 类型从 `"ON" | "OFF" | null` 改为 `boolean | null`；`readFileSwitch` 现识别 YAML 布尔 `true`/`false`（含带引号的 `"true"`/`"false"`）；旧版 `ON`/`OFF` 文本视为非法值（返回 null）。导出 `SWITCH_KEY` 常量供 main.ts 引用。
- **`src/main.ts`** — `onload()` 在加载时通过内部 API `app.metadataTypeManager.setPropertyInfo` 将 `obsidian-auto-headings` 注册为 checkbox 属性类型（Obsidian 1.4.0+ 内部 API，防御性调用，无此方法时无操作）；`shouldAutoTrigger` 的比较值从 `"OFF"`/`"ON"` 改为 `false`/`true`；所有注释同步更新。
- **`tests/dev_tests/frontmatter.test.ts`** — 全面改写：测试值改为 `true`/`false`，旧版 `ON`/`OFF` 案例改为验证非法（返回 null）。
- **`tests/dev_tests/main.test.ts`** — 3 处测试里的 `ON`/`OFF` 改为 `true`/`false`。
- **`doc/spec.md`、`doc/testplan.md`、`README.md`、`release/README.md`** — 所有用法示例/矩阵/描述同步更新。
- 版本号 0.6.0 → **0.6.1**（package.json / manifest.json / versions.json / package-lock.json）。
- `npm run release`：release/ 已更新（main.js / manifest.json / styles.css / zip）。

### 没做什么 / 已知限制

- **无向后兼容**：已有文件里写了 `obsidian-auto-headings: ON` 或 `OFF` 的，升级后将失效（视为非法值，跟随全局开关）。需手动改为 `true`/`false` 或在 Obsidian 属性面板重新勾选。
- `metadataTypeManager` 是 Obsidian 未公开 API，在旧版 Obsidian（< 1.4.0）或 API 签名变化时将静默无操作（不影响功能，仅属性面板不显示勾选框形态）。

### 下一步

- 手验：在 Obsidian 属性面板确认 `obsidian-auto-headings` 显示为复选框类型；勾选/取消后验证自动触发行为符合预期。
- 手验旧版迁移：含 `ON`/`OFF` 的笔记升级后确实跟随全局开关（非法值静默忽略）。

### 验证方式

```
cd obsidian-auto-headings
npm test              # 191 passed
npm run lint          # 无报错
npm run format:check  # 格式全绿
```

---

## 2026-06-29 M6 落地（claude/obsidian-auto-headings-m6-ik65hm）

### 做了什么

- **`src/cleanup.ts`（新建）** — 全样式并集剥离器 `clearNumberingContent`：arabic ∪ cjk ∪ circled ∪ lower-alpha ∪ upper-alpha，独立于任何模板，仅剥一层（「2024 折中」），支持可选 `strippablePrefixes/Suffixes` 提高历史前缀识别率。
- **`src/numbering.ts`** — 新增导出 `stripPrefixBroad`（供 cleanup.ts 引用）；C3 修复：`numberHeadings` 对 `level < top` 分支改为调用 `stripHeadingPrefix`，使升高 topLevel 后降出范围的标题旧前缀被剥除。
- **`src/main.ts`** — 新增命令「清除当前文件编号」（`runClearNumbering`，带 Notice）；新增 `clearAllVaultNumbering` 方法（遍历全库 .md 文件逐一清除）。
- **`src/settings/SettingsTab.ts`** — 新增防抖延迟滑块（50–2000ms，带重置按钮）；新增「危险区域」清除全库编号按钮 + `ClearVaultModal` 二次确认对话框。
- **`tests/dev_tests/cleanup.test.ts`（新建）** — H1-H4 清除场景 + C3 修复验证（含幂等性、非编号 H1 不受影响）。
- **`tests/dev_tests/uvm/framework.ts`** — C3 约束放开：`setTopLevelLower` → `setTopLevel`，允许 topLevel 双向随机（1–4），新增 `topLevelRaised` 覆盖率 bin，`gaps()` 同步追踪。
- 版本号 0.5.0 → **0.6.0**（package.json / manifest.json / versions.json）。
- `npm run release`：release/ 已更新（main.js / manifest.json / styles.css / zip）。

### 没做什么 / 已知限制

- H5（用户手写数字标题被误剥）属已接受风险（spec §2.3），不修。
- `# 2024 总结` 在 topLevel=H2（H1 低于 topLevel）时也会被 C3 修复剥去 `2024`（无状态引擎无法区分插件前缀与用户数字标题），对应 numbering.test.ts 已更新文档该行为为预期内取舍。
- GUI（设置面板滑块、对话框）属 DOM 层，未自动化测试，留手验。
- 余下 Milestone（M7 以后）见 spec.md Roadmap。

### 下一步

- 手验：防抖滑块（50/300/2000ms 实测延迟）、「清除当前文件编号」命令、「清除全库编号」按钮（确认双对话框）。
- C4（topLevel=H3 时 H2 不编号场景）可补一条 dev test（testplan C4 🔲）。
- 无其他待修 bug。接下来看 M7 Roadmap 或用户反馈。

### 验证方式

```
cd obsidian-auto-headings
npm test       # 191 passed
npm run lint   # 无报错
npm run format:check  # 格式全绿
npm run test:fuzz     # 5000×80 全绿（C3 约束放开后覆盖率闭合）
```

---

## 2026-06-29 — 升版 0.5.0：Milestone 5 按路径配置 + 开关/命令重构

**交接人：** 分支 `claude/obsidian-auto-headings-m5-1o2j87`

**做了什么：**

- **进入 Milestone 5**：版本 `0.4.0` → **`0.5.0`**（M=5，`*` 归零；同步 manifest/package/versions/
  lockfile/release）。
- **路径规则系统（纯函数）`src/pathrules.ts`**：`PathRule = {pattern, template}`；
  - `ruleMatches`：根 `/` 匹配所有；文件夹（以 `/` 结尾）匹配其下全部子项；文件（不以 `/` 结尾）精确匹配。
  - `ruleSpecificity`：根 `0` ＜ 文件夹（按归一化长度，越深越具体）＜ 文件（加 1e6 基数，恒胜文件夹）。
  - `resolvePathRule`：取最具体的匹配，**并列时列表靠后者胜出**（`>=` + 正向遍历）；无命中返回 `null`。
  - `hasRootRule`：判定是否存在 `/` 根规则（供兜底提示条）。归一化容忍反斜杠 / 前导斜杠 / 重复斜杠。
- **设置数据模型 `src/settings.ts`**：`enabled` → **`autoNumber`**（「全局自动编号」面板层）；新增
  `pathRules`，默认预置一条 `/`→「默认」。`defaultPathRules()` 每次返回独立数组（避免共享引用）。
- **frontmatter `src/frontmatter.ts`**：新增 `isForcedOnByFrontmatter`（`ON` → 文件级强制 opt-in）。
- **触发层重构 `src/main.ts`**（核心）：
  - **双层开关**：`setAutoNumber` ↔ 全局命令「切换全局自动编号」双向同步。
  - **`shouldAutoTrigger(content)`**：`fm:OFF`→否；`fm:ON`→是（覆盖全局关）；否则跟随 `autoNumber`。
  - **`getTemplateForFile(path)`**：按 `pathRules` 解析 → 模板；无命中或模板已失效 → `null`。
  - **自动路径**（`scheduleRenumber`）：够格才排防抖、到期复核 + 解析模板，无模板**静默跳过**。
  - **手动路径**（`runImmediateRenumber`）：**绕过** `autoNumber` 与 `fm:OFF`，仅受模板命中约束；
    命不中弹 Notice「当前文件未匹配任何路径规则，无法编号」。
  - `applyRenumber(editor, template)` 收窄为纯机械重排（门控移到调用方）；`renumberActiveFile` 走
    自动判定 + 按活动文件路径解析模板；`renameTemplate` 成功后同步改 `pathRules` 中的引用；
    `loadSettings` 迁移旧 `enabled`→`autoNumber`、补 `pathRules`。
- **设置 GUI `src/settings/SettingsTab.ts`**：
  - 顶部开关改为「全局自动编号」；新增**路径规则区**——可视化表格（拖拽手柄 + 行号 + 路径输入〔接
    `<datalist>` 真实路径补全〕 + 模板下拉 + 删除）、`+ 添加规则`、**拖拽排序**、`hasRootRule` 兜底
    缺失提示条 + `+ 添加 / 根规则` 快捷按钮。
  - 删模板：未被引用直接删；被路径规则引用则弹 **`DeleteTemplateModal`**（列出受影响规则 + 去向下拉：
    降级「默认」/ 改投他模板 / 连规则一并删）。
- **测试**：新增 `tests/dev_tests/pathrules.test.ts`（12 例）；重写 `main.test.ts`（23 例）覆盖
  I1/I2/I3/I4/I6/I7、J1–J5/J7、`getTemplateForFile`、双层开关与手动绕过；`settings.test.ts` 更新为
  `autoNumber`/`pathRules`；`obsidian-mock.ts` 加 `Modal`（`DeleteTemplateModal` 继承需在加载期可构造）。
  dev **178 passed**；`npm run test:fuzz`（5000×80）全绿（未碰引擎）；lint/format/build/release 全绿。
- **C3 评估（用户拍板）**：解决方向定为「**升高 topLevel 时清除后再编号**」——用 M6 的全样式并集剥离器
  剥掉移出范围标题的旧前缀再重排。因属**显式配置动作**（用户本意即「不再编号这些」），不再有「裸吃正文」
  顾虑；依赖 cleanup 剥离器，**留 M6 一并实现**（已写入 spec Roadmap M6 与 testplan C3 备注）。

**没做什么（边界）：**

- **GUI 仅手验**：路径规则表（增删/拖拽/补全/兜底提示）、删模板对话框属 DOM 层，沿用既有约定不写 DOM
  单测；纯解析与接线已被 `pathrules.test.ts` / `main.test.ts` 覆盖（K8/K9/K10 标手验）。
- **未碰 M6**：清除编号命令 / [清除全库编号] 按钮 / cleanup 全样式剥离器 / C3 实修 / 防抖滑块均未动。
- **C3 仍 ❌**（方案已定，待 M6 落地）；UVM 未纳入路径规则（路径解析是无状态纯函数，独立于 strip 健壮性）。

**下一步：**

- 推进 **M6**：`cleanup.ts` 全样式并集剥离器（独立于模板）→「清除当前文件编号」命令 + [清除全库编号]
  按钮（二次确认）；据此**实修 C3**（升高 topLevel → 清除后再编号）；防抖延迟滑块（50–2000ms）；
  边界情况（E3/E7/E9/E11 等）补测。
- 可选打磨：路径规则的 user_tests 手验样例；删模板对话框 / 拖拽排序的实测核对。

**验证方式：**

- `cd obsidian-auto-headings && npm test`（178 passed）；`npm run lint`、`npm run format:check` 全绿。
- `npm run test:fuzz`（5000×80）全绿。
- `npm run release` 重新生成 `release/`（main.js/manifest.json/styles.css/zip 均 0.5.0）。
- 手验路径规则：设置面板「路径规则」区加一条文件夹规则指向自定义模板，打开该文件夹下的文件停顿后看是否
  用该模板编号；删根规则看兜底提示条；关「全局自动编号」后对某文件设 `fm: ON` 看是否仍自动编号；
  用「立即重新编号」命令对 `fm: OFF` 文件看是否照常编号。

---

## 2026-06-29 — 升版 0.4.0：Milestone 4 白名单系统（引擎匹配 + 默认词表 + GUI 编辑器）

**交接人：** 分支 `claude/obsidian-auto-headings-m4-1ylpto`

**做了什么：**

- **进入 Milestone 4**：版本号从 `0.3.19` 跨到 **`0.4.0`**（M=4，`*` 归零；同步 manifest/package/
  versions/lockfile/release）。
- **白名单匹配引擎**（`src/numbering.ts`）：
  - `normalizeForWhitelist(text)`：归一化用于命中判定（**不改写文件**）——去行内 Markdown（`**`/`*`/
    `_`/`` ` ``/链接）→ NFKC（折叠全角空格等）→ trim + 折叠内部空白 → 转小写。
  - `computeWhitelistExemptions(headings, template, options)`：对每个标题先 `stripPrefix` 剥旧编号
    （**豁免即去号**，D7）再归一，与各条目比对——`exact`（完全相等）/ `partial`（包含子串）/
    `subtree`（精确命中为根，覆盖其后更深标题、遇同级/更高级终止）。**多条目取并集**（`子树 > 全部 =
    部分`）。返回应豁免的 `Heading` 引用集合。
  - `numberHeadings` 接线：**缺省**即按 `template.whitelist` 自动计算豁免（命中者不写前缀、不占计数器
    槽位）；显式 `options.isWhitelisted` 回调仍**覆盖**（保持旧单测注入语义）。
  - `analyzeWhitelist(headings, template, options)`：供设置面板的逐条命中数（`perEntry[i].count`）、
    「自身被全部/部分豁免却含子标题」的 ⚠ 标记（`warnHasChildren`）、与豁免标题并集（`exempted`）。
- **默认模板预填词表**：`DEFAULT_WHITELIST()` 返回 16 条（中英各 8：目录/Contents、附录/Appendix、
  附图/Figures、附表/Tables、参考文献/References、致谢/Acknowledgements、摘要/Abstract、索引/Index），
  默认均「全部匹配」。`DEFAULT_TEMPLATE.whitelist` 改用它（旧仅 3 条占位）。
- **GUI 白名单编辑器**（`src/settings/SettingsTab.ts` + `styles.css`）：模板展开面板底部替换原占位提示，
  渲染——输入框（Enter 添加、`(text, match)` 去重）、条目 chip（词语 + 匹配方式下拉「全部/部分/子树」+
  命中数角标 + 含子标题 ⚠ + ✕ 删除）、当前活动文件实时命中预览「将豁免 N 个标题：…」。配套
  `main.ts` 新增 `currentFileHeadings()`、把 `strippableAffixes()` 转公开供面板取并集剥离选项。
- **测试**：新增 `tests/dev_tests/whitelist.test.ts`（20 例）覆盖归一化 + D1–D4/D6/D7/D8 + 默认词表
  自动生效 + `analyzeWhitelist` 命中数/告警。dev **158 passed**；`npm run test:fuzz`（5000×80）全绿
  （UVM 走显式 `isWhitelisted`，不受影响）。lint / format / build / release 全绿。

**没做什么（边界）：**

- **GUI 仅手验**：白名单编辑器属 DOM 层，沿用既有约定不写 DOM 单测（SettingsTab 无单测基建），
  留 `tests/user_tests/04-白名单结构标题.md`（已更新为 0.4.0 实测样例）手验。
- **未碰 M5/M6**：按路径选模板、双层开关、frontmatter `ON` 强制、删模板确认、清除编号命令均未动。
  当前仍全局单模板（「默认」），白名单随该模板生效。
- **C3（升 topLevel 孤儿前缀）** 仍缓（留 M6 清除编号兜底）；UVM 约束未放开（白名单匹配未纳入随机
  序列覆盖，属后续可扩展项）。
- **D2 尾随空白**：命中标题会和普通编号一样被 trim 尾随空白（既有行为），非白名单新引入。

**下一步：**

- 推进 **M5**：路径规则系统（`PathRuleStore`，`/` 根规则 + 具体度解析 + GUI 表格 + 路径补全）、
  开关两层化（启用插件 vs 全局自动编号）、frontmatter `ON` 文件级强制、手动命令绕过开关、删模板
  「知情确认 + 安全降级」对话框。届时白名单随**路径专属模板**整体覆盖（引擎已就绪，只差选模板那层）。
- 可选打磨：把白名单匹配纳入 UVM 随机序列覆盖（放开一条约束）；评估方案 B（状态化剥离）彻底解 C3。

**验证方式：**

- `cd obsidian-auto-headings && npm test`（158 passed）；`npm run lint`、`npm run format:check` 全绿。
- 动了引擎：`npm run test:fuzz`（5000×80）全绿。
- `npm run release` 重新生成 `release/`（main.js/manifest.json/styles.css/zip 均 0.4.0）。
- 手验白名单：把 `tests/user_tests/04-白名单结构标题.md` 的代码块贴进启用插件的 Vault，停顿后看
  目录/参考文献/摘要等不编号；在设置面板模板编辑面板底部增删条目、切换匹配方式看实时命中预览。

---

## 2026-06-29 — 升版 0.3.19：Layer 2 集成测试（main.ts 触发层 / 防抖 / 单事务 / 开关门控）

**交接人：** 分支 `claude/obsidian-auto-headings-next-sr4w3p`

**做了什么：**

- **新建 obsidian 模块替身 + vitest 别名**，使 `main.ts` 能在无 Obsidian 运行时下被加载测试：
  - `tests/dev_tests/obsidian-mock.ts`：极简替身，仅提供源码**作为值**用到的 `Plugin` / `PluginSettingTab`
    / `Setting` / `Notice`（记录消息供断言）/ `MarkdownView` / `normalizePath`（类型用途的导入编译时擦除）。
  - `vitest.config.ts` 加 `resolve.alias`：把所有 `import … from "obsidian"` 重定向到该替身。真实构建
    （esbuild）仍把 obsidian 标记 external，互不影响。
- **新建 Layer 2 集成测试 `tests/dev_tests/main.test.ts`（17 例）**：用「假编辑器」（记 `transaction`
  次数 + 应用整行替换）+ vitest 假定时器（`globalThis.window = globalThis` 提供 `window.setTimeout`）
  驱动 `AutoHeadingsPlugin` 的私有触发方法，覆盖 testplan：
  - **J1** 防抖合并（延迟内多次调度只编号一次）、**J3** 多文件路径独立、**J2** `onunload` 取消待处理、
    **J4** 多行改动合并为**一次事务**、**J5** `renumberActiveFile`（改模板后即时重排，默认→中文不叠加）。
  - **J7**（新增场景）「立即重新编号」绕过防抖 + 取消同文件待处理 + 遵守全局开关（弹 Notice）。
  - **I1/I2/I4** 开关门控：全局开关关不调度、到期前关开关则回调再校验跳过、frontmatter `OFF` 跳过。
  - **方案 A 接线**：`strippableAffixes()` 收集全模板前后缀并集（恒含空串），经 `applyRenumber` 生效——
    当前模板无前缀但别的模板用「第」时，旧 `第1 ` 前缀仍被剥净。
- **回填 testplan**：J1–J5 + 新 J7 → ✅；I1/I2/I4/I5 → ✅（I5 由 frontmatter.test + I1 跟随全局覆盖）；
  J 类 / I 类各加一段说明指向 `main.test.ts`。dev **共 138 passed**（新增 17）。
- 升版 0.3.18 → **0.3.19**，重生 `release/`。

**没做什么（明确边界）：**

- **J6（光标/选区不被打乱）仍 🔲**：假编辑器不建模光标与选区，属真实环境手验项，留 testplan 手验。
- **I3 / I6 / I7 仍 🔲（M5）**：frontmatter `ON` 强制覆盖全局关、手动命令绕过开关与 OFF、按路径规则
  选模板/无命中处理——这些 M5 语义尚未在 main.ts 实现。`main.test.ts` 里断言的是**当前 M3 行为**
  （如「立即重新编号」目前**遵守**开关与 OFF，与 M5 目标相反），实现 M5 时需改这些测试。
- 未碰编号引擎 `src/numbering.ts`（本轮纯测试基建 + 文档）。

**下一步（给接手 Agent 的明确起点）：**

1. **M4 白名单**（引擎已有 `isWhitelisted` 回调，差 GUI + 匹配归一化，testplan D 类）——是 M3 之后
   最自然的下一块功能。
2. 或 **M5 双层开关 + 路径系统**：实现 frontmatter `ON` 覆盖、手动命令绕过、路径规则选模板（testplan
   I3/I6/I7、spec §3.1/§3.2/§3.8），届时把 `main.test.ts` 里 I6 等「当前 M3 行为」断言改成 M5 目标。
3. 或评估方案 B（状态化剥离）以彻底解 C3 +「2024 首次也保留」（见 0.3.18 块）。

**验证方式：**

- `npm test`（138 passed，含 `main.test.ts` 17 例与 400 条随机序列）/ `npm run lint` / `npm run
  format:check` 全绿；`npm run build`（tsc）通过；`npm run release` 重生 `release/`（manifest 0.3.19）。
- 复现 Layer 2：`main.test.ts` 经 `obsidian` 别名加载真实插件；假定时器 `vi.advanceTimersByTime(300)`
  触发防抖回调；`FakeEditor.txnCount` 断言「单一事务」。

---

## 2026-06-29 — 升版 0.3.18：修 B2/B3/B9（方案 A）+「2024 折中」只剥一层（M3 打磨）

**交接人：** 分支 `claude/obsidian-auto-headings-next-sr4w3p`

**做了什么：**

- **修复 testplan B2/B3/B9「改前缀/后缀后再触发叠加」（方案 A）**：`stripPrefix` 剥离前后缀不再死扣
  当前模板值，新增 `affixAlternation()` 接受一个**候选集合**——恒含「当前级别值 + **空串**」，并由
  `NumberOptions.strippablePrefixes` / `strippableSuffixes` 注入。main.ts 新增 `strippableAffixes()`
  收集**全部模板各级在用的前后缀并集**传入。于是「无前缀时编的号」（空串候选）与「旧前缀值」（并集）
  都能被识别剥净：前缀空→`第` 得 `第1 标题`（不再 `第1 1 标题`）、后缀空→`章` 得 `1章 标题`。
- **落地用户约定的「2024 折中」（E5b）**：解决「用户在插件序号后补回自己的数字」被吃掉的问题。
  - **拆分隔符容差类**：`NUMBER_SEPARATOR_CLASS`（段间序号间隔符，**排除空格/Tab**）与
    `TITLE_SEPARATOR_CLASS`（标题间隔符，含空格）。空格只当「序号→标题」分隔符，故 `1 2024 标题`
    不再被解析成「`1`、`2024` 两段父级序号」。
  - **只剥一层**：去掉 `stripPrefix` 的循环重剥，一次只移除最左侧一个完整前缀单元，其后内容一律当
    正文。于是 `1 2024 总结` → 只剥 `1 ` → 保住 `2024 总结`（稳定、幂等）。`2024 总结` **首次**仍被剥
    成 `1 总结`（spec §2.3 既定取舍，无状态分不清插件前缀 vs 用户正文）。
  - **父级段恒可选**：`stripPrefix` 的 `(?:inner sep)*` 不再看当前 `inherit`——历史前缀可能是
    `inherit=true` 时写的（带父级段），即便现在翻成 false 也要能一并剥净；`*` 取零段即覆盖 inherit=false。
    这让去掉循环后 inherit 翻转的残留仍能剥净、保持幂等。
- **放开两条 UVM 约束并验证**（`tests/dev_tests/uvm/framework.ts`）：① 前后缀从「整条固定」改为
  「空 ↔ 本序列候选」随机切换 + 传「空+候选」并集给剥离（验证 B2/B3 双向）；② 移除「前缀非空回避数字
  起头标题」过滤、恒喂全部标题（验证 L2 已被方案 A 对称化）。`inherit×非空前后缀`、`topLevel 升`、`字母
  样式`三条约束仍保留。**15000×80 全绿、覆盖率闭合**（新增 `affix-toggled`/`affix-nonempty-trigger` bin）。
- **测试**：`numbering.test.ts` 把两条旧「循环剥离脏数据」测试改写为「只剥一层」新语义；新增 describe
  「改前缀/后缀后不叠加（方案 A，B2/B3）」5 例 + 「2024 折中（E5）」4 例。**dev 共 121 passed**。
  `tests/user_tests/07` 补 B2/B3/E5b 手动实测段。
- **文档**：testplan B2/B3/B9→✅、新增 E5/E5b、§1「2024 折中」原理、§3 汇总、§3.1 L2→✅、§4 约束表更新；
  spec §2.3 加两行（数字起头标题折中 + 前后缀方案 A）；uvm/README 约束表；README/版本号。
- 升版 0.3.17 → **0.3.18**，重生 `release/`。

**没做什么（明确边界）：**

- **未修 C3（升 topLevel 后移出范围标题的孤儿前缀）**：与「2024 折中」同源——「降出编号范围」的标题
  **不会被重新编号**，顺手剥它旧前缀就是 `# 2024 篇`→`# 篇` 的**裸吃**（无补偿、违背「别毁正文」）。
  彻底干净需引入状态（区分插件前缀 vs 用户正文）。暂缓，留给 M6「清除编号」命令兜底。UVM `topLevel
  只减不增` 约束保留。
- **未做状态化剥离（方案 B）**：用户与我确认本轮保持无状态、走方案 A + 折中。彻底区分「插件前缀 vs
  用户正文」（让 `2024 总结` 首次也保留、C3 干净）需记录插件写过什么，是更大改动，留作后续可选。
- 未触碰 main.ts 防抖/事务层与 Layer 2 集成测试（用户已指定为**下一轮**）。

**下一步（给接手 Agent 的明确起点）：**

1. **Layer 2 集成测试（用户指定的下一步）**：给 main.ts 的防抖 / 单一事务 / frontmatter 触发层建
   mock-Obsidian 集成测试（testplan J 类、I 类全 🔲）。当前所有测试只覆盖纯引擎 `renumberContent`，
   真实触发路径零覆盖。
2. 若要彻底解决 C3 + 「2024 首次也保留」：评估方案 B（状态化剥离，记录插件写入的前缀）。
3. 推进 M4 白名单（引擎已有回调，差 GUI + 匹配归一化，testplan D 类）。

**验证方式：**

- `npm test`（121 passed，含默认 400 条随机序列）/ `npm run lint` / `npm run format:check` 全绿；
  `npm run build`（tsc）通过；`AAH_FUZZ_RUNS=15000 AAH_FUZZ_OPS=80 ... --testTimeout=180000` 绿、覆盖率闭合；
  `npm run release` 重生 `release/`（manifest 0.3.18）。
- 复现 2024 折中：`renumberContent("## 1 2024 总结")` 得 `## 1 2024 总结`（保留）；`renumberContent("## 2024 总结")`
  得 `## 1 总结`（首次吃，取舍）。复现 B2：`renumberContent("## 1 标题", 前缀=第模板)` 得 `## 第1 标题`。

---

## 2026-06-28 — 升版 0.3.17：新增 UVM 风格「约束随机序列」压测框架（M3 打磨 / 测试基建）

**交接人：** 分支 `claude/obsidian-auto-headings-testplan-nwl2pt`

**做了什么：**

- **新增 UVM 风格随机序列测试框架**（`tests/dev_tests/uvm/` + 入口 `tests/dev_tests/random_sequence.test.ts`），
  借鉴硬件验证 UVM 思想压测状态转移 bug：
  - **Sequencer**：约束随机生成「编辑文本 / 改模板字段 / 触发编号」的长操作序列（`World.step`）。
  - **Driver**：把操作同步施加到「裸文档真值 `bare`」与「编辑器文本 `rendered`」（行级锁步）。
  - **Reference-model 记分板**：每次触发后断言 `join(rendered) === renumberContent(serialize(bare), 模板)`
    ——即「带历史前缀剥+重编」必须等于「从裸文本直接编号」。任何前缀叠加/残留当场被抓，且参考侧复用
    可信 build 路径、不重复实现逻辑、不会和 DUT 一起错。
  - **功能覆盖率**：14 类操作 + 各序号样式 + inherit/skipFill/ancestor/topLevel降/栅栏/白名单/空标题/
    深层级/跳级/自食标题等 bin 必须全部撞到，否则报「覆盖率未闭合」。
  - **可复现**：mulberry32 种子 RNG；失败抛 `SequenceError`，含 seed + 完整操作轨迹（含每次 trigger）+
    DUT/期望/裸文档三方文本。`AAH_FUZZ_SEED=N AAH_FUZZ_RUNS=1` 即复现单条。
- **默认随 `npm test` 跑 400 条 × 40 步（<1s）**；新增 `npm run test:fuzz`（5000×80）供改引擎后压一遍；
  可经 `AAH_FUZZ_RUNS/OPS/SEED` 调参。
- **bring-up 实战**：在 1.5 万条随机序列里先后撞出三类问题并逐一收口（**关键，下一手必读**）——
  1. **栅栏失衡**：`deleteLine` 删掉代码块闭合 ``` 会把已编号标题事后埋进未闭合代码块、冻结前缀够不着
     → 改为 deleteLine 不删栅栏定界行（模型局限，非 bug）。
  2. **L2**：前缀非空 + 数字起头标题（`2024 总结`）「带前缀后才被吃」是历史相关行为，参考模型表达不了
     → 前缀非空时回避数字/字母起头标题（spec §2.3 取舍，E5 已静态覆盖）。
  3. **L1**：某级从字母样式改走且无级别再用字母时，旧 `A)` 剥不掉会叠加 → 随机样式只用 arabic/cjk/circled
     （字母不在 `ALWAYS_STRIPPABLE_STYLES`，有意取舍）。
  最终对约束空间 **1.5 万条全绿、覆盖率闭合**。
- **约束 = 当前 strip 健壮性的精确刻画**：prefix/suffix 整条固定、inherit 仅前后缀空时翻转、topLevel 只减
  不增、样式不混字母、前缀非空回避数字/字母起头标题——每条都对应一个已登记的 bug/取舍（B2/B3/C3/L1/L2）。
- **文档**：testplan 新增 §3.1（L1/L2 取舍登记）+ §4（UVM 框架说明）+ 工作流程加「改引擎跑 test:fuzz、
  修好 bug 放开对应约束」；新增 `tests/dev_tests/uvm/README.md`；CLAUDE.md §5 增补随机测试通用指引。
- 升版 0.3.16 → **0.3.17**，重生 `release/`。

**没做什么（明确边界）：**

- **没改编号引擎 `src/`**（本轮纯测试基建 + 文档）；B2/B3/C3 仍未修——它们现由 UVM 约束**圈住**，等后续
  专门修复时放开对应约束即自动获得随机覆盖。
- 框架只压**引擎层**（`renumberContent`）；未驱动真实 Obsidian / main.ts 的防抖+事务层（上一轮讨论的
  Layer 2/3，留作后续）。

**下一步（给接手 Agent 的明确起点）：**

1. 修 B2/B3/C3 时：先在 `tests/dev_tests/uvm/framework.ts` **放开对应约束**（注释里已标明每条约束对应谁），
   `npm run test:fuzz` 跑红 → 据 `SequenceError` 的 seed/轨迹定位 → 改 `src/numbering.ts` → 再跑绿。
2. 想覆盖防抖/事务/frontmatter 触发层：参 0.3.16 之后那轮讨论，给 main.ts 建 mock-Obsidian 集成测试（Layer 2）。

**验证方式：**

- `npm test`（112 passed，含默认 400 条随机序列）/ `lint` / `format:check` 全绿；`npm run test:fuzz` 与
  `AAH_FUZZ_RUNS=15000 AAH_FUZZ_OPS=60 ... --testTimeout=120000` 均绿、覆盖率闭合；`npm run release` 重生
  `release/`（0.3.17）。

---

## 2026-06-28 — 升版 0.3.16：修复「改分隔符后再触发前缀叠加」（testplan B1/B4/B5，M3 打磨）

**交接人：** 分支 `claude/obsidian-auto-headings-testplan-nwl2pt`

**做了什么：**

- **修复 testplan B 类「分隔符族」3 个 bug**（在已编号内容上改间隔符后再触发会叠加）：
  - **B1** 标题间隔符 空格→`、`（用户报告的 `一、一 标题`）→ 现得 `一、标题`
  - **B5** 标题间隔符 `. `→空格（`1 1. 标题`）→ 现得 `1 标题`
  - **B4** 序号间隔符 `.`→`-`（`1-1 1.1 子`）→ 现得 `1-1 子`
- **修法**（`src/numbering.ts`）：新增 `SEPARATOR_CLASS`（常见分隔标点/空白字符类）与
  `tolerantSeparator(exact)`，在 `stripPrefix` 里把 `numberSeparator` / `titleSeparator` 的匹配从
  "只认当前模板值"改为"**优先精确匹配当前值，否则容差匹配一段分隔标点/空白**"。于是用**旧分隔符**写出
  的历史前缀也能被剥净、不再被当正文而在左侧叠新前缀。**前缀（prefix）/后缀（suffix）仍精确匹配
  不变**（见下"没做什么"）。
- **安全边界**（已加回归测试）：容差类**仅含标点/空白**，不含字母/数字/一般汉字；容差分支要求 ≥1 个
  分隔字符；前缀仍须以序号 token 起头。故"API 设计""100% 覆盖率"等**不以序号起头**的标题完全不受影响；
  "# 三"这类末尾无分隔符的真实标题也不被误剥。误伤面与历史一致（仅"序号+分隔符起头"会被当前缀覆盖，
  符合 spec §2.3）。
- **测试**：`tests/dev_tests/numbering.test.ts` 新增 describe「改分隔符后再触发不叠加」共 5 例（B1/B4/B5
  + 2 条安全性）；新增 `tests/user_tests/07-改配置后再触发.md` 手动实测样例。**111 passed**。
- **回填 testplan**：B1/B4/B5 与 §3 汇总表对应行 ❌→✅，写明修法与安全边界；B2/B3/C3 仍 ❌（见下）。
- 升版 0.3.15 → **0.3.16**，重生 `release/`。

**没做什么（明确边界）：**

- **没修 B2/B3（改前缀/后缀后叠加）**：`prefix`/`suffix` 是用户自填的**任意文本**，对其做容差匹配会
  大幅放大误伤（如把"Note 1 thing"的"Note "当前缀吃掉），风险远高于分隔符，**刻意留到专门一轮**用更
  结构化的方案处理。
- **没修 C3（调高 topLevel 后浅标题残留旧前缀）**：需在"剥移出范围的旧前缀"与"不误伤裸标题"间取舍，
  另案处理。
- 按用户要求本轮只取 3 个 bug（分隔符族），未扩大到其他类别。

**下一步（给接手 Agent 的明确起点）：**

1. 若继续修 bug：B2/B3（前缀/后缀）需要"对比本应写出的前缀"或"记录历史值"等结构化思路，**务必先在
   testplan E 类补足误伤面 user_tests / dev_tests** 再动手；C3 同理。
2. 否则按 testplan 把 🔲（M4 白名单 / M5 开关+路径 / M6 清除 / J 防抖）逐步补测试并实现。

**验证方式：**

- `npm test`（111 passed）/ `npm run lint` / `npm run format:check` 全绿；`npm run release` 已重生
  `release/`（manifest 0.3.16）。
- 复现修复：`renumberContent("## 标题", cjk+空格)` 得 `## 一 标题`，再用 cjk+`、` 模板重排得
  `## 一、标题`（旧版会得 `一、一 标题`）；详见新增测试与 testplan B 节。

---

## 2026-06-28 — 升版 0.3.15：新建 doc/testplan.md 测试计划 + 工作流程接线（M3 打磨）

**交接人：** 分支 `claude/obsidian-auto-headings-testplan-nwl2pt`

**做了什么：**

- **新建 [`doc/testplan.md`](./testplan.md)**——这个 Addon 的**测试场景清单与真值表**，按「操作（尤其
  操作序列）→ 预期结果 → 当前状态（✅/❌/⚠️/🔲）」逐条枚举，同时面向**开发期 Agent**（dev_tests）与
  **手动实测用户**（user_tests）。重点是 §1「状态转移测试」：把「已编号文件 → 改某模板字段 → 再触发」
  当一等公民来测，因为绝大多数诡异 bug 都出在这里。
- **实测复现并登记了一类 bug（§3 已知 bug 汇总）**：在已编号内容上**改格式字段后再触发会前缀叠加**——
  - B1 改标题间隔符（空格→`、`）→ `一、一 标题`（=用户报告的原始现象）
  - B5 标题间隔符 `. `→空格 → `1 1. 标题`
  - B4 序号间隔符 `.`→`-` → `1-1 1.1 子`
  - B2 加前缀「第」→ `第1 1 标题`；B3 加后缀「章」→ `1章 标题` 实为 `1章 1 标题`
  - C3 调高 topLevel 后，移出编号范围的浅标题残留旧前缀（`# 1 篇` 的 `1 ` 不被清）
  根因均在 `src/numbering.ts`：`stripPrefix` 把 `prefix/suffix/numberSeparator/titleSeparator` 当**当前值
  字面量**写进剥离正则，这些字段一改、旧前缀就匹配不上。**序号样式（numeral）此前已用"全样式并集
  token"修过（B6/B7 ✅），但这几个字面量字段没做同等放宽。**
- **工作流程接线**：根 `CLAUDE.md` §4.1 把 `testplan.md` 纳入 Addon 文档结构表、§5 开发流程新增「动手前
  先在 testplan 加场景 / 完工后回填状态」两步；`README.md`、`doc/spec.md` §2.3、`tests/user_tests/README.md`
  各加指向 testplan 的交叉引用。
- 升版 0.3.14 → **0.3.15**（manifest/package/package-lock/versions），重生 `release/`。

**没做什么（明确边界）：**

- **没有修任何 bug、没改引擎代码**。本周期只立测试计划、登记 bug、接线文档。§3 的 ❌ 全部留给后续周期。
- testplan 里标 ❌/🔲 的场景**尚未**落成 `tests/dev_tests/` 的失败回归测试——下一步要做。

**下一步（给接手 Agent 的明确起点）：**

1. 优先修 **B 类**（用户实际报告）：让 `stripPrefix` 对 `prefix/suffix/numberSeparator/titleSeparator`
   的旧值也能剥离（思路见 testplan §3 末「统一修复思路」），**难点是守住不误伤真实标题**——务必同步
   补 testplan B/C/E 类的 dev_tests + user_tests 双向验证「既剥得净、又不误伤」。
2. 每修好一条，把 testplan 对应行 ❌→✅、更新 §3 汇总表、补回归测试、bump 版本。
3. 之后再按 testplan 把 🔲（白名单 M4 / 清除 M6 / 开关 M5 / 防抖 J 类等）逐步补测试覆盖。

**验证方式：**

- `npm test`（106 passed）/ `npm run lint` / `npm run format:check` 全绿；`npm run release` 已重生
  `release/`（manifest 显示 0.3.15）。
- bug 复现：见 testplan §2 B/C 类「当前实测」列；可用 `renumberContent` 串两次（旧配置编号 → 改字段 →
  再编号）即得叠加输出。

---

## 2026-06-26 — 升版 0.3.14：修复标题间隔符预览失真（尾随空格被 trim）（M3 打磨）

**交接人**：agent（claude/obsidian-auto-headings-m3-y4vnoo 分支）

**用户反馈两点疑似 bug**：①标题间隔符默认是空格，改成别的后想改回空格、在输入框敲一个空格「似乎
识别不出来」；②间隔符填 `". "` 好像只能格式化成 `"."`。要求确认并修复，诉求是「用户在间隔符里敲
什么，插件就用什么」。

**核查结论（实测）：实际编号一直是对的，bug 只在 GUI 预览。**

- `renumberContent` 实测：`sep=" "` → `## 1 章`、`sep=". "` → `## 1. 章`，且二次编号幂等；
  `serializeTemplate`/`normalizeTemplate` 往返也**原样保留** `" "` 与 `". "`。即引擎与存储早已「敲啥用啥」。
- 真正的坑在 `previewLevel`：它对 `buildPrefix` 结果做了 `.replace(/\s+$/, "")`，把**预览**里的尾随
  空白吃掉，于是面板把 `" "` 显示成 `1标题`、`". "` 显示成 `1.标题`，让用户**误判**「空格没生效 /
  `. ` 被吃成 `.`」。

**做了什么**：

- `numbering.ts`：`previewLevel` **去掉尾随 trim**，原样返回 `buildPrefix` 前缀（`["1 ","2 ","3 "]`、
  `["1. ",…]`）。预览经 `previewText` 拼 `${s}标题` 后即 `1 标题` / `1. 标题`，尾随空格因其后紧跟
  「标题」而清晰可见，用户能得到「确实生效」的反馈。更新了该函数 JSDoc。
- 测试：`numbering.test.ts` 新增 `previewLevel` describe（空格 / `". "` / `"、"` 三例如实保留），共
  **106 passed**。
- spec.md §2.3 边界表新增一行（间隔符含尾随空白＝所见即所得 + 预览已修复说明）。
- 版本 0.3.13 → **0.3.14**（manifest/package/lock/versions/release/manifest + README 版本号），
  `npm run release` 重建产物。

**没做什么**（明确边界）：**未改编号 / 存储逻辑**（本就正确）；**未碰 M4+**；未改 `textCell` 输入控件——
HTML 文本框里只含一个空格时看起来「空」是输入框固有现象（值其实是 `" "`，placeholder 因有值而隐藏），
现在靠**预览**给出生效反馈即可，不过度改造控件。

**下一步**：继续 M3 打磨（按实测反馈），或经定优先级后推进 M4 白名单 / M5 / M6。

**验证方式**：`npm test`（106 passed）、`npm run lint`、`npm run format:check` 全绿；`npm run release`
重建产物。Obsidian 实测：模板某级标题间隔符填一个空格 → 预览显示 `1 标题`（有可见间距）、文件得
`## 1 章`；填 `". "` → 预览 `1. 标题`、文件得 `## 1. 章`。

---

## 2026-06-26 — 升版 0.3.13：新增「祖先序号渲染」开关 ancestorNumeral（M3 打磨）

**交接人**：agent（claude/obsidian-auto-headings-m3-y4vnoo 分支）

**背景**：上一周期（0.3.12）评估指出——当前「继承前级」对混合序号样式只支持「祖先各自套用自身
样式」(Model A)，故 `H2=中文/H3=阿拉伯` 得 `一.1`，无法表达中文书惯例（章 `一` / 节 `1.1`）。
用户拍板：①加每模板开关、默认保持现状；②`H4=a)` 两种语义都要（已由每级「继承前级」覆盖）；
③祖先段只取裸数字、不带祖先的前缀/后缀（本就如此）。本周期实现该开关。

**做了什么**：
- `numbering.ts`：新增 `AncestorNumeral = "self" | "arabic"`、`DEFAULT_ANCESTOR_NUMERAL = "self"`、
  `normalizeAncestorNumeral`；`Template` 加字段 `ancestorNumeral`；`DEFAULT_TEMPLATE` 补 `self`。
  `buildPrefix` 在拼祖先段时按策略选样式：**末段（当前级）始终套本级样式**，祖先段在 `arabic`
  下一律阿拉伯、`self` 下各自套自身样式（`i < lastIndex` 判定是否祖先）。占位段（skipFill）不受影响。
- `schema.ts`：`normalizeTemplate` 解析 `ancestorNumeral`（缺失/非法回退 `self`），随 `serializeTemplate` 落盘。
- `settings/SettingsTab.ts`：模板编辑面板「起始编号层级」下拉之后，新增「祖先序号渲染」下拉
  （各自样式 `1.a.①` / 统一阿拉伯 `一 / 1.1`），改动即存盘 + `renumberActiveFile` + 重渲染预览。
- **剥离无需改动**：`stripPrefix` 的祖先段 token 本就是全样式并集（`innerSegmentToken`），故
  `arabic` 写出的 `1.1` 能剥、由 `self` 切到 `arabic` 时旧的 `一.1` 也能被识别改写（已加幂等回归）。
- 测试：`numbering.test.ts` +6（self 保持 `一.1`；arabic 得 `一`/`1.1`/`1.1.1`；末段非阿拉伯保留
  `1.1.①`；arabic+H4 继承得 `1.1.a)`；H4 不继承得独立 `a)` 与策略无关；self→arabic 改写幂等），
  `schema.test.ts` +1（规范化/回退）。共 **103 passed**。
- 版本 0.3.12 → **0.3.13**（manifest/package/lock/versions/release/manifest + README 版本号与功能条目），
  `npm run release` 重建 `release/`（含 zip）。spec.md §3.5/§3.6 补该字段、组合规则与设计取舍。

**没做什么**（明确边界）：**未碰 M4+ 功能**；未提供第三种「祖先＝当前级样式」(Model B，会把
`1.1.a)` 变成 `a.a.a)`，无意义)；未让祖先段携带祖先自己的前缀/后缀（按用户③，只取裸数字）；
`numberSeparator`/`titleSeparator`/`prefix`/`suffix` 仍取**当前级**的（既有行为，未改）。

**下一步**：M3 继续打磨（按实测反馈），或经定优先级后推进 M4 白名单（spec.md §3.7）/ M5（§3.1/§3.2/§3.8）/
M6（§3.10）。若日后再加序号样式或第三种祖先策略，记得同步 `buildPrefix` 的祖先分支与
`stripPrefix` 的并集 token。

**验证方式**：`cd obsidian-auto-headings && npm test`（103 passed）、`npm run lint`、`npm run format:check`
全绿；`npm run release` 重建产物。Obsidian 实测：模板设 H2=中文、H3=阿拉伯、「祖先序号渲染」选
「统一阿拉伯」→ H2 标题 `一`、H3 子节 `1.1`、`1.1.1`；选「各自样式」→ 回到 `一.1`。

---

## 2026-06-26 — 升版 0.3.12：release 脚本额外打包 zip（M3 打磨 / 交付物增强）

**交接人**：agent（claude/obsidian-auto-headings-m3-y4vnoo 分支）

**用户诉求**（直接做）：`npm run release` 除了在 `release/` 平铺原来的三个独立文件，**还要生成一个
zip**；zip 内是一个 `obsidian-auto-headings/` 文件夹，里面放那三个文件。这样既能直接下载、解压即得
标准插件目录，也方便日后发布 GitHub Release。

**做了什么**：
- 新增 devDependency **`adm-zip`**（纯 JS、跨平台，避免依赖系统 `zip` CLI）。
- 重写 `scripts/sync-release.mjs`：平铺三文件后，再把 `main.js`/`manifest.json`/`styles.css` 以
  `obsidian-auto-headings/<file>` 路径塞进 zip，写出 `release/obsidian-auto-headings.zip`。
  zip 内文件夹名 = `manifest.json` 的 `id`。**固定每个条目时间戳**（2020-01-01），使内容不变时
  zip 字节稳定、不产生无意义的 git 改动（已验证连跑两次 md5 一致）。
- `release/README.md`：新增「方式一（zip）/ 方式二（独立文件）」两种安装说明。
- 版本 0.3.11 → **0.3.12**（manifest/package/package-lock/versions/release/manifest + README 版本号），
  `npm run release` 重建 `release/`（含新 zip）。

**没做什么**（明确边界）：未改任何编号逻辑 / 测试（仍 96 passed）；**未碰 M4+ 功能**；zip 文件名采用
**稳定名**（不含版本号）以免历史里堆积多份；zip 内**不含** `release/README.md`（按用户要求只放三文件）。
关于「继承前级」对混合序号样式的设计评估（H2=一/H3=1.1 诉求）见下方「评估」一节，本周期**仅评估、未改代码**。

**评估：当前「继承前级」能否表达「H2=一、H3=1.1、H4=a)」？（结论：不能，缺一个自由度，非 bug）**
- 实测当前引擎对「每个祖先段套用其**自身级别**的样式」（Model A，0.3.2 的有意设计）：
  `H2=cjk,H3=arabic` → `一.1`（用户想要 `1.1`）；`H2=arabic,H3=alpha,H4=circled` → `1.a.①`。
- 根因：每级单一的 `numeral` 字段同时承担两个**会冲突**的职责——「本级**独立**显示成什么」与
  「本级**作为祖先**出现在更深前缀里显示成什么」。中文书惯例（章 `一`、节 `1.1`）要求祖先转阿拉伯；
  而提纲惯例（`1.a.①` / `I.A.1`）要求祖先保留各自样式。两者**方向相反**，单一固定模型无法兼得。
- 结论：不是 bug，是**缺一个自由度**。建议加**每模板**开关「祖先序号渲染」= {各自样式（默认=现状）|
  统一阿拉伯}。默认值＝现状，向后兼容；选「统一阿拉伯」即得 `一` / `1.1` / `1.1.a)`。`stripPrefix`
  的剥离 token 本就纳入全样式并集，加该开关无需改动剥离、已天然兼容。
- 待用户确认的歧义（见对话）：①「统一阿拉伯」下同一章在标题处显示 `一`、在子节号里显示 `1`，这种
  「同号不同形」是否可接受（中文书确实如此）；②`H4=a)` 指**不继承**的独立 `a)`，还是继承的 `1.1.a)`；
  ③祖先段是否需要带祖先自己的前缀/后缀（如 `第一章`→子节里要不要 `第1章.…`，通常不要）。

**下一步**：等用户就上面三点拍板后，再实现「祖先序号渲染」开关（M3 打磨范畴）：`Template` 加字段
（如 `ancestorNumeral: "self" | "arabic"`，默认 `self`）→ `buildPrefix` 渲染祖先段时按它选样式 →
schema 解析/兜底 → GUI 加下拉 → 补单测（两模型在 cjk/alpha/circled 组合下的输出与往返剥离）。

**验证方式**：`cd obsidian-auto-headings && npm test`（96 passed）、`npm run lint`、`npm run format:check`
全绿；`npm run release` 后 `unzip -l release/obsidian-auto-headings.zip` 应见 `obsidian-auto-headings/`
下三文件；连跑两次 `npm run release`，`md5sum release/obsidian-auto-headings.zip` 两次一致。

---

## 2026-06-26 — 升版 0.3.11：修复「空行直接转标题致编号重复叠加」bug（M3 打磨）

**交接人**：agent（claude/obsidian-auto-headings-m3-y4vnoo 分支）

**用户诉求**：(1) 按 0.3.10 文档要求更新设计与产出，开发**停留在 M3 持续打磨**，不碰 M4+ 里程碑。
(2) 修复一个实测 bug：用户在**本行无文字**时用快捷键直接把当前行转成 H2/H3 等标题，插件会插入
**两个一模一样的编号**（如 `1.1.1 1.1.1`）；删掉后面那个又会再生一个新的。

**根因**：用户在空行按快捷键，Obsidian 写入 `### `（带尾随空格）。插件首轮编号得 `### 1.1 `
（标题文本为空，行尾即「标题间隔符」那个空格）。下一轮 `parseHeadings` 会 **trim 掉行尾空白**
（`parser.ts`），读到的 `text` 变成 `1.1`（无尾随空格）。而 `stripPrefix` 的前缀正则**末尾要求
标题间隔符**（空格），故 `1.1` 配不上 → 被当成正文 → 在其左侧再叠一层新前缀 → `### 1.1 1.1`。
删掉后面那个 `1.1` 后剩 `### 1.1 `，重新触发又走同一条路，循环复生。

**修复**（最小且不引入回归）：
- `parser.ts`：`Heading` 新增 `rawText` 字段——与 `text` 唯一区别是**保留行尾空白**（`m[2]` 不 trim）。
- `numbering.ts`：新增 `stripHeadingPrefix(heading, level, template)`，改用 `heading.rawText`（即
  `1.1 `，**带间隔符空格**）调用 `stripPrefix`，再 trim 结果；`numberHeadings` 的白名单分支与正常
  分支都改用它。这样空标题前缀 `1.1 ` 能被干净剥成空（幂等），而 `# 三` 这类「**本身就是序号字样、
  行尾无空格**」的真实标题因缺间隔符**不被误剥**。
- **关键取舍**：曾试过在 `stripPrefix` 末尾把标题间隔符放宽为「间隔符 或 行尾 `$`」，但会把 `# 三`
  这类纯序号字样标题误剥（撞上既有回归测试），故**回退**，改走「剥离用保留空白的 rawText」这条更
  精准、无副作用的路径。

**做了什么**：上述两处源码修复；`doc/spec.md` §2.3 边界表新增一行（空行转标题的幂等保证）；
`numbering.test.ts` 新增 3 条回归（空 H3 多轮幂等不叠加、删残留不复生、`# 一/二/三` 真实序号标题
不误剥）、`parser.test.ts` 新增 1 条（`text` 去尾空白 vs `rawText` 保留），共 **96 passed**；
版本 0.3.10 → **0.3.11**（manifest/package/package-lock/versions/release/manifest），`npm run release`
重建 `release/`（含 `main.js`）；根 `README.md` 版本号 0.3.10 → 0.3.11。

**没做什么**（明确边界）：**未碰 M4+ 任何功能**（白名单匹配、按路径选模板、开关重构、清除编号均按
原状停在「待开发」）；未改 `stripPrefix` 的剥离 token 策略与计数器状态机；未触碰「手写 `1.1 标题`
会被当前缀剥掉」这一既有且已文档化的固有歧义（与本次无关）。

**下一步**：继续 M3 打磨（按用户实测反馈），或在用户/接手者定优先级后推进 M4 白名单（`spec.md`
§3.7）/ M5 开关重构+路径系统（§3.1/§3.2/§3.8）/ M6 清除编号（§3.10）。

**验证方式**：`cd obsidian-auto-headings && npm test`（96 passed）、`npm run lint`、`npm run format:check`
全绿；`npm run release` 后 `git status` 见 `release/` 更新。Obsidian 实测：在空行按快捷键转 H3，
反复编辑/保存只得单个 `1.1`（不叠成 `1.1 1.1`）；把模板 `topLevel` 设 H1 时 `# 三` 仍呈现为 `3 三`
（序号字样标题不被吞）。

---

## 2026-06-26 — 升版 0.3.10：开关重构 + 路径 `/` 根规则 + 清除编号（仅改规格文档）

**交接人**：agent（claude/obsidian-auto-headings-logic-2rih7m 分支）

**用户诉求**（M5/M6 的设计定调，本周期**只更新文档、不动代码/测试**）：
1. **开关两层化**：「启用插件」≠「自动编号」。装了插件但得在面板开「全局自动编号」才会自动跑；
   否则只按 frontmatter `obsidian-auto-headings` 的值、或用户手动命令才工作。
2. **frontmatter `ON` 获得独立语义**：文件级强制自动编号（即便全局关）；`OFF` 文件级强制关闭。
   **手动命令绕过**全局开关与 `OFF`（用户敲命令即「我要」），且不弹 fm 值提示。
3. **路径系统**：取消单独的「全局默认模板选择器」，改为路径规则表里一条**可删的 `/` 根规则**充当
   全库兜底；删掉它即「只在特定路径编号」。无规则命中时：自动静默跳过、手动弹 Notice。
4. **删模板**：A+B 结合——被路径规则引用时弹确认对话框，列出受影响规则并可降级到「默认」/改投/连删。
5. **删模板/删规则不回滚已格式化文件**（冻结现状）；新增**「清除当前文件编号」命令** + 面板
   **[清除全库编号]** 按钮（二次确认、不做成命令防误触），剥离器用全样式并集、独立于模板。

**做了什么**（仅 `doc/spec.md` + 根 `README.md` + 版本号文件）：
- `spec.md`：§3.1 重写为「开关、命令与生效判定」（双层开关 + 命令表 + 自动/手动两条生效路径）；
  §3.2 重写单文件开关（`ON` 强制语义 + 矩阵 + `OFF` 不清除）；§3.6 补「删模板知情确认+安全降级」
  对话框与「不回滚」原则；§3.8 改为 `/` 根规则并入表格、可删、兜底提示条、无命中处理；
  §3.9 触发流程判定行更新；**新增 §3.10 清除编号**（双入口 + 全样式并集剥离器 + 与 `OFF` 分工 + 风险）；
  §2.3 边界表补 7 行；§4 架构图补 PathRuleStore/cleanup 模块与 M5–M6 接线说明；目录加 §3.10。
- 根 `README.md`：版本号 0.3.9→0.3.10；M5/M6 概览描述更新（已 prettier 对齐表格）。
- 版本号：`manifest.json` / `package.json` / `package-lock.json` / `versions.json` / `release/manifest.json`
  统一升 0.3.10。

**没做什么**（明确边界）：**未写任何源码 / 测试**——M5/M6 全部功能仍未实现，本周期纯规格定稿；
未重建 `release/main.js`（无源码改动，仅同步了 `release/manifest.json` 版本号元数据）；未触碰白名单（M4）。

**下一步**：先做 **M4 白名单系统**（`spec.md` §3.7，数据模型 `WhitelistEntry` 已在 M3 落地），
还是先做本轮定稿的 **M5 开关重构/路径系统**，由用户/接手者定优先级。实现 M5 时严格按新版 §3.1/§3.2/§3.8
的「自动 vs 手动」两条路径与 `/` 根规则模型；实现 M6 清除编号时按 §3.10 的全样式并集剥离器。
**动代码后务必 `npm run release` 重生 `release/main.js` 并入库**（本轮因纯文档未触发）。

**验证方式**：`cd obsidian-auto-headings && npm run format:check` 全绿（prettier 已对齐 README 表格）；
本轮未改源码故未跑 test/lint（沿用上一周期 92 passed）。人工：`spec.md` 目录含 §3.10，§3.1 标题为
「开关、命令与生效判定」。

---

## 2026-06-26 — 协作机制：文档结构重整 + status.jsonl 状态索引（不升版本号）

**交接人**：agent（claude/obsidian-inpage-title-compat-rc1emf 分支）

**用户诉求**（仓库级协作机制，**非对本插件功能的更新，故不升版本号**，仍 0.3.9）：
1. 在根 `CLAUDE.md` 写清「版本号里程碑内持续打磨」原则（`0.M.*`，`*` 持续递增直到该里程碑满意）。
2. log.md 越来越长——约定接手时**只读最新一块**，按需再翻历史。
3. 新建 `doc/status.jsonl` 极简状态索引（首行总览 + 每周期一句话概括，倒序），接手**先读它**；
   并把历史 log 概括进去。
4. 把 `doc/README.md`（详细规格）**更名为 `doc/spec.md`**，在 Addon 根**新建简短 `README.md`**
   （当前功能 + Milestone 概览）。以上一并写进 `CLAUDE.md`，并对 `chrome-tab-tree` 同样应用。

**做了什么**：
- **根 `CLAUDE.md`**：§4 改为「三层记忆」读序（status.jsonl → log.md 最新块 → spec.md）+ 每周期同维护
  log+status；新增 §4.1「文档结构」表（README / spec / log / status 职责）；新增 §5.1「版本号里程碑内
  持续打磨」（含「协作机制类改动不升版本」例外）；§7 速览表链接改指 README/spec/log/status。
- **本 Addon**：`doc/README.md` → `doc/spec.md`（`git mv` 保留历史）；新建根 `README.md`（简介 + 当前
  功能 + Milestone 概览）；新建 `doc/status.jsonl`（首行 0.3.9 总览 + 14 行历史概括）。log.md 顶部
  补「接手怎么读」与「历史条目中的『README §X』即 spec.md」消歧；目录结构树更新为 README/spec/status。
  release/README.md、status.jsonl 内的旧 `README §X` 指针改为 `spec.md`。
- **chrome-tab-tree**：同样把根 `README.md` → `doc/spec.md`、新建简短根 `README.md`、新建 `doc/status.jsonl`；
  log.md 指针改 spec.md。

**没做什么**：**未升版本号**（协作机制类，0.3.9 不变）；未改任何源码 / 测试 / 行为 / 产物二进制；
历史 log 块内的「README §X」prose 不逐条改写（用顶部消歧说明统一覆盖）。

**下一步**：Milestone 4 白名单系统（`spec.md` §3.7），接法见下方 0.3.7 记录的「下一步」。

**验证方式**：`cd obsidian-auto-headings && npm test`（92 passed）、`npm run lint`、`npm run format:check`
全绿（仅文档/结构改动，行为不变）。人工：`doc/` 下应有 spec.md / log.md / status.jsonl，根有简短 README.md。

---

## 2026-06-26 — 升版 0.3.9：README 与实现对齐（补全「后缀」等过时描述）

**交接人**：agent（claude/obsidian-inpage-title-compat-rc1emf 分支）

**用户诉求**：(1) 重申「做了更改就升版本号，哪怕功能没动」，本周期升到 **0.3.9**（0.3.* 全程
属 Milestone 3 的持续打磨迭代，`*` 可一直递增，直到 M3 满意无明显 bug）。(2) README 多处仍按
**加入「后缀」字段之前**的旧规格描述（如「前缀/序号/序号间隔符/标题间隔符/继承前级」缺了「后缀」），
要求对照 `log.md` 与源代码**交叉审查并更正**，让 README 与实际实现一致。

**做了什么**：
1. **版本号**：`package.json` / `manifest.json` / `versions.json` / `package-lock.json` / `release/manifest.json`
   全部 0.3.8 → **0.3.9**；`npm run release` 重新生成 `release/`。
2. **README 对照源码（`numbering.ts` 的 `LevelFormat`/`Template`/`DEFAULT_TEMPLATE`、`schema.ts` 的
   `serializeTemplate`）逐处更正**：
   - §3.6 字段数「五个」→「**六个**」结构化字段（prefix / numeral / **suffix** / numberSeparator /
     titleSeparator / inherit）；字段说明同步补 `suffix`、`levels.h1`、`topLevel`、`skipFill`。
   - §3.6「字段如何组合」示例块表头补 **后缀** 列，新增「第1.1章」示例行 + 后缀语义注释。
   - §3.6 两份 JSON 示例（学术风格 / 默认）补全每级 `suffix`、新增 `h1` 级、补模板级 `skipFill`/
     `topLevel`，字段顺序对齐 `serializeTemplate` 实际落盘输出。
   - §3.6 设置 GUI ASCII 布局图补 **后缀** 列、加 H1 置灰行、加「起始编号层级」下拉与「跳级缺失
     层级 / 占位字符」底栏，与实际面板一致。
   - §4 存储分层表：`data.json` 内容删去**白名单**（白名单随模板存于 `templates/*.json`，非 data.json）。
   - §4 架构图：`TemplateStore.ts` 归位到 `templates/`（与 `schema.ts` 同级）、`PathRuleStore` 标注
     「M5 规划，尚未实现」。
   - §5 Roadmap M3：schema 字段列表补 `suffix` 与模板级 `topLevel`/`skipFill`；编辑面板「五级×五列」
     → 「六级 H1–H6 × 六列〔含后缀〕+ 起始层级下拉 + 跳级占位」。
   - `log.md` 目录结构注释里过时的「H1 降级」→「起始层级 topLevel」（`demoteStrayH1s` 已于 0.3.7 移除）。

**没做什么**：未改任何**源代码 / 测试 / 行为**（纯文档 + 版本号 + 重生产物）；历史日志条目里的
「H1 降级」等描述属当时记录，**刻意保留**不改写。未触碰白名单（M4）、按路径选模板（M5）。

**下一步**：Milestone 4 白名单系统（README §3.7），接法见下方 0.3.7 记录的「下一步」。

**验证方式**：`cd obsidian-auto-headings && npm test`（92 passed）、`npm run lint`、
`npm run format:check` 全绿；`npm run release` 后 `git status` 见 `release/` 与各版本文件更新。
人工对照：README §3.6/§4 的字段、JSON、GUI 图、存储表均含「后缀」且与 `numbering.ts`/`schema.ts` 一致。

---

## 2026-06-26 — 厘清与 Obsidian「页内标题」的兼容关系（仅改文档）

**交接人**：agent（claude/obsidian-inpage-title-compat-rc1emf 分支）

**用户问题**：开启 Obsidian「外观 → 页内标题（将文件名作为可编辑的标题在文件内容中显示）」后，
这个官方功能与本插件有什么冲突？能否兼容？不能则适配。

**结论（核查后）：无破坏性冲突，且已天然兼容，无需改动行为。**

- **核查**：页内标题是编辑器从 `file.basename` 生成的**渲染层 widget**，不进入 CodeMirror 文本缓冲区。
  本插件全程只读写 Markdown 源文本——读 `editor.getValue()`（`main.ts:211`）、按行号 `editor.transaction`
  写回（`main.ts:240`）、`parseHeadings` 只扫源文本里的 `#` 行。两者分属渲染层 / 源文本层，互不污染：
  插件不会给页内标题编号，也不会因它行错位；阅读模式下插件不运行。
- **唯一关系是写作习惯搭配**：默认 `topLevel=H2` 是为「正文手写 `# 文档标题`」设计；开了页内标题后
  标题改由文件名承担，正文 `#` 常直接是章节，想给正文 H1 编号把模板 `topLevel` 设为 H1 即可（0.3.7 已支持）。
- **刻意不做自动适配**：按外观开关自动改 `topLevel` 违反「插件绝不替用户改 `#` 层级、不替用户做主」
  的核心原则（README §3.4），故只做**文档化指引**。

**做了什么**：README §2.3 边界表新增「页内标题」一行；§3.4 末尾新增「与 Obsidian『页内标题』的关系」
小节（含 `topLevel` 搭配表与「不自动改写」的说明）。

**没做什么**：**未改任何源码 / 测试 / 产物**——无代码改动，故未重新生成 `release/`、未改版本号
（仍 0.3.8，强制规则 1 针对代码改动）。未触碰白名单（M4）、按路径选模板（M5）。

**下一步**：Milestone 4 白名单系统（README §3.7），接法见下方 0.3.7 记录的「下一步」。

**验证方式**：本次为文档改动，`cd obsidian-auto-headings && npm test`（仍 92 passed）、`npm run lint`、
`npm run format:check` 维持全绿（未触碰源码，行为不变）。Obsidian 实测：开启页内标题后，文件名标题
不被编号、正文行不错位；把模板 `topLevel` 设为 H1 时正文 H1 章节正常编号为 `1`/`2`/…。

---

## 2026-06-26 — 修复两个实测 bug：改样式后前缀叠加 + 改模板后不更新（0.3.8）

**交接人**：agent（claude/obsidian-headings-format-bugs-4i4slj 分支）

**用户在 0.3.7 实测反馈两个 bug**：
1. 已格式化后，在「默认」模板里调整格式，会在文件里**追加新前缀而非改写旧的**，出现
   「1.2.1 1.二.1」这种叠加。
2. 有时调整格式后**文件压根没更新、什么改动都没有**。

**根因 & 修复**：

- **Bug 1（前缀叠加）**：`stripPrefix` 的剥离 token 只取「模板当前在用的样式」（+ arabic）。
  当把某级（如 H3）从中文改回阿拉伯、且**模板里再无任何级使用中文**时，cjk 字符类从 token 里
  消失，旧的 `1.二.1` 配不上、剥不掉，于是被当成正文、左侧再叠一层新 `1.2.1`。这正是 0.3.2 日志
  里「有意的边界」收敛取舍，现成了用户实打实的 bug。
  **修复**（`numbering.ts`）：把剥离拆成**父级段**与**末段**两类 token——
  - 父级（内层）段 `innerSegmentToken`：纳入**全部**序号样式。父级段恒被序号间隔符夹住，放宽到
    全样式不会误伤正文，却能清掉「样式被改走后残留」的父级旧段（如 `1.二.1` 里的 `二`）。
  - 末段 `lastSegmentToken`：arabic/cjk/带圈**始终**纳入（误伤面小，与长期存在的「2024 总结会被
    arabic 剥」一致），字母样式（lower/upper-alpha）**仅在模板实际使用时**纳入——否则会把
    「API 设计」「TODO 列表」这类英文词开头标题误剥。
  - 删除旧的 `templateNumeralStyles` / `numeralUnionToken`，新增 `ALWAYS_STRIPPABLE_STYLES` /
    `unionToken` / `innerSegmentToken` / `lastSegmentToken`。循环剥离与幂等性不变。
  - **取舍**：字母样式作为**末段**被改走（如 H3=字母→改回阿拉伯）后的残留仍剥不掉——这与
    「英文词开头标题不被误剥」直接冲突，无法两全；选择保护英文标题（更常见）。父级位置的字母
    残留则已能剥。

- **Bug 2（调整后不更新）**：在设置面板改模板只调 `templateStore.save()` 写盘，**从不触发当前
  打开文件的重新编号**，须等用户在编辑器里再敲一下才生效，故看起来「没更新」。
  **修复**：`main.ts` 新增 `renumberActiveFile()`（取活动 MarkdownView、跑同一套 `applyRenumber`，
  受全局开关/frontmatter 约束、无活动编辑器或无变化时静默跳过）；`SettingsTab` 在每处模板改动
  （网格各字段 `saveAndPreview`、起始编号层级、跳级策略、占位字符）保存后调用它，使格式调整即时
  反映到当前笔记。

**做了什么**：上述两处源码修复；`numbering.test.ts` 新增 4 条回归（中文改回阿拉伯不叠加、直接
清理 `1.2.1 1.二.1` 脏前缀、纯阿拉伯不误伤 `API 设计`/`TODO 列表`、内层放宽不误伤 `a.b.c 记法`），
共 **92 passed**；版本 0.3.7 → 0.3.8，重建 `release/`。

**没做什么**：未碰白名单（M4）、按路径选模板（M5）；字母样式作为**末段**被改走后的残留未处理
（见上「取舍」，刻意）；README 未改（剥离实现细节非用户可见规格，行为仍符合「手动前缀会被覆盖」）。

**下一步**：Milestone 4 白名单系统（README §3.7），接法见下方 0.3.7 记录的「下一步」。

**验证方式**：`cd obsidian-auto-headings && npm test`（92 passed）、`npm run lint`、
`npm run format:check` 全绿；`npm run release` 后 `git status` 见 `release/` 更新。Obsidian 实测：
默认模板某级改成中文再改回阿拉伯，旧 `1.二.1` 被改写为 `1.2.1`（不叠加）；在设置面板改格式时，
当前打开的笔记即时重新编号。

---

## 2026-06-25 — 起始编号层级 topLevel 取代 H1 降级；占位限数字；列序调整（0.3.7）

**交接人**：agent（claude/heading-numbering-fourth-level-76p04p 分支）

**用户诉求**：旧的「首个 H1 作标题、其余 H1 连同子树降级」太替用户做主、自由度不足。改为：
插件**永不改写 `#` 层级**；多个 H1 的处理由每模板的**起始编号层级 `topLevel`**（下拉，默认 H2）决定。
另：占位字符只允许「能被干净剥离」的字符（即数字）；模板列序调成 前缀 序号 序号间隔符 后缀 标题间隔符。

**做了什么**：
1. **topLevel（核心）**：`Template` 新增 `topLevel`（1–6，默认 2）与 `levels.h1`；`HeadingCounter`
   扩为 c1–c6（levels 1–6）。`numberHeadings` 改为：每个非白名单标题都 `bump`（即便低于 topLevel，
   作为**重置边界**），仅 `>= topLevel` 的标题输出前缀并剥离旧前缀（更浅的不剥离，避免误伤
   「2024 总结」）。`buildPrefix` 序号段从 `topLevel` 起截取。**删除 `demoteStrayH1s` 与
   `RenumberMode`**（live/format 合并），`renumberContent`/main.ts 去掉 `mode`，「立即重新编号」
   退化为普通重排。新增 `normalizeTopLevel`/`DEFAULT_TOP_LEVEL`。
   - 多 H1 语义：默认 H2 下所有 H1 原样保留、各自重置其下 H2；topLevel=H1 则 H1 也编号。
2. **schema**：`LEVEL_KEYS` 加 `h1`；`normalizeTemplate` 解析 `levels.h1` 与 `topLevel`（旧模板缺省
   回退 H2）。
3. **GUI**：模板面板加「起始编号层级」**下拉**（H1–H6）；网格扩为 H1–H6 六行、低于 topLevel 的行
   置灰（`.ah-grid-row-inactive`）、预览显示「（不编号）」；列序按用户要求调为
   前缀/序号/序号间隔符/后缀/标题间隔符/继承前级（`styles.css` 列模板同步）。
4. **占位限数字**：`sanitizePlaceholder` 改为只保留数字（空回退 0），`normalizeSkipFill` 与 schema
   都经它收口；GUI 占位输入即时滤除非数字。
5. **测试**：删 demote 用例、改 HeadingCounter 为 c1 基、补 topLevel/多 H1/重置边界/不误伤标题
   等用例（共 89 passed）。**文档**：README §2.3/3.3/3.4/3.5/3.6/3.9/Roadmap 全面改写
   （H1 降级 → topLevel）；`user_tests/03-多个H1.md` 重写。版本 0.3.6 → 0.3.7，重建 `release/`。

**没做什么**：未实现白名单匹配（M4，"首 H1 作标题+其余编号"需 topLevel=H1 + 白名单豁免标题行，
M4 落地后即可）；未做按路径选模板（M5）；未做每文件 frontmatter 覆写 topLevel（未来可选增项）。
版本仍停在 0.3.*（0.4.* 预留给 M4）。

**下一步**：Milestone 4 白名单系统（README §3.7）。注意把白名单接入 `numberHeadings` 的
`isWhitelisted` 透明分支即可与 topLevel 协同（白名单透明、topLevel 决定范围）。

**验证方式**：`npm test`（89 passed）、`npm run lint`、`npm run format:check` 全绿；
`npm run release` 后 `git status` 见 `release/` 更新。手动：模板面板切「起始编号层级」H1/H2/H3，
对多 H1 文档实测；多个 `#` 不再被改写为 `##`。

---

## 2026-06-25 — 占位字符限数字 + 新增「后缀」模板字段（0.3.6）

**交接人**：agent（claude/heading-numbering-fourth-level-76p04p 分支）

**用户诉求**：(1) 占位字符不应允许会导致「无法干净剥离」的字符；(2) 模板每级加「后缀」字段，
使字段顺序为 **前缀 + 序号 + 后缀**，以支持「第1章」式编号。

**做了什么**：
1. **占位字符限数字**：新增 `sanitizePlaceholder`（滤除非数字、空回退 `0`），`normalizeSkipFill`
   与 schema 的 `skipFill` 解析都经它收口；GUI「占位字符」输入即时滤除非数字并回写。
   原因：`stripPrefix` 的剥离并集**恒含** arabic 的 `\d+`，故纯数字占位无论之后改占位/切 drop
   都能被干净剥离，不会重复叠加；`-`/`*` 等非数字在策略变更后会失配残留，故禁止。
2. **后缀字段**：`LevelFormat` 增 `suffix`（默认空）。`buildPrefix` 输出顺序改为
   `前缀 + 完整序号 + 后缀 + 标题间隔符`（如「第」+「1」+「章」+「 」→「第1章 」）；`stripPrefix`
   的正则同步纳入后缀，保证带后缀的前缀也能幂等剥离。后缀作用于**完整序号**（含继承父级），
   即「第1.1章」而非每段都带后缀。schema `normalizeLevel` 解析/兜底 `suffix`，旧模板缺省为空。
3. **GUI**：模板编辑网格新增「后缀」列（位于「序号」与「序号间隔符」之间）；
   `styles.css` 网格列数 7→8。
4. **测试**：numbering 新增后缀用例、占位限数字（数字幂等 + 非数字收口）用例；schema 新增
   suffix 与占位数字收口用例；并修订上一周期「自定义 `-` 占位」用例为数字。共 90 passed。
5. 文档：README §3.6 字段表加「后缀」行、拼接公式加后缀、`skipFill` 说明改为「仅限数字」；
   `user_tests/02` 占位说明改数字、新增 `06-前缀后缀第几章.md`。版本 0.3.5 → 0.3.6，重建 `release/`。

**没做什么**：未改计数器状态机、白名单（M4）、错位 H1；后缀仅作用于本级完整序号，不向子级传播
（与前缀一致）；按路径选模板仍属后续里程碑。

**下一步**：按 README Roadmap 推进（白名单 M4、按路径选模板 M5）。

**验证方式**：`npm test`（90 passed）、`npm run lint`、`npm run format:check` 全绿；
`npm run release` 后 `git status` 见 `release/` 更新。手动：模板某级填前缀「第」后缀「章」→
H2 得「第1章 标题」；占位字符输入非数字会被自动清掉。

---

## 2026-06-25 — 跳级占位策略改为「每个模板可配置」（0.3.5）

**交接人**：agent（claude/heading-numbering-fourth-level-76p04p 分支）

**用户诉求**：跳级缺失层级「补还是不补、补 0/1/任意字符」众口难调，应做成**选项**；且
**不要全局设置，由每个模板自行决定**（「默认」模板将默认套用于所有 md，等价于全局默认，其他模板再各自覆盖）。

**做了什么**：
1. **数据模型**（`numbering.ts`）：新增 `SkipFill = {mode:"drop"} | {mode:"fill",placeholder}`、
   `DEFAULT_SKIP_FILL`（补 `0`）、`normalizeSkipFill`（fill 空占位→`0` 兜底）。`Template` 增加
   **模板级**字段 `skipFill`；`DEFAULT_TEMPLATE` 默认补 `0`（与 0.3.4 行为一致）。
2. **引擎接线**：`buildPrefix` / `stripPrefix` 改为从 `template.skipFill` 读取策略——
   drop 丢弃缺失段、fill 以 placeholder 字面量补段；`numeralUnionToken` 把 fill 占位纳入剥离
   并集，保证**自定义占位（如 `-`）写出的前缀也能幂等剥离**，不会重复叠加。
3. **持久化**（`templates/schema.ts`）：`normalizeTemplate` 解析/校验 `skipFill`，缺失（旧模板）
   或非法回退默认补 `0`，fill 空占位回退 `0`；随 `serializeTemplate` 一并落盘。
4. **GUI**：模板编辑面板底部新增「跳级缺失层级」下拉（补位 / 不补位）+「占位字符」文本框
   （仅补位时显示），每模板独立、即时存盘。**未做成全局设置**（按用户要求）。
5. **测试**：numbering 新增 skipFill 五用例（fill 0/1/自定义 `-` 幂等/drop/空占位兜底）；
   schema 新增 4 用例（缺失/drop/自定义/非法回退）。共 86 passed。
6. 文档：README 边界表与 §3.6 增补 `skipFill` 字段说明；`user_tests/02` 说明该选项。
   版本 0.3.4 → 0.3.5，重新生成 `release/`。

**没做什么**：未把该策略做成全局设置（刻意，按用户要求归属模板）；未触碰计数器状态机、白名单
（M4）、错位 H1 等；按路径选模板仍属后续里程碑。

**下一步**：按 README Roadmap 推进（白名单 M4、按路径选模板 M5 等）。路径模板上线后，
「默认」模板的 `skipFill` 即为全局默认、其余模板各自覆盖的语义会自然生效。

**验证方式**：`npm test`（86 passed）、`npm run lint`、`npm run format:check` 全绿；
`npm run release` 后 `git status` 见 `release/` 更新。手动：设置面板展开某模板 → 底部切换
「跳级缺失层级」与「占位字符」，对 H2/H3 后直接写 H5 的文档实测 `1.1.0.1` / `1.1.1.1` / `1.1.1`。

---

## 2026-06-25 — 修复跳级标题少一段序号 + 面板版本号 + 测试目录重组（0.3.4）

**交接人**：agent（claude/heading-numbering-fourth-level-76p04p 分支）

**用户反馈**：从「第四级标题」（即 H5）起序号少一位——H3 后直接跟 H5 时，H5 被当作 H4
（如 `5.a.a` 三段，应为四段）。而当中间的 H4 真实存在时，H5 正常呈现四段。

**做了什么**：
1. **跳级序号修复**（`buildPrefix` @ `src/numbering.ts`）：原逻辑对跳级时计数器为 0 的中间
   祖先**整段丢弃**，导致 H_n 段数少于其深度。改为**如实呈现该 0**——故 H3→H5 得 `1.1.0.1`
   （四段，`0` 显式标示缺失的 H4），既不被当作 H4 的 `1.1.1`，也用 `0` 区别于「真实 H4=1」时
   的 `1.1.1.1`。（注：本周期内曾先用「1 占位」`1.1.1.1`，经用户确认改为 `0` 占位以消歧。）
   **关键不变量**：占位只影响显示，该级计数器仍保持 0，直到真正出现该级标题才从 1 累加——
   故跳级 H5 在前、随后首个真实 H4 仍为 `1.1.1`（不被借号）。
2. **设置面板版本号**：`SettingsTab.display()` 在面板右上角渲染 `v{manifest.version}`
   （新增 `.ah-version` 样式：右对齐、`--text-faint`、`--font-ui-smaller`，低调但清晰）。
3. **测试目录重组**：`tests/*.test.ts` 全部移入 **`tests/dev_tests/`**（agent 维护的自动化单测，
   `vitest include` 为 `tests/**/*.test.ts` 仍能发现；导入路径 `../src`→`../../src`）。新增
   **`tests/user_tests/`**：5 个 `.md` 场景文件供用户复制进真实 Vault 实测边界（基础嵌套 / 跳级 /
   多 H1 / 白名单 / 代码块内井号），每个文件先文字说明场景与预期、再用代码块给可复制内容
   （阅读模式一键复制）；附 `README.md` 说明用法与「后续按场景/模板扩展」的约定。
   `tests/user_tests/` 已加入 `.prettierignore`（刻意排版的 fixture，免被 prettier 改写）。
4. 同步修订 README「边界情况」表跳级一行；更新 `numbering.test.ts` 跳级用例为 `0` 占位预期。
5. 版本 0.3.3 → 0.3.4（manifest/package/versions），`npm run release` 重新生成 `release/`。

**没做什么**：未改动计数器状态机（`HeadingCounter` 累加/归零语义不变，跳级中间级别仍不实例化）；
未触碰白名单（M4，`user_tests/04` 已标注「功能开发中」）、错位 H1 降级等其他逻辑。

**下一步**：继续按 README Roadmap 推进（白名单 M4 等）。功能（如按路径区分模板）上线后，按
`tests/user_tests/README.md` 的约定补充对应场景的 `.md` 实测文件。

**验证方式**：项目根 `npm test`（78 passed）、`npm run lint`、`npm run format:check` 全绿；
`npm run release` 后 `git status` 可见 `release/` 已更新。手动复现跳级：H2/H3 后直接写 H5，
默认模板下应得 `1.1.0.1`（四段）；面板版本号见设置页右上角。

---

## 2026-06-25 — 修复两个编号 bug：父级样式继承 + 改模板后前缀重复叠加（0.3.2）

**交接人**：agent（claude/obsidian-headings-numbering-o8n6uf 分支）

用户实测反馈两个问题，本周期一并修复：

- **Bug 1（父级被强制成阿拉伯数字）**：原设计「跨级拼接时父级一律以阿拉伯数字呈现，仅本级套
  numeral 样式」（见旧 README §3.5/§3.6）。当把 H3 设为字母、H4 设为带圈时，H4 前缀显示成
  `3.1.①` 而非 `3.a.①`——父级的字母/带圈样式无法向下可见。**改为**：`buildPrefix` 让**每一级父级
  各自套用其所在级别的 numeral 样式**（内部计数器仍是纯阿拉伯整数，样式只在写入时套用）。这是
  对既有规格的有意修订，已同步改写 README §3.5/§3.6 相关表述。
- **Bug 2（改默认模板后前缀重复）**：先用旧模板（如 H4=带圈）格式化好，再把该级样式改成别的
  （如 arabic）后重新编号，会出现 `#### 3.1.1 3.1.① 子节` 这种**新前缀叠加在旧前缀左侧**的脏
  数据。**根因**：`stripPrefix` 的剥离 token 死扣「本级当前 numeral 样式」，样式一改，旧前缀里的
  `①` 配不上新 token（`\d+`），剥不掉，于是被当成标题正文、左侧再叠一层新前缀。**修复**：剥离时
  改用「模板**当前在用的全部样式**的并集 token」（始终含 arabic，便于迁移旧前缀与默认模板），每一段
  序号都用并集去匹配；并**循环剥离**直至稳定，可清理历史上已叠加的多层脏前缀。
- **做了什么**：
  - `numbering.ts`：`buildPrefix` 父级改套各自级别样式；新增 `templateNumeralStyles` /
    `numeralUnionToken`；`stripPrefix` 改用并集 token + 循环剥离；cjk 字符类补 `兆`。
  - `tests/numbering.test.ts`：更新原「父级 arabic」断言为新行为；新增两组回归——
    「父级套各自样式（含跨级路径往返还原、整文幂等）」与「改样式后不叠加 + 多层脏前缀循环清理 +
    纯阿拉伯模板不误伤英文词开头标题」。测试 70 → 76 全绿。
  - README §3.5/§3.6 改写「父级一律 arabic」为「父级各自套用其级别样式」。
  - 版本 0.3.1 → **0.3.2**（package/manifest/versions 同步），重跑 `npm run release` 刷新 `release/`。
- **没做什么**：未碰白名单（M4）/ 路径规则（M5）。并集启发式有一处**有意的边界**：若某样式仅被
  「正被改走的那一级」使用、改后模板里再无任何级用它，则该旧样式不在并集中，旧前缀剥不掉——
  这是为「纯阿拉伯模板不误伤 `API 设计` 这类英文词开头标题」而做的收敛取舍（并集只纳入模板**实际
  启用**的样式）。用户的实际场景（带圈仍用于 H6）不受影响。带圈 >50 的回退形式 `(n)` 仍不剥离。
- **下一步**：继续 Milestone 4（白名单系统，按 README §3.7 规格）。若日后扩展 numeral 样式，
  记得同步 `numeralTokenPattern`（剥离字符类）与 `buildPrefix`（父级套各自样式）的约定。
- **验证方式**：`cd obsidian-auto-headings && npm test && npm run lint && npm run format:check` 全绿
  （76 例）；Obsidian 实测：H3 字母/H4 带圈时前缀呈 `1.a.①`；把某级样式改掉后重新编号不再出现
  `1.1.1 1.1.①` 这类叠加，原有脏文件再格式化一次即被清理。

---

## 2026-06-25 — 修复 bug：非 arabic 序号样式下 H3–H6 标题被反复重写（0.3.1）

**交接人**：agent（claude/claude-md-docs-1upx6r 分支）

- **现象**：把模板某级序号样式改为非阿拉伯（cjk/带圈/字母）后，H3–H6 标题每个防抖周期被反复
  改写，前缀不断累加成「一堆重复序号 + 连接符」，标题文本被污染。H2 不受影响。
- **根因**：`stripPrefix`（`numbering.ts`）构造的剥离正则用**本级 numeral 的 token** 去匹配
  **所有**序号段；但 `buildPrefix` 的继承前缀里**父级序号恒为阿拉伯数字**、仅本级套用 numeral
  样式（如 cjk 的 H3 前缀是 `1.一`）。于是父级的 `1` 配不上 cjk 的字符类，整条前缀漏配 → 剥不掉
  → 下一周期再次 `buildPrefix` 叠加，雪崩。H2 无父级段故幸免。
- **做了什么**：
  - 修复 `stripPrefix` 的继承分支正则为 `(?:\d+{sep})*{token}`——零个或多个「阿拉伯父级 + 分隔符」
    后接本级 numeral token，与 `buildPrefix` 的结构严格对应（含跳级时父级段数可变）。
  - 新增回归测试（`tests/numbering.test.ts`）：四种非 arabic 样式在 H3/H4 的
    `buildPrefix→stripPrefix` 往返还原；cjk 模板 `renumberContent` 连续两次结果一致（不累加）。
    测试 65 → 70 全绿。
  - 版本 0.3.0 → **0.3.1**（`package.json`/`manifest.json`/`versions.json` 同步），重跑
    `npm run release` 刷新 `release/`。`minAppVersion` 保持 `1.4.0`（用户实测于 Obsidian 1.12.4，
    远高于下限；此 bug 与版本无关）。
- **没做什么**：未改其它逻辑；带圈数字 >50 的回退形式 `(n)` 仍无法被剥离（独立的小众边界，本次不涉）。
  白名单匹配仍属 M4，未动。
- **下一步**：继续 Milestone 4（按 README §3.7 规格）。若实现自定义 numeral 样式扩展，注意同步
  `numeralTokenPattern` 与 `buildPrefix` 的「父级 arabic、本级套样式」约定。
- **验证方式**：`cd obsidian-auto-headings && npm test && npm run lint && npm run format:check` 全绿；
  Obsidian 实测：把模板 H3 改 cjk，编辑触发后标题稳定为 `1.一 …` 且多次保存不再累加。

---

## 2026-06-25 — 白名单（M4）设计加固：保留全部/部分/子树，补齐健壮性规格（仅改文档）

**交接人**：agent（claude/claude-md-docs-1upx6r 分支）

- **做了什么**：与用户评审白名单匹配设计后，**保留** `全部/部分/子树` 三种面向用户的匹配方式
  （直观、好操作），但在 README 把此前的语义漏洞补成明确规格：
  - **匹配归一化**（健壮性核心）：比较前对标题与条目做「剥前缀 → 去行内 Markdown → NFKC →
    trim 并折叠空白 → 转小写」，**仅用于判定、不改写文件**；解决 `**目录**`、全角空格、大小写
    导致的「肉眼相同却不命中」。
  - 把「优先级取最强」澄清为**良定义的并集**：被任一条目命中即豁免；命中它的条目中有「子树」
    则连同子树一并豁免（`子树 > 全部 = 部分`）。
  - 点明「全部/部分」是谓词、「子树」是范围，二者正交；首版**不**提供「部分+子树」组合（留待后续
    高级选项）。明确「子树」根判定按**精确**命中。
  - 「自身被全部/部分豁免、却含子标题」会使子标题错挂到上一个已编号祖先 → 面板 ⚠ 告警引导改用
    子树；引擎不做隐式改写。补充**当前文件实时命中预览**与**条目去重**。
  - 更新 §2.3 边界表、§3.5 计数注意项、§3.7 全节、§5 的 M4 清单。
  - 按用户要求，把**默认模板预填充中英常用结构性标题词表**（目录/附录/附图/附表/参考文献/致谢/
    摘要/索引 及其英文，默认全部匹配）记为 **Milestone 4** 内容，写进 §3.7 词表与 M4 清单。
- **没做什么**：**未改动任何源码**——`WhitelistEntry`（`numbering.ts`）与校验器（`schema.ts`）已
  正确承载 `text + match(exact/partial/subtree)`，无需变动；实际匹配器、归一化、预览、告警、默认
  词表的**落地全部属 M4**，本次只更新规格。因无代码改动，**未重新生成 `release/`**（强制规则 1
  针对代码改动；本周期产物无变化）。
- **下一步**：实现 **Milestone 4**，严格按 README §3.7 新规格：归一化函数（注意只用于匹配）、
  并集解析、子树范围扫描（基于 `parser.ts` 扁平标题列表按级别推算，无父子链）、把判定接到
  `numberHeadings` 的 `isWhitelisted` 回调、扩充 `DEFAULT_TEMPLATE.whitelist` 为上述中英词表、
  以及面板内的 chip 编辑器/去重/⚠ 告警/当前文件命中预览。补单测：归一化各分支、并集优先、子树范围、
  含子标题告警场景。
- **验证方式**：本次为文档改动，`cd obsidian-auto-headings && npm test && npm run lint &&
  npm run format:check` 维持全绿（未触碰源码，行为不变）。

---

## 2026-06-25 — 仓库改用统一 Agent 交接约定（未触碰插件代码）

**交接人**：agent（claude/claude-md-docs-1upx6r 分支）

- **做了什么**：仓库新增顶层 `CLAUDE.md`（通用开发守则）与 Claude Code on the web 的 SessionStart
  钩子（`.claude/`，远程会话自动 `npm install`）；并把「每个 Addon 用 `doc/log.md` 倒序交接」固化
  为全仓库统一约定（见根 `CLAUDE.md` §4）。本文件即该约定在 obsidian-auto-headings 的落地，口径与
  新增的 `chrome-tab-tree/doc/log.md` 一致。
- **没做什么**：未改动任何插件功能代码 / 测试 / 产物；版本号不变（仍 0.3.0）。本项目顶部的
  ⚠️ 强制规则（每周期必跑 `npm run release` 并提交 `release/`）继续有效，优先级高于通用守则。
- **下一步**：插件开发主线不变——见下方 M3 记录的「下一步」（Milestone 4 白名单系统）。
- **验证方式**：本次为文档/工程约定改动，无需重跑插件测试；`npm test` / `npm run lint` 维持上一周期
  的全绿状态。

---

## 2026-06-24 — 交付物规范化（产物文件夹 + 强制约定）

**交接人**：agent（claude/obsidian-auto-headings-m3-t051ro 分支）

用户反馈：希望「每次工作都产出可供 Obsidian 实测的插件」，且产物文件夹用英文名。本次：

1. **产物文件夹 `产物/` → 重命名为 `release/`**（英文、语义清晰）；安装说明文件改名为
   `release/README.md`。同步更新 `.gitignore` / `.eslintignore` / `.prettierignore` 引用。
2. **新增 `npm run release` 脚本**（`scripts/sync-release.mjs`）：一条命令完成「生产构建 +
   把 main.js/manifest.json/styles.css 同步进 `release/`」，让每周期重生产物零成本。
3. **在本文件顶部新增「⚠️ 强制规则」**：要求所有 Agent 每个周期都用 `npm run release`
   重生 `release/` 并随提交入库——这是本次反馈的核心，已固化为团队约定。
4. 重新生成并提交了 Milestone 3 的最新 `release/`（版本 0.3.0），可直接安装实测。

未触碰任何插件功能代码；测试/lint/格式化保持全绿。

---

## 2026-06-24 — Milestone 3：模板系统（完成）

**交接人**：agent（claude/obsidian-auto-headings-m3-t051ro 分支）

### 背景 / 触发反馈
用户在 Obsidian 1.10.4 实测 M2 产物，反馈「GUI 只有全局开关，没看到其他功能」。
M3 的目标正是把模板系统补全，让设置面板真正可用。

### 本周期做了什么（Milestone 3 全部勾选）
1. **序号渲染器**（`src/numbering.ts` `renderNumeral`）：补全 `cjk`（中文数字，含
   十位规范化「十一」与万/亿大节进位）、`circled`（①…㊿，超界回退 `(n)`）、
   `lower-alpha` / `upper-alpha`（双射 26 进制，z→aa）。原先仅 `arabic`。
2. **模板 schema**（`src/templates/schema.ts`，新增）：`normalizeTemplate` 容错校验
   （缺失/非法字段回退默认，不抛错）、`serializeTemplate`、`createDefaultTemplate`、
   `templateFileName`（跨平台文件名安全化，「默认」→ `default.json`）。
3. **TemplateStore**（`src/templates/TemplateStore.ts`，新增）：用 `app.vault.adapter`
   读写 `templates/*.json`；`init()` 首次自动建目录 + 写 `default.json`；
   `create / save / delete / rename` CRUD；默认模板恒置顶、不可删/改名；单个损坏 JSON
   不影响整体加载。
4. **设置 GUI**（`src/settings/SettingsTab.ts` 重写）：模板列表 +「+ 新增模板」+ 每行
   「删除 / 编辑」；编辑向下展开行内面板（H2–H6 × 前缀/序号/序号间隔符/标题间隔符/
   继承前级 五列）+ 每级**实时预览**；非默认模板可在面板内改名（失焦/回车提交）。
5. **样式**（`styles.css`，新增）：编辑面板的网格布局。
6. **接线**（`src/main.ts`）：`onload` 初始化 TemplateStore；编号改用
   `getActiveTemplate()`（当前 = 全局默认模板「默认」），故在 GUI 编辑「默认」会**即时
   改变编号行为**；新增 `renameTemplate()` 钩子（为 M5 路径规则同步预留）。
7. **预览辅助**（`src/numbering.ts` `previewLevel`）：供 GUI 生成同级序号示例。
8. **测试**：新增 `tests/schema.test.ts`（11 例）；更新 `tests/numbering.test.ts`
   原「非 arabic 抛错」断言为各样式正确性断言。**全量 65 例通过，tsc / eslint 清白。**
9. **工程整理**：README 移入 `doc/`；新增可分发产物文件夹（后于同日重命名为 `release/`）；
   版本 0.0.1 → 0.3.0；更新 `.gitignore`（放行 `release/main.js`）/ `.prettierignore` / `.eslintignore`。

### 没做什么（明确的边界，未越界到后续 Milestone）
- **白名单匹配未实现（M4）**：模板已携带 `whitelist` 数据并在 GUI 保留，但 exact /
  partial / subtree 的命中判定与优先级、子树范围计算、计数周期集成**尚未实现**；
  GUI 中白名单编辑器仅有占位提示。`numberHeadings` 仍通过 `isWhitelisted` 回调注入
  （目前 main 未传入，即无白名单生效）。
- **按路径配置未实现（M5）**：当前所有文件统一使用「默认」模板。`renameTemplate` 里
  对 `data.json` 路径规则引用的同步是空操作（无规则可同步）。全局默认模板选择器、
  路径规则表格、路径补全均未做。
- **防抖延迟滑块 UI（M6）**：`debounceDelay` 已在数据模型与逻辑中生效，但设置面板尚无
  调节滑块。
- 多语言、更多序号样式（罗马数字等）、批量重排（M7 Backlog）。

### 已知限制 / 注意点
- 预览中 `circled` 仅覆盖 1–50，超出回退 `(n)`；`stripPrefix` 的带圈正则也仅覆盖常见区段。
- `stripPrefix` 存在设计内歧义：标题本身以「数字+标题间隔符」开头时会被当作旧前缀剥离
  （与 README「手动编辑前缀属预期、会被覆盖」一致）。
- GUI 字段为逐键 `input` 即时保存（写文件）；改名为失焦/回车提交以避免产生中间文件。

### 下一步（给接手 agent）
1. **Milestone 4 — 白名单系统**：在 `numbering.ts` 实现三种匹配与优先级（全部＜部分＜
   子树）、子树范围计算；在 `main.ts` 把当前模板的白名单接成 `isWhitelisted` 传入
   `renumberContent`；在 `SettingsTab` 的编辑面板内做白名单 chip 编辑器（输入回车添加、
   匹配方式下拉、x 删除）。数据通道（`Template.whitelist` + 序列化）已就绪。
2. **Milestone 5 — 按路径配置**：`PathRuleStore`、全局默认模板选择器、路径规则表格 +
   Obsidian 路径补全；解析后用 `getActiveTemplate(filePath)` 选模板；补全
   `renameTemplate` 中对路径规则的同步。
3. 建议：为 TemplateStore 增加针对 vault adapter 的集成测试（可 mock adapter）。

### 验证方式
```bash
cd obsidian-auto-headings
npm install
npm test           # 65 例
npm run lint
npm run release    # 构建并同步可实测插件到 release/
```
