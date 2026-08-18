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

## 2026-08-11 M13 实测反馈修复：alias 完整标题名 + VC 词典格式/阈值/轻量化（1.0.27）

### 做了什么

用户人工测试 1.0.26 后给出 5 条反馈，逐条处理：

1. **基础建议框正常**——确认，无改动。
2. **自动联动确认框太长** → 精简：长段 ①②③ 文案改为「一句总述 + `ul` 三点要点列表」
   （i18n 新增 `vcAutoConfirmPoints: string[]`，Modal 按列表渲染），手动模式文案同步精简。
3. **词典体积 / iCloud 同步担忧** → 研究 + 轻量三件套落地（详见下）。
4. **alias 是残缺前缀**（打「交叉矩」补出 `[[…|交叉矩]]`，用户要完整标题名）→ **产品决策变更**：
   `buildHeadingLink` 去掉 `typedText` 参数，alias 恒为剥编号前缀后的完整标题名
   `displayText`（与 VC 词典 value 的 alias 形态一致）；i18n desc / README 双语 / testplan Q4
   预期同步更新。
5. **VC 框只打一个「交」无候选** → **根因是词典 JSON 格式不兼容**（见下），叠加 VC 默认触发
   阈值问题，一并修复。

**VC 源码核实（clone 留档 `doc/research/vc-source-verification.md`，不入库）**：
`tadashi-aikawa/obsidian-various-complements-plugin` main 分支，逐条核实原方案 §12 的
[C：未核实] 项：

- **词典 JSON 格式（原调研结论有误，本次更正）**：VC 当前版本的 `JsonDictionary` 顶层必须是
  `words` 数组（`{ words: [{ value, displayed }] }`，`CustomDictionaryWordProvider.ts:16-48`）。
  我们 1.0.26 写的**裸数组**会让 `json.words.map` 抛 TypeError → VC 弹「Fail to load」且词典
  **0 词**——这就是用户实测 #5「打『交』无任何候选」的根因。1.0.27 修复为 `{"words":[...]}`。
- **触发阈值**：VC 默认 `tokenizeStrategy`（default）的 `triggerThreshold = 3`
  （`TokenizeStrategy.ts:19`），且 `customDictionaryMinNumberOfCharactersForTrigger` 默认 0
  （跟随全局阈值）——即使格式修好，1–2 字符也不触发。自动配置现在把该字段置 1
  （`Math.min(全局阈值, 1) = 1`，只放宽自定义词典类补全），兑现「只打一个字也出标题建议」。
- 其余确认：插件 id `various-complements`、`customDictionaryPaths: string`（换行分隔）、
  `enableCustomDictionaryComplement: boolean`、活体 `.settings` + `saveData`（`VariousComponents
  extends Plugin`）、reload 命令 id `reload-custom-dictionaries`——全部与 1.0.26 实现一致。

**词典轻量三件套**（回应用户 #3：VC 自己的 current-vault 补全不落盘，我们却生成一个词典文件，
是否太重）：

1. 紧凑 JSON（去掉 `\t` 缩进，体积 -30~40%）。
2. **内容未变不写盘**：`main.ts` 缓存上次写出的 JSON，相同则跳过 `adapter.write`
   （标题无变化时 iCloud/同步零流量）；关闭联动/开关时清缓存，下次开启必落盘。
3. **词典独立条数上限 `MAX_VC_DICTIONARY_ENTRIES = 20,000`**：超出截断 + 一次性 Notice
   （`noticeVcDictionaryTruncated`，新 i18n 键）。20,000 条 ≈ 2.2MB 封顶，几千条时几百 KB。

`vcintegration.ts`：`VcSettingsShape` 增 `customDictionaryMinNumberOfCharactersForTrigger`
（存在才校验类型）；`buildVcDictionaryJson` 返回 `{ json, truncated, total }`；两条写入路径
统一 `applyTriggerThreshold`（现值 ≠1 才写）。测试：`vcintegration.test.ts` 改格式断言 +
新增 20,001 条截断用例 + 阈值断言（含「已是 1 不动」）；`main.test.ts` 新增「VC 词典写盘」
describe 4 例（节流写盘 / 内容未变不重写 / 内容变化重写 / 截断 Notice，makePlugin 假 vault
补 `adapter`）。testplan 新增 **Q20** 行覆盖上述四件事，Q4/Q11/Q12 预期同步更新。spec.md M13
条目更新（决策变更 + 核实结论 + 轻量三件套）。

### 没做什么

- **词典分片**（按 matchKey 首字符拆多个小文件，VC 的 `customDictionaryPaths` 天然支持多路径）：
  单次写盘更小、iCloud 增量更友好，但总大小不变、重写逻辑复杂化（需 per-file 变更定位分片），
  列入 research 留档的后续候选，v1 不做。
