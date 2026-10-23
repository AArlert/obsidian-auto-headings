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

---

## 2026-10-24 issue #10 第三轮：触发方式收成开 / 关两档（新装默认关）+ 回车不接受（不 bump，交接：claude/issue-10-feedback-49b340）

### 做了什么

- 用户定（2026-10-24）：三档收成两档。报告者不用补全插件、没有「打字出建议」的习惯，对这类人最好的默认就是不弹。
  - **撤销「打 `[[` 时」档**：删 `src/nativelinksuggest.ts`、其单测与 `tests/probes/native-link.js`，`headingindex.queryPrefix` 的
    `includeGeneric` 还原。理由（spec §3.23「否决」）：全靠包原生框的非公开结构；原生 `[[##` 本来就按子序列模糊匹配全库标题
    （先前文档说它「按剥编号匹配做不到」是错的），多出来的只是少打两个 `#`。上一块里的 Q59 / Q60 随之作废。
  - 设置回到布尔 `headingLinkSuggestEnabled`（沿用发版键名），改名「打字时建议标题链接」，**全新安装默认关**；老用户原值保留，
    没有该键的 → 开；评审构建写过的 `headingSuggestTrigger` 折算一次（只有 `auto` 算开）后删掉（Q50）。
  - ~~编辑器右键菜单勾选项 + 「在右键菜单里显示开关」~~：做了、真机测过，用户看后定**没必要**（2026-10-24），已整块删掉
    （`main.addHeadingSuggestMenuItem`、设置项、10 种语言文案、单测与探针相应部分）；评审构建存过的 `headingSuggestInEditorMenu` 加载时删。Q61 标撤销。
  - **升级时统一改关一次**（2026-10-24 用户定：报告者是 1.2.4 升级用户，data.json 里存着默认的 `true`，只靠「新装默认关」盖不住他）：
    没做过迁移的（`headingSuggestOffMigrated` 不为 true）一律改关，开着 VC 联动的保持原值；只做一次，新装标记直接为 true。
    `settings.test.ts` 五例（Q50）。发布说明草稿 `doc/release-notes/1.2.5.md`（版本号发版时按 bump 定）。
  - **回车不接受**（Q58）：对照 1.14.4 app.js，`Scope.handleKey` 按注册顺序取第一个匹配，内置 Enter 先注册、追加盖不住——
    构造时经公开 `scope.unregister` 摘掉它（`keys` 未公开，认不出不动）；兜底：`selectSuggestion` 收到回车就关框 +
    `exec("newlineAndIndent")`。新单测 `tests/dev_tests/headingsuggest.test.ts`，mock 的 `Scope` 照真实形状补了 `keys` / `unregister`。
- 10 种语言的新文案；设置说明一行化上限内重写。spec §3.23 新节替换旧「三档」节，§3.13 / §4 同步；testplan Q49 / Q50 / Q55 / Q56 / Q58 改写、
  Q51–Q54 / Q57 / Q59 / Q60 标「已撤销」、新增 Q61；使用指南双语、README 双语改写。
- **设置页 GUI**（用户拿 Easy Typing 设置页作参考，2026-10-24 定，L49 / L50，spec §3.13）：TAB 选中态改淡强调色底 + 强调色字 + 底部线；
  每个分区一张大卡片（新 `src/settings/group.ts`，DOM 照原生 `SettingGroup`，外加 `ah-group` 卡片层），四个 TAB 都接上。
  先试过只用原生分组：在用户的 Cupertino 主题下与改前一样（主题把每行画成卡片），故加外层卡片。loom test-vault 截图看过
  Cupertino、默认深 / 浅、Minimal、Blue Topaz，测完主题还原；截图在会话 scratchpad。旧版 Obsidian（< 1.11）与手机端没看。
- 设置页细节（用户实测提，L51）：路径规则表列名改「路径 / 模板 / 编号模式」；卡片里的表头与面板同色；语言卡片加「界面」标题
  （新键 `sectionInterface`）；窄屏时分组标题行的按钮不再被挤到说明下面；模板编辑页「占位字符」框被后面的 `.ah-fmt-input { width: 100% }`
  盖成整行，叠写类名修回 52px。④⑤ 用户自己测。
- 用户看过后再定（L51 ② / ⑥、L34）：吸顶表头往上盖住面板的上内边距（滚上去的行原先会从表头上方露出来）；「添加规则」「新增模板」
  改为原生图标按钮 `addExtraButton`（只有「+」、无边框、悬停高亮、文字进提示），删掉 `decorateHeadingButton` 与 `.ah-heading-btn` 样式。
