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

## 2026-08-19 M13 第四轮：无标点连写触发（Q22）+ 与 VC 的建议框共存（Q23）+ 面板分区（1.0.29）

### 做了什么

接手 DS（另一 agent）留下的 1.0.28 与其交接报告 `doc/research/handover-m13-1.0.28.md`，
用户判断「不够好」。三件事：解决 bug、搞定 UI、收拾残局。

1. **Q22 无标点连写的尾部词触发**（用户实测：「一笔事务」「一个交叉矩阵」，以及光标停在行中间
   的「一笔事务|拆成」）。中文正文没有词边界，`extractTriggerToken` 把连续字母数字段整段吞成
   一个 token，前缀匹配必然落空（「哈哈，事务」有逗号断开故一直正常）。
   **没有照搬交接报告 §5.1 的方案**——那个方案把放宽做在索引层（新增 `HeadingIndex.
   queryBySuffix` / `hasAnySuffixMatch`），并明写「alias/排序/上下文屏蔽逻辑不变」，
   **漏了替换区间**：`onTrigger` 返回的 `start` 仍是整个 token 的起点，而 `selectSuggestion`
   替换的是 `[start, 光标)`——按那个方案接受【事务】会把前面的「一笔」一起删掉；`sortEntries`
   的「精确匹配优先」判据拿整段 token 去比也永远不成立。根因不在索引查询，在**触发词边界**。
   实际修法落在 `headingtrigger.ts` 的两个纯函数：`suffixCandidates`（整段 + 逐级后缀，长度
   ≥ `MIN_QUERY_LENGTH`，按码点切分不劈代理对，每个候选带自己的列偏移）+ `resolveTriggerQuery`
   （取第一个命中者 = 用户输入量最多者优先，注入索引判定保持纯函数可测）。索引 API 一行未动。
2. **Q23 与 Various Complements 的建议框共存**（用户实测截图指认：「VC 自身的文件链接建议被本
   插件覆盖了，都看不到」）。根因是 Obsidian 的 `EditorSuggest` **同一时刻只显示一个**弹框，
   先返回非 null 触发信息的那个赢；VC 与本插件都以普通 `EditorSuggest` 注册（VC 侧已核实：
   `doc/research/various-complements-src/src/main.ts:86` + `ui/AutoCompleteSuggest.ts:76`），
   本插件一命中，VC 的文件链接/词补全建议就整个看不见。**这不是「两个都显示」的取舍，是二选一**，
   且 Q22 修完命中面变大会让冲突更频繁——故先用 `AskUserQuestion` 摆出三个选项，用户选了
   「默认让路 + 给个开关」。落地：新设置 `headingSuggestWhenVcActive`（`"yield"` 默认 / `"own"`），
   判定抽成纯函数 `shouldYieldSuggestToVc(mode, status)` 便于单测，`HeadingLinkSuggest.onTrigger`
   开头调用。仅 VC **已启用**时才让路（未安装/已禁用没有竞争者，让路只会白丢功能）。
   **让路 + 词典联动关闭 = 标题建议无处出现**，这是该策略唯一的坑，设置面板就此显式警告
   （`vcCoexistDeadEndWarn`），不静默失效。
3. **UI（用户逐条指定）**：① 建议框 icon 由 `link` 改为标题的 H 标志——`setIcon` 的 id 只是
   字符串、官方 .d.ts 不枚举也不校验，传了内置集里没有的 id 会**静默留空**，故写成
   `ICON_CANDIDATES = ["heading","hash","link"]` 逐个试 + 检查是否真渲染出子元素；
   ② 全局设置面板按功能区分节（用户猜「也许用 `---`」）——用的是仓库既有惯例
   `setHeading() + .ah-section-head`（左侧强调色竖条），比 `<hr>` 多了「这组是干什么的」这句话：
   语言（不挂节头）→ 自动编号（全局开关 + 防抖延迟）→ 链接维护（Backlink 同步）→
   标题链接建议（建议开关 + VC 共存策略 + VC 词典联动）。防抖延迟从原来夹在建议开关后面
   挪回自动编号组。
4. **压测扩展**：`uvm/heading-index.ts` 每步对拍新增 Q22 解析——DUT 走「候选序列 + 索引二分」，
   参考走「候选序列 + 全量扫描」，两侧须选出同一候选；并断言 `sample.slice(start) === text`
   （替换区间自洽，即「不吃掉用户已打的前半截」这条地基）。
5. **收拾残局**：`doc/log-archive.md` 有一整块 1.0.25 周期块是上一轮 `npm run docs` 归档出来
   但**没被提交**的（工作区脏了一整轮），本次一并入库；其余 25 个「已修改」文件全是 CRLF
   行尾噪音、无内容差异（见 `windows-env-quirks` 记忆）。

### 没做什么

- **没有实现交接报告 §5.1 的 `queryBySuffix` / `hasAnySuffixMatch` 索引 API**——见上，那是错
  的落点；索引层保持 1.0.28 的形状不动。
- **没有回答「词典机制是否过于 heavy」**（用户本轮提出）：结论与取舍已在会话里给出，但它牵动
  的是 M13 联动的产品形态（要不要保留词典这条路），需用户拍板后才动代码，本轮未改。
- 真机手验项不变：Q4/Q5/Q9/Q10–Q15/Q21 仍 🔲/⚠️；Q23 新增的真机项（两插件同装切换共存策略）
  同样待手验。
- 词典分片仍不做。

### 下一步

