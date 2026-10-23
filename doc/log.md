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

---

## 2026-10-23 issue #10 第二轮：触发方式三档 + 接管原生 `[[`；Roadmap 登记（不 bump、未提交，交接：claude/issue-10-feedback-49b340，仅本地；改动从 claude/issue-10-review-9028d8 原样复制过来，以本分支为准）

### 做了什么

- issue #10 报告者回复 1.2.4 后「问题依然在」：库里恰好有【项目】【json】这类标题（1–2 个文件、被链接过），按规则就是会弹；
  套话过滤（≥ 3 个文件）1.2.4 已有。用户定：不再调阈值，改为让用户选触发方式，且不另造触发符（`;;` 方案否决）——
  - 「标题链接建议」开关 → 三档下拉 `headingSuggestTrigger`：自动触发 / 打 `[[` 时 / 关闭。新装默认「打 `[[` 时」，
    老用户 `true → auto`、`false → off`（`main.loadSettings`）。
  - 新增 `src/nativelinksuggest.ts`：对照本机 Obsidian 1.10.6 app.js，原生 `[[` 建议框的 `suggestManager.getSuggestionsAsync`
    在文件模式下的结果之后追加 `heading` 型条目（与原生 `[[##` 同形，`subpath` 用公开的 `stripHeadingForLink`），插入交给原生；
    渲染按全库模式显示来源路径；高亮在追加条目上按 `#` / `^` 时只打字符不接受。认不出静默，卸载还原。
  - 非自动触发档：本插件建议框不弹；VC 框里本插件词典的词一律去掉；「建议显示在」只在自动触发档显示，且与上一行左对齐（删 `.ah-sub-settings`）。
- spec §3.23 新节、testplan Q49–Q56；使用指南双语、README 双语同步；`tests/probes/native-link.js`。
- Roadmap：自动起始层级（判定规则 + 边界 / 手欠情况表）、更多序号样式（中文大写 / 全角 / 片假名，天干记下暂不做）、
  Number Headings 迁移并入整库样式检测并改为设置分档（不处理 / 兼容 / 转换，细节待立项）、更多界面语言。
- 界面多语言（用户要求派 sonnet 子代理做，主模型复核门槛与抽查文案）：新增繁體中文 `zh-TW`、日本語 `ja`，类型为
  `Partial<Messages>`、缺键回落英文（`withEnglishFallback`）；「自动」按 `getLanguage()` 分支判定（zh-TW/HK/MO/Hant → 繁中，
  其余 zh → 简中，ja → 日文）；语言下拉用各语言自称。两种语言只缺 10 个语言无关键（序号样式名等）。日文一行化上限定 56 字
  （日文天然较长）。第二轮（同一子代理续做）再加 es / fr / de / ru / ko / pt-BR（pt / pt-PT 也归 pt-BR），俄语复数 `pluralRu`；
  西法德葡俄一行化 ≤ 100 字符、日韩 ≤ 56 字。**全部无母语审校**。见 spec §3.11、`tests/dev_tests/i18n-locales.test.ts`。
  `src/i18n.ts` 已约 4780 行（大半是翻译表），按拆分信号该拆成 `src/i18n/` 一语言一文件，本轮未做。
- 「编号维护」TAB 走查（用户问能否用、够不够、要不要精简）：新写 `tests/probes/maintenance-tab.js` 真机点当前笔记四项，**抓出一个真 bug**——
  实时预览会整笔丢弃删除 frontmatter 行的编辑器事务（插入不受影响），「清除」暂停后点「立即重新编号」提示「已重新编号，并恢复」
  却什么都没变。修法：事务被拒（内容原封不动）时退回「先编号、再经 `processFrontMatter` 删暂停键」两步（H15）。精简方案（当前笔记组
  挪进状态栏「本篇」菜单、TAB 只留全库两项）已给用户，用户定按方案做，并加两条（见下两条）。
- 「编号维护」TAB 精简（spec §3.24 / §3.13，S29–S32）：当前笔记组整体搬进本篇菜单（新增「清理」段：清理手写编号…；仅显示笔记另有清除残留），
  TAB 只剩全库两项；删掉不再用的 15 个文案键与 `clearActiveFileNumbering`。用户定把「清除本篇编号」并进「这篇不编号」：选它 = 写 `false`
  + 剥本插件编号（手写不动），**先属性、后剥离各一笔**（剥离带独立 `origin`），撤销一次只退剥离、属性仍是不编号——真机实测并成一笔时
  撤销会连属性一起退回。实时预览拒写属性时退回 `processFrontMatter`、等同步回编辑器再剥。
- 阅读视图右键标题菜单（S33–S35，用户提）：新增 `src/readingheadingmenu.ts`，右键阅读视图标题的折叠箭头打开同一份标题菜单，不能拖；
  标题行号取阅读视图渲染器 `getSectionInfo(el).lineStart`（DOM 无行号、懒渲染），取不到按标题文字唯一匹配；改文件走该视图自带编辑器事务。
- 记忆：用户总要求「简洁、思维负载低、操作简单、功能丰富」。
- 同日续（issue-10-feedback 会话）：「+ 新增规则」一律默认「仅显示」、模式下拉顺序改为仅显示 / 写入文件 / 不编号（V47，spec §3.22，用户定）；
  复跑 `native-link.js` 25/25。登记：Q57（`[[` 档按用户习惯打字，电脑操作真机；用户实测怀疑「`[[` 后打 `#` 一下子插入第一条」）、
  Q58（自动触发档回车不误选，报告者实为回车误选、非空格）、Roadmap M9「手写 / 外来编号识别改为整篇判断」（实测误判 `A 计划` 等）。
