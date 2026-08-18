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

## 2026-08-19 M13 第七轮：VC 框里补齐同名标题 + 两个建议框观感统一（1.0.32）

### 做了什么

用户实测 1.0.31（VC 启用 + 词典联动开 + 让路生效）后提出三点，并明确了目标：「VC 的候选里既有
VC 自己的也有本插件的标题，同时出现，不管本文件还是其它文件都要有；标题 icon 是 H；不要
`交叉矩阵 => ...` 这种显示」。同时确认「VC 关闭、仅本插件时所有功能都在预期内」。

**先把 VC 侧的机制查清（源码 clone `doc/research/various-complements-src`，只读）**，三条硬约束
决定了哪些能做、哪些根本做不到：

1. **同名标题只出一条 ≠ 我们的 bug**：VC 的 `jsonToWords` 把 `value` / `displayed` **对调**
   （内部 `Word.value` 存的是我们给的 `displayed`，原 value 进 `insertedText`，
   `provider/CustomDictionaryWordProvider.ts:48-57`），而去重谓词 `suggestionUniqPredicate`
   （`ui/suggester.ts:27-45`）对 customDictionary **只比 `value` + type group**，不比
   `createdPath`、也不比 `insertedText` ⇒ 两条 `displayed` 相同的词条必被砍掉一条
   （落点 `ui/AutoCompleteSuggest.ts:602`）。**让 `displayed` 本身不同是唯一规避途径**；
   第二行小字不参与去重，救不回被删那条。
2. **`=> ...` 是 VC 设置项 `displayedTextSuffix` 的默认值本身**（字面量 `" => ..."`，
   `setting/settings.ts:223`），条件是「customDictionary + `insertedText` 非空 + 该设置非空」。
   我们**必须**给 `displayed`（否则 VC 拿整串 `[[...]]` 去匹配，用户打「交叉」根本匹配不上），
   `insertedText` 必然非空 ⇒ 只能置空那个设置。
3. **VC 框的 icon 改不了**：`::before` + base64 SVG，class **只按词条 type** 加，DOM 里没有任何
   per-word / per-dictionary 钩子（`ui/AutoCompleteSuggest.ts:1204-1224`）。想改成 H 只能覆盖整个
   customDictionary 类型的 CSS，**会误伤用户自己其它词典的条目**。VC 也没有任何面向第三方的
   扩展点（无 API、不挂 window、provider 硬编码）。

三点都需用户拍板，用 `AskUserQuestion` 摆出代价后用户定了：**冲突项才加区分后缀 + 下方小字写
来源** / **自动配置时写入清空** / **不覆盖 VC 的 CSS，改把本插件自己的框对齐 VC 的样式**（放弃 H）。

据此落地四件事：

1. **`disambiguateVcDisplayed`（`src/vcintegration.ts`）**：标题全库唯一 → 保持纯净；冲突组 →
   加 `(来源)`。**区分形态按「组」统一决定**——组内文件名互不相同就整组用文件名，只要有重名文件
   就**整组**升级为完整路径。这一条是单测当场逼出来的：初版逐条贪心地各判各的，`x/同.md` 与
   `y/同.md` 会得到「一条 `(同)`、一条 `(y/同)`」的参差列表，用户读不出这是同一维度的区分。
   仍撞（同文件两个同名标题、或与某个纯净标题撞车）→ 挂 ` #2`。后缀只能在**尾部**：VC 首字母
   桶键取 `value.charAt(0)`，前缀化会让「交叉」直接查不到。**先截断到 2 万条再消歧**，否则被
   截掉的孪生项会给幸存者留下一个毫无意义的后缀。
2. **词条加 `description = 路径`**：VC 官方字段，渲染为条目第二行小字，与本插件建议框的
   「标题 / 来源」两行对齐。它受用户全局设置 `descriptionOnSuggestion` 控制（设为 `None` 时不
   显示）——**不代改**（它同时管 internalLink 等，用户可能是刻意关的），改为
   `readVcDescriptionOnSuggestion` 只读探测 + 设置面板如实提示一句。正因为它可能被关掉，
   同名区分才必须落在标题行而不是只靠这一行。
