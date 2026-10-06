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

## 2026-10-07 1.3.0 开发：M16 笔记内入口与模板编辑增强全部落地（不 bump，交接：feat/1.3.0-note-entry，仅本地）

### 做了什么

- 规格 [3.24](./spec/3.24-笔记内入口.md) + testplan S 组（S1–S23）先行。
- **纯函数**：`headingedit.ts`（`toggleSkipMarker` / `planSectionShift`，围栏内 `#` 不动、越界整体拒绝）、
  `templates/styles.ts`（样式快照 / 历史 / 去重限额 / 五个预设）。
- **接线**：`noteentry.ts`（5 条新命令、编辑器右键两项、状态栏「本篇」菜单、标题手柄菜单、单篇模板选择器）；
  `headinghandle.ts`（CM6 浮层 ⋮⋮，手机端行尾 ⋯）；`main.ts` 的 `getTemplateForFile` 认 frontmatter
  `obsidian-auto-headings-template`（只在规则命中且非「不编号」时生效，指向不存在的模板则忽略）。
- **命令改名**（ID 不变）：统一「动词 + 对象」，README / 使用指南同步。
- **模板编辑**：弹窗改草稿式（取消 / 保存，保存前不动笔记）；格式页顶部「快速套用」菜单（最近 4 份历史 + 预设）与
  「历史」弹窗；历史存 `data.json` 的 `templateHistory`，改名迁移、删除清除。
- 路径规则「不编号」从模板下拉挪到「模式」下拉（S23，数据仍是 `$none`；切回退默认模板）。
- 单测 +20：`headingedit.test.ts`、`templatestyles.test.ts`、`main.test.ts` S 组；mock 补 `Menu` / `FuzzySuggestModal` / `Platform`。

### 没做什么

- **真机只测了一部分**（桌面，Oblivion 库「Claude测试/基础」，操作后均已撤销 / 还原）：手柄悬停与菜单、跳过标记、整节降级、右键两项、状态栏菜单、单篇模板选择与清除、命令改名、模板弹窗快速套用 / 草稿取消。
  **没测**：历史弹窗（需保存一次模板）、模板「保存」落盘、路径规则「模式」下拉里的「不编号」、自动编号三选一的写入、整节升级与越界提示、手机端 ⋯、源码模式下的手柄。
- 实测发现并已修：窄边距下手柄左边放不下会压住折叠箭头 → 贴到标题文字末尾；单篇模板选择器没有「清除」→ 加「跟随路径规则」项；删光最后一个 frontmatter 键会留空 `---` 外壳 → 顺手清掉。
- 拖动手柄移动整节（Roadmap 写的「以后」）；M8b 未动。
- 标题手柄在源码模式也显示（按 `HyperMD-header` 类判定），是否保留待实测观感。

### 下一步

- 已部署 iCloud 测试库（当前库内即本分支构建）；请用户实测上面「没测」的几项和整体观感，修完后 bump 1.3.0、写 release notes、发版。
- 已知取舍：「不编号」切回写入 / 仅显示时模板退回默认，若用户嫌丢选择再加「记住上次模板」。

### 验证方式

- `npm run check`：全绿（Windows 本机 `whitelist.test.ts:406` ICU 假红除外）。

---

## 2026-10-07 发版 1.2.2：设置面板视觉更新（交接：feat/1.2.2-visual-refresh → master，tag 1.2.2）

### 做了什么

- 用户在 iCloud 测试库实测桌面端与手机端全部通过（手机端观感受 Obsidian 移动端原生样式所限，接受），确认发版。
- `npm run bump` 1.2.1 → 1.2.2；写 `doc/release-notes/1.2.2.md`（双语，含 M15 视觉更新 + 1.2.1 之后合入的属性链接 YAML
  引号修复与 `**` 星号修复）；testplan「未发版」→ 1.2.2，M15 相关 🔲 手验场景按用户实测回填 ✅。
- 合并 master、推送、等 CI 绿后打 tag `1.2.2`。

### 没做什么

- L31（离场提示条）没实测——只有固化编号后才出现，仍是 🔲。
- Community Hub 送审需用户登录维护者面板点「Check for new releases」。

### 下一步