- Q57 电脑操作实测（主力库，测试笔记已删）：「[[xx」后按 # 补全第一个文件是 Obsidian 原生行为，不是本插件造成；本插件这边两处要改——
  高亮在追加的标题上按 # 是死路（只打出 #、框变「未找到」），短查询时追加的标题沉在文件候选之后看不见。
- 用户定按构想改（Q59 / Q60，spec §3.23、使用指南双语）：高亮在追加的标题上按 `#` / `^` 时把它所在的笔记当文件条目交给原生
  （对照 1.14.4 app.js 的 `qB`：文件条目 + `#` 拼成 `[[笔记#`），`#` 再填剥编号的标题文字，原生框只剩这一条；完整命中的标题
  由 `rankExactHeadings` 定分，排到完整命中的文件之后、其余条目之前。单测 16/16；`native-link.js` 补了 Q59 / Q60 检查。
- `src/i18n.ts` 拆成 `src/i18n/`（index / types / 10 个语言文件，派 sonnet 做）；主模型复核：10 种语言 `getMessages` 输出与拆分前逐字一致、导出符号一致。
- 新写 `tests/probes/note-freeze.js`（S31 ①③④、S35 ②），未跑。

### 没做什么

- **未提交、未发版**（用户要先本机测）。issue #10 未回复。
- Q53 / Q56 观感、Q55 真实 VC 联动只有逻辑 / 探查，没人眼看过。
- 待用户定：老用户 `true` 是否也迁到「打 `[[` 时」（现迁为自动触发，issue #10 报告者升级后原地不动）；Q58 未实现。
- 桌面端未真机：命令关自动编号是否顺手清编号；仅显示笔记有残留时「这篇不编号」能否清掉；手改属性为 `false` 只冻结不清；
  另一窗口开着编辑视图时在阅读视图里用菜单改文件。均可走 loom 探查通道。
- 手机端阅读视图标题菜单不做（待反馈）。

### 下一步

- 测试库窗口被关，`native-link.js`（新增 Q59 / Q60 项）与 `note-freeze.js` 都没跑：开测试库窗口后跑这两个；用户有空时主力库电脑操作重测 Q57 / Q59 / Q60。
- 上面四项探查（即 `note-freeze.js`） → 用户确认后按 dev-cycle 收尾提交、合并；之后发版并回复 issue #10（新档「打 `[[` 时」即其诉求）。

### 验证方式

- `npm run check`：唯一失败为已知 Windows ICU 排序假红（whitelist）；lint / 格式 / 构建全绿。
- loom test-vault（Obsidian 1.14.4）：`native-link.js` 25/25、`suggest-rules.js` 27/27、`maintenance-tab.js`、`note-menu.js` 全过（后者要求窗口可见：隐藏时阅读视图不渲染，探查前用 `showInactive` 显示测试库窗口）；旧 data.json 迁移为自动触发。
- 按用户要求，最终构建已放进 Oblivion 主力库与 loom test-vault（只换 main.js / manifest.json / styles.css，不碰 data.json；
  主力库原构建备份在会话 scratchpad）。主力库原开关是关着的，升级后显示为「关闭」。

---

## 2026-10-18 发版 1.2.4：issue #10 标题链接建议按信号触发 + VC 联动收紧（交接：claude/recent-fix-test-release-012e07 → master，tag 1.2.4）

### 做了什么

- 用户要求按最近的修复（`fix/heading-suggest-signals`，下一块）多测后发版。该分支快进到本工作分支，复跑门槛并补真机探查：
  - `npm run check` 唯一失败为已知 Windows ICU 排序假红；lint / 格式 / 构建全绿；`npm run test:fuzz` 3 组全绿（M13 44s，无 RPC 超时）。
  - loom test-vault（Obsidian 1.14.4）部署新构建 + 临时放入 VC：`suggest-timing.js` 11/11；新写 `tests/probes/suggest-rules.js`
    （Q7 / Q27–Q34 / Q46–Q48 共 27 项）全过。测完移走 VC、还原 test-vault 原 1.2.3 构建。
- 用户截图问「在 `# haha` 里打字，VC 框出 healthca 是否正常」：核对是 VC 的框，`healthca` 是思特威那篇第 203 行的真实标题（测试残留），
  被 VC 的 `fuzzyMatch`（用户库里开着）模糊命中；`healthcare` 来自 VC 的英文词表。行为符合 Q7 / Q48。问过用户是否在 VC 框里滤掉
  「只靠模糊命中」的标题，用户选**保持现状**；使用指南双语补一句 VC 模糊匹配的说明。
- bump 1.2.4，写 `doc/release-notes/1.2.4.md`，testplan / spec 的「未发版」回填为 1.2.4。

### 没做什么

- Q29（输入法拼字时按 Tab）、输入法下的空格误选仍只有用户手测结论，没自动化。
- issue #10 的回复与关闭留给用户（回复要按新规则写，草稿见上一块「没做什么」）。

### 下一步

- 推 master 等 CI 绿 → 打 tag 1.2.4 → 到 Community Hub 维护者面板点「Check for new releases」；回复并关闭 issue #10。之后回到 M17。

### 验证方式

- 同上：`npm run check`、`npm run test:fuzz`、test-vault 两个探查脚本（共 38 项）全过。