3. **自动配置清空 `displayedTextSuffix`**：`VcSettingsShape` + `isValidVcSettingsShape` 加该字段，
   仿 `applyTriggerThreshold` 新增 `applyDisplayedTextSuffix`（现值非空串才写），活体与文件两条
   写入路径各调一次。这是 VC 的**全局显示项**，`vcAutoConfirmPoints` 单列一条并写明「你其它
   自定义词典的候选也不再带 ` => ...`」；手动模式不写 VC 配置，故在 `vcManualConfirmBody` 补一句
   让用户自己清。
4. **本插件建议框对齐 VC 观感**：`ICON_CANDIDATES` 由 `["heading","hash","link"]` 改为
   `["library","book","heading"]`（书架语义），第二行字号/配色由 `--font-ui-smaller`/`--text-faint`
   改为 VC 的 `0.75em`/`--text-muted`。**刻意不照搬 VC 样式表里的 base64 资产**（第三方资产 +
   署名问题），用 Obsidian 内置 lucide 的同语义图标，顺带自动跟随主题。

### 没做什么

- **没有覆盖 VC 的图标 CSS**（用户否决）：省掉一整块依赖 VC 私有 class 名的脆弱代码。
- **没有用零宽字符做不可见消歧**（用户否决）：能骗过去重且视觉零噪音，但
  `descriptionOnSuggestion=None` 时两条候选长得一模一样、无法选择，且词典文件被看不见的字符污染。
- 没有代改 `descriptionOnSuggestion`，没有碰 VC 的其它设置。
- 没有动让路判定（1.0.31 的三条件不变）、没有动 `MIN_QUERY_LENGTH`。

### 下一步

- 用户真机复测：① 重走一次「自动配置」，确认框应多出「清空显示后缀」那条，确认后 `=> ...` 消失；
  ② 打「交叉」，VC 框里应同时出现 `交叉矩阵 (axi)` 与 `交叉矩阵 (交叉矩阵)`，各带来源第二行，
  且 VC 自己的候选照常在列；③ 关 VC 或切「本插件优先」，看本插件的框是否已换成书架图标 + 对齐字号。
- 既有待办不变：P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM 交互。

### 验证方式

`npx tsc --noEmit` 干净；`npm test` 621 通过（唯一失败仍是 `whitelist.test.ts:406` Windows ICU
已知假红）——新增 `disambiguateVcDisplayed` 6 例（唯一项纯净 / 跨文件同名 / 同名文件不同目录整组
升级 / 同文件重复挂序号 / 与「原文长得像后缀」撞车 / 确定性）+ `buildVcDictionaryJson` 同名场景与
`description` 断言 + `isValidVcSettingsShape` 与 `enableAutoIntegration` 的 `displayedTextSuffix`
四例；同步改了 `main.test.ts` 里断言词典条目形状的旧用例（新增字段属语义变更，必须显式改期望值而
不是只加新用例）。`npm run test:fuzz`（5000×80）三块记分板全绿；lint / format:check / release
重建单独复跑。本周期派发 3 次（Explore ×2 查 VC 词条模型与渲染机制、Plan ×1 出实施方案）。

---

## 2026-08-19 M13 第六轮：消灭「让路死角」+ 本插件优先时隐藏 VC 配置（1.0.31）

### 做了什么

用户带着一个新 vault 形态实测 1.0.30 并报了三件事，其中一件是**我在 1.0.29 埋的设计错误**。

**用户的观察**：库里 `axi.md` 与 `交叉矩阵.md` 各有一个标题【交叉矩阵】，在 `axi.md` 里打字，
建议里「没有 `交叉矩阵.md` 的那个，只有本文件的，而且 icon 也不对」。

**先排除索引 bug**：vault 的 create / modify / delete / rename 四个事件都已接线
（`main.ts:318-346`），新建文件会被索引；`headingindex.test.ts` 也早有「多文件同名标题：全部
收录、path 次级排序确定」这条。所以不是索引漏收。追问后用户确认：**那个框是 VC 的**——
于是一切对上了：默认让路 + VC 已启用 ⇒ 我们的 `onTrigger` 恒返回 null，我们的框根本没机会
出现，用户看到的自始至终是 VC 的框，icon 自然也是 VC 的。