- **立即开发 1.3.0（Roadmap M16：笔记内入口与模板编辑增强），新开对话进行，不在本对话。** 范围见
  `doc/spec/5-Roadmap.md` M16：标题手柄菜单、右键菜单两项、状态栏「本篇」菜单、新命令与命令改名、模板编辑增强
  （快速套用含「最近用过的样式」、此模板的历史、草稿式保存）。画布样稿 1.3.0 各块见记忆 gui-redesign-plan-2026-10。
- 开工前先读 `dev-cycle` 技能，testplan 先行；视觉 / 交互改动照旧部署 iCloud 测试库给用户看。

### 验证方式

- `npm run preflight` 全绿（Windows 本机 `whitelist.test.ts:406` ICU 假红除外）；master CI 绿后才打 tag。

---

## 2026-10-07 1.2.2 视觉风格更新：M15 全部落地（不 bump，交接：feat/1.2.2-visual-refresh，仅本地、未推送）

### 做了什么

- **第一块（外壳 + 全局设置）**：分区标题回原生、8 处弹窗原生 `setTitle`、TAB 四字名（编号维护图标 `wrench`）、
  全局设置说明一行化（`i18n.test.ts` 守门）、防抖滑块常显数值、VC 三行缩进且按 VC 状态显隐、离场提示条中性化。
  用户看过后定：外壳版本号**保留**；「在大纲中显示编号」开关**删除**、固定开启（旧字段加载时清理）。
- **第二块（路径模板）**：规则表去行号改当前笔记圆点、添加规则挪到标题行、窄屏两行 + ⋯ 菜单（确认框拆到
  `PathRuleModals.ts`）；模板卡片；新增模板编辑弹窗 `TemplateEditorModal.ts`（格式页 `EditPanel.ts` / 底部预览
  `TemplatePreview.ts` / 白名单页图例）；纯逻辑 `templateView.ts` + `templateView.test.ts`。
- **第三块**：编号维护 TAB（`DangerTab.ts` → `MaintenanceTab.ts`，两组、补「立即重新编号」「清除残留编号」入口、
  全库确认框输入确认词 `confirmWordMatches`）；关于插件（双语简介、按钮链接、鸣谢一行名称 + 一行说明）；外来编号
  弹窗（全选三态、已选计数、去卡片框、勾选框对齐、滚动条独立槽位、写明数量的确认按钮）与带处数的 Notice。
- testplan：L9 / L10 / L12 / L13 / L20 / L23 改写，新增 L27–L45、J22–J24，Q10 / Q24 / V43 注明变化；spec 3.6 / 3.7 /
  3.10 / 3.13 / 3.18 / 3.22 / 4 同步，Roadmap M15 全勾并写两条落地备注；使用指南补「标题链接建议」一节。

- **用户实测后第二轮（同日）**：卡片预览改为 H1–H6 全部列出（不编号层级浅色、不带编号）；编辑弹窗底部预览每行标出
  H 几；规则表下灰字对齐路径框；外来编号「全选」补半选横杠样式。我用电脑操作实机过了一遍全部 TAB、编辑弹窗、确认框、
  外来编号提示与弹窗（测试笔记 `Claude测试/外来编号弹窗测试.md`，弹窗都点了取消，未改任何笔记）。
- **第三轮（同日）**：用户定清库确认框不加「同时关闭自动编号」；编号维护的「清理非本插件编号」改为「检查…」，先弹
  迁移守卫同款清理预览框（`reviewActiveFileForeignNumbering`，没命中模板时只剥编号，L12 + `main.test.ts` 三条）。
- 快速套用要加「最近用过的样式」（记住该模板最近几次编辑，一键回到那个样式）——已记进 Roadmap M16，不在 1.2.2 做。

### 没做什么

- 新界面的 🔲 手验场景都还没过真机；没 bump、没写发布说明、没推送。

### 下一步

- 用户在 iCloud 测试库实测整套 1.2.2 → 按反馈改 → 用户确认后 bump 1.2.2、写 `doc/release-notes/1.2.2.md`、
  testplan「未发版」换版本号、合并 master、推送、打 tag（期间仍不推送，见 [[release-1.2.2-local-first]] 记忆）。

### 验证方式

- `npm run check`：837 条测试仅 `whitelist.test.ts:406` Windows ICU 假红；tsc / eslint / prettier（本仓库文件）/ docs 守卫通过。
- 构建已部署 iCloud 测试库（`release/` 2026-10-07 07:08）。