- VC 加载失败 Notice 的乱码（「鈿?」）是 VC 自身显示问题，不在我们侧修。
- 真机手验项不变：Tab 行为 / `.suggestions.useSelectedItem` / compositionend 重触发 /
  移动端点按 / 真实 VC 加载行为仍需用户实机确认（testplan Q4/Q5/Q9/Q10–Q15 保持 🔲/⚠️）。

### 下一步

- 用户实机复测重点：① VC 框打「交」应出候选（格式 + 阈值双修复的验证点，Q12/Q20）；
  ② 插件框打「交叉矩」接受后应补出完整标题名 `[[交叉矩阵#1 交叉矩阵|交叉矩阵]]`（Q4）；
  ③ 自动联动确认框是否整洁（#2）；④ 大库下词典文件体积与 iCloud 同步感受（Q20）。

### 验证方式

`npm test` 596 通过（唯一失败为 `whitelist.test.ts:406` Windows ICU 排序已知假红，与本次
无关）；lint / build / format:check 走 preflight 统一验证。本周期派发 0 次（VC 源码核实为
主模型直接 clone + grep，无 SubAgent）。

---

## 2026-08-11 M13 落地：标题链接建议 + Various Complements 联动（1.0.26）

### 做了什么

按 `doc/research/gitignore-axi-md-3-1-1-tab-axi-declarative-whistle.md` 完整执行（该目录已被
`.gitignore` 排除不入库）。方案 §0 的 `.gitignore` 改动（排除 `doc/research/`）已由上一会话
先行提交（`4af7ec3`），本周期核对时已在库，无需重复。本轮实现完整 M13。

**功能一：标题链接建议（默认开）**——在任意笔记正文里打出与 vault 内标题「剥编号前缀后的
原文」匹配的文字时弹出建议，Tab/点按接受后替换为指向该标题的链接（视觉保留用户打的原文）。

- 新增 `src/headingindex.ts`：`HeadingIndexEntry` + `buildEntriesForFile`（复用 `parseHeadings` /
  `stripPrefix` / `displayAnchor` / `normalizeForWhitelist`，与编号引擎完全解耦——白名单豁免、
  「不编号」文件夹的标题照常可链）+ `HeadingIndex`（按 matchKey 排序数组 + 二分查找；
  `loadInitial` 一次排序避免 O((N·H)²)；上限 50,000 条 / 单文件 500 条，截断置位 + 一次性
  Notice，不静默丢弃；构造参数可调上限供测试模拟截断）。
- 新增 `src/headingtrigger.ts`：`extractTriggerToken`（`\p{L}\p{N}` 向左回溯，最短 2 码点 /
  上限 80）、`isBlockedContext`（标题行 / `#` 标签 / 未闭合 `[[` / 紧邻 `[` 四类礼貌规则）、
  `sortEntries`（精确优先 → matchKey 长度升序 → path 兜底）、`buildHeadingLink`（同文件省略
  文件名，alias 恒为用户打的原文）。
- 新增 `src/headingsuggest.ts`：`HeadingLinkSuggest extends EditorSuggest`，四个生命周期方法
  薄委托纯函数（方案 §8.2 选项 A：类本身不伪造测试，留真机手验）；IME 组合期间 `onTrigger`
  首行短路（复用既有 `imeComposing`）；Tab 接受走 `Scope.register`（[] 修饰键，不误吃
  Shift+Tab），内部 `.suggestions.useSelectedItem` 包 try/catch 静默降级——Obsidian 内部 API，
  已登记为未来升级最优先复查点。
- `main.ts` 接线：`headingIndex` 字段 + 按文件去抖 `headingIndexTimers`；`onload` 注册
  EditorSuggest + `onLayoutReady` 内**先挂** `vault.on(create/modify/delete/rename)` **再起**
  初始扫描（`buildInitialHeadingIndex`，按 200 文件/批让出主线程，复用 `debounceDelay` 不新增
  设置项）；`setHeadingLinkSuggestEnabled` 运行期补建/清空（关闭即零成本）；`onunload` 清理。
  **架构承诺修订**：spec.md §4「触发的性能边界」追加 M13 例外（全生命周期一次懒加载全库只读
  扫描，此后仅按文件增量维护）——这是方案 §2.1 明确要求正面处理的冲突，不能假装没发生。

**功能二：Various Complements 联动（默认关，需显式确认）**——把标题索引导出为 JSON 词典喂给
VC 的自定义词典补全（VC 自身标题级补全 issue #72 开了 4 年多没做，本联动是真实的获客角度，
前提是足够稳、不破坏用户已有 VC 配置）。