- **标题链接建议按主力库重放数据收紧**（用户问 1.2.4 规则效果 → 定「把改进方向做完」，spec §3.23 新段，Q30 / Q31 / Q62–Q64）：
  新脚本 `scripts/suggest-replay.mjs` 用当前源码把一个库逐字重放，报打扰（每千字弹几次）与召回（真实标题链接在原笔记里打出标题文字时
  能否弹出）。比了 9 组方案后落地：短词（不分中英）完整命中要信号——被链接 ≥ 2 次 / 就在当前笔记或同文件夹 / 当前笔记链过它
  （`hasShortWordSignal`、`HeadingIndex.exactMatchPaths`、`HeadingLinkCounts.linksFrom`）；纯英文前缀门槛 6 → 8 个字母
  （`MIN_LATIN_PREFIX_WEIGHT`）；「不选就记住」（`DismissMemory`，Esc / 回车 / 接着打字都算，离开即忘）。主力库：每千字 17.98 → 12.57，
  记住后至多 5.01；召回 79.9% → 75.7%。注意 `suggest-toggle.js` 的列表那一项现在会因记住而不弹（同篇同词），复跑时改用别的词。
- Roadmap M18 下登记「打字插链接的其他常见需求」（用户定先记录）：Esc 记住、显示文字用原词、选中文字后补链接、同篇短链接核实、README 讲透链接不断。
- 新探针 `tests/probes/suggest-toggle.js`（Q58 回车 / 列表续项、Q61 菜单）。
- **真机（2026-10-24，用户空了之后）**：
  - loom test-vault：`suggest-toggle.js` 12/12；`note-freeze.js` 13/13；回归 `note-menu.js`、`suggest-rules.js` 全过。
  - 真机抓出两处、已修：
    - **回车**：只摘内置 Enter 不够——编辑器自己的 CM 键表 `{key: "Enter", run: isShowingSuggestion}` 在有建议框时吞掉回车，
      回车既不插链接也不换行。改为再注册一个 Enter：先关框、返回 `undefined` 不拦截（`headingsuggest.ts`，单测同步）。
    - **S35 ②**：阅读视图那份编辑器缓冲不含另一叶子里未落盘的编辑，两边各自落盘互相覆盖，跳过标记丢了。改为同篇有编辑视图时
      改那个编辑器，行号经新纯函数 `mapHeadingLine` 按标题文字 + 同名序号映射；`markdownContextForPath` / `activeMarkdownContext`
      同样优先编辑视图（本篇菜单单篇操作同理）。
  - 探针自身修正：`suggest-toggle.js` 改打完整标题（两字中文需被链接过才弹）、菜单改读 DOM；`note-freeze.js` S31④ 的预期改为
    「改属性那一刻的样子」（写入笔记打开即被编号，手写「第三章」不认作编号会再补一个 2——这属 Roadmap M9 外来编号识别的范围）。
  - 电脑操作真键盘（test-vault，无 VC）：列表里回车续出下一项、不插链接、框关掉；Tab 插入 `[[目标#waiver|waiver]]`；
    微软拼音上屏「项目进度」后框弹出、回车照常换行；组合中回车只上屏字母。
  - 主力库 Oblivion（`D:\iCloudDrive\…\Oblivion`）已部署：评审构建的 `link` 加载为关、右键菜单末尾有此项（关无勾 / 开有勾），
    点按弹提示并写入 data.json（旧键已删）。主力库开着 VC 联动，开着时弹的是 VC 的框（按设计让路），回车 / Tab 是 VC 的行为。
    测完已经从右键菜单关回去（恢复测试前的实际状态）；部署前的 data.json 备份在会话 scratchpad。
  - 插曲：`obsidian://open?vault=Oblivion` 打开的是另一个同名库 `F:\文档\Obsidian\Oblivion`，快速切换器在那里新建了一篇
    「AH实测临时」，已删；两库的临时笔记都已删。以后按库 id `f23b2d6dac691435` 打开主力库。
- 门槛：tsc / eslint / prettier 绿；vitest 996/997（唯一红是已知 Windows ICU 假红 `whitelist.test.ts`）；`npm run release` 已出，已拷进 loom test-vault。

### 没做什么

- 主力库里本插件自己的框（不走 VC）没实测：要改用户的 VC 联动设置，没动；本插件框的按键以 test-vault 实测为准。
- 收紧后的触发规则与「不选就记住」只有单测 + 重放脚本，没真机打字测；旧版 Obsidian（< 1.11）设置页、手机端没看。
- 没 bump、没发版；issue #10 未回复；未合并 master。提交是一整笔：改动在同一批文件里交织，按主题拆的中间提交编不过。

### 下一步

- 合并回 master（CLAUDE.md §5.1）；新对话做 TOC（用户定）。
- 发版 1.2.5（release notes 草稿已写）→ 回复并关闭 issue #10。
- 调触发规则先跑 `node scripts/suggest-replay.mjs <库>`。
