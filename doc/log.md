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

## 2026-10-27 标题菜单四项反馈：设置开关 + 返回置顶 + 阅读视图落盘 + 升降级可选范围（不 bump、未提交，交接：claude/title-menu-level-adjust-c3cecb）

### 做了什么

- **设置开关**：全局设置新增「笔记内菜单」分组——标题右键菜单（`headingMenuEnabled`）、状态栏标签（`statusBarMenuEnabled`），默认开；关标题菜单时手柄 / 手机「⋯」/ 阅读视图右键 / 编辑器右键标题项都不再介入（testplan S39）。
- **返回置顶**：从标题菜单进的本篇菜单把「返回」放最上面，鼠标点完「本篇编号设置…」正落在它上面（S38，`noteentry.ts` `buildNoteMenu`）。
- **阅读视图菜单项生效**：只在阅读视图打开时改走 `vault.process`（`readingheadingmenu.ts` `fileBackedEditor` + 纯函数 `applyTextChanges`），不再依赖背后的隐藏编辑器；同篇有编辑视图仍改那个（S37，S35 ② 不变）。
- **升降级范围**：保持「本节 = 连同子标题」为默认，新增「仅升级 / 降级此标题」菜单项与两条命令（`planSectionShift` 加 `scope`，S36）。理由见 spec §3.24 末节。
- 10 种界面语言补 9 个键；testplan S36–S39、spec §3.24、user-guide 双语同步。

### 没做什么

- **没真机验**：阅读视图那条的根因是推断（隐藏编辑器不落盘 / 不重绘），改走文件肯定会重绘，但没在 Obsidian 里亲眼看过；S36–S39 仍写「待真机」。S35 当时的真机结论与用户这次实测矛盾，原因没查清。
- 阅读视图下本篇菜单里的「立即重新编号 / 复制大纲 / 清理」等仍走原编辑器路径，若用户反映同样无效再照 `fileBackedEditor` 的思路处理。
- 阅读视图下的改动进不了撤销栈（代价，已写进 spec）。
- 门槛：`vitest` 1012/1013，唯一红仍是已知 Windows ICU 假红（`whitelist.test.ts` CJK 排序）；`npm run check` 见提交前一次。

### 下一步

- 重建 `release/` 部署到测试库，真机验 S36–S39（尤其阅读视图下「跳过此标题 / 升级本节」是否真改了文件并重绘）；通过后回填 testplan、发 1.2.6。

### 验证方式

- 单测：`headingedit.test.ts`（scope self）、`readingheadingmenu.test.ts`（`applyTextChanges`，含 CRLF）、`settings.test.ts`（S39 缺省）；真机待办见上。

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

---

## 2026-10-24 补真机探针：收紧后的规则与「不选就记住」21/21（不 bump、未提交，交接：claude/issue-10-feedback-49b340）

### 做了什么

- 新增 `tests/probes/suggest-signals.js`：把 Q30 / Q31 / Q62 / Q63 搬到真机（loom test-vault，Obsidian 1.14.4）。临时打开建议、
  建 `探针-AH信号` 库，21 项全过；结束时删临时文件夹，建议开关还原成测前的「关」。
  - 触发规则那段用真编辑器打字；「不选就记住」那段改用假编辑器（`onTrigger` 只用到 `editor.getLine`），免得 Obsidian 自己的
    触发 / 关框在两次取样之间插进来改写记忆，把断言变成掷骰子。
- **首轮结果是假红，原因值得记**：库里 `main.js` 确实是新构建（哈希与 `release/` 一致），但插件是 05:11 加载的、构建是 05:29 拷进去的，
  内存里跑的还是旧规则（`sg.dismissed` 不存在、6 个字母就前缀弹、英文短词不要信号）。禁用再启用插件后复跑才 21/21。
  教训写进 `tests/probes/README.md`「怎么跑」：拷完构建必须重载插件，并附一行 `typeof` 自查。
- 探针自身修一处：`笔记.md` 里那条出链指向的标题文件必须**先建**——链接计数按建文件那一刻的解析结果算一次，目标还不存在就漏掉，
  要等源文件下次变动才补（`headinglinks.ts` 已有的取舍）。改成最后建「当前笔记」后 `linksFrom` 正常。
- `doc/testplan/Q-标题链接建议与VC联动.md`：Q30 / Q31 / Q62 / Q63 的状态格由「🔲 真机手验」改为
  「✅ 真机探针（`suggest-signals.js`，2026-10-24）」+「🔲 打字手感」——行为有真机证据了，手感仍没人看过。
- 顺手清库（用户授权）：主工作树切回 `master`；搬走重复克隆与 10-07 的旧 `release/auto-headings.zip`，删三个多余 worktree
  与四个已并入 master 的分支（未提交内容已 `git diff` 存成 patch）。有一个空 worktree 目录被进程占着删不掉，git 已不再登记它，无害。

### 没做什么

- 没合并 master、没 bump、没发版、没回 issue #10（等用户定）。
- **打字手感没测**：弹框出现的时机、候选顺序在真实输入节奏下顺不顺，没人试过；测试库平时关着建议，探针是临时开的。
- 手机端、旧版 Obsidian（< 1.11）的设置页没看。

### 下一步

- 用户拿测试库打一轮（打开「打字时建议标题链接」）→ 满意就按 `CLAUDE.md` §5.1 合并、发 1.2.5、回并关 issue #10。
- 主力库（Oblivion）**不用**为「升级统一关一次」做任何事：那次迁移只在 `vcIntegrationMode === "off"` 时改关，它开着 VC 联动
  （`auto`），按设计算显式选择、保持开着；把 `headingSuggestOffMigrated` 复位也是空操作，所以没动它的 `data.json`。
- 主力库的 `vc-heading-dictionary.json` 现在只有 `{"words":[]}`（04:53 关建议时清空的），下次重载本插件会按标题重建，不用手工补。

### 验证方式

- 真机：经 `loom-probe` 通道跑 `suggest-signals.js` → 21/21；跑完 `探针-AH信号` 已删、`headingLinkSuggestEnabled` 仍为 `false`、
  `main.js` 哈希与 `release/` 一致。
- 门槛：`node scripts/docs.mjs --check` 0、`prettier --check` 0（本次只动文档 + 新增探针脚本，`src/` 未动，故未重跑 vitest）。