- 新增 `src/vcintegration.ts`：探测三态（not-installed / disabled / enabled，`app.plugins`
  结构化收窄不用 any）+ 分层防御写入——Layer 1 活体实例（`.settings` + `saveData`，不碰文件、
  无竞态）→ Layer 2 文件级读改写（JSON.parse 全量、只改 `customDictionaryPaths` /
  `enableCustomDictionaryComplement` 两字段、JSON.stringify 全量写回，**绝不重建对象**）→
  Layer 3 schema 校验失败整体放弃（`isValidVcSettingsShape` 存在才校验类型，并拒绝数组）；
  `mergeDictionaryPath`（换行分隔字符串合并，最易错一步单独成纯函数）；`buildVcDictionaryJson`
  （displayed 用**不含 WJ** 的干净原文——顺带消解 spec 附录 A.2 记录的「VC 精确匹配被 WJ
  打穿」风险，已回填该节）；reload 命令调用与失败兜底（与「写入失败」提示分离）。
- 设置：`headingLinkSuggestEnabled`（默认 true）+ `vcIntegrationMode`（off/manual/auto，默认
  off）+ 三态下拉（沿用 `languageName` 的 addDropdown 先例）；**任何离开 off 的切换必须过确认
  框**（新建 `src/settings/tabs/VcIntegrationSection.ts`，两个 Modal 照抄 DangerTab 结构）；
  词典路径展示 + 一键复制（Clipboard API + execCommand 兜底）。
- i18n 中英 23 个新键（含最高风险的自动配置确认文案，逐句列明会读写 VC 配置）；styles.css
  建议框样式；README 双语各加一条卖点 + 快速上手补一行。

**测试**：新增 `tests/dev_tests/headingindex.test.ts`（16 例）/ `headingtrigger.test.ts`
（16 例）/ `vcintegration.test.ts`（24 例）；`main.test.ts` 追加 M13 两个 describe（8 例：
去抖窗口/重置/切走作废/剥前缀收录/关闭不构建/运行期补建/截断 Notice）；
`obsidian-mock.ts` 补 `EditorSuggest`/`PopoverSuggest`/`Scope` 最小替身 + Plugin 的
`registerEditorSuggest`（headingsuggest 模块加载必需）。`doc/testplan.md` 新增 Q 分类 19 行
（Q1–Q19），dev 可覆盖的逻辑行已回填 ✅/⚠️，真机项（Q4/Q5/Q9/Q10–Q15）保持 🔲 待用户手验。
spec.md 落 M13 Roadmap 条目 + 执行顺序表第 6 位 + A.2 消解回填。

### 没做什么

- 方案 §10 Out of scope 全部未做：块级 `#^blockid`、模糊/拼音匹配、跨 vault、标题内标点触发、
  围栏跨行检测、VC 联动关闭时的反向清理、其他补全插件联动、批量转换存量正文、索引持久化缓存。
- `HeadingLinkSuggest` 类本身（Tab 键、DOM 渲染、移动端点按）未做自动化测试——方案 §8.2
  选项 A 明确推荐：`EditorSuggest` 真实交互是 DOM/CM6 行为，伪造容易造出「测试通过但真实行为
  对不上」的假安全感。
- VC 侧 [C：未核实] 项（插件 id / `app.plugins` 形状 / data.json 字段名与类型 / 活体 `.settings`
  字段 / reload 命令 id / Tab 默认行为 / compositionend 后是否立即重触发）全部按调研值实现，
  在 testplan Q 行与代码注释标注，需真实环境逐条核对（方案 §12）。

### 下一步

- 真机手验（对照 testplan Q1–Q19 与方案 §11 清单）：建议框 DOM/Tab 接受、**已编号标题锚点
  含 WORD_JOINER 时链接可点**（本功能最核心的正确性要求）、移动端点按、中文输入法组合、
  真实 VC 手动/自动两条路径 + 至少一次刻意构造的失败场景（临时改坏 VC data.json 验证
  Layer 3 兜底不写坏文件）。
- 若实测发现 [C：未核实] 项与实现不符：修正 `vcintegration.ts`/`headingsuggest.ts` 对应实现，
  不得为「让代码能跑」绕过 schema 校验或静默吞错（方案 §12 处理原则）。

### 验证方式

`npm run lint` 全绿 / `npm run build`（tsc -noEmit + esbuild）通过 / `npm test` 590 通过，
唯一失败为 `whitelist.test.ts:406` Windows ICU 排序已知假红（与本次改动无关）/ `npm run
format:check` 与 `npm run release` 在 preflight 内统一验证。未做真机手验（本环境无 Obsidian
实体），按仓库惯例保持 testplan 对应行 🔲 并写明「待用户真机手验」。本周期派发 0 次（无
SubAgent，全部主模型直接实现）。

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