**根因（1.0.29 的设计错误）**：让路默认开（`headingSuggestWhenVcActive = "yield"`）+ 词典联动
默认关（`vcIntegrationMode = "off"`）——**两个默认叠在一起，装了 VC 的用户一开箱标题建议就
整个消失**。1.0.29 我意识到了这个死角，但用「设置面板弹一条警告」去兜——用户不打开设置就
永远看不到，等于静默失效。这是典型的「用提示去补设计缺陷」。

**修法：从判定条件上消灭，而不是提示**。`shouldYieldSuggestToVc` 加第三个条件——让路还要求
词典联动**确实开着**：

- 让路 + VC 启用 + 联动开 → 让路（VC 框里有标题条目，两边候选同框可见）
- 让路 + VC 启用 + **联动关** → **不让路**，由本插件的框接管（让给一个拿不出标题候选的框
  等于让用户什么都看不到）
- 本插件优先 / VC 未装未启用 → 一律不让路

死角从此不可达，面板那条「标题建议将无处出现」的警告随之改成如实告知
（`vcCoexistFallbackHint`：「当前仍由本插件的建议框接管……开启词典联动后即会真正让路」）。
`vcCoexistDesc` 同步补上「只有词典联动开着时才会真的让路」（中英双语）。

**用户明确要求的第二件事**：「本插件优先的时候，就不要出现 VC 的相关配置（联动选项、词典
按钮）」。已照做，但留了两条例外——照字面全隐会出事：

1. **词典联动已经开着**时照常渲染。否则会留下「词典还在按节流重写、用户却既看不见也关不掉」
   的隐身状态。
2. **VC 未安装**时不受影响。共存下拉本就只在 VC 已安装时渲染，此时 `headingSuggestWhenVcActive`
   的历史值不该反过来遮住手动联动——手动联动允许未装 VC 时先生成词典（testplan Q10）。

**第三件事（不是 bug）**：「本插件优先、不重启，打『交』出的是 VC 的框，打『交叉』才出本插件
的」——符合预期：`MIN_QUERY_LENGTH = 2`，单字符我们不触发，那一轮自然归 VC；两字符起我们接管。
顺带验证了共存开关**运行期切换即时生效、无需重启**。

用户另确认：Q22 的「一个交叉矩阵」接受后「一个」确实还在——1.0.29 的修复成立。

### 没做什么

- **没有改 icon 实现**：用户报的 icon 问题出在 VC 的框上，我们的 `setIcon("heading")` 这轮才
  第一次真正有机会显示（此前默认让路把它挡在门外）。等用户看到本插件的框再判断 `heading`
  这个 id 在其 Obsidian 版本里是否存在——存在则是 H，不存在会按 `ICON_CANDIDATES` 退到 `#`。
  不在没看到实物前反复改猜。
- 没有新增索引层测试：「多文件同名标题全部收录」早有单测，不重复造第二份（单一事实源）。
- 没有动 `MIN_QUERY_LENGTH`（单字符不触发是刻意的噪音防护）。

### 下一步

- 用户真机复测：默认设置下（联动关）本插件的框现在应当出现，且 `axi.md` / `交叉矩阵.md` 两条
  同名标题都在列 —— 顺便确认 icon 到底是 H 还是 `#`；「本插件优先」时 VC 配置应消失。
- 既有待办不变：P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM 交互。

### 验证方式

`npx tsc --noEmit` 干净；`vcintegration.test.ts` 30 例（`shouldYieldSuggestToVc` 扩为
两模式 × 三安装态 × 三联动态）、`i18n.test.ts` 键位对齐、`headingindex.test.ts` 全通过；
`npm test` 全量 611 通过（唯一失败仍是 `whitelist.test.ts:406` Windows ICU 已知假红）；
lint / format:check / release 重建单独复跑。本周期派发 0 次。

---

## 2026-08-19 M13 第五轮：设置面板叙述重写——把「共存」讲成产品选择而非实现细节（1.0.30）

### 做了什么

**只改文案与面板渲染，零行为改动**（用户明确圈定范围）。