- 用户真机复测：Q22（「一个交叉矩阵」出候选且接受后「一个」保留）、Q23（VC 同装时弹框归属、
  切「本插件优先」能切回旧行为）、icon 是否真的渲染成 H、面板分区观感。
- 待用户拍板：VC 词典机制的去留（heavy 与否），决定后可能重塑 M13 联动形态。
- 既有待办不变：P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM 交互。

### 验证方式

`npm test` 611 通过（唯一失败仍是 `whitelist.test.ts:406` Windows ICU 排序已知假红，与本次改动
无关）；`npm run test:fuzz`（5000×80）三块记分板全绿，含新增的 Q22 解析对拍；`npx tsc --noEmit`
干净；lint / format:check / release 重建走 preflight 统一验证。
本周期派发 0 次（本次会话的 harness 限制 Agent 调用，长输出改用管道过滤压缩，未走 SubAgent）。

---

## 2026-08-11 M13 第三轮：UVM 压测拓展（抓出 3 个索引 bug）+ 启动词典同步 + 建议框 icon（1.0.28）

### 做了什么

用户提醒：新功能须按项目规定拓展 `tests/dev_tests/uvm` 压测引擎并跑压力测试（此前 1.0.26/1.0.27
未做）。本轮补上，并顺带处理用户实测反馈的另外两点：

1. **UVM 压测拓展（`tests/dev_tests/uvm/heading-index.ts`）**：M13 标题索引的「约束随机序列 +
   参考模型记分板」压测——DUT 是 `HeadingIndex`（排序数组 + 二分 + 增量维护），参考模型是
   「裸 `Map<path, 条目>` + 全量 filter + 稳定排序」的朴素实现；操作池 = setFile（新建/更新）/
   removeFile / renameFile（含不存在、覆盖已有路径、自身改名）/ loadInitial；每步后对拍
   `queryPrefix`（13 组查询）/ `hasAnyPrefixMatch` / `size` / `allEntries`。入口挂在
   `random_sequence.test.ts`（随 `npm test` 跑 500×60，`test:fuzz` 跑 5000×80，全绿）。
   **立刻抓出并修复 3 个真实 bug（testplan §3.3 登记 U5–U7）**：
   - U5：`setFile` 用 lowerBound（相等区间开头）前插，反复更新同一文件时同 (matchKey, path)
     条目顺序反转、与参考模型稳定排序不一致 → 改 `upperBoundEntry`（相等区间末尾）插入。
   - U6：`renameFile` 到已存在路径（覆盖改名）残留被覆盖文件的旧条目、`totalCount` 漂移
     （seed=4 复现，DUT=39 vs 参考=46）→ filter 同时移除 oldPath 与 newPath + 计数修正。
   - U7：`renameFile(p, p)` 自身改名时 `replaced` 与 `entries` 是同一数组、totalCount 多扣
     → 自身改名按无操作提前返回。
   压测另增强：rename 操作 30% 概率显式覆盖已有路径（稳定覆盖 U6 分支）。
2. **启动词典同步（升级/重启场景，Q21）**：VC 只在「启动」与「Reload custom dictionaries」命令
   两个时机加载词典（已对照 VC 源码核实）——已自动联动的用户升级插件后，VC 内存里仍是旧/失败
   的词典，这就是 1.0.27 修复格式后用户实测「VC 框仍无条目」的根因。修法：`onLayoutReady` 里若
   `vcIntegrationMode !== "off"`，主动重写词典 + 调 reload，命令未就绪时按 2s 间隔重试 5 次、
   耗尽静默（`syncVcDictionaryAfterStartup`）。
3. **建议框 icon（用户实测「候选前没有 icon，和原生 VC 不一致」）**：`HeadingLinkSuggest.
   renderSuggestion` 改为「icon 列（`setIcon("link")`）+ 标题/来源两行」布局，styles.css 配
   flex 样式。注：VC 框里 custom-dictionary 条目**自带 icon**（VC styles.css 的内联 SVG），
   用户看到的无 icon 候选是本插件自己的建议框。
4. 用户新场景「一笔事务」（已有文本「一笔」→ 写成「一笔事务」，本文件标题【事务】应出候选；
   VC 的 current-vault 能识别）——**登记 testplan Q22（未实现）**：现触发词提取把「一笔事务」
   整段当查询词，前缀匹配「事务」失败；「哈哈，事务」因逗号分隔 token 即「事务」故正常。
   已给出实现方案（整段前缀或长度 ≥2 后缀的前缀匹配：`HeadingIndex.queryBySuffix` +
   onTrigger/getSuggestions 接线 + 压测对拍扩展），留给 CLAUDE 落地。

### 没做什么

- **Q22「一笔事务」后缀匹配未实现**（用户要求登记，方案已写进 testplan Q22 与交接报告）。
- 真机手验项不变（Tab / .suggestions.useSelectedItem / compositionend / 移动端点按 / 真实 VC
  加载），testplan Q4/Q5/Q9/Q10–Q15 保持 🔲/⚠️。
- 词典分片（research 留档的后续候选）仍不做。

### 下一步

- CLAUDE 接手：按 testplan Q22 实现「一笔事务」后缀匹配（含压测对拍扩展）；真机复测
  Q4/Q5/Q9/Q10–Q15 与 Q21（升级场景 VC 自动拿到新词典）。

### 验证方式

`npm test` 599 通过（唯一失败为 `whitelist.test.ts:406` Windows ICU 排序已知假红）；`npm run
test:fuzz`（5000×80）三块记分板全绿；lint / build / format:check 走 preflight 统一验证。
本周期派发 0 次（全部主模型直接实现）。

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
