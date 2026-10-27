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

## 2026-10-28 Quiet Outline 面板显示仅显示编号（不 bump、未提交，交接：claude/quiet-outline-show-only-numbers-7330df）

### 做了什么

- **接入 Quiet Outline**（第三方，0.5.15 核对）：它是 Vue 树、没有条目对象，但节点 `id="no-N"` 的 N 即 `metadataCache` `headings` 下标；用它取行号后走与内置大纲相同的「行号 + 级别」配对。所示文件取自 `plugin.navigator.view.file`。固定开启、无设置项（`outlineView.ts` 抽出 `OutlineAdapter`，内置大纲与 Quiet Outline 各一个；`main.ts` 加 `cachedHeadings`；`styles.css` 把文字容器改 flex 让 `::before` 同行）。
- testplan V48–V53、spec §3.22、架构目录树同步；单测 `virtual-outline.test.ts` 22 条（含 7 条 Quiet Outline 假 DOM 用例）。
- 门槛：`docs --check` / `prettier` / `eslint` / `tsc` 绿；`vitest` 1021/1022，唯一红是已知 Windows ICU 假红。已 `npm run release` 并覆盖部署到 Oblivion 库（库内原为 1.2.6）。

### 没做什么

- **真机（Oblivion 库，深色主题，Quiet Outline 0.5.15）已看**：编号与标题同行、窄面板长标题换行后悬挂缩进、搜索过滤带编号、编辑加标题后面板实时更新，均正常。**未看**：浅色主题、省略设置、彩虹线开关；节点 `id` 究竟挂在哪一层没读真实 DOM（渲染正确，无重复 id 的迹象）。
- 没写 README / user-guide（等真机确认可用后再补一句）。

### 下一步

- 补看浅色主题 / 省略设置后把 V53 改 ✅；用户确认后提交、合并。

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

---

## 2026-10-24 发版 1.2.5：标题链接建议默认关 + 按重放数据收紧 + 设置页改版（issue #10，交接：claude/issue-10-feedback-49b340 → master，tag 1.2.5）

### 做了什么

- 用户真机手感验过（2026-10-24）：上一块的探针 21/21 之后，用户自己在测试库打了真实内容，确认弹框时机与候选顺序可接受，据此发版。
- `npm run bump` 1.2.4 → 1.2.5（`manifest.json` / `package.json` / lockfile / `versions.json` / `release/manifest.json` 一并同步）；
  `doc/testplan/` 48 处、`doc/spec/` 18 处「未发版」回填为 1.2.5，顺手补了版本号与汉字之间的空格（`1.2.5起` → `1.2.5 起`）。
- 发布说明沿用上一块写好的 `doc/release-notes/1.2.5.md`，内容未改。
- 门槛：`docs --check` / `prettier --check` / `eslint` / `tsc` 全绿；`vitest` 1007/1008，唯一红仍是已知 Windows ICU 假红
  （`whitelist.test.ts` 的 CJK 排序）。

### 没做什么

- **没回 issue #10**：用户自己回并关闭。
- 没把新构建重新拷进测试库 / 主力库：两边跑的就是这份代码（`main.js` 哈希一致），只是 `manifest.json` 还写着 1.2.4，
  由用户自己走 BRAT / 商店更新。
- 手机端、旧版 Obsidian（< 1.11）的设置页没看（与上一块同）。

### 下一步

- 推 master 等 CI 绿 → 打 tag 1.2.5 → 到 Community Hub 维护者面板点「Check for new releases」送审；用户在 issue #10 回复并关闭。

### 验证方式

- `git tag` 与 `manifest.json` 版本一致（Release 工作流会校验，不一致即失败）；真机 21/21 见上一块；本轮只动版本号与文档，`src/` 未变。