起因是用户对 1.0.29 的共存方案追问了两轮，且两次都问在点子上：

1. 「VC 没开启时我们自己的标题补齐是非常完善的，这本身是插件的一大卖点」——对，而且**它一个
   字节词典都不用**（走内存 `HeadingIndex`），`vcIntegrationMode === "off"` 时词典完全不生成。
2. 「你说 VC 先挑，但两边都命中时不还是只有 VC 的候选框？」——**对，我上一轮把「按需让路」
   （改 EditorSuggest 排序，VC 先挑、它不接才轮到我们）排在推荐位是判断偏了**。它只是把「谁被
   盖住」换了个方向，两边都命中时标题候选照样消失；而「两边都命中」很可能是常态不是边角——
   只要那个标题恰好也是个文件名（用户截图里的「交叉矩阵」正是），VC 的内部链接补全必然命中。
   该路线已放弃，不为它去碰内部的 `workspace.editorSuggest.suggests` 排序（`obsidian.d.ts` 里
   只有 `registerEditorSuggest`，排序全无公开 API）。

由此得到的**结构性结论**（本轮要写进面板的那句话）：一个弹框位是 Obsidian 的硬限制，想让
两边候选**同时可见**就必须有人合并；合并只有两个方向，而把 VC 的条目并进我们的框需要读 VC
的 provider 并复刻其插入语义（内部 API，不可行），所以**官方支持的合并入口只有 VC 的自定义
词典**。词典的职责是「合并」，不是「补全」——这正是它删不掉又显得重的原因。

文案据此重写（中英双语同步）：

- `sectionSuggestDesc`（**新增**，「标题链接建议」分区导语，沿用 PathRules 的 `p.ah-section-desc`）：
  先讲「打字即出、不依赖任何其它插件、开箱即用」，再讲「下面两项只有同时装了 VC 才需要关心」。
  防的是用户把「VC 联动」误读成本功能的前置条件。
- `headingLinkSuggestDesc`：补一句「这项能力完全自带、不依赖任何其它插件」。
- `vcCoexistDesc`：从「Obsidian 同一时刻只显示一个建议框……」这种实现细节，改写成三种处境的
  后果——让路 + 开词典 = 两边同框可见（最完整）；不开词典 = 只能二选一，且明说各自看不到什么。
- `vcModeDesc`：从「联动增强」改成「**让标题候选出现在 VC 的建议框里**……这是把两边候选合并
  进同一个建议框的唯一官方入口」，并补「没装 VC 就用不上它，标题建议本来就独立可用」「关闭时
  一个字节都不生成」。

### 没做什么

- **没有动任何行为逻辑**：`shouldYieldSuggestToVc` / `headingSuggestWhenVcActive` / 词典生成与
  写入 / 触发解析全部原样，本轮 diff 只有 i18n 文案 + GeneralTab 多渲染一个 `<p>`。
- **没有实现「按需让路」（VC 先挑）**——见上，已论证其无法解决「两边都命中」，明确放弃。
- 没有删词典、没有改共存默认值（仍是 `"yield"`）。
- 词典分片、VC 内存注入（`suggester.customDictionaryWordProvider` 虽是公开字段且匹配走它的
  `wordsByFirstLetter`，但 `refreshCustomWords()` 开头就 `clearWords()`，任何 reload 都会清空
  我们塞的词条，且属伸手改他人插件内存状态）——两条都明确不做。

### 下一步

- 用户真机复测 1.0.29 的功能项（Q22 出候选且前半截保留 / Q23 弹框归属与开关切换 / icon 是否
  真渲染成 H / 面板分区观感）+ 本轮新文案的可读性。
- 既有待办不变：P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM 交互。

### 验证方式

`npx tsc --noEmit` 干净；`i18n.test.ts` 中英键位对齐 10 例通过；`npm test` 611 通过（唯一失败
仍是 `whitelist.test.ts:406` Windows ICU 排序已知假红）；lint / format:check / release 重建单独复跑
（注意 `preflight` 是串联的，test 一红后面的 lint / format:check 根本不会执行，不能只看它的退出码）。
本周期派发 0 次。

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
