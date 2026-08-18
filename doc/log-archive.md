# obsidian-auto-headings 开发日志归档（log-archive）

> 本文件是 `log.md` 滚动出去的**历史周期块**（倒序，新的在上）。平时不必读；
> 需要某次改动的来龙去脉时再来翻。当前活跃日志见 [`log.md`](./log.md)。

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

## 2026-08-10 bug 修复：快捷键转空标题——编号写入光标错位 + 行尾多一个空格（1.0.25）

### 做了什么

用户实机反馈（桌面端）：先用快捷键把当前行变成标题，插件插入自动编号的同时，光标位置不对、
行尾还多出一个空格——描述是"## <光标><编号区域><空格><空格>"，光标应落在编号之后、多出的
那个空格不该存在。没有直接照字面猜（"光标"两字容易读成正文内容），先用 `AskUserQuestion` 结
构化确认了具体现象是哪一种解读，再动手查根因。

**根因是同一处触发条件下的两个独立 bug**，都出在"用快捷键/编辑把一个空行（或标题正文已清空
的标题行）转成标题、光标停在行尾"这个场景（旧内容整体是新内容的前缀，纯追加）：

1. **行尾多一个空格**：`preserveCursorLineTrailingSpace`（1.0.23 引入，见 J19 那次周期）用
   `newLines[line].endsWith(trailing)` 判断"新内容是否已经带着旧行尾空白"，但 `buildPrefix`
   在标题文本为空时以不可见的 WORD_JOINER 哨兵收尾（{@link render.ts}）——`endsWith` 被这个哨
   兵挡住，误判成"没有"，于是把旧的 `## ` 里那个空格又补了一份，叠成两个。改法：比对前先剥掉
   新行尾部的 WORD_JOINER 哨兵，只看真正可见的字符。
2. **光标卡在编号前面**：`writeLineDiff`/`lineChange` 为了不打断正在敲字的用户，只写回真正变
   化的那一段（J19 的最小范围改写）。对"旧内容是新内容前缀"这种纯追加场景，算出的插入点与
   光标恰好落在同一坐标——CM6 对"插入点=光标位置"的默认关联是**光标留在插入文本之前**，编号
   写完光标反倒卡在数字前面，用户接着打的字会插到编号中间。这一点这次才第一次显式处理：新增
   `cursorSelectionForEmptyHeading`，判定"标题渲染后仍为空"（`text.endsWith(WORD_JOINER)`，
   与模板前缀/后缀/分隔符风格无关的通用判据），命中时随写回事务显式把光标钉在行尾——已有标题
   正文的行不受影响，仍交给编辑器按插入点自然映射（该场景本就正确，见 `lineChange` 头部注释）。
   `editor.transaction` 本身就支持在 `changes` 之外带一个 `selection` 字段一并生效，不需要额外
   一次调用。

`main.ts`：`preserveCursorLineTrailingSpace` 改比对逻辑；新增 `cursorSelectionForEmptyHeading`；
`writeLineDiff` 加一个可选 `selection` 参数透传给 `editor.transaction`；`applyRenumber` 接线。
测试：`tests/dev_tests/main.test.ts` 补 `FakeEditor.lastSelection`（记录事务显式带的选区，并同步
更新 `cursor` 模拟真实编辑器落点）+ 新增 describe 块 3 例（J21：单空格不叠加 / 光标钉在行尾 / 已
有标题正文的行不受影响不覆盖光标）。

验证方式：`npm test`（526 通过，唯一失败是 `whitelist.test.ts:406` 的 Windows ICU 排序已知假
红，与本次改动无关）/ `npm run lint` / `npm run format:check`（首次跑因新代码未格式化失败，
`npx prettier --write src/main.ts` 后复跑全绿）/ `npm run test:fuzz`（核心写回路径改动，模糊测
试全绿，无新假红）。未做移动端/真机手验——这是纯逻辑修复，`FakeEditor` 已能模拟"显式 selection
生效"这条真实 Obsidian/CM6 行为，判定为已被单测覆盖。

### 没做什么

- 没有改动"已有标题正文、用户在中间位置编辑"这条路径的光标行为——那条本就交给编辑器按插入点
  自然映射，且验证过现有设计对它是正确的（新增判据仅在标题渲染为空时才生效，加了专门的回归测
  试防止误伤）。
- 没有处理"光标不在被保护行、但同样在插入点上"的场景——`protectLine` 只在自动路径（防抖触发）
  传入，手动命令（立即重新编号等）不受这层保护约束，也不在本次修复范围内（历来如此，见 J11 对
  手动命令的说明）。

### 下一步

- ✅ **2026-08-10 用户真机确认解决**："实测已解决"，随即要求收尾推送并打 tag 发布——testplan
  J21 已回填确认。
- 其余待办不变：J20 已用户确认解决；P12 / E36 / O11① / O5f / H12 / H9 / Dataview / J18 的 DOM
  手验仍待办，见 status.jsonl 首行与更早周期块。

---

## 2026-08-10 UX 小改：清理外来编号确认框移动端视觉对齐 PC（1.0.24）

### 做了什么

用户实机截图反馈（两张对照图）：J17（1.0.23）加的逐条勾选 + git 风格 diff 确认框，窄屏
（含移动端，`@media max-width:480px`）下把勾选框与 diff 从横排切成纵排——勾选框独占一行，
diff 卡片另起一行、且因原横排逻辑被挤窄。用户要求移动端对齐 PC 端的视觉效果。

**先问清楚再动手**：截图能看出两处差异——① 布局（横排 vs 纵排）；② 卡片背景观感（移动端截图
隐约能看到卡片背后透出笔记原文，疑似半透明）。这次没有直接猜，用 `AskUserQuestion` 让用户
明确排除了②（"不改卡片透不透"），锁定只改布局，并给出比"简单加宽横排"更具体的方案：
**checkbox 不再挤占 diff 的横向空间**——diff 始终占满卡片内容区宽度，checkbox 改为悬浮定位，
纵向对齐 diff 首行（红/before 行）的顶部；红行换行成两排时，checkbox 仍对齐最上方一排。

实现（`styles.css`）：
- `.ah-foreign-guard-item` 从 flex 横/纵排切换改为 `position: relative` + 固定 `padding-left`
  留白（默认 40px，窄屏媒体查询加宽到 44px 配合更大的可点触勾选框）。
- `.ah-foreign-guard-toggle` 改 `position: absolute`，`top`/`left` 与卡片的
  `padding-top`/`padding-left` 对齐——天然贴 diff 首行顶部，不需要额外算高度。
- `.ah-foreign-guard-diff` 从 `flex: 1 1 auto`（与 checkbox 分享行内空间）改为 `width: 100%`。
- 窄屏媒体查询精简：只保留放大 checkbox 触控尺寸（22px）+ 相应加宽 `padding-left`，去掉原来
  的 `flex-direction: column` 整套横纵排切换——**桌面与移动端现在是同一套布局代码**，不再有
  断点级的视觉分裂，"对齐"这件事从"调参数凑相似"变成"物理上不可能不一致"。

验证方式：本机起 `python -m http.server` 把改动后的 `styles.css` 配一份最小 HTML 骨架跑进
Claude Browser 预览，375px（模拟移动端）与 800px（模拟桌面）两个视口截图核对，长标题换行两排
时 checkbox 仍贴最上一排——符合预期后清理临时文件，未入库。质量门槛：`npm test`（唯一失败是
`whitelist.test.ts:406` 的 Windows ICU 排序已知假红，与本次改动无关）/ `lint` / `format:check`
全绿。纯 CSS 改动，无需改测试代码。

### 没做什么

- 没碰卡片背景透明度/`--background-secondary` 相关的任何东西——用户已明确排除，若移动端真有
  背景色不透底的观感问题，需要用户另外反馈、单独查根因，不要顺手"顺便"改了。
- 没有做移动端真机手验（本次是纯 CSS 视觉改动，本机浏览器多宽度截图已核对布局符合用户给出的
  具体规格，但最终观感仍需用户真机确认，见 testplan J20 状态）。

### 下一步

- 等用户真机确认 J20（对话框在移动端的实际观感）。
- 其余待办不变，见 status.jsonl 首行与本文件更早周期块（P12 / E36 / O11① 等 DOM 手验、竞品
  调研采纳清单）。

---

## 2026-08-09 真机回归：新敲的标题不编号——彻底换掉「整行冻结」（并入 1.0.23，不单独发版）

> **接手者注意**：本块记录的是**上一块修得不对**、用户真机又打回来的一次。教训在最后一节，
> 比改动本身值钱。
>
> **版本号说明**：本轮一度 bump 到 1.0.24，用户要求**并入 1.0.23**、不单独发新版，故版本号已退回
> 1.0.23，`release-notes/1.0.24.md` 的内容并进 `1.0.23.md`、原文件删除。**但 1.0.23 的 tag 与
> GitHub Release 是在本轮修复之前就已推送发布的**——线上那份 1.0.23 产物**不含本轮修复**，仓库里的
> 1.0.23 与线上的 1.0.23 就此分叉。要让线上也拿到修复，须移动 1.0.23 tag 重新触发发布工作流
> （见「没做什么」）。

### 症状与根因

用户实测：敲 `##` 写完标题文本，光标**直接移到另一行**，编号不出现；必须再编辑一次（多数人是
碰巧按了 Enter）才补上。用户原话「怎么老毛病又回来了」——他把它读成 1.0.15 那个老问题复发。

根因是**上一块给的修法覆盖不全**。那一版的判据是「光标行的标题层级相对
`headingSnapshots` 是否变化」，而该判据前有一道保守闸：

```ts
if (headings.length !== snapshot.length) return false;  // 逐位对照前提被打破 → 当作"没变" → 冻结
```

**新敲出一个标题恰好会让标题数量变化**，于是走保守分支、整行冻结——层级判据只挡住了「改层级」
那一种症状，挡不住「新增标题」这一种。

更要命的是**解除冻结的条件从来就不成立**：冻结后本该「光标移开后的下一次触发补上」，但自动路径
只挂 `editor-change`，**移动光标不触发任何事件**。所以真实解除条件是「再编辑一次」，不是「移开」。
这一条 1.0.15 就写在注释和 spec 里，一直没人（包括我）意识到它根本不成立——**日志 / 注释里写着的
「会在 X 之后补上」，如果 X 不是一个真实事件源，那就是一句从未被验证过的话。**

### 改法：不再冻结任何东西

整行冻结从一开始就是**用整行级手段去解决一个只关乎行尾空白的问题**（J11 要防的就只有
`stripPrefix` 的 `\s+$` 把刚敲的空格吃掉）。本轮把手段本身换掉：

- `preserveLine` + `levelChangedSinceSnapshot` → **删**，换成 `preserveCursorLineTrailingSpace`：
  只把用户刚敲的行尾空白补回本轮结果，**编号照常写入**。不再需要快照、不再需要任何历史推断。
- 幂等性天然成立：补回后与上一轮落盘内容逐字节相同 ⇒ 下一轮无改动可写，不发空事务。
- 补回的空白不产生幻影改名——`parseHeadings` 的 `text` 本就去尾空白，快照与改名判定看的都是它。

**配套改 `writeLineDiff` 为最小范围改写**（新增 `lineChange()`）：不冻结意味着光标行会在用户正
敲字时被改写，而原先的**整行替换**变更范围覆盖光标位置，CM6 只能把光标甩到一端——那是换一种形式
的「抢键盘」。掐掉两端公共前后缀后，编号前缀落在行首是**纯插入**（`from.ch === to.ch`），与行尾的
光标天然不重叠。切点两端各回退一格避开 UTF-16 代理对（emoji 标题常见）。顺带缩小了 J6 的暴露面。

### 验证

`main.test.ts` J19 三例（新标题当轮编号 / 新标题带空格 / 写回范围断言，FakeEditor 加 `lastChanges`）
+ J11 五例重写（语义变了：**J11 现在期望"编号照写 + 空格保住"，不再是"整行原样"**）。全量 524 条
523 绿（唯一红是 `whitelist.test.ts:406` 的 ICU 本机假红）；fuzz 5000×80 记分板全程一致；
`tsc`/`lint`/`format:check` 全绿。**用户真机复验通过**（原话「完美」）。

### 教训（比改动本身重要）★

1. **上一轮把用户的反馈修窄了。** 用户上一次说的是「改层级后等不到编号」，就只针对
   「层级变化」造了个判据，而没有回头问「**冻结这个手段本身是不是从一开始就用错了**」。结果是
   同一个根因换个入口（新增标题）立刻复发。**症状驱动的补丁会把根因留在原地**——收到第二次同类
   反馈时，优先怀疑的应该是手段选错，而不是判据不够细。
2. **别信注释里那句「会在 X 之后补上」**，除非能指出 X 对应哪个真实事件源。这次的 X（光标移开）
   压根没有监听器，这句话在仓库里躺了 9 个版本没被质疑过。
3. **语义变更要显式改测试的期望值，不能只加新用例。** J11 原本断言「整行原样保留」，新语义下
   它应该断言「编号照写 + 空格保住」——如果只加 J19 不改 J11，两者会互相矛盾，而先跑通的那个会
   掩盖问题。

### 没做什么

- **没有引入光标 / 选区监听**（CM6 `updateListener` 一类）。本轮是绕开这条路解决的；spec
  Roadmap 里 hobeedzc 那条「脏标题行集合 + 离开该行才重排」仍未做，且已补注说明它依赖的正是这次
  绕开的事件源，真要做得重新估成本。
- **没动上一块的清理确认框相关代码**（勾选 / diff / 搜索），本次改动与它无交集。
- **没有引入 `gh` CLI 到本机**：移动 tag 重发全部靠 CI 完成（本机无 `gh`，见 memory 记录）。

### 覆盖线上 1.0.23：移动 tag 重发（用户明确要求）★

1.0.23 的 tag 与 GitHub Release 是在本轮修复**之前**推的，线上产物不含修复。用户判断「上线没多久、
装的人应该很少」，要求**直接覆盖线上版本**而非新发 1.0.24，故：

1. **先改发布工作流使其可重复触发**：`.github/workflows/release.yml` 原本直接 `gh release create`，
   而该命令在**同名 Release 已存在时会报错退出**——「移动 tag 强推重发」这条路原本走不通，首次
   需要它时才发现。现在改为先 `gh release delete "$tag" --yes || true` 再建（不加 `--cleanup-tag`，
   tag 本身不动；Release 不存在时命令返回非零，`|| true` 咽掉，首次发布照常）。
2. **工作流的改动必须先落进被 tag 的那个提交**——工作流是从 tag 指向的提交 checkout 出来跑的，
   顺序反了等于用旧工作流重发，照样失败。
3. 然后 `git tag -f -a 1.0.23` + `git push -f origin 1.0.23` 触发重建。

**代价（已与用户确认接受）**：已装 1.0.23 的用户因版本号未变**不会收到更新提示**，只有新安装 /
手动重装的人拿到修复版。

### 下一步

1. 沿用的手验清单：P12 / E36 / O11① / O5f / H12 / H9 / Dataview；J18 的 DOM 交互。
2. 发版前照例 `git ls-remote --tags origin` 现场核对。**另注意**：现在 tag 可能被移动过，
   「tag 存在」不再等于「线上产物就是当初那次构建」——要确认线上内容得看 Release 的构建时间 / 资产。

### 本周期派发

派发 3 次（全部 `quality-gate`：单测验证 ×1、fuzz ×1、收尾门槛 ×1）。诊断与改法设计主模型自持——
根因在「手段选错」这一层，需要同时持有 J11 的历史动机、1.0.23 的判据实现和 CM6 写回语义三者。

---

## 2026-08-09 用户体验反馈三连：光标保护精确化 + 清理外来编号逐条勾选（1.0.23）

用户实测反馈三点，逐一处理：

### 做了什么

**① 光标所在行保护精确化（testplan J16）**。用户反馈：改标题层级后若光标不移开，编号迟迟不更新，
"卡顿"。查代码发现根因不是防抖延迟本身，而是 `preserveLine`（1.0.15 为修 J11"行尾空格被吞"引入）
把光标所在行的**任何**差异都当打字噪音整行冻结，连结构性的层级变化也一并冻死；而"移开后补上"依赖
下一次 `editor-change`，单纯移动光标不触发任何事件，实测常等很久。找用户确认三种改法（精确保护 /
完全恢复原方案 / 保留整行冻结+新增光标离开监听）后，选了精确保护：借 `headingSnapshots`（backlink
改名判定本就在用的上一次写入基线）判断光标行标题**层级**相对基线是否变化——没变（行尾空白等打字
噪音）才冻结，变了（敲 `#` 的结构性改动）立即照常写入，不必等移开。用层级不用文本，是因为层级从
不受任何剥离/归一化影响，变了就一定是结构性改动。`main.ts` 新增 `levelChangedSinceSnapshot`；
`main.test.ts` 回归 2 例（层级变→立即生效 / 层级未变+行尾空格→仍受保护，后者是防止用 WJ 存在与否
当判据的更简单方案——那种方案会在"已编号标题追加空格"这个更常见的场景里重新引入 J11 的 bug）。

**② + ③ 清理外来编号确认框改为逐条勾选 + git 风格 diff 预览（testplan J17）**。用户反馈：J14 的
确认框只能看、不能选，要么全清要么全不清；且预览只显示"剥离后"的中间态，不是套模板后的真实效果；
视觉也偏紧凑。改动：

- `cleanup.ts`：`clearForeignNumberingContent` 加可选 `keepLines`（跳过指定行，默认行为不变）；
  `ForeignNumberingPreviewItem` 加 `lineIndex` 关联勾选状态。
- `main.ts` 新增两个方法：`computeForeignCleanupPreview`（选择性剥离 + 立即套模板，一份计算同时
  供预览与确认执行复用，避免"预览说改A、实际却改了B"）；`applyForeignCleanupSelection`（确认框
  专属执行路径，勾选的清理、取消勾选的保留原文但仍立即叠加模板前缀，单一事务写回，不影响原有
  `runClearForeignNumbering` 全量命令）。**关键点**：确认后全文必含至少一个 WJ，迁移守卫此后不会
  再对本文件命中——不存在"保留的那条下一轮又被拦一次"的问题。
- `ForeignNumberingCleanupModal.ts` 重写：每条候选前加勾选框（默认勾选=清理），勾选变化时整份
  重算重绘（成本换正确性——白名单 `subtree` 匹配依据标题文本判豁免，某条是否清理会联动影响子孙
  标题是否编号，没有更便宜的正确增量更新方式）；diff 改为 git 风格 −/+ 两行对照，"+"行展示套模板
  后的真实效果（含取消勾选时的"模板前缀+原文"双重编号预览）。
- `styles.css`：卡片式布局、留白宽松；红/绿配色用 Obsidian `--color-red-rgb`/`--color-green-rgb`
  浅色底；新增 `@media (max-width: 480px)` 断点，窄屏下勾选框与 diff 块纵向堆叠、勾选可点触区域
  加大到 22px。
- `i18n.ts`：确认框说明文案改讲勾选语义；新增逐条勾选框文案 + 确认执行后按清理/保留计数的动态
  Notice（中英对照）。

`main.test.ts` 重写 J14 原有 1 例为 2 例（全勾选一步到位套模板 / 取消勾选后双重编号+守卫不复发）；
`cleanup.test.ts` 补 `lineIndex` 断言 + `keepLines` 新例。

### 没做什么

- **spec.md 的置信度分级预览（Roadmap M9 一条）与光标保护覆盖面扩展（另一条 hobeedzc 建议）均未
  实现**——本周期两条都只是"往同一方向挪了一步"，不是那两条 Roadmap 项本身，已在对应条目补注说明
  两者关系，避免误读为已完成。
- ~~J17 的视觉与移动端堆叠留手验~~：**已由用户真机确认通过**（见下方补记）。
- **未处理本会话开始前就已存在的大量未提交改动**（`.claude/agents/*.md`、`CLAUDE.md`、`README*`、
  `src/numbering.ts` 等约 40 个文件、以及 `.gitignore` 的 3 行改动）——`npm run format` 全库跑了一遍
  把所有 CRLF 文件就地转 LF（本机环境坑，见下），这些文件因此在 `git status` 里显示为已改动，但
  `git diff` 内容为空；本次提交**只暂存本周期实际触碰的文件**，不碰这些无关改动，也不碰 `.codex/`
  与 `AGENTS.md`（按既有约定）。

### 本机环境坑：全库 format 后 ~40 个无关文件"显示已改"

`npm run format`（`prettier --write .`）按 `.prettierrc.json` 的 `endOfLine: "lf"` 把磁盘上是 CRLF
的文件就地转成 LF——这台机器 checkout 时看起来是整库 CRLF，于是几乎每个被 prettier 扫到的文件都在
`git status --short` 里冒出来。用 `git diff --stat` 核对后确认：只有本周期真正编辑过的 9 个文件有
实际内容变化，其余全部是纯换行符转换（git `autocrlf` 归一化后 diff 为空，`git add` 这些文件也不会
产生任何可见的提交内容）。与既有 memory 记录的坑同源，只是这次触发面更大——按同一姿势核对即可，
不必逐个排查。

### 补记：用户真机手验通过，顺带一处纯视觉微调（不 bump）

用户实机测试三条改动均确认通过，唯一反馈：确认框每条勾选框下方的"清理"文字标签多余，去掉即可。
处理：删掉 `ForeignNumberingCleanupModal.ts` 里对应的 `createSpan` 调用、`i18n.ts` 里不再使用的
`foreignGuardItemToggleLabel` 键（中英文都删，checkbox 的 aria-label 保留，不影响读屏）、
`styles.css` 里对应的 `.ah-foreign-guard-toggle-text` 规则与 `.ah-foreign-guard-toggle` 的多余布局
属性（原为给文案腾位置，现只剩 checkbox 一个子元素）。纯视觉、不涉及逻辑，用户明确说了不 bump，
仍是 1.0.23。

**追加一个小功能**（同一轮反馈里补的，同样不 bump、并入 1.0.23）：确认框顶部加搜索框（testplan
J18），按候选标题现状文本实时匹配，点击结果或搜索框内回车（取第一条匹配）把主列表滚动到对应条目
并短暂高亮（1.2s 渐隐），纯定位辅助、不改变任何勾选状态。`ForeignNumberingCleanupModal` 新增
`searchQuery` 状态与 `jumpTo`/`renderSearchResults`；`i18n.ts` 加两条文案；`styles.css` 加搜索框 /
结果列表 / 高亮动画样式。DOM 交互（滚动、高亮、点击结果）与 J17 视觉部分同样的限制——假编辑器环境
`Modal.open()` 是空实现，单测测不到，留手验。

质量门槛两轮都跑过（除已知 ICU 假红外全绿），`release/` 已重建。

### 下一步

1. 沿用上一周期遗留的手验清单：P12 / E36 / O11① / O5f / H12 / H9 / Dataview。
2. 未解决问题总账与竞品调研采纳清单见更早周期块与 spec Roadmap M9，未受本次影响。
3. 1.0.23 即将打 tag 发布——用户已明确指示推送并发布，发版前照例先 `git ls-remote --tags origin`
   现场核对远端已发布版本，不信日志旧结论。

### 本周期派发

派发 0 次（主模型全程自持）——本次是**用户直接反馈的体验问题**，涉及触发链改动方向的判断（三选一
问过用户）与"预览/执行必须逐条一致"这类跨文件设计约束，拆给子 agent 反而要重述完整上下文，不划算；
质量门槛验证按惯例派 `quality-gate`（本周期共 4 次：main.test.ts 单测 ×2、全量 test/lint/fuzz ×1、
format ×1）。

---

## 2026-08-09 社区 PR #7 审核并入：继承级数 inheritDepth（1.0.22）

> **接手者从这里开始读。** 本块是**第一次合入外部贡献**的完整记录——含「PR 基于旧版本该怎么核」的
> 复用姿势，以及本仓库要求而 PR 不可能自带的那部分收尾（文档 / testplan / 版本 / 产物）。

### 做了什么

合入 GitHub PR [#7](https://github.com/AArlert/obsidian-auto-headings/pull/7)「feat: add configurable heading
inheritance depth」，新增每级可选字段 `inheritDepth`：`inherit=true` 时**最多往上拼几个祖先段**。
缺省 / `null` = 继承到 `topLevel`（= 1.0.21 及以前的唯一行为，**老模板零迁移**）。
截取起点 `max(topLevel, level - inheritDepth)`，**永不越过 `topLevel`**。规格见 `spec.md` §3.6
「继承级数用途」，场景真值表见 `testplan.md` §P（P1–P12）。

**PR 作者交付的部分**（原样采纳，未改一行逻辑）：`template.ts` 的 `normalizeInheritDepth` +
`render.ts` `buildPrefix` 截取 + `numbering.ts` skipFill=none 检查范围收窄 + `schema.ts` 按物理层级
夹紧（h1→0…h6→5）+ `EditPanel.ts` 新增「继承级数」下拉 + i18n 中英文案 + `styles.css` 九列网格 +
`inherit-depth.test.ts`（220 行，13 例）+ `schema.test.ts` 补 24 行。

**本次补齐的部分**（PR 不可能自带）：`spec.md` §3.6 字段表 + 用途小节 + JSON 示例 + CR-14b；
`testplan.md` §P 十二行场景；README 中英各一条；`release-notes/1.0.22.md`；bump 1.0.21→1.0.22；
`release/` 重建；本块 + `status.jsonl`。

### 合并风险怎么核的（可复用姿势）★

PR 基于 `1ff21f8`（**1.0.13**），master 已到 1.0.21，中间隔 **14 个提交**。核查顺序：

1. `git fetch origin refs/pull/7/head:pr-7` → `git merge-base master pr-7` 定位基线。
2. **只比对 PR 触碰的那几个文件在 master 上的分叉**（`git diff --stat <base> master -- <files>`），
   而不是看 master 整体改了多少——本次 8 个源文件里 **4 个在 master 上一行没动**
   （`render.ts` / `template.ts` / `templates/schema.ts` / `EditPanel.ts`），风险面立刻收敛到 3 个。
3. 分叉的 3 个（`i18n.ts` / `numbering.ts` / `styles.css`）**全部自动合并无冲突**，但
   **`numbering.ts` 必须手工复核**——master 侧 1.0.17 的 `<!-- skip -->` 分支（issue #6）就落在
   PR 插入点的**紧邻下方**，自动合并「文本干净」不等于「语义正确」。复核结论：PR 的
   `skipCheckStart` 计算在 map 回调开头、skip 标记分支在其后，互不干扰，`slice(skipCheckStart - 1, -1)`
   落在正确的 skipFill=none 分支里。
4. 门槛：`tsc -noEmit` 干净；`vitest` 516 条 515 绿（唯一红是 `whitelist.test.ts` 的 ICU 排序，
   **Windows 本地老假红**，与本 PR 无关，master 上同样红）。

### 顺带修掉的一个既有缺陷

`buildPrefix` 里起始编号偏移原本判 `i === 0`（序列首段）。截取起点可变后，首段不再必然是
`topLevel` 段，PR 改判 `segLevel === top`——**这同时修正了原代码的语义**：偏移本就该跟着
「真正的 `topLevel` 段」走，而非「序列第一段」。testplan P5 锁住该行为。

### 订正：上一块的「发版状态」已过期 ★

上一块写着「线上商店仍是 1.0.13、1.0.14–1.0.21 全部未发布、tag 尚未推送」——**这条已不成立**。
本次收尾核对 `git ls-remote --tags origin` 与 GitHub Releases 页发现：**`1.0.21` 早已推送并发布，
且被标记为 Latest**（说明文本即 `1.0.21.md`，已含 1.0.14–1.0.21 全部用户可见改动）。

**教训**：`doc/log.md` 里的「发版状态」是**会被仓库外动作改变**的事实（用户可能在会话之外自己推了
tag），写进日志那一刻就可能开始腐坏。**发版前必须现场核**（`git ls-remote --tags origin`），
不能信日志里的旧结论。本次因此差点把 1.0.14–1.0.21 的说明重复塞进 1.0.22 的 Release
（会让用户把「单标题跳过编号」这类早已发布的功能当成新功能读第二遍），核对后已改回只讲本版新增。

### 没做什么

- **PR 分支未在 GitHub 上关闭**——本地合并后需推 master，GitHub 会自行识别；若不自动关闭需手动
  关并致谢（本机无 `gh` CLI）。
- **P12 的 DOM 手验没做**：「继承级数」下拉的置灰联动（H1 恒灰、取消「继承前级」时同步灰）
  是纯 UI，需真机。逻辑侧走同一 `buildPrefix`、已被 P1–P11 覆盖。
- **UVM 未纳入 `inheritDepth` 随机化**：`uvm/stimulus.ts` 目前根本不随机化任何**级内**格式字段
  （`inherit` / `numeral` / 分隔符都不动），不是本 PR 的遗漏，是压测框架既有的覆盖缺口。
- **tag 未推**：发版仍等用户指令，见下方发版状态。

### 下一步

1. **已发版**：`1.0.22` tag 已推送，工作流按 `doc/release-notes/1.0.22.md` 建 Release。
   该说明**只讲 inheritDepth**——因为 1.0.14–1.0.21 的改动已随 **1.0.21 Release 发布过**（见下）。
2. 待手验清单在上一块基础上**新增 P12**：E36 / O11① / O5f / H12 / H9 / Dataview / P12。
3. 未解决问题总账与竞品调研采纳清单见下一块与 `spec.md` Roadmap M9，未受本次影响。

### 本周期派发

派发 0 次（主模型全程自持）——本次是**外部代码审核**，判断合并风险与语义正确性需要完整持有
master 与 PR 两侧的上下文，拆给子 agent 反而要把上下文重述一遍，不划算。

---

## 2026-08-09 会话收尾：未解决问题总账 + 竞品调研路线调整（无版本变化，纯文档）

> **接手者从这里开始读。** 本块是 2026-08-09 那次长会话（1.0.15 → 1.0.21，七个版本）的收尾总账，
> 只汇总**状态与去向**，不复述细节——每条都指向真正的事实源。

### 本次会话产出（七个版本）

| 版本 | 一句话 |
| --- | --- |
| 1.0.15 | `CLAUDE.md` 瘦身 46 行，开发周期十步下沉为按需加载的 `dev-cycle` 技能（纯文档，未 bump） |
| 1.0.16 | 复制净化取消开关、改为恒开（旧配置迁移删键）+ 订正附录 A.11 两处「移动端独占 / 唯一」错误论点 |
| 1.0.17 | 单标题跳过编号 `<!-- skip -->`（issue #6 phase 1）+ 迁移守卫可见化 + UVM 注释块排雷三颗雷 |
| 1.0.18–1.0.21 | 迁移守卫提示的**四轮真机修复**，详见下方「那条 bug 的四轮教训」 |

### 发版状态 / git tag ★

- **线上商店仍是 1.0.13**；`git tag` 最新也是 `1.0.13`。1.0.14–1.0.21 **全部只在仓库里，未发布**。
- **用户已拍板：只发最新那一个版本**（不逐版本补发）。故 `doc/release-notes/` 里**只有
  `1.0.21.md` 是会被取用的**——它已把 1.0.14–1.0.21 的全部用户可见改动合并成一份双语说明。
  `1.0.10.md`–`1.0.17.md` 均为历史草稿，**不会被任何流程读取**，保留仅作留档。
- **发布姿势**（本机无 `gh` CLI，走 tag 触发工作流）：确认 `manifest.json` 版本 = `1.0.21` →
  `git tag -a 1.0.21 -m "1.0.21"`（**不带 `v` 前缀**，Obsidian 约定）→ `git push origin 1.0.21`。
  `.github/workflows/release.yml` 会自动构建、按 `doc/release-notes/1.0.21.md` 建 Release 并附三个
  产物。**截至收尾时 tag 尚未推送**——等用户明确指令再发（推 tag = 面向全体用户公开发布）。

### 未解决问题总账

**A. 待用户真机手验**（本地无从验证，都需要真实 vault）

| 项 | 内容 |
| --- | --- |
| testplan `E36` | 带 `<!-- skip -->` 的标题，`[[文件#` 补全给出哪种形态、已有内链是否解析。夹具已备好：`tests/user_tests/11-单标题跳过编号.md` 最后一节 |
| testplan `O11①` | 设置 → 全局设置里确认**不再有**「复制净化」开关（纯 UI，1.0.16 已删代码） |
| testplan `O5f` | Obsidian **内置**「导出为 PDF」是否残留 WJ。**这条卡着一个需求的决策**：结论出来才能定「渲染层剥 WJ」做不做 |
| testplan `H12` / `H9` | 固化编号确认框 / 离场提示条；真库内链不断 |
| Dataview 样例 | README 里给的查询写法需在真实 Dataview 上验一遍 |

**B. 待决策**

- **复制净化未命中时的降级**（spec §2.8「残余已知限制」）：LRU 未命中（重启后 / 条目逐出 /
  外部改过）时粘贴回来的是净化文本。1.0.17 已把上限 50→200 吃掉「同会话逐出」这一类；
  **剩下「跨重启」这一类未处理**——曾评估的「未命中时剥净编号再插入」会改变粘贴语义，未做；
  「持久化 LRU」已因隐私 + 多端同步冲突**两次否决**，不要再翻案。
- **Setext 标题支持的优先级**（spec Roadmap M12 已登记）：做与不做未定；真要做**必须连
  frontmatter 结尾 `---` 被误判成 Setext H2 那个坑一起做**（竞品 gurjar1 的同类缺陷至今 open）。
- **`doc/research/` 的可移植性**：它是 `.gitignore` 排除的**本地留档**，换机器/重新克隆就没了。
  当初这么定是因为本仓库是**公开发布仓库**、放不得逐条点名竞品的拆解材料。若要跨机器保留，
  需另择存放处——这个取舍用户知情但未最终拍板。

**C. 待做（已定性，等排期）**

- **单标题 skip 的 phase 2**：标题旁浮动菜单里一键切换，标记由插件写入。等 M8a/M8b GUI 落地。
  纪律见 [spec §3.20](./spec.md)：**手写标记只是兜底，不得当卖点售卖**。
- **竞品调研的采纳清单 8 项**：已全部立项进 [spec Roadmap M9](./spec.md)「竞品源码级调研的采纳
  清单」，含工作量 / 风险 / 与既有设计的冲突点。**不要照抄竞品实现**，每条都写明了不可照抄的
  地方（尤其 backlink 回滚的并发写、低置信度编号接管）。

**D. 已知限制（接受，不修）**

- 迁移守卫的提示：**用户手动关掉后不会重新弹**（Obsidian 的 `Notice` 无「被关闭」回调），
  需切到别的文件再回来。
- 迁移守卫的判据（`stripForeignNumbering`）有**固有误伤面**：`## API 设计`、`## TODO 清单`
  这类正常标题会被判成疑似外来编号 ⇒ 弹提示、跳过自动编号。正因如此，清理**必须**走预览确认框，
  **绝不可做成无预览的一键清理**（否则就是把 `API` 从用户标题里吃掉）。
- 未落盘改动下，`cachedRead` 读到的是上次落盘内容，切回来那一瞬的守卫判断可能滞后一步；
  用户一开始打字即经防抖路径按编辑器真实内容重新判断，不影响正确性。
- 本机 `whitelist.test.ts:406` 的 ICU 排序断言**恒红**，是 Windows 环境差异，不是回归。

### 那条 bug 的四轮教训 ★（最值得下一个接手者读的一段）

同一个「迁移守卫提示不对」的问题修了四轮，每轮都以为找到根因：

1. **1.0.17** 按 `file-open` 事件重置「已提示」标志 → 真机说切回来不一定弹。
2. **1.0.18** 改按「最近检查的路径」推导，不依赖事件 → 真机说切到干净文件反而弹。
3. **1.0.19** 加「提示只为当前活动文件发声」的门 → 真机说提示依然是过时的。
4. **1.0.21** 才发现：**喂给判断的内容本身就是错的**——`file-open` 那一刻 `view.file` 已换、
   编辑器缓冲区还显示上一篇，且滞后**不止一个事件循环**（1.0.20 推迟一个宏任务仍读到上一篇）。
   改用 `vault.cachedRead(file)` 取文件自身内容，时序无关，问题消失。

**四轮的单测全绿，根子是同一个**：测试替身里「文件内容」与「编辑器内容」**永远相等**、且
`app.workspace` **根本没有 `getActiveFile`**，于是「被检查的文件 ≠ 用户正看着的文件」「文件内容 ≠
缓冲区内容」这两个维度在单测里**根本不可表达**。
**⇒ 替身比真实环境「更整齐」的地方，就是 bug 的藏身处。** 往 `obsidian-mock.ts` 里补方法时，
优先补那些能让「不一致」被表达出来的，而不是让一切都自洽。
本轮新增的回归都做了**「去掉修复 → 确认变红 → 恢复 → 转绿」**的实测，不是写完就绿的摆设——
这个动作值得成为习惯。

### 接手指引

1. 第一条命令仍是 `npm run docs -- --handover`。
2. 本分支 `feat/m11-export-m12-retire` 的改动**已全部合并回 `master`**（见下方「验证方式」）。
3. 竞品调研的**结论**在 [spec Roadmap M9 采纳清单](./spec.md)；**原始报告**在 `doc/research/`
   （本地、不入库），需要溯源细节时才翻。

**验证方式**：全程 `npx tsc --noEmit` / `npm test` / `npm run lint` / `npm run format:check` /
`npm run test:fuzz` 五项门槛；唯一红灯是既知的 ICU 排序噪音。1.0.21 已由用户真机确认解决。

**本周期派发 0 次**（收尾整理，主模型亲自做）。

---

## 2026-08-09 1.0.21 判断依据改为文件自身内容（真机反馈第四轮；用户直接点出了正解）

**背景**：1.0.20 的 `setTimeout(0)` 不够。用户第四轮给了一个非常干净的复现，直接把规律指出来了：
「a、b 是正常文件，C 是外来编号。那么 **a→C 无提示，C→b 弹提示且没什么可清理**」——
**编辑器内容正好落后一个文件**。并且直接提了正解：**「为什么不能做成打开 C 就弹出？打开 a、b
不弹出？就是只检测当前打开的文件，然后立马弹出提示」**。

**根因（终于对上）**：`file-open` 那一刻 `view.file` 已换、编辑器缓冲区还显示上一篇，而且这个
滞后**不止一个事件循环**——1.0.20 推迟一个宏任务再读，读到的仍是上一篇。所以「读编辑器」这条路
本身就是错的，推迟多久都是在猜。

**做了什么**：`renumberOnOpen` 不再读 `editor.getValue()`，改用 **`vault.cachedRead(file)`**——
它按 `TFile` 取**这个文件自己的内容**，与编辑器换没换到位**完全无关**，是时序无关的判据。
守卫与提示全部基于它，于是「打开 C 就弹、打开 a/b 不弹」自然成立。

- **写入侧另加一道闸**：`applyRenumber` 必须经编辑器写，故只有在编辑器确实已显示该文件、
  且 `editor.getValue() === content` 时才动手；不一致说明尚未换到位（或有未落盘改动），
  本轮**只判断不写入**。1.0.20 记录的那个「可能把 A 的编号写进 B」的潜在数据损坏，到这里才真正
  堵死——之前只是靠守卫恰好拦住。J9 的语义不受影响：内容一致时照常重排，不一致时由用户随后的
  第一次编辑经防抖路径补上。
- **`main.test.ts` J15 重写为 6 例**，直接按用户给的 a→C / C→b 两个方向建模，**去掉修复后这两条
  确实变红**（已实测）。

**教训（连着四轮，根因每轮都更深一层）**：1.0.17 调「何时重新提示」→ 1.0.18 换判据仍在调时机 →
1.0.19 加「提示归属哪个文件」的门 → 1.0.21 才发现**喂给判断的内容本身就是错的**。四轮的单测全绿，
根子是同一个：**测试替身里「文件内容」与「编辑器内容」永远相等**，而真实 Obsidian 在换页瞬间恰恰
不等。本轮给替身补上 `vault.cachedRead`、并让它能与编辑器内容**故意不一致**，这个维度才第一次
可表达。**替身比真实环境「更整齐」的地方，就是 bug 的藏身处**——这条已经连续验证两次了。

**没做什么 / 已知遗留**：

- **未落盘改动的边角**：用户在某文件里打了字（未保存）后切走再切回，`cachedRead` 读到的是上次
  落盘的内容，可能与屏幕上不完全一致。守卫判据因此可能略滞后一步；随后的第一次编辑会经防抖
  路径按编辑器真实内容重新判断，故只影响「刚切回来那一瞬的提示」，不影响正确性。
- 1.0.19 遗留的「用户手动关掉提示后不会重新弹」（Obsidian 的 `Notice` 无关闭回调）仍在。

**下一步**：① 把 1.0.21 发给用户**第五轮**复验（原样跑 a→C、C→b 两步）；② 通过后推送、合并、
打 tag（只发 1.0.21）；③ 排队中的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（496 通过，唯一红灯仍是既知的
`whitelist.test.ts:406` ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）
全绿；J15 新用例经「去掉修复 → ①② 变红 → 恢复 → 转绿」实测确认有效。

**本周期派发 0 次**。

---

## 2026-08-09 1.0.20 `file-open` 时编辑器内容尚未换到位（真机反馈第三轮；**方向对、药量不够**——见 1.0.21）

**背景**：1.0.19 发出去后第三轮真机反馈：「在外来编号的文件里敲个字、立刻切去**已经由本插件
接管**的文件，弹出，但点击后还是显示没有什么可以清理——提示依然是过时的。切回来也不弹出。」
1.0.19 加的「只为当前活动文件发声」那道门**确实生效了**（提示挂在了 b.md 上、`getActiveFile()`
也确实是 b.md，所以门放行了），但它挡不住真正的毛病：**内容是错的**。

**根因**：`renumberOnOpen` 同步跑在 `file-open` 处理器里，而**那一刻 Obsidian 已经把
`view.file` 换成了新文件、编辑器里的内容却还是上一篇的**。于是：

- `view.file?.path === "b.md"` ✅ 通过 → `editor.getValue()` 返回的却是 **a.md 的内容** →
  `hasUnclaimedForeignNumbering(a 的内容)` = true → 提示**挂在 b.md 的路径上**弹出。
- 点击时 `markdownContextForPath("b.md")` 重新读 b.md 的**真实**内容（此时已换到位、带 WJ）
  → 预览为空 → 「没有什么可以清理」。
- 切回 a.md 时同理：编辑器又还停在 b.md 的内容上 → 判定为干净 → 不但不提示，还顺手
  `dismissGuardNotice("a.md")`。三条症状全部对上。
- **更危险的潜在后果**：若那份陈旧内容恰好是「干净但没编号」的，`applyRenumber` 会把
  **a.md 的编号写进 b.md 的编辑器**。这次是守卫恰好拦住才没发生——属于侥幸，不是设计。

**做了什么**：

1. **`renumberOnOpen` 推迟一个宏任务**（`window.setTimeout(…, 0)` → 新的
   `renumberOnOpenSettled`），在那时**重新解析**活动视图、并**重新确认**它就是本次打开的文件
   （用户可能在这一瞬又切走了）。J9「打开即按当前模板重排」的语义不受影响——它本来就不要求
   同步完成。
2. **`scheduleRenumber` 计时器加作废闸**：到期时若 `info.file?.path !== path`，说明这个叶子在
   防抖窗口内已切到别的文件（同一个 `MarkdownView`/`Editor` 实例会被复用来显示新文件），
   **整轮作废**。此前只靠 1.0.19 那道「活动文件」门挡提示，写入侧并没有挡。
3. **`main.test.ts` 新增 J15 三例**，其中一例把「`view.file` 已换、`editor` 内容未换」那一瞬
   **精确建模**（同一个 editor 实例，推进事件循环时才换内容）——**去掉修复后该用例确实变红**，
   已实测确认它抓得住这个 bug，不是写完就绿的摆设。

**教训（第三轮才修对，值得记住）**：三轮修复分别在调「什么时候重新提示」（1.0.17 `file-open`
重置 / 1.0.18 `lastGuardedPath`）、「这条提示说的是哪个文件」（1.0.19 活动文件门），**都对，但都
不是根因**——根因是「判断所依据的内容本身就是错的」。前两轮的单测之所以全绿，是因为测试替身
里**编辑器内容与文件路径永远是一致的**，而真实 Obsidian 在 `file-open` 那一瞬恰恰不一致。
**替身比真实环境「更整齐」的地方，就是 bug 的藏身处。**

**没做什么 / 已知遗留**：

- **`setTimeout(0)` 是否足够**取决于 Obsidian 换内容的时机，本地无法验证。若第四轮仍复现，
  下一步应改为「用 `metadataCache.getFileCache(file)` 的 headings 与编辑器内容交叉校验」，
  内容对不上就跳过本轮——那是不依赖时序的判据，但实现更重，故先用延后这条轻的。
- 1.0.19 遗留的「用户手动关掉提示后不会重新弹」（Obsidian 的 `Notice` 无关闭回调）仍在。

**下一步**：① 把 1.0.20 发给用户**第四轮**复验（原样复现这次那条链路）；② 通过后推送、合并、
打 tag（只发 1.0.20）；③ 排队中的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（493 通过，唯一红灯仍是既知的
`whitelist.test.ts:406` ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块
记分板）全绿；新增回归经「去掉修复 → 变红 → 恢复 → 转绿」实测确认有效。

**本周期派发 0 次**（主模型亲自处理——根因判断依赖对 Obsidian 事件时序的整体推理）。

---

## 2026-08-09 1.0.19 迁移守卫提示只为当前活动文件发声（真机反馈第二轮；**当时以为是根因，实际不是**——见 1.0.20）

**背景**：1.0.18 发出去后用户第二轮真机反馈，给了完整复现：「打开一个外来编号的文件，没弹；
切换到一个自己写的文件，这时候就弹出提示；点击清理又说不需要清理」。三条症状同源，而且**前两版
（1.0.17 的 `file-open` 重置、1.0.18 的 `lastGuardedPath` 序列推导）都没打到根因**——它们都在
调整「**什么时候**该重新提示」，而真正的问题是「**这条提示说的是哪个文件**」。

**根因**：`guardForeignNumbering` 的发起方**不保证是用户正看着的那个文件**：

- `scheduleRenumber` 的防抖计时器捕获的是**安排那一刻**的 `path` 与 `editor`。用户在 a.md 里敲了
  字、300ms 还没到就切走，计时器在**切换之后**才到期 ⇒ 弹出的是 a.md 的提示，而屏幕上已经是
  b.md。这正是症状 ①②：打开 a 时没弹（那时还没打字、没有计时器），切到 b 才弹（a 的计时器到期）。
- `renumberActiveFile`（改模板后即时重排）直接遍历**全部**打开的叶子，后台脏文件同样会弹。
- 症状 ③ 随之而来：那条提示指向 a.md，而同标签页切换早把 a.md 换掉了 / 用户以为它在说 b.md，
  于是点进去看到的是「不需要清理」。

**做了什么**：

1. **提示的可见性收归 `showForeignNumberingGuardNotice` 一处裁决**，三条约束：
   - **只为当前活动文件发声**：`this.app.workspace.getActiveFile()?.path !== path` 直接不弹。
   - **同一文件至多一条**：已有一条在屏幕上就不重建——Notice 是 `duration: 0` 不自动消失的，
     用户持续打字会让防抖反复到期，每次重建会闪烁、且把用户正要点的那条抽掉。
   - **失效即收起**：切到别的文件（`renumberOnOpen` 最前面无条件调用
     `dismissGuardNoticeUnlessFor`）、或该文件已被清理干净（`guardForeignNumbering` 返回 false
     时 `dismissGuardNotice`）时主动 `hide()`。
2. **`lastGuardedPath` 删除**（1.0.18 引入的那个单变量）：它解决的是「什么时候重新提示」，而
   新机制里「切走时收起、回来时因无活动提示而重建」天然覆盖了这个诉求，不需要额外状态。
3. **`main.test.ts` 回归 6 例**，含真机链路逐条复现（计时器切走后到期不弹、批量刷新只弹活动的
   那个、连续打字只有一条、切走收起、切回重提、清理干净收起）。

**为什么前两版没测出来（值得记住的教训）**：测试替身 `app.workspace` **根本没有 `getActiveFile`
方法**，而 `main.ts` 里用的是 `getActiveFile?.()`（可选调用）——于是「活动文件」这个维度在单测里
**根本不存在**，两版实现都只能围绕「调用序列」做文章，测试也就只能验证调用序列。本轮给替身补上
了 `getActiveFile` 并新增 `setActiveFile` 驱动器，让「被检查的文件 ≠ 用户正看着的文件」这个真实
场景第一次变得**可表达**。**替身缺一个方法 = 一整类 bug 在单测里不可见**。

**没做什么 / 已知遗留**：

- **用户手动关掉提示后不会重新弹**：Obsidian 的 `Notice` 没有「被用户关闭」的回调，插件无从得知
  那条已经不在屏幕上，因而会一直认为「这个文件已有一条」。要等切到别的文件再回来才会重建。
  可接受（对比 1.0.15 之前的「静默永久跳过」仍是净改善），但记在这里备查。

（1.0.18 那轮遗留的「zip 被占用打不了包」已解除，本轮 `npm run release` 跑通，产物为 1.0.19。）

**下一步**：① 把 1.0.19 发给用户**第三轮**复验（重点复现本次那条链路：在外来编号文件里打字 →
立刻切走 → 观察是否还会误弹；以及切走再切回是否照常提示）；② 复验通过后推送、合并、打 tag
（只发 1.0.19）；③ 排队中的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（490 通过，唯一红灯仍是既知的 `whitelist.test.ts:406`
ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）全绿。

**本周期派发 0 次**（主模型亲自处理——根因判断依赖对触发链路时序的整体理解，不适合外包）。

---

## 2026-08-09 1.0.18 迁移守卫重新提示不再依赖 file-open 事件（真机验证反馈）

**背景**：用户拿 1.0.17 release 包真机测试后反馈：迁移守卫的「换到别的文件再回来即可再提示」
（J13）不一定真的弹出来。1.0.17 的实现按 `file-open` 事件重置「已提示」标志——单测里用「连续
调用两次 `renumberOnOpen`」模拟「切走再切回」，这个模拟本身就在假设 Obsidian 的 `file-open`
在标签页切换时每次都可靠触发，而这个假设从未在真实 Obsidian 里验证过（testplan J14 当时也承认
「🔲 手验 DOM」）。真机测出它不成立。

**做了什么**：

1. **重新设计判断依据，不再绑定单一事件**（testplan J13 改版）：`foreignNumberingWarned`
   （`Set<string>`「已提示过」标志）换成 `lastGuardedPath`（`string | null`，最近一次被检查的
   文件路径）。`guardForeignNumbering` 在函数最前面**无条件**比较「这次要检查的路径」与
   `lastGuardedPath` 是否相同——不同就判定「刚从别处过来」，允许重新提示；相同则维持节流。
   这个比较**不依赖任何特定事件**：触发检查的除了 `file-open`（`renumberOnOpen`），编辑防抖
   到期（`scheduleRenumber`）同样会调用 `guardForeignNumbering`——只要用户在别的文件里打过字
   （哪怕 `file-open` 那次真的没触发），`lastGuardedPath` 照样会被更新，回到原文件继续编辑时
   一样能正确识别「离开过」。
   - **关键细节**：路径比较写在函数最前面、**无条件**执行（哪怕本次检查的文件其实内容干净、
     不含外来编号也照样刷新）——否则切去一个干净文件再切回来，`lastGuardedPath` 不会被那次
     「路过」更新，回来后反而识别不出离开过。
   - **为什么不是「每次检测都弹」**（用户最初的直觉修法）：`guardForeignNumbering` 在编辑防抖
     每次到期时都会被调用——用户在同一个疑似外来编号的文件里持续打字、多次停顿，若不做任何
     节流，会弹出多条 `duration:0`（不自动消失）的 Notice 堆在屏幕上，比原来的静默 bug 更烦人。
     `lastGuardedPath` 这个设计同时满足「同一文件内连续编辑只提示一次」与「换文件再回来必定
     重新提示」两个目标，且后者不再依赖事件的可靠性。
2. **改名 / 删除 / 卸载的配套维护**同步从 Set 操作改为单变量比较赋值（`rename` 时若
   `lastGuardedPath` 恰是旧路径则跟着改；`delete` 时若恰是该路径则清空；`onunload` 直接置 `null`）。
3. **`main.test.ts` J13 用例重写并新增**：原「连续调用两次 `renumberOnOpen`」用例本身就是在测
   一个不成立的假设，已改为「中途插入对另一文件的检查」；新增一条「完全不调用 `renumberOnOpen`、
   纯靠 `scheduleRenumber` 打字触发」的专项，直接对应用户反馈的真机场景；另加一条验证 `file-open`
   确实触发时也照常工作。共 4 例（原 2 例扩为 3 例 + 1 例新场景）。
4. **发行说明改写为 1.0.18.md**（`1.0.17.md` 原样留作历史草稿，不再是任何流程会读取的文件）：
   迁移守卫那条 bullet 的措辞从「重新打开文件」改为「切到别的文件再切回来」，与实际机制一致；
   版本区间从「1.0.14–1.0.17」延到「1.0.14–1.0.18」。

**没做什么 / 已知遗留**：

- **一个较窄的边界未处理**：若用户同时打开多个疑似外来编号的文件并快速轮流编辑（如分屏），
  `lastGuardedPath` 会在这些文件间来回变化，导致每次切回都被判定「离开过」而重新提示——即便
  用户其实没有真正离开太久。评估为可接受的权衡（对比原来的「静默永久跳过」是净改善），未做
  更复杂的「多文件访问历史」跟踪。
- **设置面板改模板触发的批量刷新**（`renumberActiveFile`，同样调用 `guardForeignNumbering`）
  在多个疑似外来编号文件同时打开时，会依次将 `lastGuardedPath` 指向每个文件，理论上可能让
  用户正在编辑的那个文件在批量刷新后被误判为「刚从别处过来」而多弹一次提示——同上，接受。
- release 包因用户机器上 `release/auto-headings.zip` 被 NanaZip 打开锁定，打包步骤本轮暂未跑通；
  平铺三件套（`main.js`/`manifest.json`/`styles.css`）已同步到 1.0.18，需在用户关闭该文件后补跑
  `npm run release` 重新打包 zip。

**下一步**：① 用户关闭锁定 zip 的窗口后补跑 `npm run release`，重新打包发给用户复验（含 J13 场景：
真实切换标签页测试）；② 复验通过后推送分支、合并回 master、打 tag（只发 1.0.18，之前的 1.0.14–17
均不单独发布）；③ 之前排队的手验清单（H12/H9/O5f/Dataview/E36）与 Setext 标题支持仍待推进。

**验证方式**：`npx tsc --noEmit` / `npm test`（487 通过，唯一红灯仍是既知的 `whitelist.test.ts:406`
ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）全绿。

**本周期派发 0 次**（主模型亲自处理——涉及对真机反馈的根因判断与节流策略取舍，不适合外包）。

---

## 2026-08-09 1.0.17 单标题跳过编号（issue #6）+ 迁移守卫可见化 + UVM 注释块排雷

**背景**：三条线并行。① 用户 issue #6 提前排期到本周期；② 上周期 spec §2.8 补写的「迁移守卫两种
后果」分析里，更重的那一种（静默永久跳过、用户视角像插件坏了）本周期直接动手修；③ 1.0.14 遗留的
UVM 注释块激励缺口一并排掉。②③ 派 `feature-coder` 并发执行，①主模型亲自做（涉及解析核心与
backlink 锚点，不适合外包）。

**做了什么**：

1. **单标题跳过编号 `<!-- skip -->`**（issue #6 phase 1，testplan E30–E36，spec §3.21 新节）：
   `parser.ts` 新增 `hasSkipMarker`（行尾 HTML 注释，大小写/空白容错），接到 `numbering.ts` 里
   **白名单豁免的同一分支**——不新造机制：命中即不编号、不推进计数器、不作重置边界，但**剥离
   已有编号**（给已编号标题事后补标记，下次重排会摘掉那个号，不会冻结成僵尸编号）。选形态的
   四条理由（阅读视图不可见/复用 1.0.14 R2 语义/必须行尾避免误判正文批注/与 gurjar1 刻意同形
   零迁移成本）与两条未定项（phase 1 只跳本行不含子树；内链锚点表现待实机）写进 spec §3.21。
   新增 `tests/user_tests/11-单标题跳过编号.md` 夹具，README 双语补充说明（按 §3.20 判据：
   手写只是兜底，不当卖点售卖）。
2. **迁移守卫可见化**（testplan J13/J14）：`foreignNumberingWarned` 从「每会话一次、之后永久
   静默」改为「每次 `file-open` 重新允许提示一次」（`renumberOnOpen` 函数体最前清空，它是
   file-open 在自动路径上的唯一入口）。Notice 改用 `createFragment` 构造可点击文案（Obsidian
   官方 API，`Notice` 原生支持 `DocumentFragment`，`duration:0` 常驻到用户点击），点击后打开
   `ForeignNumberingCleanupModal`——逐条列出「现状→清理后」对照（`previewForeignNumberingCleanup`，
   与实际清理同一套 `stripForeignNumbering`，保证预览与结果一致），**不做无预览的一键清理**：
   清理命令与守卫共享同一误伤面（`## API 设计`这类正常标题也会被判成疑似外来编号），无预览
   执行等于本插件一直在批评竞品的「吃用户内容」缺陷本身。
3. **UVM 注释块激励排雷**（1.0.14 遗留三颗雷全部拆除，见下方独立小节）。
4. **LRU 上限 50→200**（`clipboard.ts`，上周期净化降级方案 A 的第一步，减少同会话内的条目逐出）。

**UVM 排雷细节**：先用临时探索脚本（未入库）对 `renumberContent`/`backlinks.ts` 做了 13 组对照
实验，摸出关键点——注释块「事后包住已编号标题」时自动重编号会清 WJ 残留（按 §3.17 分区域分治），
围栏则原样冻结；据此① SAFE/MESSY 碎片投毒按「行内配对闭合进默认模式、未配对裸定界符进 explore」
分区；② `deleteLine` 补删注释定界行的覆盖率标记（本无保护，只是没统计）；③ R3 形态标题走
backlink 往返实测天然安全，不必如原设想限制进 explore 池。`oracles.ts` **未改**过滤逻辑——已证明
现有正则够用，但依赖「注释相关碎片池都是良构（无 `]`/`#`/`|`）」这条隐性前提，以后扩碎片池要留意。

**没做什么 / 已知遗留**：

- **单标题 skip 只做识别，没有写入侧**：phase 2（标题旁浮动菜单一键切换）等 M8a/M8b GUI 落地。
- **内链锚点表现未验**（testplan E36）：带标记标题的 backlink 快照与锚点归一化看到的是含标记
  文本，Obsidian metadataCache 怎么处理 HTML 注释锚点本地无法验证，登记待用户真机手验。
- **迁移守卫 Modal 的 DOM 渲染未测**（沿用仓库既有约定：`Modal.open()` 从不触发 `onOpen`，
  单测只覆盖构造参数与回调，DOM 细节留手验）。
- **净化降级方案 A 只做了 LRU 上限**：真正的「不再静默永久跳过」已经是本周期的迁移守卫改造
  （两者是同一类问题的不同入口，此次一并解决）；「未命中时剥净编号再插入」仍未做。
- 1.0.14–1.0.17 **都还没打 tag 发布**；release-notes 待补。

**下一步**：① 打包 release 交给用户本机验证（O11①/H12/H9/O5f/Dataview/E36 一起验，见 status
`next`）；② 用户验证通过后推送分支、合并回 master、打 tag（**只发最新版本**）；③ Setext 标题
支持（spec Roadmap 已登记，优先级待定）。

**验证方式**：`npx tsc --noEmit` / `npm test`（485 通过，本机唯一红灯是既知的
`whitelist.test.ts:406` ICU 排序噪音）/ `npm run lint` / `npm run test:fuzz`（5000×80 两块记分板）
全绿；三条并行改动经 `git status` 确认零文件级冲突，合并后重跑全部门槛复核无交互问题。

**本周期派发 2 次**（feature-coder × 2，UVM 排雷 + 迁移守卫可见化，均并发执行；单标题 skip 主模型
亲自实现）。两次派发均因 auto-mode 分类器故障被意外中断过一次，确认无残留改动后原样重派成功。

---

## 2026-08-09 1.0.16 复制净化取消开关（恒开）+ 订正「移动端独占」错误论点

**背景**：竞品调研（本周期另一条线，见下）顺带核出 spec 附录 A.11 里两句不成立的对外论点；用户同时
拍板取消复制净化开关——**「不往用户剪贴板里塞隐形字符」是插件的固有承诺，不是可选项**，留着开关
等于承认「关掉也算一种正当配置」，而那个状态正是 §2.6 登记的 WJ 外泄风险本身。

**做了什么**：

1. **`sanitizeClipboard` 开关全面移除**（testplan O11 ✅，spec §2.8 新增「无开关」小节）：删设置字段
   与默认值（`settings/model.ts`）、GeneralTab 的开关 UI、`i18n.ts` 中英两套文案键、`main.ts` 两处
   门控（copy/cut 端与 paste 还原端）。**旧配置走迁移删键**（`delete merged.sanitizeClipboard`，
   与既有的 `backlinkStandaloneTrigger` 同一姿势）——1.0.10–1.0.15 期间显式关掉过的用户升级后同样
   恒净化，键在下次 `saveSettings` 时从 `data.json` 消失。
   - **为什么不是「保留开关但默认开」**：默认开只消解了一半。M11 信任包的目标是把 WJ 风险从「披露」
     升级到「主动消解」，而开关的存在本身就是在说「这事可以不做」。行为面本就可控：WJ 守卫保证不含
     编号的复制粘贴零介入，降级路径保证任何失败都退回「等于本功能不存在」。
2. **vault 内往返补两条回归**（testplan O12 ✅）：① 同一份内容**连续粘贴两次**都必须命中还原——
   `lookup` 命中只刷新 LRU 新旧序、不消费条目，若哪天改成消费式这条即红；② 旧配置残留
   `sanitizeClipboard:false` 时净化端与还原端都照常工作。另加一条 `loadSettings` 迁移用例，
   断言旧键确实被删。
3. **订正 spec 附录 A.11 两处错误论点**（2026-08-09 复核五家 `manifest.json`）：原文写「移动端可用是
   本插件在活跃竞品中的**独占优势**」「活跃竞品中**唯一**移动端可用」——**实际只有 gurjar1 一家是
   `isDesktopOnly: true`**，header-enhancer / number-headings / title-serial-number /
   auto-numbered-headings 四家均为 `false`。改为「最活跃的对手 gurjar1 桌面端限定，本插件移动端可用」
   并就地加了「不可写成『唯一』或『独占』」的护栏。这条原文明写着是留给 README 竞品对比节与迁移
   向导取用的，**若照原样上架就是一条会被当场证伪的承诺**。

**没做什么 / 已知遗留**：

- **净化的残余降级面没有收窄**（spec §2.8「残余已知限制」照旧）：LRU 未命中时（Obsidian 重启后、
  条目被逐出、文本在外部改过）粘贴回来的是净化文本，裸序号会被当正文、叠新前缀，且触发外来编号
  守卫拦下该文件的自动编号。**开关取消后这条没有逃生口了**，三个可选缓解（提高 LRU 上限 / 未命中
  时改为剥净编号再插入 / 持久化 LRU——最后一条 2026-07-18 已因隐私否决）都**未动**，等用户拍板。
- 竞品调研（codex 源码级 + subagent issue 挖掘）结论**未进 spec**，按用户要求只留在会话与
  scratchpad 报告里；其中「单标题 skip 标记」已有我方 issue #6 认领，是下一个功能的明确候选。
- 1.0.14 / 1.0.15 / 1.0.16 **都还没打 tag 发布**。

**下一步**：① 用户手验 H12 / H9 / O5f / Dataview；② 决定上面三条净化降级缓解做不做；
③ 打 tag 发版（release-notes 需补 1.0.16）；④ 单标题 skip 标记（issue #6，已回复用户「后续版本」）。

**验证方式**：`npx tsc --noEmit` / `npm test`（466 通过，新增 3 例）/ `npm run lint` / `npm run preflight`；
本机唯一红灯仍是既知的 `whitelist.test.ts:406` ICU 排序噪音。

**本周期派发 3 次**（quality-gate × 2、general-purpose(sonnet) × 1 挖竞品 issue；另调用本机 codex CLI
× 1 做竞品源码级功能对比——沙箱内联网需绕开 schannel，见 memory `codex-cli-local-dispatch`）。

---

## 2026-08-09 1.0.15 CLAUDE.md 瘦身：开发周期正文下沉为 `dev-cycle` 技能

**背景**：根 `CLAUDE.md` 每次会话全量进上下文，而「十步清单 + 版本号规则 + 钩子/CI 细节」只在真正
动手改代码时才用得上——常驻成本高、使用频率低。技能（skill）按需加载，正好承接这类「用时才读」的
流程正文。本周期只搬运不改语义。

**做了什么**（分支 `feat/m11-export-m12-retire`）：

1. 新建 `.claude/skills/dev-cycle/SKILL.md`：原 §4 十步清单 + §4.1 版本号规则（`0.M.*` 格式、
   `npm run bump` 三形态、上架后仅行为改动才 bump）原样搬入，`description` 写明触发时机
   （开工做实质改动 / 准备收尾提交）。
2. 根 `CLAUDE.md` 减 46 行：§4 只留「一句话流程 + 读技能」指针，并强调 **bump 与 preflight 一步都不能省**
   （最容易被省的正是这两步，故留在常驻文件里）；删 §1 仓库结构（目录树的单一事实源是本文件
   「目录结构约定」块）、§7 钩子/CI 细节压成三行、两段 monorepo 迁移历史备注（迁移早已完成）。
3. `.claude/agents/feature-coder.md` 的「按 CLAUDE.md §4 流程干活」改指 `dev-cycle` 技能——§4 已无正文，
   子 agent 照旧引用会读到一句话流程而漏掉 testplan-first。
4. 本文件「目录结构约定」块登记 `.claude/skills/dev-cycle/`；订正上一周期块与 `status.jsonl` 首行日期
   （07-25 → 07-29）。

**没做什么**：

- **未 bump**（上架后策略：只碰 `doc/` 与 `.claude/`，`src/` 一行未动，不向线上用户推空更新）。
- `AGENTS.md` 与 `.codex/`（Codex 镜像）按既定约定不改不删不提交——其中的 §4.1 引用因此与
  `CLAUDE.md` 现状不同步，**属预期**，需要时由用户侧自行重生成。

**下一步**：仍是上一周期块那三条 —— ① 用户手验 H12（固化确认框）/ H9（真库内链）/ O5f（内置导出
PDF）/ Dataview 样例；② 竞品 auto-heading(gurjar1) 源码级调研并入 spec 附录 A.11；③ 打 tag 发
1.0.14 / 1.0.15（tag 最新仍停在 1.0.13，release-notes 均已备好）。

**验证方式**：`npm run preflight`（docs 归档 + release 重建 + test + lint + format:check）。

**本周期派发 1 次**（quality-gate × 1）。

---

## 2026-07-29 1.0.15 三处「用户已表态、插件仍自作主张」：清除即暂停 / 不抢键盘 / 迁移守卫误伤

**背景**：用户在真机使用中报了两条体感问题（「清除当前编号是个摆设」「标题后写空格会被自动清掉」），
本周期把它们连同顺带挖出的第三条一起修掉。三者同源：**插件在用户明确表态之后仍然自作主张**。
规格集中写在 spec §3.19（新节），入口从 §3.2 / §3.10 指过去。

**做了什么**：

1. **「清除当前文件编号」此前是摆设**（testplan H13–H16 ✅）：`runClearNumbering` 只取消了该文件
   **当前那一个**待处理防抖计时器，下一次按键即重新 `scheduleRenumber` 把编号编回去——只要「全局
   自动编号」开着，这条命令**永远不可能产生持久效果**。现在清除时若该文件确实还会被自动重编号
   （`shouldAutoTrigger` 够格 + 命中模板），把 frontmatter `obsidian-auto-headings: false` **并进同一个
   `editor.transaction`**，一次撤销整体回退；反之一个字都不写。恢复走「立即重新编号」（顺带移除该键，
   该键是唯一一项时整个 `---` 块一并移除）。
   - **复用既有单文件开关而非新造暂停状态**：它写在文件里、用户看得见改得动、跨重启存在，且每条
     自动触发路径本就尊重它。新造 `pausedPaths` 则是隐形状态，还要挂文件重命名事件重映射路径——
     正是 1.0.14 离场提示条那条教训（「不能在用户不知情时一声不吭地什么都不做」）所指。
   - **写入侧只产出「编辑计划」不直接改字符串**（`frontmatter.ts` 的 `planPauseFileSwitch` /
     `planResumeFileSwitch` → `SwitchEdit`）。因为 `writeLineDiff` 按「整文件重写永不增删行」做逐行
     索引比对，往顶部插几行会让其后所有行错位；交回 `main.ts` 翻译成一条 `EditorChange` 后，CM6
     变更集按原文档坐标计算，与行替换天然互不干扰。该模块此前是纯只读的，本次首次有了写入侧。

2. **不在用户正敲字的那一行下手**（testplan J11 ✅）：`stripPrefix` 会把标题文本的行尾空白归一化掉
   （`strip.ts` 的 `s+$`，幂等所必需），而自动路径此前**没有任何光标守卫** ⇒ 用户在标题末尾敲一个
   空格、停顿超过防抖时长，空格就被静默吃掉。新增 `preserveLine`：自动路径把光标所在行的改动从本次
   事务里剔除、**其余行照常重排**，该行在光标移开后的下一次触发补上。
   - **不整轮顺延**（与 J8 的 IME 分支形状不同）：顺延会在光标停在标题行不动时无限期地重排计时器。
   - **保护必须发生在折叠自链接之前**——被保护的行标题文本没变就不该产生改名，更不该据此改写指向
     它的内链（否则链接指向一个文件里并不存在的标题）。快照因此记的始终是真正落盘的内容。

3. **迁移守卫误伤**（testplan J12 ✅，**写 J11 用例时撞出来的既有缺陷**）：
   `hasUnclaimedForeignNumbering` 拿 `stripForeignNumbering(rawText)` 与 `rawText` **直接**比较，而前者
   末尾也带一道 `s+$` 归一化 ⇒ 一个全文无 WJ、无任何编号的文件，只要某个标题行尾有空格就被判成
   「像外来编号」，该文件的自动编号被整个拦下、并弹出误导性的「请先执行『清理非本插件的标题编号』」。
   修法：比较基准同样去掉行尾空白。**这条是第 2 项的第二个独立成因**——只修光标守卫治不好它。

4. **`fm: false` 的含义收窄为「不自动编号」**（testplan I8 ✅，M22 用例反转）：第 1 项让「清除编号」
   开始写这个键，而它此前**同时**关掉 backlink 独立触发 ⇒ 清一次编号会连「改名不断链」一起停掉，
   等于用一次编号清理换掉附录 A 里定位的第一价值。故 `shouldBacklinkStandaloneTrigger` 不再检查该键。
   **这是对已上架语义的有意收窄**，由用户拍板（理由：backlink 本就是独立的全局功能，任何时候都该 sync）。
   要彻底静默请关 `updateBacklinks` 总开关。

**没做什么 / 已知遗留**：

- **竞品 auto-heading（gurjar1）的调研只落到了会话里，未进 spec 附录 A**。本次派 subagent 做了源码级
  核实（真实仓库是 `gurjar1/auto-heading-obsidian`，此前 memory 记的地址 404），拿到设置面板 41 个控件
  逐项表、三套标题旁可视化 UI（CM6 widget 行内工具条 / gutter 徽标 / 顶部 breadcrumb 条）、24 条命令、
  状态栏与右键菜单清单。**下一步应把它并进 spec 附录 A.11 并重排 M12 那条「两条借鉴命令」**。
- **未验证 O5f**（Obsidian 内置「导出为 PDF」是否残留 WJ）——用户表示自己手验，故本周期未推进
  「自动识别 pandoc 导出并临时清 WJ」那条需求。结论已给：**「清了再放回」这条路应否掉**（Obsidian
  没有导出开始/结束事件，且崩溃/取消会把库停在被剥光的状态，而剥 WJ 不进撤销历史）；真正的杠杆是
  `registerMarkdownPostProcessor` 渲染层，且**必须只碰文本节点、不碰 `data-heading` 与链接 href**。
  等 O5f 结论出来再决定是否值得做。
- **UVM 激励仍未扩到注释块**（1.0.14 遗留），三颗雷未拆：SAFE_FRAGMENTS/MESSY_FRAGMENTS 投毒、
  deleteLine 删注释定界行、R3 形态标题进 backlink 往返。
- 1.0.14 与 1.0.15 **都还没打 tag 发布**。

**下一步**：① 用户手验 H12（固化确认框/离场提示条）、H9（真库内链不断）、O5f（内置导出 PDF）、
Dataview 样例；② 竞品调研并入 spec 附录 A.11；③ 打 tag 发 1.0.15（release-notes 已备好）。

**验证方式**：`npx tsc --noEmit` / `npm test`（新增 22 条：main 12 + frontmatter 11 - 重合，另反转 M22、
改 I6 与三条清除路径断言）/ `npm run lint` / `npm run test:fuzz` 全绿；本机唯一红灯是既知的
`whitelist.test.ts:406` ICU 排序噪音（见 memory `windows-env-quirks`）。

**本周期派发 2 次**（quality-gate × 2；另派 general-purpose × 1 做竞品调研）。主模型亲自做了设计决策、
frontmatter 写入侧、光标保护接线与全部文档。

---

## 2026-07-19 1.0.14 M12 两项：注释块跳过（含分区域残留分治）+ 固化编号并交还所有权（全库）

**背景**：本块是「导出 + 离场」四项里的**周期 B**（有行为变化，故 bump 1.0.14 并重建 `release/`）；
周期 A（导出与 Dataview，纯文档）见下一块。

**做了什么**：

1. **注释块跳过**（M12，spec §3.17 新节，testplan E19–E29 全 ✅）：`%%…%%` 与 `<!--…-->` 内的
   `#` 行不视为标题——不编号、**不推进计数器**、不进 backlink 快照。
   - **新增 `src/scan.ts`** 作为跳过区域的唯一权威扫描器。此前 `parser.ts` 与 `numbering.ts`
     各自维护了一份**同构的围栏状态机**、且后者要反向从 `./parser` 借 `FENCE_RE`，依赖方向别扭；
     现在两处都只消费 `scanSkipRegions`。`parser.ts` 保留一个 `FENCE_RE` 的 re-export 兼容既有 import。
   - 与围栏的关键差异是**注释可行内开闭**，不能沿用「整行 continue」。定下 **R1–R10 十条裁决**
     （spec §3.17 表），核心是 **R2「行首定标题」**：`## 标题 %% 批注 %%` 与 `## 标题 <!--`
     **本行都仍是标题**（`#` 未被遮蔽），后者只遮蔽**下方**各行。
   - 两条**明确记为已知限制**、并各配一条钉住现状的用例：① 注释内的 ``` 会开启围栏（R5 反向）；
     ② 行内代码 `` `<!--` `` 里的分隔符照常触发（R6，正确处理需 CommonMark 级反引号游程
     tokenizer）。两者的失败方向都是「多跳过 / 冻结」而非「误编号」，且可见可恢复，故接受。
2. **区域内残留的分区域分治**（本次最细的一条决策，用户拍板 + 设计审查共同收敛，spec §3.17）：
   标题被**事后**包进区域后，WJ 前缀会留在里面。两类区域**故意给不同待遇**——

   | 区域 | 自动重编号 | 显式清除命令 |
   |---|---|---|
   | 注释块 | **清掉** | 清掉 |
   | 围栏代码块 | **原样冻结** | 清掉 |

   理由：**注释块是隐藏散文**，里面的 WJ 残留在阅读视图根本不可见、用户肉眼永远找不到，
   插件清掉自己留下的东西是安全的；**围栏是字面内容**，日常编辑绝不能改写——否则一段
   「演示本插件 WJ 格式的代码块」会在敲字过程中被静默吃掉。但**清除命令必须两类都清**，
   否则注释里那份不可见残留会挺过「清除全库编号」，直接违背标记契约「永远可退出 / 精确剥净」
   的承诺。判据一律用 **WJ 而非「看起来像编号」**；一行同时属两类时以围栏为准（更保守）。
   实现为 `cleanDemotedResidue` 的 `ResidueScope` 参数，缺省两者 false = 0.7.20 原行为。
3. **固化编号并交还所有权（全库）**（M12，spec §3.18 新节，testplan H9–H12）：编号**原样保留**
   为普通文本、移除全部标记、插件停止接管。入口在敏感操作 TAB 第 4 项 + 二次确认框，
   **刻意不注册命令面板命令**——它比清库更需要防误触（清库清掉的还能重编回来，固化之后插件
   已认不出那些编号是自己写的）。三个非显然点：
   - **必须全文级剥离，不能只处理标题行**。`backlinks.ts` 的 `displayAnchor` 刻意把 WJ 写进
     `[[file#⁠1 ⁠标题]]`（Obsidian 锚点解析按字节比对、不剥 WJ），只剥标题行会让链接侧仍带 WJ、
     与标题字节对不上 ⇒ **全库内链集体断链**。两侧同步归零才对。H9 用例把这条钉死。
   - **停止接管需要硬闸，只关 `autoNumber` 不够**：`shouldAutoTrigger` 里 `fm === true` 在全局
     开关**之前**返回 true，带 `obsidian-auto-headings: true` 的文件固化后一编辑就会在已成普通
     文本的编号上再叠一层 ⇒ 双重编号。故新增 `settings.retired`，闸放在该函数**首行**。
     刻意**不动 `autoNumber`**（那是用户偏好，恢复接管时不该要他重设）——与清库 H7 刻意相反。
   - **恢复路径复用既有机制、零新建**：解除 retired 后，固化编号因已无 WJ 被
     `hasUnclaimedForeignNumbering` 判为外来编号，`guardForeignNumbering` 命中并跳过写入；
     用户跑既有的「清理非本插件的标题编号」即可干净重编。
   - **离场状态必须可见**：`retired` 时全局设置页顶部显示提示条 + 「恢复接管」按钮
     （`.ah-retired-banner`）。离场后下面那个「全局自动编号」开关即便开着也没有任何效果，
     没有这条提示用户只会觉得「插件坏了」——这是本功能最容易砸掉信任的地方。
4. **`stripWordJoiners` 从 `clipboard.ts` 迁到 `strip.ts`**（`WORD_JOINER` 的定义处）：它现在同时
   服务剪贴板净化与固化离场，不再是剪贴板专属。原处 re-export，既有 import 与单测零改动。
5. **文档**：spec 新增 §3.17/§3.18 + §2 边界表加一行 + M12 两条勾掉；`marker-contract.md` §1 给
   「无 WJ ⇒ 插件从未碰过」加了**固化**这个新例外（这是对下游的语义变更，必须写进契约）、
   §5「干净卸载」扩为 A/B 两条路；两版 README 的「如何干净地离开」同步；**订正 README 关于
   Number Headings 的说法**——它久拖未决的两条呼声（按文件夹排除编号、注释块跳过）**现在都已实现**，
   原文还写着「都在路线图上」。新增 `doc/release-notes/1.0.14.md`。

**没做什么**：**UVM 激励未扩到注释块**——按设计审查的落地顺序，先做 DUT + 静态用例并让**现有 UVM 套件
一行不改跑全绿**（这本身即零回归证明，已达成），扩激励另起一个 commit。扩之前必须先拆三颗雷：
① `SAFE_FRAGMENTS`/`MESSY_FRAGMENTS` 若含未配对的 `%%` 或裸 `<!--`，`editTitleInPlace` 会在标题行
开启未闭合注释、遮蔽下方全文 ⇒ 参考模型必然假红；② `deleteLine` 删注释定界行与既有围栏失衡同因同果，
`deletable` 过滤需同步扩；③ R3 形态标题会把 `%%` 带进 backlink 往返（`oracles.ts` 现只排除 `[[]#|`），
应先只进 explore 池。H12（确认框文案与离场提示条）是 GUI 手验，保持 🔲。

**验证方式**：`npx tsc -noEmit` ✅；`npm test` **438 通过**（新增 25 条注释块用例 + 6 条固化用例全绿），
唯一红灯仍是 `whitelist.test.ts:406` 的本机 ICU collation 既知假红；`npm run lint` ✅；
**`npm run test:fuzz --runs=5000 --ops=80` 两块记分板全绿（4.64s）**——核心逻辑（`scan.ts` +
`cleanDemotedResidue` 重写）在大规模随机状态转移下稳定。零回归的结构性论证：UVM 激励不产生注释块，
故 `inComment` 恒 false，加上自动路径 `fences: false`，行为与 0.7.20 逐字节一致。
另：三条断言「空数组」的已知限制用例本身缺乏鉴别力（解析器整个坏掉也会通过），已给 R5 反向那条
**补了对照组**（去掉 ``` 后必须恢复识别）。

**本周期派发 4 次（quality-gate × 4）**。

**下一步**：打 tag `1.0.14` 发布（`doc/release-notes/1.0.14.md` 已备好）。手验清单交用户：
H12 固化确认框与离场提示条、H9 真库跑一遍确认内链不断、O5f 内置「导出为 PDF」、Dataview 样例真库跑通。
UVM 注释块激励（含上面三颗雷）另起一轮。

---

## 2026-07-19 1.0.13（未 bump）M11 导出验证矩阵实测落地 + 订正两处已上架的错误承诺（Pandoc filter / Dataview `file.headers`）

**背景**：接手做 M11/M12 的「导出 + 离场」四项，本块是其中的**周期 A（导出与 Dataview，纯文档 + 一个
资源文件）**；周期 B（固化离场命令、注释块跳过）另起一块。探索阶段发现**两处已随商店版本发出去的错误
承诺**，于是本周期从「补验证」变成「补验证 + 修错」：

1. **`file.headers` 根本不存在**。README 两版 + `marker-contract.md` §3 + `spec.md` §2.6 都在教用户写
   `WHERE file.headers = "1 模块设计"`，并把查不到归因于 WJ。核对 Dataview 官方 metadata-pages 文档：
   页面隐式字段表里**没有任何标题类字段**——那条查询去掉 WJ 也一样查不到，旧建议在教一个不存在的 API。
2. **`marker-contract.md` §3 的 Lua filter 从未实测**，且自带注释承认会压平标题内联格式
   （`pandoc.utils.stringify`），而 README 已把它作为双重编号的推荐解法。

**做了什么**：

1. **装 pandoc 3.10 + typst 0.15.1**（winget；typst 作 PDF 引擎，避开 MiKTeX 500MB+），跑完整矩阵，
   testplan `O5` 拆为 **O5a–O5g**、其中 a–e 全部 ✅：
   - **O5b 复现双重编号**取证：pandoc 的 `1.1` 叠在插件烧入的 `1.1` 上 ⇒ `1.1 1.1 纯文本标题`。
   - **O5e 此前未知的定论**：`##` 起头的文档 pandoc 按**嵌套深度**而非绝对层级编号（首个 `##` = `1`），
     与插件默认 `topLevel=H2` **恰好吻合**，不产生层级错位——这条以前没人验过，属实测新增信息。
   - **PDF 文本层无 WJ 残留**（O5a）：四份 PDF 的 `ToUnicode` CMap 均不含 `2060`；**配了阳性对照**
     （同批标题里的汉字码位 U+5F15 正常命中）确认探针有效——只会报「没找到」的探针等于没探。
2. **重写 filter → `assets/pandoc/strip-autoheadings.lua`**（新增，不进插件产物）。关键点：WJ 对在
   pandoc AST 里被 `Space` 拆到**不同的 `Str`** 里（`Str"⁠1.2"`/`Space`/`Str"⁠标题"`），所以逐 `Str`
   正则与 stringify 重建**都不可能**正确处理富文本标题——必须遍历 inline 列表。双模式
   （`strip-prefix` 默认 / `-M autoheadings=strip-marker`），兼容旧单哨兵，实测 `<strong>`/`<code>`/
   链接全部存活。**刻意不碰 `Code`/`CodeBlock`**：代码是字面内容，且插件从不往代码里写标记。
3. **Dataview 适配方案**（`marker-contract.md` §3 新增「Dataview」节，英文，受众正确）：列出 WJ 实际
   露头的**三个**入口（`TASK`/`LIST` 的 `section`、链接 subpath、DataviewJS 的 `metadataCache`），
   首推**零转义路线**——编号恒为前缀 ⇒ `endswith()`/`contains()` 天然不受影响。需归一时用
   `regexreplace(x, "\u2060", "")`，**逐环验证过**：Dataview 字符串解析器对 `\u` 原样透传
   （`parse.ts` 的 escapeChar 只特判 `\"` 与 `\\`）→ `regexreplace` 走 `new RegExp(pat,"g")`
   （`functions.ts`）→ 那 6 个字符被正则引擎当 Unicode 转义编译。三环缺一条这个配方就是错的。
4. **顺手修掉一类文档陷阱**：把**可执行配方**里的字面 U+2060 一律改成可见转义文本 `\u2060`
   （`marker-contract.md` 两处旧配方 + 本次新增三处、README 两版的剪贴板配方、夹具自检命令）。
   不可见字符写在「让用户复制」的代码块里，等于给用户一段看不见也验不了的东西。
   **「字节格式图示」行刻意保留字面字符**（`marker-contract.md` 26/29/38、README 121、spec 叙事若干），
   两类用途不同，不要一刀切。
5. 新增夹具 `tests/user_tests/10-导出与Pandoc兼容.md`（双哨兵 / 含内联格式的标题 / 旧单哨兵 /
   `##` 起头 / 未编号对照组），兼作 O5f 内置导出手验样例。

**没做什么**：未 bump（`src/` 一行未动，无行为与产物变化，按 §4.1 上架后策略不推空更新给线上用户），
未重建 `release/`。**O5f（Obsidian 内置「导出为 PDF」）与 O5g（Publish 锚点）没做也不能做**——前者是
Electron 对阅读视图 print-to-PDF、与 pandoc+typst 是**两条不同链路，结论不可外推**，需真机手验；
后者无 Publish 订阅。两格保持 🔲，README 也照实写「仍未验证」，**没有拿 pandoc 的绿去糊内置导出的格**。

**验证方式**：矩阵五格实跑并留存真实输出（PDF 文本层探针配阳性对照）；DQL 转义链条三环逐环查证
（两环读 Dataview 源码、一环本地 node 复算——**第一次本地复算因 bash/JS 双层转义把反斜杠吃掉，
测的是「WJ 匹配 WJ」这种恒真命题，改用脚本文件重测才拿到真结果**，同类翻车本周期共两次，
另一次是往 spec 里写配方时又写成了字面字符，均已用「落盘后重读校验」的脚本兜住）；
`npm run lint` ✅ / `docs --check` ✅；`npm test` 408/409（唯一红灯是 `whitelist.test.ts:406` 的本机
ICU collation 既知假红）；`format:check` 红的 12 个文件**全部是我没碰过的**、且 `git diff` 证实
零内容差异（纯 CRLF 工作副本噪音，CI 以 LF 检出为准）。

**本周期派发 5 次（Explore × 3、Plan × 1、quality-gate × 1）**。

**下一步**：周期 B——固化编号并交还所有权（全库）+ 注释块跳过与分区域残留清理，届时 bump 1.0.14
并重建 `release/`。手验清单交用户：O5f 内置导出、Dataview 查询样例在真库跑通。

---

## 2026-07-18 1.0.13（未 bump）UVM 压测框架拆分（1686→9 文件）+ 修 Windows 上失效的 test:fuzz + 订正过期框架文档

**背景**：外部评审给 UVM 压测引擎 8.5/10，指出三条边界 + 一条工程隐患。核查后**三条边界均不动代码**——
它们都已在仓库内明确记录（参考模型复用 build 路径是刻意取舍、幂等 oracle 的分工见 uvm/README，
「明确不入 UVM」清单见本文件 testplan §4 尾部），评审是在复述而非发现。重建一套独立编号实现作参考模型
属高成本低回报（会变成第二处需同步维护且必然漂移的真相源），**不做**。真正落地的是第四条 + 两处评审
没发现的实缺陷。

**做了什么**：

1. **`framework.ts` 1686 行拆成 9 个文件**（原为全仓库最大文件，超过 `main.ts` 1286，违反 CLAUDE.md §3
   「~500 行且多职责 = 拆分信号」）：`framework.ts`(533，World 状态 + step/finish/trigger + runSequence，
   仍是唯一入口并 re-export 公共 API) / `operations.ts`(262) / `config-ops.ts`(317) / `oracles.ts`(246) /
   `coverage.ts`(191) / `stimulus.ts`(111) / `config.ts`(98) / `model.ts`(61) / `rng.ts`(41)。
   `World` 的方法体外移为接收 world 句柄的自由函数、类内保留一行委托，故 `step()` 等调用点零改动；
   三个新模块用 **`import type { World }`** 引入（编译期擦除）保证运行时依赖图单向无环。
   `random_sequence.test.ts` 一行未改。
2. **纯搬运的验收方式（可复用）**：RNG 是种子化 mulberry32 ⇒ 序列完全确定。改动前先采集**黄金基线**
   （DEFAULT_GEN + EXPLORE_GEN 各 500 seeds × 60 ops，dump 每个 seed 的 World 终态全字段 + Coverage
   累加器指纹，8MB）。Phase 1（外移常量/Coverage）与 Phase 2（拆 World）后各比对一次，**md5 全程一致**
   （`4b4552b2…`），实锤 rng 调用序列未被扰动。采集用的临时用例已删。
   > 踩坑记录：`JSON.stringify` 对 `Map`/`Set` 默认产出 `{}`，会**静默掏空指纹**——`Coverage.numerals`
   > 是 Set、`Coverage.ops` 与 `World.lastResolved` 是 Map，replacer 里必须显式处理。首版漏了 Set，
   > 54 个 bin 里只有 1 个是真数字，差点拿一张假的安全网去做重构。
3. **修 `npm run test:fuzz` 在 Windows 上长期失效**：原命令用 POSIX 前缀赋值
   `AAH_FUZZ_RUNS=5000 … vitest`，而 npm 在 Windows 默认走 `cmd.exe`（`script-shell` 未配置），
   该语法直接是语法错误 ⇒ CLAUDE.md §4 第 4 步「动核心逻辑后额外跑一遍 test:fuzz」在本机**一直没生效**。
   新增 `scripts/fuzz.mjs`：以 `process.execPath` 直接拉起 vitest 的 ESM 入口（免 npx / 免 `shell:true`，
   参数不会被二次拆词），注入 `AAH_FUZZ_*`，**透传退出码**（已实测失败场景返回 1，否则 CI 会把失败当通过），
   支持 `--runs=/--ops=/--seed=`。超时从 120s 放宽到 600s（`--runs=20000` 时原值不够）。**不引入 cross-env 依赖**。
4. **订正 `uvm/README.md` 的过期描述**（评审没发现；过期的地图比大文件更坑接手 Agent）：
   ① explore 标注「进 CI？否（`it.skip`，会撞 U1/U2/U3）」——实际 0.6.7 起已转正、每次 `npm test` 都跑，
   且 U1/U2（0.6.3）、U3（0.6.6 方案A）、U4（0.6.7）**全部已修**；② 称 explore 由 `AAH_FUZZ_MODE=explore`
   切换——该变量早已无门控效果；③ 写「默认 400 条 × 40 步」——实际 500×60；④ explore 序号样式漏了
   roman（黄金基线的 coverage dump 实测为 arabic/circled/cjk + lower/upper-alpha + lower/upper-roman）。
   另把「参考侧…**不会和 DUT 一起错**」这句过度声明改准确：它不会与 DUT 各自演化出分歧，但对**共因错误**
   （两侧对同一条规则一起理解错）没有免疫力——这正是 S7 另配独立参考模型 `indepMatch`/`indepSpec` 的原因。
   新增「文件分工」节。
5. **下沉 `framework.ts` 顶部历史升级段落**（同批用户追加要求）：顶部设计注释里 0.6.2/0.6.5/0.7.1/0.7.5/
   0.7.6 五段「升级」叙事经核查**在 `log-archive.md` 对应版本条目已有完整周期块**（做了什么/压测结果/
   没做什么一应俱全）——原叙事是重复记录而非新信息，违反 CLAUDE.md §3.1 单一事实源纪律。删除四段
   `0.6.5`/`0.7.1`/`0.7.5`/`0.7.6` 详细叙事（`0.6.2` 一段本就只是「两种模式」现状说明，只去掉版本号
   标题、留主体），代之以一句「历史演进」指针段落，指向 `log-archive.md` 五个版本条目 + `testplan.md`
   §3.2（bug 状态权威源）。纯注释删减，零逻辑变化。

**没做什么**：未 bump（按 CLAUDE.md §4.1 上架后策略：只碰 `tests/` `doc/` `scripts/`，`src/` 一行未动、
无行为与产物变化，故不推送空更新给线上用户），未重建 `release/`。未重建独立参考模型（理由见背景）。
未动任何 oracle 语义 / 约束表 / 覆盖率 bin 定义。`framework.ts` 现 486 行（< 500），历史升级叙事已下沉。

**验证方式**：黄金基线逐字节比对（Phase 1 / Phase 2 各一次，md5 全程一致）；`npm test` 409/410 通过
（唯一红灯是 `whitelist.test.ts:406` 的本机 ICU collation 预存噪音，CI 为准）；
**`npm run test:fuzz` 5000×80 两块记分板全绿（4.7s）**——这条同时实证了新脚本在 Windows 上真能跑；
`eslint` + `prettier --check` 对 `tests/dev_tests/uvm` 全绿；注释下沉后**重跑一遍同一质量门槛**确认
纯文档改动未引入回归（仅改 `/** ... */` 注释文本，语义上不可能影响 rng 调用序列，但仍全量复核）。

**本周期派发 4 次（Explore × 2、feature-coder × 2）**。

**下一步**：接 1.0.13 原有待办——用户真机手验 K15/K16、打 tag `1.0.13` 发布、M12 余项。
UVM 侧 backlog 不变（放开「各模板不同前后缀候选」+ 按活模板动态算剥离并集，探「删含唯一前缀模板 →
旧文件孤儿残留」）；新增可选项：默认模式样式约束（arabic/cjk/circled）的原因已随方案A失效，
可专项放开跑一轮，绿了就删约束。

---

## 2026-07-18 1.0.13 M12 两项落地：批量重编号 +「不编号」伪模板；K14/K14b 手验回填 + 箭头图标统一

**做了什么**：

1. **用户真机手验 1.0.12 通过**（「效果达标」）：testplan K14/K14b 的「手验 DOM」回填 ✅。随手感
   反馈做小改：分层浏览的 `⬅` 返回 / `▸` 下钻改用**同族 lucide 图标**（`setIcon` `arrow-left` /
   `arrow-right`，`--icon-size: var(--icon-s)`，点击区扩大手法不变）。
2. **M12「不编号」伪模板（testplan K15）**：`pathrules.ts` 新增哨兵 `NO_NUMBERING_TEMPLATE = "$none"`；
   `getTemplateForFile` 对哨兵返回无模板（复用「无可用模板」既有语义，自动路径静默跳过、已有编号
   冻结）；伪模板**参与具体度解析并可胜出**（`daily/→不编号` 压过根规则）；手动命令经
   `resolvesToNoNumbering` 弹专用 Notice；`TemplateStore.rename` 拒占哨兵名；GUI 下拉在真实模板后
   固定伪选项，「失效模板」兜底不误伤哨兵。
3. **M12 多文件批量重编号（testplan K16）**：`main.ts` 新增 `batchRenumberRule`——作用域=规则**路径
   模式**命中的全部 Markdown 文件，**每个文件用它自己解析出的模板**；跳过 fm `false` / 未接管外来
   编号（J10 同源）/「不编号」；**已打开文件走编辑器单一事务**（可撤销、无 `vault.process` 竞态），
   未打开走 `vault.process`；backlink 照常同步且改写数**汇总一条 Notice**（`syncBacklinksCounted`
   从 `syncBacklinks` 拆出计数核心 + `notifyBacklinkTotal` 统一出口）。GUI：行内 `list-ordered`
   图标按钮（「不编号」行置灰）+ `BatchRenumberModal` 确认框（显示命中文件数，内联在
   `PathRules.ts`，随 `DeleteTemplateModal` 先例）；表格加第 6 列（grid 28px×2）。
4. **测试**：`main.test.ts` 新增 K15×3 + K16×5 共 8 例（含「点根规则批量不覆盖子规则文件」「编辑器
   通道不被 vault 竞态覆盖」），68 例全过；`pathrules.test.ts` 45 例全过；tsc 干净。
5. **文档**：spec §3.8 新增两段规格 + M12 两项勾选；README 双语补「规则级两件配套工具」段并修
   「没打开的文件永远不会被碰」表述（显式确认的批量操作除外）；release-notes/1.0.13.md 双语。

**没做什么**：K15/K16 的 GUI 手验 DOM 仍 🔲（下拉伪选项观感、批量确认框、批量后实测编号），留用户
真机确认；批量重编号未做进度条 / 取消（命中数极大的库一次跑完，Notice 只在结束时汇总）——如有需求
再立项。

**验证方式**：`main.test.ts` 68 例 + `pathrules.test.ts` 45 例全过（quality-gate 定向）；
`npm run preflight` 全绿（Windows ICU collation 预存噪音除外，CI 为准）。

**本周期派发 3 次（repo-scout × 1、quality-gate × 2）**。

**下一步**：用户真机手验 K15/K16（伪模板下拉 + 批量按钮/确认框）；打 tag `1.0.13` 发布（release
工作流取 `doc/release-notes/1.0.13.md`）；M12 余项（注释块跳过、断链扫描命令、description 重排、
公开 API 改名事件、迁移指南与社区发布）。

---

## 2026-07-18 1.0.12 路径建议弹窗：统一「已配置行再次点击」的外观（K14b，用户实测反馈）

**做了什么**：

1. **用户实测 1.0.11 后反馈**：新增空行进分层浏览外观正确，但**把某行配好 `/` 或 `A/` 后再次点击
   该行**，弹窗又回落成「匹配一堆」的扁平列表——视觉设计与功能设计不统一。
2. **根因**：1.0.11 的模式判断只看「输入框是否为空」（`value.trim() === ""`），配好的行 value 非空
   ⇒ 一律走扁平搜索分支（`/` 经前导斜杠剥离后 needle 为空 ⇒ `filterPathCandidates` 返回全部候选；
   `A/` ⇒ 匹配一堆含 `a/` 的项）。
3. **修复（1.0.12，行为变化已 bump）**：
   - `pathrules.ts` 新增纯函数 `browseDirForInput(value, folderPaths)`——决定该进分层浏览还是扁平
     搜索并返回要浏览的目录：空 / 根 `/`（含 `//`、`\` 归一化写法）/ **真实存在的文件夹（尾斜杠，
     如 `A/`）** → 返回目录路径（`A/` 返回 `A`，浏览**进** A）；正在打字的片段（`Pro`）/ 文件规则
     （`A/note.md` 无尾斜杠）/ 尚不存在的文件夹名 → 返回 `null`（交给扁平搜索）；
   - `PathSuggest.ts` `refresh()` 改由 `browseDirForInput` 决定模式（替换原「是否为空」判断），并把
     `getCandidates()` 结果复用、顺带算出 `folderPaths`；类注释与 spec §3.8 同步。
4. **测试**：`pathrules.test.ts` 新增 `browseDirForInput` 14 例（空/根/真实文件夹/前导斜杠反斜杠/
   打字片段/文件规则/非实文件夹边界），全过；`npm test` 401 通过、`lint`/`format`/`tsc` 全绿。

**没做什么**：DOM 交互仍无自动化覆盖（同 1.0.11），K14b 标 🔲 手验 DOM，留用户实测「配好后再点击
的外观一致性」。

**验证方式**：`pathrules.test.ts` 45 例全过（含新增 14 例）、`npm test` 401 通过、`lint`/`format`
全绿；唯一红灯是本机预存 Windows ICU collation 排序噪音（`whitelist.test.ts:406`，与本改动无关，
CI 为准）。

**本周期派发 1 次（quality-gate × 1）**。

**下一步**：用户实测 1.0.12 分层浏览（含配好后再点击）的完整手感，回填 K14/K14b 手验；M11 其余项
（导出验证矩阵、Canvas O1、E8 拍板、Backlink 审阅模式、H8+清库撤销、CM6 原子区域）。

---

## 2026-07-18 1.0.11 路径规则建议弹窗：分层浏览模式 + 修根候选诡异过滤（用户报告 + 现场调研 numeroflip 源码定案）

**做了什么**：

1. **用户报告两个疑点**：① 路径规则输入框已提交 `/` 根规则后再次点击，下拉建议出现「诡异／又一个
   `/`」的观感；② 建议弹窗希望改成按目录层级点击下钻，而非扁平列出全库。
2. **先复现、后调研、再定案**：① 用纯函数复现脚本实测确认根因——`collectPathCandidates` 手动注入
   的合成根候选 `{path:"",isFolder:true}` 一旦 needle 恰为 `/` 就被自身子串匹配逻辑排除，顶层文件夹
   全部消失、只剩深层嵌套项；② 用户要求先调研参考实现 numeroflip/obsidian-auto-template-trigger 的
   真实逻辑再动手——直接拉取其 GitHub 源码（`fileSuggest.ts`/`suggest.ts`/`Settings.ts`）确认
   `FolderSuggest.getSuggestions` 是**扁平**子串模糊匹配（非分层）、`folder.path &&` 显式排除根目录、
   点击即选中并 `close()`；该插件**没有**文件级规则（只有文件夹→模板）。据此推翻了此前给出的
   「点击=下钻、专门一行选中当前层」分层方案初稿，改为「点文字＝选中（贴合参考实现默认手感）、
   文件夹行小箭头＝下钻（新增能力，不冲突）」——与用户讨论 ASCII 手绘两版交互后拍板。
3. **实现（1.0.11，行为变化已 bump）**：
   - `pathrules.ts`：新增纯函数 `parentDir`/`listImmediateChildren`（分层浏览用）；
     `filterPathCandidates` 的 needle 剥离前导 `/`（本就是根锚点写法，非字面字符，K14 根因之一）；
   - `PathRules.ts`：`collectPathCandidates` 不再注入合成根候选（对齐参考实现）；
   - `PathSuggest.ts`：加状态机——输入框为空进「分层浏览」（header 显示当前层路径且点击选中该层、
     非根层加 `⬅` 返回上一级；子项文件夹优先字典序列出，行文字点击＝选中，文件夹行小箭头 `▸`＝
     下钻；ArrowLeft/Right 键盘辅助）；有输入内容沿用既有全库模糊搜索；一打字即退出浏览、清空
     回空输入重新从根开始（不记忆上次深度）；
   - `i18n.ts` 新增 4 个中英文案；`styles.css` 新增 header/back/chevron/empty 样式（小箭头用
     padding+负 margin 扩大点击区，不撑大行内视觉比例，回应用户「小箭头不要太小」的要求）。
4. **测试**：`pathrules.test.ts` 新增 38 例（`parentDir`/`listImmediateChildren`/
   `filterPathCandidates` 前导斜杠场景），全过；`tsc --noEmit`/`lint`/`format` 全绿。

**没做什么**：`PathSuggest.ts` 的 DOM 交互（点击/下钻/返回的真实手感）无自动化测试覆盖（仓库现状
如此，`PathRules.ts`/`PathSuggest.ts` 一直没有 DOM 级测试），留用户在 Obsidian 里实测确认——
testplan K14 标记 🔲 手验 DOM。

**验证方式**：`pathrules.test.ts` 68 例全过（含本次新增 38 例）、`tsc --noEmit`、`npm run lint`、
`npm run format` 全绿；`npm test` 唯一红灯是本机预存 Windows ICU collation 排序噪音
（`whitelist.test.ts:406`，与本次改动无关，CI 为准）。

**本周期派发 1 次（quality-gate × 1）**。

**下一步**：等用户在真实 Obsidian 环境里实测分层浏览的点击/下钻/返回手感，回填 K14 手验结论；
M11 其余项（导出验证矩阵、Canvas O1、E8 拍板、Backlink 审阅模式、H8+清库撤销、CM6 原子区域）。

---

## 2026-07-18 1.0.10 复制净化落地：同步净化 + 内存映射双通道（用户拍板新方案，claude/clipboard-paste-spike-impl）

**做了什么**：

1. **方案翻案（用户认可后定案）**：spike 判死的只是「从 OS 剪贴板读自定义格式」；「是不是我们
   净化过的内容」这一判断改问插件自己——copy/cut 净化时把 `规范化(净化文本) → 原文` 记入**插件
   内存 LRU**，paste 时同步读 `text/plain`（标准格式在 paste 事件语境同步可读，spike 已证）查表，
   命中才 `preventDefault()` + 还原原文。双通道复活，隐藏通道从 OS 剪贴板搬进内存；原「不接管
   paste、O9 降已知限制」的 2026-07-15 裁定被本方案取代。`spec.md` §2.8 整节改写（spike 实测
   保留为历史依据），§2.6「剪贴板投毒」行改记「主动消解已实现」，Roadmap M11 该项勾选。
2. **实现（1.0.10，行为变化已 bump）**：
   - 新增 `src/clipboard.ts`（纯逻辑：`stripWordJoiners`/`stripWordJoinersFromHtml`/
     `normalizeClipboardText`/`ClipboardOriginalCache` LRU，条数 50 + 总字符 2M 上限，仅内存
     不持久化——隐私考量见 spec §2.8）；
   - `main.ts` 接线：`registerClipboardSanitizer`（copy/cut 冒泡监听，主窗口 + window-open
     弹窗；`defaultPrevented` 区分 CM6 编辑器路径=覆写 text/plain+text/html 并记 LRU、阅读模式
     路径=DOM 选区自构造净化 payload 不记 LRU）与 `restoreSanitizedPaste`（editor-paste 五道
     同步守卫：他人已处理 / 未命中 / 目标编号未生效 / 多光标 / 开关关，全过才整段还原原文）；
   - 设置开关 `sanitizeClipboard`（默认开，GeneralTab + i18n 中英 + loadSettings 迁移兜底）；
   - README 双语：「粘贴到其他应用」改为已消解 + 开关位置，「导出与外发」复制行改「已消除」。
3. **测试**：`tests/dev_tests/clipboard.test.ts` 28 例——纯函数 / LRU（含 CRLF 规范化命中、
   逐出与刷新序、超限不驻留）/ O9 内容级回归（还原→重排等价裸文本追加、反例出现 `3 1` 双重
   编号证明还原必要）/ 插件级 copy/paste 守卫矩阵（经 obsidian-mock 直调私有方法）。
   `testplan.md` O8/O9 改写为新方案并升 ⚠️（逻辑已单测、实机待 §7.1），O10 改写降级语义。

**没做什么 / 环境注记**：O4/O8 实机字节检查、O10 移动端实机仍待 §7.1 环境。本机（Windows）有
两处**预存**环境性红灯，与本次改动无关、CI（Ubuntu）为准：① `whitelist.test.ts:406` 排序断言
随本地 ICU collation 失败（stash 干净基线复现）；② `format:check` 对未跟踪 `.codex/`、`.claude/`
配置与部分历史文件报换行符差异。本次触碰的全部文件已单独 `prettier --check` 全绿。

**验证方式**：`clipboard.test.ts` 28/28、`npm run lint`、`test:fuzz` 5000×80、触碰文件
prettier 全绿；`npm test` 除上述预存红灯外全过；合并后以 master CI 结果为最终门槛。

**追记（同周期第二笔提交）**：Release 工作流升级——`gh release create` 的说明优先取仓库内
`doc/release-notes/<tag>.md`（人写双语说明、随代码入库可追溯），缺文件回退 `--generate-notes`；
新增 `doc/release-notes/1.0.10.md`（本版复制净化的用户向双语说明）。动机：本机无 gh CLI，
发布说明走「入库 + CI 发布」通道，顺带沉淀为常设机制。

**本周期派发 3 次（quality-gate × 3）**。

**下一步**：M11 其余项（导出验证矩阵、Canvas O1、E8 拍板、Backlink 审阅模式、H8+清库撤销、
CM6 原子区域）；§7.1 实机环境就绪后回填 O4/O8/O9/O10 实测结论。

---

## 2026-07-15 1.0.9 剪贴板 WJ 净化：paste 端 spike 完成，OS 剪贴板隐藏通道判死（Codex 会话，claude/clipboard-paste-spike-impl；收尾由 2026-07-18 会话补记）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **paste 端真机 spike**：在真实 Obsidian 桌面客户端（Electron 37.10.2 / Chromium
   138.0.7204.251，Windows）DevTools Console 实测四步，结论回填 `spec.md` §2.8：
   - `event.clipboardData.types`（同步）与 `paste` 事件内的异步 `navigator.clipboard.read()`
     **都看不到** `"web "` 自定义格式（只见 `text/plain`）——Chromium 对 paste 事件语境的既有
     安全限制，非本地环境异常；
   - `keydown` 层拦截后事件外 `read()` **能**读到自定义格式（证明写入本身成功），但该方案要求
     无差别接管所有 Ctrl+V 并合成 `paste` 事件（`isTrusted=false`），跨插件兼容风险与功能定位
     不成比例，否决。
2. **范围裁定（用户决策）**：paste 端不接管，只做 copy/cut 端净化；O9（粘贴回同 vault 已编号
   文件的双重编号）降为已知限制。

**没做什么**：未写代码；本周期收尾三件套（log 块 / status 行 / 提交）当时缺失，由 2026-07-18
接手会话补记——**该裁定随后即被 2026-07-18 周期的「内存映射双通道」新方案推翻**，见上一块
（倒序在本块之上）；本块保留 spike 实测事实作为历史依据。

**验证方式**：纯文档改动；spike 结论以 `spec.md` §2.8 回填文本为准。

**本周期派发 0 次**（Codex 会话直接实测）。

**下一步**：按裁定实现 copy/cut 端净化（后被新方案取代，见后续周期块）。

---

## 2026-07-10 1.0.9 剪贴板 WJ 净化：3 个留白问题拍板 2 个（用户指示，claude/clipboard-wj-pollution-mecppf）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **PR #5 已建并订阅**（上一周期，`claude/clipboard-wj-pollution-mecppf` → `master`，草稿）：
   CI 绿、无 review 评论，承接本周期继续讨论。
2. **对 spec §2.8 留白的 3 个问题逐一讨论，定案 2 个、1 个转为「实现周期第一步 spike」**：
   - **copy/cut 端触发判断（定案）**：监听器只能全局挂载（无从预知选区内容），内部第一步做同步
     廉价判断——选区文本 `.includes(WORD_JOINER)` 为假即完全放行、为真才 `preventDefault()` 接管；
     不做「是否完整标题行」的结构解析，净化对任意字符串都成立。
   - **隐藏通道 payload（定案）**：存完整原始选区文本，不用「净化文本+WJ 位置索引」差异编码——
     省空间在此没有真实约束，索引方案想兜底的「外部改过再粘贴回来」场景本该走「找不到隐藏通道
     即当新内容处理」的降级路径，不需要索引介入。
   - **paste 端触发判断 + `clipboard.read()` 权限提示（合并为一个未定案问题）**：
     `preventDefault()` 必须同步调用、但「有没有隐藏通道」的判断要么靠 `clipboardData.types`
     同步可见性、要么靠异步 `read()`——这两条路都没有查到 Obsidian/Electron 环境下的确切行为，
     必须在真实 Obsidian 渲染进程里跑最小 spike 实测，结果直接决定 paste 端最终方案（或降级到
     「只做 copy 端净化、不接管 paste」，但那样会带回「粘贴回已编号 vault 双重编号」的已知回归）。
3. **`doc/spec.md` §2.8 回填三段讨论结论**，把「留给实现周期拍板的问题」从 3 项收窄为 1 项（paste
   端 spike），copy/cut 端与隐藏通道两项已可直接按定案实现，不需要在下个编码周期重新讨论。

**没做什么**：仍未写代码——spike 本身也是下个周期的第一步工作，不在本轮纯讨论周期做。

**验证方式**：纯文档改动，无代码变更；`npm run docs` 归档 + 内部锚点校验。

**本周期派发 0 次**（用户全程直接对话讨论）。

**下一步**：合并本 PR 到 master（用户本轮已指示）；下一个编码周期开工第一步是 paste 端 spike
（验证 `clipboardData.types` 同步可见性 + `clipboard.read()` 权限提示行为），根据结果实现桌面端
双通道 copy/paste 钩子并补单测（重点 O9 双重编号回归），移动端能力探测降级路径同期实现。

---

## 2026-07-10 1.0.9 剪贴板 WJ 净化：技术选型定案（用户指示，claude/clipboard-wj-pollution-mecppf）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **承接上一周期的遗留讨论**（剪贴板 WJ 污染净化，见 status 首行 `next`）：本周期继续只讨论
   方向，验证了「插件能否识别被清除 WJ 的内容」这一悬而未决的前提——答案是**不能安全识别**：
   `hasUnclaimedForeignNumbering`（`src/cleanup.ts:112-118`）的外来编号探测是**全文件级**的，
   只要目标文件别处还有一个 WJ 就不生效；净化后的无 WJ 内容粘贴进已编号 vault 会被 `stripPrefix`
   当纯正文、叠加新前缀，产生 `## 2 1 标题` 式双重编号（与 U1/U2/J10 系列历史 bug 同构）。据此
   否决了「单通道净化」（复制时无条件清 WJ），转向「双通道」方向。
2. **摸清双通道的技术选型**（WebSearch 调研 + 用户拍板）：
   - Electron 原生 `clipboard.writeBuffer` 一次只挂一个自定义格式、与 `writeText` 无法原子共存
     （Electron issue #41462 未解决），**不适用**。
   - 改用标准 Async Clipboard API（`navigator.clipboard.write` + `ClipboardItem`），自定义格式走
     `"web "` 前缀（Chrome 104+，Obsidian Electron 内核远超此版本），对外部应用默认不可见。
   - Obsidian 官方论坛确认插件在 Android/iOS WebView 沙箱内写自定义剪贴板数据默认被拦截——
     **移动端只能靠运行时能力探测 + 静默完全跳过**，不能退化成单通道（会重现①的双重编号 bug）。
3. **设计落盘 `doc/spec.md` §2.8「剪贴板净化设计」**（新增小节，2.6/2.7/目录/Roadmap M11「复制
   净化开关」条目同步链接）：范围边界（只覆盖交互式 `copy`/`cut`，不含 Pandoc/静态站点生成器/
   Publish 等文件级导出——那类工具直接读磁盘、不经过剪贴板事件，已由 M11「导出验证矩阵」与附录
   A §A.5 单独覆盖）、copy/paste 两端设计、移动端能力探测降级、降级默认值（任何一步失败一律不
   介入、维持现状，不做单通道半吊子方案）、三个留给实现周期拍板的未决问题。
4. **`doc/testplan.md` §O 补场景**：O8（桌面端外部粘贴净化）/ O9（粘贴回已编号 vault 验证双通道
   避免双重编号）/ O10（能力探测失败静默跳过），O4 改写为指向三者的入口行。

**没做什么**：仍未写任何代码——用户本轮要求「先规划如何开工、文档写好」，不是实现。三个「留给
实现周期拍板」的问题（触发范围、隐藏通道 payload 内容、`clipboard.read()` 是否弹权限提示）故意
留白，等下一个编码周期在真实 Obsidian 渲染进程里边做边定，不在纯设计阶段瞎猜。

**验证方式**：纯文档改动，无代码变更，不适用 `npm test`/`lint`；`npm run docs` 归档 + 内部锚点
校验（新增 §2.8 锚点 `#28-剪贴板净化设计m11复制净化开关技术选型2026-07-10-定案未实现` 与
Roadmap/testplan 三处引用手动核对一致）。

**本周期派发 0 次**（用户全程直接对话讨论 + 主模型自己读代码验证 `hasUnclaimedForeignNumbering`
判据范围，未派 SubAgent）。

**下一步**：进入实现周期——按 spec §2.8 设计实现桌面端双通道 copy/paste 钩子，拍板三个留白问题，
补 `tests/dev_tests/` 单测（重点覆盖 O9 的双重编号回归）与 O8/O10 的实机验证方式；testplan O8–O10
状态回填。其后回到 M11 其余项（导出矩阵、Canvas O1、E8、审阅模式、H8+清库撤销、CM6 原子区域）。

---

## 2026-07-10 1.0.9 Backlink 两开关合一（用户指示，claude/backlink-switch-consolidation-j7mol6）

**做了什么**：

1. **设置模型合并**（`src/settings/model.ts`）：删除 `backlinkStandaloneTrigger` 字段与
   `DEFAULT_SETTINGS` 对应默认值；`updateBacklinks` 字段注释改为「全局生效，与是否命中编号模板 /
   是否实际写入编号无关」。
2. **触发逻辑合并**（`src/main.ts`）：`shouldBacklinkStandaloneTrigger` 判据从
   `!backlinkStandaloneTrigger || !updateBacklinks` 简化为仅 `!updateBacklinks`——独立于编号模板的
   触发路径（CR-18）不再需要额外 opt-in，随总开关一起全局生效；仍受 frontmatter `false` 与
   `vaultClearInProgress` 约束（未变）。`loadSettings` 迁移逻辑删掉旧字段的默认值回填，改为
   `delete merged.backlinkStandaloneTrigger` 清理存量 data.json 里的死字段。
3. **GUI 精简**（`src/settings/tabs/GeneralTab.ts` + `src/i18n.ts`）：删除第二个开关
   「无模板/未编号时也同步链接」（`backlinkStandaloneTriggerName/Desc`，中英文接口 + 两语言实现）；
   保留的「同步内部链接（Backlink）」开关描述改写为说明「全局生效，与是否编号无关」，用户不再需要
   理解两层开关语义。
4. **测试同步**（`tests/dev_tests/main.test.ts`）：测试辅助 `PluginInternals`/`makePlugin` 选项删除
   `backlinkStandaloneTrigger` 字段；原「M19–M25」用例矩阵重写为「M20–M25」——M19（独立触发关+无模板）
   与 M23（总开关关）语义合并（现在只有一个总开关，关闭即两种效果都不触发），其余用例改为断言单开关
   下的全局生效行为，不再传 `backlinkStandaloneTrigger` 选项。
5. **文档同步**：`doc/spec.md` §3.12 三处（`updateBacklinks` 设计原则段、CR-18 详述段、CR-18 表格行）
   + Roadmap M12 打勾项，改写为「1.0.8 落地独立开关 → 1.0.9 并入单开关」的演变叙事，说明两层开关是
   「无谓认知负担」；`doc/testplan.md` §M 开头 blockquote + M19–M26 场景行同步重写，删除 M19（并入
   M23）与 M26（GUI 面板行，因第二个开关已不存在）。

**没做什么**（用户明确本轮范围之外）：剪贴板 WJ 污染问题（复制到 Obsidian 外应清除所有 WJ 标记、
复制到 Obsidian 内应保留 WJ 以便识别「这是本插件已编号的内容」避免重复编号）本轮**只讨论不动代码**——
用户原话「干净导出属于讨论任务」。现状：`main.ts` 依旧无任何 `clipboard`/`copy`/`paste` 事件钩子
（`repo-scout` 定位确认），该问题连「插件能否识别被清除 WJ 的内容」这一前提都未探明，留待后续周期
单独立项讨论（候选落点：spec.md §2.6 已知生态兼容性风险 或 M11 信任包「复制净化」项，见 status.jsonl
`next`）。

**验证方式**：`npm test`（359 通过）/ `npm run lint` / `npm run format:check` 三项全绿（quality-gate
子代理跑的收尾档）；`npm run release` 重建 `release/` 三件套 + zip，`tsc -noEmit` 随 build 隐式过一遍
类型检查（设置模型删字段后接口收窄，若有遗漏引用会在此处报错，实测无报错）。未做 Obsidian 内实测
（远程环境无 GUI，纯代码 + 单测层面验证）。

**本周期派发 2 次**（repo-scout ×1 定位两开关与 WJ 剪贴板现状、quality-gate ×1 收尾档 test+lint+format）。

**下一步**：M11 信任包内「复制净化」讨论——需要先探明「插件能否从被清除 WJ 的编号标题正确识别/恢复
编号状态」这一前提是否成立，成立的话方案可以简化（无需区分粘贴目的地，插件自适应识别即可）；不成立
再回到「复制到 Ob 内保留 WJ / 复制到 Ob 外清除 WJ」的双路径设计。

---

## 2026-07-10 1.0.8 SubAgent 派发体系落地 + 清理 sync-plugin-repo 迁移遗留（claude/subagent-harness-dispatch）

**做了什么**（纯 harness/文档周期，无插件行为变化，按上架后策略不 bump）：

1. **CLAUDE.md §0 从三行准则改写为可执行派发协议**：派发表（任务类型 → agent → 返回上限）、
   输出契约（结论先行 / file:line / 禁整段粘贴 / 超长返工）、升级路径（haiku 两败 → sonnet → 主模型）、
   主模型保留事项清单。
2. **新建 `.claude/agents/` 四个仓库级定义**（随 git 入库）：`quality-gate`（haiku，跑质量门槛压缩返回，
   分验证档/收尾档）、`repo-scout`（haiku，内置 §3 定位菜谱的检索员）、`mech-editor`（haiku，机械改动，
   带禁区清单 + 歧义即停）、`feature-coder`（sonnet，边界清晰的编码，testplan-first，收尾归主模型）。
3. **删除已失效的 `scripts/sync-plugin-repo.mjs`**（引用不存在的 `publish/` 目录跑必崩，职能已被
   `release.yml` tag 发布工作流取代）+ 删 `package.json` 的 `publish:repo` + 修缮本文件目录树块
   （删 publish/ 与 sync-plugin-repo 两行、补 `.claude/agents/` 行）。此项由 mech-editor 试点执行。

**没做什么**：feature-coder 定位存疑（价值是上下文隔离而非省钱）——按约定观察 2~3 个周期，
使用率为零则删；新 agent 定义**本会话不生效**（注册表会话启动时固定），`/agents` 加载确认留待下个新会话。

**验证方式（A/B 实测）**：全绿时 `npm test` 完整输出 89 行 vs quality-gate 契约 ≤25 行（失败时全量
输出会膨胀数百行，收益更大）；repo-scout 试点查 spec §3.11 走了 grep+sed 菜谱而非整读 178KB 文件，
~2.8 万 token 检索开销隔离在子上下文；mech-editor 试点三处改动 diff 抽查干净、`docs.mjs --check` + lint 绿。
quality-gate 试点跑收尾档 preflight：4 项通过，唯一 test 失败为既有 ICU 环境差异（`whitelist.test.ts`
filterSortWhitelist，前两周期已登记非回归）；release/ 无变化，佐证不 bump 正确。

**本周期派发 3 次**（mech-editor ×1、repo-scout ×1、quality-gate ×1 收尾档 preflight）。

**下一步**：不变，M11 信任包（见 status 首行）；顺带在下个编码周期实测 4 个 agent 的会话内加载与派发表执行率。

---

## 2026-07-10 1.0.8 文档体系重整：grill 收编 spec 附录 A + 叙事倒转 + M0–M7 压缩 + 移除跨项目沉淀（claude/doc-consolidation-grill）

**做了什么**（纯文档周期，无 `src/` 改动，按上架后策略不 bump）：

1. **删除跨项目知识沉淀**：`doc/harness-workflow-ic-verification.md` 与 `doc/workflow.html`（用户
   指示，内容与插件规格无关）；log.md 目录结构约定块同步。
2. **grill.md 收编为 spec 附录 A**（用户指示，替代此前「长期独立保留」决定）：全文标题降级
   （§N → §A.N）、内部自指补 `A.` 前缀、对 spec 的指称改「本文」；spec 内 11 处
   `[grill.md](./grill.md)` 引用改附录锚点；CLAUDE.md §3.1 表删行；testplan §O 来源注与
   marker-contract.md 定位注改指附录；原文件删除。
3. **spec 叙事倒转落到门面**：顶部简介与 §1 背景改为「① 改标题不断链（第一价值，全社区最可靠的
   改名检测引擎）② 最强编号（第二层价值，burn-in 哲学）」两层结构，链接附录 A §A.1 论证；如实
   标注 CR-18 开关默认关、「装上即不断链」零配置目标待稳定后翻默认兑现。
4. **Roadmap M0–M7 压缩**：八个已完成里程碑 93 行 checklist 压为 16 行单表（细节指向本文各功能节
   与 log-archive，不留双份），Community Hub 提交机制保留一行；执行顺序表状态更新为
   「已通过官方审核，商店正式上架」（用户 2026-07-10 确认）。
5. **CR-18 全文状态回填**：§2.1 需求表、§3.12 设计段、M12 首项三处标注 1.0.8 落地（开关
   `backlinkStandaloneTrigger` 默认关、常规路径已处理本轮时不重复跑、testplan M19–M26）。
6. **锚点全量修复**：修 14 处含 `.` 的既有死锚点（GitHub slug 删点号：`m71.0`→`m710`、
   `0.7.20`→`0720`、`burn-in-m10`→`burn-inm10`）；目录补 §2.4–2.7 与附录 A 条目；§3.12 一处
   已失效的「M8 backlog」死链改指 M12。

**没做什么**：README 未按叙事倒转改版（与截图/GIF 一起做，需用户桌面环境）；manifest description
卖点重排仍按 M12 计划随下一个行为版本 bump；marker-contract.md 维持独立英文文件（用户拍板：下游
可见性本身是信任叙事的一部分）。

**验证方式**：自写脚本校验 spec 全文内部锚点 0 死链（58 个标题）；`node scripts/docs.mjs --check`
通过；`npx prettier --check` 改动的五个文档全绿；`npm run preflight` 全绿（test 359/360，唯一失败
为既有 ICU 环境差异，与本轮无关，见上一周期记录）。

**下一步**：M11 信任包为当前重点（用户指示，事关插件信任度）——八项中建议先动纯验证/拍板项
（导出验证矩阵、Canvas O1 拍板、E8 拍板），代码项（审阅模式、H8+清库撤销、复制净化、CM6 原子
区域）按 spec §5 顺序排期；README 改版 + GIF 待用户桌面环境。

---

## 2026-07-10 1.0.8 Backlink 同步独立于编号模板触发（CR-18，M12 首项，claude/m9-backlink-standalone-trigger）

**做了什么**：实现 spec.md §3.12「独立于编号模板的触发」既定设计（CR-18，M12 首项，规格早已定案，
本轮只落地代码），修复「当前 `applyRenumber` 唯一入口只被 `scheduleRenumber`/`runImmediateRenumber`
调用、且都要求 `getTemplateForFile` 命中模板」导致的盲区——无模板文件 / 全局自动编号关闭场景下，
标题改名不触发 Backlink 同步：

1. **新增独立开关 `backlinkStandaloneTrigger`**（`settings/model.ts`，默认**关**，opt-in——这是对既有
   触发面的扩展，比默认开的 `updateBacklinks` 更保守）：`loadSettings` 补迁移回退（缺失字段→false）。
2. **`main.ts` 新增两个方法**（不新增编号逻辑，纯复用既有 `headingSnapshots`/`foldSelfBacklinks`/
   `syncAndSnapshot`）：`shouldBacklinkStandaloneTrigger`（门控：独立开关 + `updateBacklinks` 总开关 +
   非 `vaultClearInProgress` + `frontmatter !== false`——**显式 `fm:false` 优先于独立触发**，覆盖一切
   自动路径，与 `shouldAutoTrigger` 对 `fm:false` 的处理口径一致）与 `applyBacklinkStandaloneSync`
   （跳过 `renumberContent`，只走 `foldSelfBacklinks` + 无条件 `syncAndSnapshot`——与 `applyRenumber`
   对称，即便本轮无改名也要刷新/播种快照基线，否则首次触发因无基线永远检测不到改名）。
   `scheduleRenumber` 改为「常规编号路径本轮未处理（无模板命中 / 不够格自动触发编号）时才尝试独立
   触发」，避免同一次改动被处理两遍（M25 回归覆盖）。
3. **顺手抽出 `writeLineDiff` 辅助方法**：`runClearNumbering`/`runClearForeignNumbering`/
   `applyRenumber`/新增的 `applyBacklinkStandaloneSync` 四处原先重复的「整文件按行 diff 后单一事务
   写回」逻辑合一，减少重复而非新增第四份拷贝。
4. **GUI**：`GeneralTab.ts` 新增开关，紧跟既有「同步内部链接（Backlink）」开关（面板位置符合规格
   要求）；`i18n.ts` 补中英文案，描述里用具体改名示例（`## 计划`→`## 项目计划`）说明生效条件，遵循
   §3.13「预览优先」原则（无法用纯渲染示例表达的复合生效条件保留一句话说明，属该原则明确的例外）。
5. **`testplan.md` M 类新增 M19–M26** 共 8 条场景（默认关无回归 / 无模板同步 / 全局关且非
   `fm:true` 仍同步 / `fm:false` 优先 / 依赖总开关 / 清库压制 / 不重复同步 / GUI 位置），全部落地为
   `main.test.ts` 新 describe 块（7 个自动化用例）+ GUI 一条标注需 Obsidian 手验 DOM。

**没做的**：`runImmediateRenumber`（手动「立即重新编号」命令）与 `renumberOnOpen`（打开文件自动重排）
未接入独立触发——前者是显式编号命令，无模板时弹 Notice 提示用户是既有预期行为；后者只在活动视图打开
时触发，标题改名场景本就靠实时编辑（`scheduleRenumber`）覆盖，范围收在 CR-18 描述的「标题文本被
改写」这一真正的盲区（编辑触发），未扩大到这两条路径——如后续需要可另开场景单独评估。M12 其余六项
（多文件批量重编号 / 不编号伪模板 / 注释块跳过 / 断链修复命令 / description 重排 / 公开改名事件 API /
迁移指南）未动。

**验证方式**：`npm test`（359/360 通过，唯一失败 `whitelist.test.ts` 的
`filterSortWhitelist`localeCompare 排序断言与本轮改动无关——`git stash` 到改动前同样失败，环境
ICU/locale 差异导致，非回归）；`npm run lint` 全绿；`npm run format:check` 全绿；`npm run test:fuzz`
（5000×80）全绿；`npm run bump` 1.0.7→1.0.8。

**下一步**：M12 其余六项已有明确定案或待细化设计，可按 spec.md §5 Milestone 12 顺序继续；`main.ts`
已增长到 ~970 行，若后续再扩几个触发路径建议评估按职责拆分（如把 `schedule*`/`apply*`/`should*`
一类触发判定函数拆到独立模块），暂未到非拆不可的程度。

---

## 2026-07-10 1.0.7 拷问式方向审查落盘：grill.md + 契约 + Roadmap 重排 M11/M12 + 实机环境规划（claude/plugin-review-infra-swtxdk）

**做了什么**：用户发起对插件的拷问式全方位审查（定位/生态适配/导出/Milestone/infra 化路径），全部认可
审查结论并全权委托落盘，本轮**纯文档大修**，不涉及 `src/`、不 bump（上架后策略）：

1. **新增 `doc/grill.md`**（长期保留的方向审查记录，单一事实源纪律的用户指定例外——落点放结论、
   本文件放推理与否决理由）：七方面拷问（定位倒转/WJ 义务/触发面盲区/Backlink 信任敞口/导出/
   Milestone 倒挂/infra 差距）+ 本轮专题 **§8「WJ 能否被 CM6 原子区域替代」**。§8 结论：原子区域
   答不了跨会话/设备的「身份」问题（纯模式匹配、位置 sidecar、会话内追踪三条去 WJ 路线逐一枪毙），
   **不能替代、应当叠加**——防护栈三层变四层（原子区域→方案A→双哨兵→清除命令）；真正零 WJ 的
   诚实路径是「虚拟编号模式」（opt-in 渲染层第二哲学，进 M9 候选）。
2. **新增 `doc/marker-contract.md`**（英文，面向下游开发者/工具作者）：WJ 双哨兵字节格式、四条
   稳定性承诺（格式/键名/永远可退出/互操作配方）、剥 WJ 与剥整前缀代码片段、Pandoc Lua filter、
   与 gurjar1 插件共存不受支持声明。
3. **`spec.md` 系列修订**：§2.2 虚拟编号翻案候选注记；§2.3「前缀可手改」修订预告；§2.5 CM 行升格
   说明；§2.6 风险表 4→8 行（Canvas 引用方靠巧合、Publish 锚点、外部写入陈旧快照、WJ 无命名空间，
   均已代码核对或标注待实测）+ 拷问追加注记；新增 §2.7 契约中文摘要；§3.12 CR-18 升格注记；
   **§5 Roadmap 重排**——执行顺序总览表（M11→M12→M8a→M8b→M10，编号不再暗示顺序）+ 新增
   **Milestone 11 信任包**（审阅模式/H8+清库撤销/复制净化/导出验证矩阵/大库性能/CM6 原子区域/
   Canvas 拍板/陈旧快照评估/E8 拍板）与 **Milestone 12 独立价值包**（CR-18/批量重编号/伪模板/
   注释块跳过/断链修复/description 重排/公开改名事件 API/Number Headings 迁移指南），M9 清池九项。
4. **新增 `spec.md` §7.1 实机验证环境规划**（用户决定：后续在装有 Obsidian 实体的 Ubuntu 环境用
   Claude Code 开发）：专用测试 vault 约定、CDP 自动化驱动（`--remote-debugging-port` + Playwright
   attach 执行 `app.commands`）→ URI+xdotool → 纯手动三级降格、O 组/导出矩阵/性能/README 截图的
   执行清单、`tests/machine_tests/` 目录纪律。
5. **`testplan.md` 新增 O 组**（生态与外部写入，O1–O7 全 🔲）：Canvas/外部改写陈旧快照/WJ 插件
   共存/剪贴板净化/导出矩阵/原子区域交互面/公开 API 事件。
6. **README 双语三新节**：「导出与外发」（Pandoc 双重编号预警 + Lua filter 指引 + PDF/Publish 待实测
   如实标注）、「从 Number Headings 迁移」（三步接管，吃停更竞品存量）、「如何干净地离开」（卸载
   三步 + 字节级可退出性承诺）；「工作原理」补共存互斥与契约链接两条。
7. CLAUDE.md §3.1 表与本文件目录结构块登记两个新文档。

**没做的**：不涉及任何 `src/` 改动——M11/M12 全部是规划，一行代码未写；O 组场景全部 🔲 未执行
（等实机环境）；manifest description 重排刻意不动（属产物，须随下一个行为版本 bump）；doc/
harness-workflow* 两个知识沉淀文件核实为用户有意保留，未动。

**验证方式**：`node scripts/docs.mjs --check` 通过；`npx prettier --check README.md README.zh.md`
通过；`npm test` / `npm run lint` 通过（未动源码，例行核验）。

**下一步**：用户将在装有 Obsidian 实体的 Ubuntu 环境用 Claude Code 继续开发——接手 agent 第一步按
spec §7.1 搭实机环境（测试 vault + CDP 驱动），然后按新执行顺序开工 **M11 信任包**（建议首件：
导出验证矩阵 O5 + 剪贴板 O4，纯验证零风险，实机环境一到位即可跑；随后审阅模式/H8 动代码）；
M12 里《从 Number Headings 迁移》长文与论坛发布不依赖实机，可随时做。

---

## 2026-07-10 1.0.7 README 补披露 WJ 生态风险 + 修正商店安装现状（claude/plugin-eval-promotion-3sy3v4）

**做了什么**：用户带着实际反馈来源两处修正，本轮**纯文档修订**（README 双语 + `spec.md` §2.6/M7 核对状态），
不涉及 `src/`，未跑 `npm run bump`（沿用"上架后策略：仅行为/产物变化才 bump"）：

1. **「安装」节更新为商店真实现状**：此前 README 写的是"社区插件商店（一旦通过审核）"，用户核实后指出
   插件**已通过自动化检查、在商店内可搜索可直接安装**，只是 Obsidian 官方的人工/编辑审核还在排队——
   两语言版本均改为反映这个现状，不再用误导性的"一旦通过审核"措辞。同步更新 `spec.md` Milestone 7 该
   checklist 项，记录这一核实结果。
2. **README「工作原理」节补齐两处此前只记在 `spec.md` §2.6、未对用户披露的 WJ 生态风险**：
   - **Dataview**：`page.file.headers` 精确字符串匹配会被 WJ 打穿，补充 DataviewJS `.replace(/⁠/g, "")`
     清洗示例 + 改用 `.includes()` 匹配标题片段两种规避写法。
   - **跨平台剪贴板**：复制粘贴到微信/知乎/Notion/邮件客户端等第三方应用时字符处理未逐一验证过，
     按"已知风险、不承诺具体表现"的措辞披露，并给出目标应用内手动清理的兜底方式。
   - `spec.md` §2.6 风险表三行状态同步勾更新（外部检索/Dataview 两行标 README 已披露完成日期；剪贴板
     一行仍标注实测未做，只是披露措辞已补上）。
3. 双语版本（`README.md` / `README.zh.md`）逐句对应修改，未产生内容漂移。

**没做的**：不涉及任何 `src/` 代码改动；跨平台剪贴板风险的**真实客户端实测**仍未做（开发环境无法验证，
仍是 spec.md 里挂着的待办）；Backlink 批量同步的 Git diff 噪音、审阅模式仍是 M9 backlog，未改动。

**验证方式**：`node scripts/docs.mjs --check` 通过；`npx prettier --check README.md README.zh.md doc/spec.md`
通过。未跑 `npm test`/`lint`/`release`（无 `src/` 改动）。

**下一步**：跨平台剪贴板行为需要真实客户端（微信/Notion 等）实测后回填 spec.md §2.6；README 截图/GIF
仍是占位，留待用户在有桌面环境处补充。

---

## 2026-07-08 1.0.7 补齐 CR-18 Backlink 独立触发 + skipFill 预览缺口 + GUI「预览优先」原则（claude/obsidian-auto-headings-review-km307d）

**做了什么**：接上一周期"下一步"遗留的两项，用户确认要补进 spec 并追加了一条通用 GUI 设计原则，本轮
全部落进 `spec.md`，纯文档修订，不涉及 `src/`，未跑 `npm run bump`：

1. **CR-18 + §3.12 新增「独立于编号模板的触发」**：把上一周期已用代码验证过的架构结论（`backlinks.ts`
   核心纯函数不依赖模板，耦合点只在 `main.ts` 的 `applyRenumber` 触发入口，只被 `scheduleRenumber` /
   `runImmediateRenumber` 调用、且都要求 `getTemplateForFile` 命中模板）写成正式设计段落：目标新增
   一条不依赖模板解析的触发路径（复用 `headingSnapshots` 快照基线）+ 独立开关，Roadmap M9 挂一条
   backlog 项。
2. **§3.13 新增「预览优先于文字说明」设计原则**：能用渲染示例说清楚的地方不写说明文字，仅当预览无法
   表达"为什么这样设计"时才留一句话说明；把已知的第一个缺口——`skipFill`（fill/drop/none）目前只有
   文字描述、没有配对渲染示例——记为该原则的待补项，Roadmap M9 挂对应 backlog 项。
3. 两处都保持"一句话 + 一个 backlog 勾选项"的精简体量，没有比照 M10 那样铺开 ASCII 图/多方案对比表——
   前者是对既有已验证结论的正式落笔，后者是一个局部渲染缺口，体量本就不需要那么重。

**没做的**：不涉及任何 `src/` 代码改动；未碰 `testplan.md`（两项仍是"规划中/待补"，未落地没有可断言
的测试场景）；README 重排 + GIF、导出清 WJ 可行性调研仍未动手（上一周期已记录，本轮未新增进展）。

**验证方式**：`node scripts/docs.mjs --check` 通过；`npx prettier --check doc/spec.md` 通过。未跑
`npm test`/`lint`/`release`（无 `src/` 改动）。

**下一步**：`skipFill` 预览与 Backlink 独立开关均已有明确设计方向，下一次动代码时可以直接按 §3.12/
§3.13 的段落实现，不需要再补规格；「预览优先」原则后续新增面板控件时应默认遵循，不必每次都重新讨论。

---

## 2026-07-08 1.0.7 用户产品讨论落规格：M10 TOC burn-in + M8b 交互面补充 + 生态兼容性风险（claude/obsidian-auto-headings-review-km307d）

**做了什么**：多轮用户产品讨论（① 上架现状与宣传短板评估 → ② 插件命名/卖点、Backlink 能否脱离编号
模板独立使用、四条 WJ 生态兼容性痛点、README 改版方向、GUI 预览缺口 → ③ 稳定性/兼容性想法批量输出
（导出清 WJ、Dataview 检索适配、全库清除可撤销、扫描修复历史断链、批量重编 UX、TOC burn-in）→ ④ TOC
监视机制细化 + 主编辑器 gutter 升降级按钮/拖放把手新想法），本轮把结论落进 `spec.md`，**纯文档修订，
不涉及 `src/`、未跑 `npm run bump`**（沿用"上架后策略：仅行为/产物变化才 bump"）：

1. **§2.2 非目标翻案**：「生成目录」不再是非目标——单文件内 burn-in 真实文本的目录，Dataview（渲染层、
   依赖额外插件）与 Table of Contents（一次性插入、不持续同步）都做不到，与本插件"写入真文本"的核心
   哲学一致；跨文件聚合视图仍非目标，继续走 M9 Dataview 集成路线，两者范围不同、互不替代。
2. **新增 §2.6 已知生态兼容性风险（待验证）**：四条——外部全文检索/正则因 WJ 断词失效（已用
   `render.ts` 代码核对成立）、跨平台剪贴板渲染 U+2060 异常（待真实客户端验证）、Dataview
   `file.headers` 精确匹配受 WJ 影响（已在 M9 候选①，待验证+出文档）、Backlink 批量同步引发 Git diff
   噪音（新发现，缓解方向并入 M9「Backlink 审阅模式」候选）。
3. **新增 §3.16 + CR-17 + Roadmap M10「原生风格 TOC burn-in」**：专属 `toc` 围栏代码块，复用编号引擎
   防抖触发路径；**关键约束**——TOC 块行数会随标题增删变化，打破"整文件重写永不增删行"的既有不变量
   （`backlinks.ts` 改名配对逻辑依赖这条不变量），技术方向待验证（CM6 事务位置映射能否在增删行场景
   下自动保持光标/滚动位置）；层级折叠复用 M8a 动态层级滑块的判定逻辑（同一纯函数，不重新实现）；
   四个未决问题（围栏语法/链接形式复用 `backlinks.ts` displayAnchor/多块支持/白名单是否收录）留待
   详细设计。M10 排期不早于 M8b 的"允许增删行整文件重写"基础设施到位。
4. **§3.15（M8b）补充设计**：新增"交互面选址"——在原有侧栏树拖拽之外，追加主编辑器 gutter 内嵌控件
   （∧/V 升降级按钮 + 拖放把手，与 Obsidian 原生标题折叠三角共存、不改变原有布局）；升降级按钮是否
   级联调整子标题层级列为未决问题；拖放把手复用既有"纯函数层 `moveHeadingBlock` + DOM 手势层"拆分，
   只是手势识别挂载点从侧栏树 DOM 换成 CM6 gutter widget。顺手修正 Roadmap 里一处过期表述（白名单子树
   拖入边界，Roadmap checklist 仍写"待实现时二选一"，与 §3.15 正文早已定案的"直接禁止"不一致）。
5. **M9 backlog 补充/细化**：多文件批量重新编号命令补 UX 定案（路径规则行右侧按钮+确认对话框）；新增
   「清除全库编号支持撤销」（与 testplan H8 读盘竞态同一段代码，建议一并修，插件自建快照/还原、非
   `Ctrl/Cmd+Z`）；新增「manifest description 卖点重排」（backlink 前置，低风险纯文案）。

**没做的**：
- **「Backlink 独立于编号模板单独可用」尚未落进 spec.md**——上一轮已用代码验证架构可行（`backlinks.ts`
  核心纯函数本就不依赖模板，耦合点只在 `main.ts` 的 `applyRenumber` 触发入口），但结论目前只在对话
  记录里，还没写成正式的 CR / Milestone 章节，需要用户确认是否也要本轮补上。
- 「skipFill 跳级预览缺口」（GUI 各处加预览的一个具体案例，已用代码确认 `EditPanel.ts` 目前无此预览）
  同样只在对话记录里，未写入 spec.md。
- README 实际重排（Feature 列表 + 跳转 + 配图）与 GIF 制作均未动手——GIF 需要真实 Obsidian 实例操作
  录屏，当前环境无法产出，需要用户自行录制或留待有桌面环境的会话。
- 「导出时清除 WJ」的可行性未验证——Obsidian 核心导出流程是否开放公共钩子给社区插件介入未经查证，
  spec.md 里未新增章节记录这条（仅在对话中给出"手动命令兜底"的降级方案建议，未落规格）。
- M10/M8b 新增内容均为规划阶段的规格文字，不涉及 `testplan.md`（未落地就没有可断言的测试场景）。

**验证方式**：`node scripts/docs.mjs --check` 通过（周期块/概括行计数未超限，目录结构约定未受影响）；
`npx prettier --check doc/spec.md` 通过。未跑 `npm test`/`lint`/`release`（无 `src/` 改动）。

**下一步**：向用户确认是否要把「Backlink 独立开关」与「skipFill 预览缺口」也补进 spec.md；若确认，
比照本轮体例（CR 表 + 非目标/风险表 + §3.x 详细规格 + Roadmap checklist）补齐。M10 与 M8b gutter 交互
的未决问题拍板后，才能拆解出可估工时的 checklist，目前仍停留在"规划中/构思阶段"。

---

## 2026-07-08 1.0.7 竞品调研驱动的 M8/M9 Roadmap 修订（claude/obsidian-plugin-integrations-hcky0m）

**做了什么**：三轮讨论（① 本插件可与哪些 Obsidian 插件联动 → ② grep M8/M8a/M8b 评审 Roadmap →
③ 用户点出 M8 是对 Quiet Outline 的模仿改良、要求调研其用户痛点并发散看其他插件），本轮把结论落进
`spec.md`，纯文档修订，不涉及 `src/`：

1. **调研证据链**（结论已写入 spec.md 对应位置，此处存证据来源）：
   - **Quiet Outline**（guopenghui/obsidian-quiet-outline）：README + issues 调研，确认「彩虹配色」
     是真实痛点——社区专门有 CSS 片段仓库（replete/obsidian-minimal-theme-css-snippets）把它的彩虹
     色改成主题色，作者原话"用它替代官方 Outline 面板"；"不支持跨级标题 h1→h3→h4"是结构性 bug（本
     插件 `parser.ts` + 模板 `skipFill` 已经正确处理同类跳级场景）；另有焦点滞留侧栏、状态持久化
     文件与 iCloud 同步冲突（#308）等交互细节问题。
   - **Modern Outline**：minimap-on-edge 范式的大纲插件，作为 QO 的替代形态调研后**不采用**——与
     本插件已定的侧栏树形态是两个不同产品方向，不同时做（用户本轮明确"不考虑做 minimap"）。
   - **Table of Contents**（hipstersmoothie，21.5 万次下载）：验证了"生成式目录"需求盘子很大，但
     用户决定改走"支持 Dataview"而非自建生成器命令，与 §2.2 非目标"生成目录是独立关注点"保持一致
     （用户本轮明确"先只考虑支持 dv"）。
   - **Number Headings**（onlyafly，8.5 万次下载）：issues 里"排除文件夹编号"（#81）、"跳过注释块内
     标题"（#72）两条现状缺口，转成 M9 候选项。
   - **Obsidian 核心 Outline / Outliner 插件**的拖拽历史（含 Obsidian v1.4.5"带 frontmatter 时拖放
     失效"回归）：转成 M8b 的一条显式测试场景要求。
   - **带编号导出**（PDF/Pandoc）：用户本轮明确"作为调研项"，即只记录待验证问题、不承诺实现范围。
   - 主要来源：<https://github.com/guopenghui/obsidian-quiet-outline>、
     <https://github.com/replete/obsidian-minimal-theme-css-snippets>、
     <https://community.obsidian.md/plugins/modern-outline>、
     <https://github.com/hipstersmoothie/obsidian-plugin-toc>、
     <https://github.com/onlyafly/number-headings-obsidian/issues>

2. **`spec.md` 修订清单**：
   - §2.2 非目标：「生成目录」补跨引用到 M9「Dataview 集成」。
   - §3.14（M8a）：呈现形态锁定侧栏树形（非 minimap，附否决记录指回本条）；标题树解析改为**直接
     复用 `parser.ts`**（不重新实现，避免 QO 同款跳级 bug）；搜索框需**复用 `main.ts` 现有
     `imeComposing` 模式**；「高亮」补非目标"不做按级别彩虹配色"；「其余交互」补"跳转后焦点还给
     编辑器"；「层级滑块」补状态持久化约束——只进单一 Settings，不做逐文件 side-car（避免 QO #308
     同款云同步冲突）。
   - §3.15（M8b）：白名单子树拖入边界从"实现时二选一"改为**锁定决策"直接禁止"**；移动端触摸拖拽
     明确列为"可独立延后、不阻塞 M8b 桌面端验收"；测试策略补一条"带 frontmatter 文件做拖放"的显式
     场景。
   - M9 候选清单：新增「Dataview 集成」（替换原「侧栏生成目录块」表述，定位"验证 + 写文档"而非新增
     插件代码）；「带编号导出」降级为"调研项，非承诺功能"；新增「路径规则不编号伪模板」「注释块内
     标题跳过」两条候选。

**没做的**：不涉及任何 `src/` 代码改动；未碰 `testplan.md`（M8a/M8b/M9 候选项仍是"规划中/候选"，未
落地就没有可断言的测试场景）；未跑 `npm run bump`（沿用"上架后纯文档改动不 bump"策略，见 0.7.26
之后历次纯文档周期）。Dataview 是否有开箱即用的标题字段、导出链路里 WJ 字符的实际表现，均未动手
验证，spec.md 里已显式标注"待验证"，不是调研结论。

**验证方式**：`node scripts/docs.mjs --check` 通过。未跑 `npm test`/`lint`/`release`（无源码改动，
`doc/` 本就在 `.prettierignore` 里，不受 `format:check` 管辖）。

**下一步**：若采纳「Dataview 集成」候选，第一步应是找一个真实 vault 手动验证 WJ 字符在 DataviewJS
里的实际表现（而非继续纯调研）；「路径规则不编号伪模板」与「注释块内标题跳过」是两个低成本、不依赖
M8 的独立小任务，可随时排期；M8a/M8b 本身仍未开工。

---

## 2026-07-06 1.0.7 补充追问二则至 Harness 文档：脚本串联链路 + 省 token 机制（claude/harness-workflow-architecture-4vyme3）

**做了什么**：用户在上一周期基础上追问两个问题——「进入本仓库的 Agent 工作流用哪些脚本
串起来」「这套工作流省上下文/省 token 是靠什么实现的」，把两问两答追加进
`doc/harness-workflow-ic-verification.md` 作为 §7/§8：

1. **§7 脚本串联链路**：从 SessionStart 钩子（自动）→ `npm run docs -- --handover`（接手
   读盘）→ 手写工作步骤 → 质量自检（test/lint/format）→ `npm run release` → `npm run bump`
   → 写交接记忆 → `npm run docs`（或合并为 `preflight`）→ 提交（pre-commit 软门禁）→
   push（CI 硬门禁）→ 合并 master 的完整时间线图 + 脚本职责速查表，并点明 `release`/
   `bump`/`docs` 三者是**手动触发、非自动串联**，真正自动串联的只有 `preflight` 组合命令
   与 pre-commit/CI 内部固定跑的 `docs.mjs --check`。
2. **§8 省 token 六机制**：分层摘要（首行+最新块恒定入口成本）、归档不删除但默认不进
   上下文、脚本算摘要代替整读计数（testplan 非 ✅ 清单）、`--handover` 单命令聚合三处、
   grep 定位菜谱替代整读 + 源码按职责拆分、结构化数据+字数上限逼出信息密度；归纳为
   "上下文消耗从随项目历史增长改造成随项目历史保持恒定"。

**没做的**：本次仍是纯知识沉淀的追加，不涉及插件行为，未跑 `npm run bump`。

**验证方式**：`npx prettier --check doc/harness-workflow-ic-verification.md` 通过；
`node scripts/docs.mjs --check` 通过。未跑 `npm test`/`lint`/`release`（无源码改动）。

**下一步**：本仓库侧无遗留任务；后续若用户在 IC 验证项目侧有新的迁移细节讨论，可继续
追加进本文档对应章节。

---

## 2026-07-06 1.0.7 新增知识沉淀文档：Harness 工作流思想提炼（面向 IC 验证 Agent）（claude/harness-workflow-architecture-4vyme3）

**做了什么**：用户要求把本仓库自身的多 Agent 协作 Harness 机制（`CLAUDE.md` 交接协议、
`log.md`/`status.jsonl` 分层记忆、`scripts/docs.mjs` 机械脚本化、pre-commit/CI 两级门禁、
`testplan.md` §4 已借用的 UVM 约束随机测试思想）提炼成通用架构原则，用于其在 IC 设计验证
领域的 Agent 工作。新增 `doc/harness-workflow-ic-verification.md`：

1. 十条可迁移的核心原则表（单一事实源、分层记忆、机械/语义解耦、两级门禁、状态转移优先、
   约束单向放松、多记分板互补、显式登记未覆盖项、已知边界钉回归测试、产物随源码入库）。
2. 分层记忆架构图与 `scripts/docs.mjs` 五件事的抽象模式（归档/滚动/摘要/校验/目录树守卫）。
3. §5 单独整理本仓库测试层已借用的 UVM 方法论内核（参考模型 scoreboard、多记分板互补、
   约束随时放松的单向棘轮、覆盖率驱动缺口分析、显式"不入随机框架"清单）——这部分与
   IC 验证同源，可直接对齐，不需要类比转译。
4. §6 给出迁移到 IC 验证 Agent 工作的具体落地设计：`doc/` 文件角色映射表、`testplan.md`
   验证维度模板、`scripts/vplan.mjs` 脚本职责、门禁分层（含 IC 验证比软件多出的"夜间全量
   回归"一层）、Agent 交接协议模板、最小可行落地清单。

**没做的**：本文档是纯知识沉淀/外部参考，不涉及插件自身行为或规格变化，故未跑 `npm run
bump`（沿用 1.0.6 README 重组周期确立的"上架后策略：仅行为/产物变化才 bump"）；未改动
`spec.md`/`testplan.md`——内容与本插件的编号引擎规格无关，不适合并入两者。

**验证方式**：`npx prettier --check doc/harness-workflow-ic-verification.md` 通过；
`node scripts/docs.mjs --check` 通过（周期块/概括行计数未超限，目录结构约定未受影响——
本次未新增 `.ts`/`.mjs` 源文件）。未跑 `npm test`/`lint`/`release`（无源码改动）。

**下一步**：待用户在 IC 验证项目一侧落地 `scripts/vplan.mjs` 与 `testplan.md` 等价物时，
如需进一步定制脚本原型可另行支持；本仓库侧无遗留任务。

---

## 2026-07-05 1.0.7 迁移守卫：自动路径检测疑似外来编号，跳过写入+提示（claude/plugin-numbering-cleanup-check-d83sxc）

**做了什么**：用户提出的真实痛点——从其他编号插件 / 手写编号迁移过来的文件（如 `## 1 红米`），装上本插件
后全局自动编号一开，打开该文件就会被自动路径叠成 `## 1 1 红米`（方案A下无 WJ 一律当正文、直接叠加编号），
观感上与 bug 无异，而这恰恰是新用户接触自动编号的第一个时刻。上一轮讨论了三个方案（自动接管 / 跳过+
提示 / 全库常驻角标），采纳方案1（跳过写入 + 一次性提示，风险最低）：

1. **`src/cleanup.ts` 新增只读探测 `hasUnclaimedForeignNumbering`**：全文完全不含 Word Joiner（插件
   从未接触过这份内容）且至少一个标题被 `stripForeignNumbering` 判定为「像外来编号」时返回 true。
2. **`src/main.ts` 三处自动写入前接入守卫**（`scheduleRenumber` 防抖到期回调 / `renumberOnOpen` /
   `renumberActiveFile`）：命中即跳过本次 `applyRenumber`，改弹 Notice 引导执行「清理非本插件的标题
   编号」；新增 `foreignNumberingWarned`（内存 Set）把提示限制为每文件每会话一次，此后静默持续跳过；
   随文件 rename 迁移键、delete 移除、`onunload` 清空。**手动命令**（立即重新编号 / 清除编号 / 清理
   外来编号）**不查守卫**，绕过一切开关照常执行——与既有「Renumber now 绕过一切开关」原则一致。
3. **已知且接受的边界**：守卫的「从未接触过」判定是**整文件级**的——一旦文件已含任意 WJ（哪怕只有
   一个标题被本插件编过号），之后再粘贴进一段带外来编号的新内容，守卫**不会**再次拦截，该段落仍按
   方案A既有语义处理（当正文、叠加编号）。这是刻意的范围收窄（避免为「部分接管」引入按标题级的更
   复杂判断），已在 `main.test.ts` 补一条回归测试固化这个边界，不是遗漏。
4. `src/i18n.ts` 新增 Notice 文案 `noticeForeignNumberingGuard`（中英双语）。
5. `doc/spec.md` §3.9「打开文件即重排」段后补一段规格说明（命中条件、行为、范围、已知风险）；
   `doc/testplan.md` J 类新增 **J10** 场景行。

**没做的**：方案2（vault 级一次性 onboarding 提示）、方案3（面板常驻角标计数）——本轮只落地风险最低
的方案1；「部分接管文件里新增外来编号段落」这个已知边界（见上第3点）暂不处理，留待用户反馈是否值得
再投入按标题级判断的复杂度。

**验证方式**：`cleanup.test.ts` 补 5 条 `hasUnclaimedForeignNumbering` 纯函数单测；`main.test.ts` 补
6 条集成测试（`scheduleRenumber`/`renumberOnOpen`/`renumberActiveFile` 命中守卫跳过写入+仅提示一次、
已接管文件的边界行为、手动命令绕过、「先清理再自动接管」典型工作流往返）；`npm test`（353 全绿）、
`npm run lint`、`npm run format:check`、`npm run test:fuzz`（5000×80 全绿，两条记分板不变式均未受影响）、
`npm run release` 全过；`npm run bump` 同步至 1.0.7。

**下一步**：等待合并回 master；若用户反馈仍在「部分接管文件」场景撞到双重编号，再评估方案2/3或按标题
级判断的复杂度是否值得投入。M8a/M8b 仍未开工，按上一周期结论排期。

---

## 2026-07-05 1.0.6 README 中英双语改版：按调研报告拆「基础层/进阶层」（claude/plugin-readme-localization-mh62xy）

**做了什么**：按 `doc/README_UPDATE_REPORT.md`（0704 调研产出）§3 的结构提案，重写 `README.md` /
`README.zh.md`，两份结构、示例一一对应：

1. **重新分层**：原先「问题钩子 → 演示 → 功能清单（平铺）→ 原理 → quick start → 安装 → 命令 → notes」
   的时间线堆叠，改成「开场钩子 → **开箱即用**（零配置/标题层级神圣/防抖不打扰/性能边界/两层开关+
   frontmatter 覆盖/配置不入笔记/双语，收尾 Quick start）→ **深入定制**（rename+backlink 演示/模板系统/
   路径规则/白名单/清除命令）→ 工作原理 → 安装/命令表/notes/license」两层组织。
2. **融入报告 §1 列出的八处设计权衡**：标题层级神圣性从功能列表第 3 条提到「开箱即用」首位；
   frontmatter 不存配置的「打开笔记看不到插件痕迹」补进同一层；`ancestorNumeral` 补了一句说清
   它解决的是"中文书式 vs 提纲式"这一真实排版冲突，而非只列举两个选项名词；白名单子树重置补一句
   「基于主流引用规范调研（约 85%）的默认行为」；backlink 同步补一句"站在 Header Enhancer 已有实现
   之上做了几处改进"（不逐条列出四点，那是 spec 的活）；「按文件覆盖」与「清除命令」里的
   "Renumber now 绕过一切开关"合并成「开箱即用」层一段统一的"两层开关+手动兜底"陈述，避免读者
   在两节之间拼凑不出这是一套体系；性能边界补一句"模板/规则再多也不会有后台开销"；工作原理一节
   补充双哨兵自愈（0.7.20）一句话说明，并保留对 gurjar1/auto-heading-obsidian 的鸣谢惯例（原写法只
   讲了单哨兵）。
3. **删除已落地的调研报告** `doc/README_UPDATE_REPORT.md`——按其自身开头注记与 `CLAUDE.md` 的
   「单一事实源」纪律，结论落地到新版 README 后原件即删，不留副本。
4. **未做的**：报告 §3 开放问题里的截图/GIF——沿用 M7 发布前已做的决定"文字说明已足够，截图/GIF
   留作后续可选补充"，本轮未动手（做的话需要先确认录屏/截图生成方式，工作量独立评估，不与本次结构
   调整捆绑）；`spec.md`/`testplan.md` 未改动——报告已确认这是纯文档重组，不涉及行为变更，故也
   **未跑 `npm run bump`**（1.0.6 早已过 1.0.0，遵循"上架后策略：仅行为/产物变化才 bump"）。

**验证方式**：`npx prettier --check README.md README.zh.md` 通过；手动核对中英两份标题层级、内部锚点
（如 `#out-of-the-box`/`#开箱即用`、`#notes`/`#说明`）一一对应且未失效；`node scripts/docs.mjs --check`
通过（目录结构约定与磁盘一致、周期块/概括行计数未超限）。未跑 `npm test`/`lint`/`release`（无源码改动）。

**下一步**：等待用户确认是否需要补充截图/GIF；M8a/M8b 仍按上一周期结论排期。

---

## 2026-07-04 1.0.6 M8 规格重整：修文档漂移 + 拆 M8a/M8b + 内容迁移（claude/spec-m8-feasibility-8f233f）

**做了什么**：应用户要求审查 `spec.md` Milestone 8（侧栏大纲导航 + 结构编辑）的可行性，本周期是讨论
产出的落地，**未改任何源码/测试**。

1. **修文档漂移**：`spec.md` 中有三处写着「审阅模式 / 全库扫描修复留 M8」（§3.12 两处 + 旧 M7 Roadmap
   一处），但实际这两项内容一直在 Milestone 9 候选清单里，M8（8.0–8.7）自身从未提过它们——三处引用
   已改为「留待 M9」，与实际落点对齐。
2. **拆分 M8a / M8b**：可行性审查发现 M8 原文把「大纲导航（只读展示/搜索/跳转）」与「拖放重排+行内
   编辑（结构性写入）」混在一个 milestone 里，后者引入的是当前写入模型（「整文件重写、从不批量扫库」）
   之外的新写入路径（剪切—拼接—重排—同步 backlink），边界情况数量级预计超过 M6/M7 已加固的「原地改
   标签」场景，且拖拽手势/动画完全没有自动化验证手段。故拆成 **M8a**（低风险，可独立发布）与 **M8b**
   （高风险，架构新增最多，建议独立排期）。
3. **内容迁移**：原先整段 UI 设计稿 + 详尽 bullet list 直接堆在 Roadmap §5 里（与项目「单一事实源」
   纪律相悖——其余 milestone 的 Roadmap 条目都只是一行 + 链接，详细设计在 §3）。本次把实质内容迁到
   新增 **§3.14 侧栏大纲导航（M8a）**、**§3.15 拖放重排与结构编辑（M8b）**，§2.1 核心需求表补
   CR-15/CR-16，§4 架构设计补一段「M8 规划中」注记（新增 `views/OutlineView.ts` 是本仓库第一次引入
   Leaf/View 基础设施）；Roadmap §5 的 M8a/M8b 只留精简 checklist + 链接。
4. **测试基建可行性结论**（本次审查的重点发现，已写入 §3.14/§3.15/§4）：
   - `vitest.config.ts` 固定 `environment: "node"`，`obsidian-mock.ts` 的 `containerEl` 只是空对象——
     现状对这类面板完全没有自动化验证空间。M8a 落地时可按新增测试文件用
     `// @vitest-environment jsdom` 引入最小 jsdom 依赖（不影响既有测试），覆盖树构建/搜索过滤/键盘
     导航等结构性断言；但真实 CSS 过渡/fade 效果 jsdom 验证不到，维持交给 `user_tests` 手验，与
     testplan 现有「面板类交互无文本语义、留手验」原则一致。
   - M8b 风险最高的拖放重排，建议**架构上**把「结构变更执行」拆成独立纯函数（如
     `moveHeadingBlock(content, source, target)`，不碰 DOM）与「拖放手势识别」（DOM 事件层）两层——
     前者可以按 `tests/dev_tests/uvm/` 现有的约束随机序列模式**新增一种随机操作**（随机移动标题），
     配套不变量做回归，是 M8 里少数能被机器持续验证、而非仅靠人工点击的部分。这个拆分建议已写进
     §3.15「测试策略」，值得在真正实现 M8b 前就定下来，而不是先写成一个揉在一起的 DOM 事件处理函数。

**没做什么**：M8a/M8b 均未开工，`views/` 目录、`moveHeadingBlock` 均不存在；这是规格/可行性层面的
整理，不是实现。

**下一步**：等待用户决定何时排期 M8a；M8b 实现前先按 §3.15 的建议把纯函数层设计出来再动手写 DOM
拖拽逻辑，以便从第一天起就能接入 UVM。

**验证方式**：纯文档改动，无代码变更。`npx prettier --check doc/spec.md` 通过；内部锚点链接（3.14/3.15
及新增交叉引用）逐一核对生成的 slug 与既有同风格标题（如 3.12/3.13）一致。未触发 `npm test`/`lint`/
`release` 重建（无源码改动，遵循「上架后策略：仅行为/产物变化才 bump」，本次不 bump 版本号）。

---

## 2026-07-04 1.0.6 白名单归一化补 HTML 标签 / `==`/`~~`（claude/whitelist-appendix-formatting-n2xdhq）

**做了什么**：用户反馈子树白名单「附录」无法排除 `<u>附录</u>`、`==附录==`、
`<font color="#c3d69b">附录</font>` 等带行内格式的标题，会被正常编号。根因：
`whitelist.ts` 的 `stripInlineMarkdown` 只剥 `**`/`*`/`_`/`` ` ``/链接，不认识 HTML 标签
与 Obsidian 的高亮 `==文字==`/删除线 `~~文字~~` 语法，归一化后文本仍带标签/标记，与白名单
词语「附录」比对不相等，判定为未命中。**修复**：`stripInlineMarkdown` 新增两步——① 用通用
正则 `<\/?[a-zA-Z][^<>]*>` 整体剥掉任意 HTML 标签（含属性，不逐一枚举 `<u>`/`<font>`/
`<span>`/`<mark>`/`<sup>`/`<br>` 等标签名，只保留标签内文字）；② 成对剥离 `==文字==` 与
`~~文字~~`（仿照既有链接 `[文字](url)` 的「还原为文字」思路，而非像 `*`/`_` 那样逐字符裸删——
`=`/`~` 单独出现在真实标题里（如 `E=mc²`）比 `*`/`_` 更常见，裸删误伤面更大，故对这两种
用成对正则精确匹配）。剥离顺序有讲究：先剥 HTML 标签（连标签属性里的 `=` 一起去掉），
再处理 `==`/`~~`，避免属性字符干扰成对匹配；`<u>**附录**</u>` 这类「标签套 Markdown」剥完
标签后剩下的 `**附录**` 仍会被最后一步的字符类删除命中，两层嵌套都能归一。

**边界场景过一遍**（决定要不要处理、要处理到什么程度）：
- HTML 标签：采用**通用**正则而非枚举标签名——`<mark>`（高亮的 HTML 写法）、`<sub>`/`<sup>`、
  `<del>`/`<s>`/`<strike>`（删除线的 HTML 写法）、`<kbd>`、`<span style="...">`、
  `<font color="...">` 全部覆盖，不需要每加一个新标签就改代码。
- `<br>`/`<br/>` 这类无内容的空标签：剥掉后两侧文字直接相邻（如「附录<br>A」→「附录a」），
  靠归一化后续的空白折叠步骤兜底，不強求补空格（原文两侧如无空格，用户很可能就是想连写）。
- Wikilink `[[附录]]` / `[[note|附录]]`：**本次未处理**——现有 `[文字](url)` 只认 Markdown
  链接语法，wikilink 是另一套语法糖；且用户报的具体案例（`<u>`/`==`/`<font>`）都不涉及
  wikilink，未加是为了不引入未经用户场景验证的行为，留作后续按需再评估，不在本次范围内。
- Obsidian 注释 `%%文字%%`：**本次未处理**——语义与高亮/删除线不同（内容本身不应显示/参与
  比对，而非仅去掉标记保留文字），错误处理反而可能引入新歧义，同样留待有实际场景再评估。
- HTML 实体（`&nbsp;` 等）：未处理，真实标题里出现的概率低于本次报告的三种格式，从简。
- 裸 `=`/`~` 字符（非成对）：刻意保持原样不删（区别于 `*`/`_` 的逐字符裸删），见上文修复说明。

**没做什么**：无法在真实 Obsidian 环境里渲染截图确认视觉效果（无头测试环境限制）；逻辑层
`normalizeForWhitelist`/`computeWhitelistExemptionDetail` 单测已覆盖（见下）。

**下一步**：如后续有用户反馈 wikilink 标题或 `%%注释%%` 场景，再单独评估是否需要归一化处理；
当前无待办。

**验证方式**：`whitelist.test.ts` 新增 D11 一组用例（HTML 标签/`==`/`~~` 单测 + 叠加嵌套 +
端到端 `numberHeadings` 子树豁免）；`npm test` 342 passed（较上一周期 +4）/ `npm run test:fuzz`
（5000×80 两个记分板全绿，核心逻辑改动按流程跑）/ `npx tsc -noEmit` / `npm run lint` /
`npm run format:check` 全绿。`testplan.md` D11 行状态回填 ✅。

---

## 2026-07-04 1.0.5 建议弹窗 z-index 修复：被「设置」模态框盖住（claude/path-suggest-zindex-fix）

**做了什么**：1.0.4 上线后用户实测反馈：路径输入框打字 + 回车能选中建议（如输入 `✂️` 回车得
`✂️ Clippings/`），但**单纯点击输入框不会像 numeroflip/obsidian-auto-template-trigger 那样弹出
下拉框**——键盘流程正常但视觉上看不到弹窗，判定为 **z-index 层级问题**：`PathSuggestPopup` 挂在
`activeDocument.body` 上，但样式给的是 `var(--layer-popover, 70)`；Obsidian 官方层级变量实际
`--layer-popover`（约 30）**低于**「设置」自身所在的 `--layer-modal`（约 50），故弹窗虽然
正确创建/定位，却被设置模态框整个盖在下面——**Enter 选中是纯逻辑（`items[selectedIndex]`），
不依赖弹窗是否可见**，这正好解释了"键盘能选、肉眼看不到"这个矛盾现象。**修复**：
`styles.css` 的 `.ah-path-suggest` z-index 改 `var(--layer-menu, 9999)`（高于 modal 的层级，
且带极高兜底值，不依赖对 Obsidian 内部变量名的记忆是否精确）。

**关于"加上对特有文件的支持"**：用户要求的「文件夹 + 文件都可选」在 1.0.4 就已经实现
（`collectPathCandidates` 本就收集 vault 全部文件夹与文件，非纯文件夹；`filterPathCandidates`
排序时文件夹优先文件仅在命中位置并列时生效，文件本身恒在候选列表内）——不需要新代码，
这次只是可见性 bug 的修复让用户能实际看到这一效果。

**没做什么**：无法在本环境（无头 vitest + 无真实 Obsidian）里截图验证弹窗现在确实出现在
设置模态框之上——z-index 数值判断基于 Obsidian 官方 CSS 变量参考（`--layer-modal` ≈50 <
`--layer-menu` ≈65），逻辑上应该解决，但仍需用户在真实环境里确认。

**下一步**：用户确认弹窗现在点击/聚焦输入框即可见、层级正确后，testplan K13 的手验部分可
转 ✅；若仍有遮挡（如与其它插件的浮层冲突），再按实际截图调整 z-index 或改挂载点。

**验证方式**：`npm test` 338 passed（无新增用例——本次是纯 CSS 数值修复，无新增可测逻辑分支）
/ `npx tsc -noEmit` / `npm run lint` / `npm run format:check` 全绿；`npm run build` 确认样式
改动正确同步进 `release/styles.css`。

---

## 2026-07-04 1.0.4 路径规则建议弹窗重做 + 三处鸣谢（claude/path-suggest-upgrade）

**做了什么**：用户报告 bug（testplan K13）：路径规则新增一行投新模板，路径填 `新路径`（漏打
尾斜杠），该文件夹下已按旧规则编号过的文件重新打开不会按新模板重排——复现确认根因不在
`renumberOnOpen`（J9）机制本身（补上 `/` 后立即正常），而是本插件把「文件夹规则」与「文件
规则」的区分**系于路径末尾是否带 `/`**，纯文本输入 + 原生 `<datalist>` 极易漏打。用户同时
指出原生 `<datalist>` 不会主动补全，并给出参考实现 numeroflip/obsidian-auto-template-trigger
（`FolderSuggest`/`TextInputSuggest`：自绘建议弹窗、键盘 ↑↓/Enter 选择、体验明显更好）。

- **`src/pathrules.ts` 新增两个纯函数**（`filterPathCandidates`、`autocompleteFolderSlash`），
  配 `pathrules.test.ts` 10 条新单测：前者按输入模糊匹配 + 排序候选（命中位置优先、位置并列
  文件夹优先于文件）；后者是**手动输入不经弹窗时的兜底**——输入若与某个真实存在的文件夹路径
  精确相等但缺尾斜杠，自动补全，直接根治用户报告的 bug（无论走不走建议弹窗都生效）。
- **新增 `src/settings/tabs/PathSuggest.ts`**：自绘建议弹窗（不依赖 Popper），参考引用仓库的
  `TextInputSuggest` 交互——挂 `activeDocument.body`、`position: fixed`（`.ah-path-table` 有
  `max-height`+`overflow-y:auto`，行内绝对定位会被裁切，故不挂在行内）；键盘 ↑↓/Enter/Esc +
  鼠标点击/悬停；选中文件夹自动带尾斜杠。`OPEN_POPUPS` 模块级集合 + `closeAllPathSuggestPopups`
  在每次 `renderPathRules` 渲染前清场，防止弹窗 DOM 节点因挂在 body 上、不随所在行的容器一起
  被 `tab.display()` 清空而变成孤儿节点。
- **`src/settings/tabs/PathRules.ts` 接线**：移除旧的「分层 datalist」（`updatePathDatalist`），
  换成 `collectPathCandidates`（列出 vault 全部文件夹/文件，含代表根 `/` 的 `{path:"", isFolder:
  true}`）供弹窗做模糊排序；`commitPattern` 里手动输入分支调用 `autocompleteFolderSlash` 兜底；
  输入框 `keydown` 先交给 `suggest.handleKeydown(e)`（弹窗展开时消费 ↑↓/Enter/Esc），未消费时
  才落回原有的「Enter → blur → 提交」逻辑。
- **鸣谢（用户要求，「关于」TAB 新增鸣谢分区）**：`i18n.ts` 新增 5 个文案键（标题/引言/三条
  说明，中英双语），`AboutTab.ts` 渲染三条鸣谢——numeroflip/obsidian-auto-template-trigger（本轮
  路径建议弹窗参考）、hobeedzc/obsidian-header-enhancer-plugin（Backlink 同步最初参考，已在
  spec.md §3.12 记录、本轮补上仓库 URL + About 页可见）、gurjar1/auto-heading-obsidian
  （WJ 单哨兵边界最初参考，本插件升级为双哨兵，spec.md §2.5 补记）。后两条是**追认**——功能早
  已实现（0.7.8/0.7.20），只是当初没写鸣谢，本轮补上。
- `doc/spec.md` §3.8 重写「路径输入补全」段（datalist → 建议弹窗 + 自动补全，含参考实现 pointer）；
  §2.5、§3.12 各补一行参考仓库 URL + 「见关于 TAB 鸣谢」pointer。

**没做什么**：未改 `PathRule` 的存储 schema（未引入显式 `kind: folder|file` 字段）——文件夹/
文件规则的区分仍系于尾斜杠约定，只是从「容易漏打」变成「弹窗自动带 + 手动漏打时兜底自动补」，
双重防线覆盖了实际报告的场景，未做破坏性数据迁移（风险/收益比更低，且现有 `resolvePathRule`
匹配算法本身没问题，问题纯在输入层）；建议弹窗的 DOM 交互（排序观感、键盘选择、动画）无法在
本环境的无头 vitest（`environment:"node"`，无 DOM）中验证，testplan K13 标记为待用户实测。

**下一步**：用户在真实 Obsidian 里手验建议弹窗（排序是否符合直觉、键盘操作是否顺手、自动补全
是否在预期时机触发）；若弹窗定位/裁切有问题（如设置面板窗口很窄时），再迭代。

**验证方式**：`npm test` 338 passed（含新增 10 条 `pathrules.test.ts` 用例）/ `npm run test:fuzz`
（5000×80，两块记分板全绿，路径规则不在被测范围内但核心编号引擎无回归）/ `npx tsc -noEmit`
/ `npm run lint` / `npm run format:check` 全绿；`npm run build` 确认 `PathSuggest.ts` 编译无误。

---

## 2026-07-04 1.0.3 修复「关于」TAB 仓库链接指向旧 monorepo（claude/auto-headings-compliance-wx7w37）

**做了什么**：用户反馈插件商店 About 页指向的仓库不对；排查发现是本仓库（早年从私有
monorepo 迁移而来）遗留的旧地址——`src/settings/tabs/AboutTab.ts` 的 `REPO_URL` 硬编码为
`https://github.com/AArlert/Addon`（monorepo 内该 Addon 的旧路径），而不是当前对外发布仓库
`AArlert/obsidian-auto-headings`。导致插件内「关于」TAB 的仓库链接与 Issues 链接都打到一个
不存在 / 不相关的地址。**改为** `https://github.com/AArlert/obsidian-auto-headings`。全仓
`grep` 复核，仅此一处硬编码引用（`manifest.json` 的 `authorUrl` 指向作者主页，非本问题）。
Bump **1.0.3**（`npm run bump`），`npm run release` 重建 `release/` 三件套并核对 `release/main.js`
内联字符串已更新。

**关于社区插件商店重扫反馈（第三轮）的三条 Recommendation**（`display` / `setWarning` /
`setDynamicTooltip` 已弃用）：**沿用 1.0.1/1.0.2 两轮已记录的结论，本轮未改动**——替代 API
（`getSettingDefinitions` / `setDestructive`）均为 **Obsidian 1.13.0+** 才提供，本插件
`minAppVersion` 现为 1.8.7，若现在迁移，重扫会把这三条「弃用提示」升级成「不支持 API」的
**Error**（比现状更差）。License Warning 与 Vault Enumeration Recommendation 同样维持前两轮
结论（前者是 GitHub licensee 缓存滞后，后者是全库清除功能的必需权限）。

**没做什么**：未处理三条已弃用 API 迁移（版本下限不满足，见上）；未新增自动化测试覆盖
「关于」TAB 的链接渲染——`REPO_URL` 是无分支逻辑的静态常量，为一行字符串常量新增 DOM 渲染
测试基建收益过低，未做。

**下一步**：确认无其他遗留 monorepo 引用后，按 §5.1 合并回 `master` 并推送；后续若
`minAppVersion` 抬高到 1.13+，一并处理三条弃用 API 迁移。

**验证方式**：`npm test` 328 passed / `npm run lint` / `npm run format:check` 全绿；
`grep -rn "AArlert/Addon"` 全仓确认清零；`grep` 复核 `release/main.js` 内联字符串已替换为
`AArlert/obsidian-auto-headings`。

---

## 2026-07-03 1.0.2 商店重扫第二轮反馈：getLanguage 版本下限 + 跨窗口类型检查（claude/obsidian-plugin-review-fixes-8fy6ck）

**做了什么**：1.0.1 推上去后 Community Hub 重扫，Error 从「any/eslint-disable」换成一条新的
`no-unsupported-api`，另有几条新 Warning/Recommendation，逐项处理，bump **1.0.2**。

- **Error：`getLanguage` 比声明的 minAppVersion 新**：typings 里它标注 **`@since 1.8.7`**，上轮
  提的 1.8.0 差一个补丁位——**minAppVersion 1.8.0 → 1.8.7**（manifest + versions.json；顺手把
  versions.json 里 1.0.1 的映射也修正为 1.8.7——1.0.1 从未发布分发，仅存于 git 历史，修正无害）。
- **Warning：`as TFile` 断言（main.ts）**：`syncBacklinks` 改 **`file instanceof TFile`** 收窄
  （TFile 改为值导入），连带删掉 `"children" in file` 鸭子判断。配套：obsidian-mock 新增 `TFile`
  替身类，main.test.ts 假 vault 的 `getAbstractFileByPath` 改返回 `Object.assign(new TFile(), …)`
  实例（否则对象字面量过不了 instanceof，8 个 Backlink 用例会静默跳过写回）。
- **Warning：`instanceof InputEvent` 非跨窗口安全 ×3**：审核建议用 Obsidian 的 `.instanceOf()`，
  但它只声明在 `UIEvent` 上，而本仓库 TS 5.6 的 lib.dom 把 `"input"` 事件映射为 `Event`，参数
  在 strictFunctionTypes 下收窄不进去（bot 环境的新 lib.dom 已是 InputEvent，两边类型环境不一致）。
  改为**不依赖构造器身份**的写法：`"isComposing" in e && e.isComposing === true`（`in` 收窄，
  零断言零 instanceof，弹出窗口下天然成立），两边编译器与两套规则都满足。
- **Recommendation：Release 产物缺 artifact attestation**：release.yml 补 `id-token: write` +
  `attestations: write` 权限与 `actions/attest-build-provenance@v2` 步骤（对 main.js /
  manifest.json / styles.css 出具构建来源证明），在 `gh release create` 之前执行。
- **不采纳的三条 Recommendation（有意跳过，非遗漏）**：`display` / `setWarning` /
  `setDynamicTooltip` 弃用提示——替代 API（`getSettingDefinitions` / `setDestructive`）都是
  **1.13.0+** 才有，本插件 minAppVersion 1.8.7，换用会把「弃用提醒」升级成「不支持 API」的
  **Error**；旧 API 在 1.13 仍正常工作，等未来抬高版本下限时一并迁移。
- **License Warning 复核**：`cat -A` 逐字节比对，LICENSE 就是标准 MIT 模板（LF、无 BOM、无增删
  字句），代码侧无可修——GitHub 的许可证识别（licensee）在默认分支文件变更后有缓存滞后，
  预计随时间/重扫自行消失；若长期不消可在提交说明里附本块结论。
- 「Vault Enumeration」Recommendation 同上轮：`getMarkdownFiles` 为全库清除功能所必需，不改。

**没做什么**：未迁移三个弃用 API（版本下限不允许，见上）；未实测 attestation 步骤真跑一遍
（要打 tag 才触发，留给下次真实发版验证）；未解决 License Warning（判定为平台侧缓存，无代码动作）。

**下一步**：推 master 后再触发一次重扫——预期 Error 清零、Warning 仅剩 License（缓存）与已解释
项；然后打 `1.0.2` tag 走一次带 attestation 的正式 Release，再去 community.obsidian.md 提交。

**验证方式**：`npm test` 328 passed（含改造后的 Backlink 假 vault 用例）/ `npx tsc -noEmit` /
`npm run lint` / `npm run format:check` 全绿；`grep` 复核 src 零 `as TFile`、零
`instanceof InputEvent`；`getLanguage` 的 `@since 1.8.7` 已对照 obsidian.d.ts 原文确认。

---

## 2026-07-03 1.0.1 商店完整扫描反馈修复：源码 Error/Warning 清零（claude/obsidian-plugin-review-fixes-8fy6ck）

**做了什么**：用户带回 Community Hub 的**完整扫描报告**（比上周期多出源码级检查），逐项修复。
本次含行为变化（命令 ID、语言探测、minAppVersion），按 §4.1 bump 到 **1.0.1**。

- **Error：`as any` + 无说明 eslint-disable（main.ts 98/177/196/818/820，审核明确不允许）**：
  五处全部消灭——① `metadataTypeManager`（内部 API）改用 `App & { metadataTypeManager?: … }`
  结构化收窄；② file-open 播种改用**公开** `vault.cachedRead`（typings 一直有，原 any 属历史包袱）；
  ③ rename/delete 快照同步改用**公开** `vault.on("rename"/"delete")` 重载；④⑤ `syncBacklinks` 的
  `getBacklinksForFile`（仍是半公开，1.13 typings 依旧未声明）以「可选方法」形状收窄，新增纯函数
  `backlinkMap()` 适配裸 Map / `{data:Map}` 两种返回形状。src 现已零 `any`、零 eslint-disable。
- **localStorage 语言探测（Behavior 标记 + Warning）**：`detectObsidianLang` 改走官方
  `getLanguage()`（1.8.0+）；obsidian devDep 1.7.2 → 1.13.1（取类型）；**minAppVersion 1.4.0 →
  1.8.0**（getLanguage 硬下限；顺带满足 css-scrollbar 的 Chromium 版本要求）。obsidian-mock 补
  `getLanguage` 替身（`__setMockLanguage` 可注入返回值/抛错），i18n.test 三个用例改走替身。
- **命令 ID 含插件 ID**：`toggle-auto-headings` → `toggle-auto-numbering`（Obsidian 注册时自动加
  `auto-headings:` 前缀）。副作用：已给旧命令设过快捷键的用户需重新绑定（上架前改，代价最小）。
- **`document` → `activeDocument`（弹出窗口兼容）**：main.ts IME 组合监听两处 +
  WhitelistEditor 行内编辑 `createElement` 一处。
- **Promise-in-void 回调（8 处）**：EditPanel / PathRules / WhitelistEditor 里 `addEventListener`
  的 `async` 回调统一改同步包装 `void fn()` / `void save().then(…)`，执行顺序不变。
- **多余类型断言（5 处）**：GeneralTab 语言三元、PathRules `createEl("datalist")`、
  `(e as InputEvent).isComposing` ×3 改 `e instanceof InputEvent && e.isComposing`。
- **`builtin-modules` 依赖（Warning，es-tooling 建议弃用）**：esbuild.config 改用官方
  `node:module` 的 `builtinModules`（含 `node:` 前缀双份 external），依赖已卸载。
- **CSS `!important`（4 处）**：分段控件选中态 / 活动 TAB 改为 `button.类.类` 叠写特异性
  （(0,2,1)，压过主题的类级规则）；主题若也用 !important 仍会盖过，属主题侧问题，注释已注明。
- **TemplateStore `JSON.parse` 未类型化**：显式标注 `unknown`（下游 `normalizeTemplate` 本就收
  `unknown`）。
- 扫描报告里的 License / README 两条 Warning 经核实**已在上周期修掉**（报告是旧快照）；
  「Vault Enumeration」标记来自 `getMarkdownFiles`（全库清除编号功能所必需）属合理使用，不改。

**没做什么**：未验证 Community Hub 重扫结果（需用户推 master 后触发）；未对 activeDocument 做
多弹出窗口的完整覆盖（仅活动窗口注册，与原 document 行为等价，真正的多窗口 IME 覆盖属 backlog）；
旧命令 ID 未做迁移兼容（上架前无存量用户）。

**下一步**：推 master 后回 Community Hub 触发重新扫描，确认 Error 清零、Warning 只剩可解释项
（如主题级 CSS 判定若仍报，可在提交说明里引用本块理由）；随后继续商店审核流程。

**验证方式**：`npm test` 328 passed / `npm run test:fuzz` 通过 / `npm run lint`、
`npm run format:check`、`npm run build`（tsc 严格类型检查）全绿；`grep` 复核 src 零
`as any`、零 `eslint-disable`、零裸 `document`；`npm run release` 产物已重建入库。

---

## 2026-07-03 1.0.0 商店自动审核反馈修复：README 占位符 + LICENSE 无法识别（claude/plugin-repo-audit-avuhui）

**做了什么**：用户提交后收到 Obsidian Community Hub 自动审核的两条 Warning，逐条修复。**纯文档
改动、不涉及行为/产物**，按 §4.1「上架后策略」不 bump manifest 版本，只记本条 log。

- **README 占位符警告**：审核器逐字扫描源码文本里的字面 `TODO`，命中 `README.md`/`README.zh.md`
  里各一行 `<!-- hero screenshot / GIF 占位 -->` 注释——尽管渲染后不可见，源码里确有 `TODO` 字样。
  用户此前已决定不做 GIF、纯文字说明足够撑起上架，故直接删掉这两行占位注释（不是留白等着填，是
  确认这次发布就不需要它），警告随之消失。
- **LICENSE 无法识别警告**：排查发现现有 `LICENSE` 文件其实是 **MIT + Commons Clause（禁商用）+
  Anti-996** 三段拼接、且自相矛盾——MIT 正文写"可自由使用/复制/修改/**出售**"，紧接着 Commons
  Clause 又说"不得商用"，GitHub 的 `licensee` 库（Obsidian 该警告大概率的数据来源）做的是模糊
  文本比对，认不出这种自定义拼接文本，判定"无法识别标准许可证"。
  查证 `licensee` 当前收录的许可证列表（57 个，`cc-by-4.0`/`cc0-1.0`/`mit` 等）**不含任何非商业
  许可证**——CC-BY-NC 系列、PolyForm Noncommercial 均不在其中。这意味着用户最初想要的"非商业+
  消除警告"两个目标**互斥**：换成任何真实的非商业许可证文本，警告大概率依然存在（该工具压根不
  认识这类许可证）。就此用 `AskUserQuestion` 请用户裁决，用户选择**优先消除警告**——改回纯净、
  未加料的标准 MIT 文本（保留原 `Copyright (c) 2025 AArlert`），删掉 Commons Clause 与 Anti-996
  两段。

**没做什么**：未保留非商业限制（用户主动放弃，换取许可证可被识别）；未额外验证 Community Hub
的警告扫描器是否真的就是调用 GitHub `licensee`（是我方合理推断，未见到官方文档明确写死数据源，
但两处线索一致——① Obsidian 提交要求页原话提到需要"LICENSE 文件"、② licensee 是 GitHub 生态
里事实标准的许可证检测工具）；未重新提交 Community Hub 审核（是用户下一步的动作）。

**下一步**：用户把改动推到 `master`（这次 Agent 已代为 commit + merge）后，回 Community Hub 页面
触发重新扫描 / 重新提交，确认两条 Warning 是否清零。

**验证方式**：`npm test`（328 passed，未受影响，纯文档改动）/ `npm run lint` / `npm run format:check`
全绿；`grep -n -i "TODO"` 复核 README 两个文件已无残留；`LICENSE` 手工核对确认只剩单一 MIT 正文、
无拼接痕迹。

---

## 2026-07-03 1.0.0 版本转正 + 新增 Release 自动化（用户明确指示直接上架，claude/plugin-repo-audit-avuhui）

**做了什么**：用户看完上一周期的审计结果后明确表态「直接 1.0.0，准备上架」，不再等 testplan 里
M18/J9/K12/L17/L22/K11/E14/E16 等手感项逐条实机验完——这是用户的选择，本轮**没有**替用户跑这些
验证、也没有把它们的状态标注为已验证（testplan 对应行保持原状态，如实反映"未验证但用户接受直接
上架"，不是"已验证"）。

- **`npm run bump 1.0.0`**：0.7.27 → 1.0.0。`manifest.json`/`package.json`/`package-lock.json`/
  `versions.json`/`release/manifest.json` 一键同步。上架后版本策略自此生效：仅行为/产物变化才
  bump manifest，纯文档改动只记 log（`spec.md` §5 M7 已有此约定，见 §4.1）。
- **新增 `.github/workflows/release.yml`**：此前只有 `npm run release` 把产物同步进本地
  `release/` 目录入库，**没有对外发布的自动化**——真要发 GitHub Release 仍得手动上传三个文件。
  新增的 workflow 在推送任意 tag 时触发：`npm run build` → `gh release create <tag> --generate-notes
  main.js manifest.json styles.css`。用 Actions runner 自带的 `gh` CLI（无需额外配置 token，
  `GITHUB_TOKEN` 由 Actions 自动注入，workflow 声明 `permissions: contents: write`）。tag 名与
  manifest version 完全一致、不带 `v` 前缀，满足 Obsidian 商店对 Release 命名的硬性要求。
  这个能力此前完全没有——GitHub MCP 工具集里没有"创建 Release"这个操作，Agent 自己不能越权
  帮用户点 GitHub 网页按钮，所以补一条 CI 是唯一能让"打 tag = 有 Release"这件事可重复、
  不依赖人工点击的路径（下次改动想发新版本，打个 tag 就行，不用记着手动传三个文件）。
- **`doc/spec.md` M7 清单收尾**：「发布物料」「版本转正」「发布自检」标记完成（各自附带"未做
  什么"的老实说明——截图/GIF 仍是占位、user_tests 全量手动回归未逐条重跑，均是用户知情选择，
  不是遗漏）；「提交至 Obsidian 社区插件目录」保持未完成——这一步需要用户自己的 Obsidian
  账号登录 community.obsidian.md，Agent 没有、也不该有这个账号的访问权限。

**没做什么**：未替用户跑 testplan 里剩余的手感验证项；未生成截图/GIF（用户明确表示纯文字已够）；
未推送 `1.0.0` tag 触发 release.yml（是否现在就打 tag、正式对外发布，留给用户决定时机——workflow
已就绪，用户想发的时候 `git tag 1.0.0 && git push origin 1.0.0` 或在 GitHub 网页 Releases 页手动
打 tag 即可）；未替用户去 community.obsidian.md 提交（做不到，需要用户本人登录）。

**下一步**：用户视时机打 `1.0.0` tag 触发 GitHub Release → 去 community.obsidian.md 完成账号
登录 + 关联仓库 + 提交审核。上架后如有社区反馈的 bug/改动需求，回到「仅行为/产物变化才 bump」
的版本策略继续迭代。

**验证方式**：`npm test`（328 passed）/ `npm run lint` / `npm run format:check` 全绿；
`npm run release` 确认 `release/manifest.json` version 已是 `1.0.0`；`.github/workflows/release.yml`
本地过 `python3 -c "import yaml; yaml.safe_load(...)"` 校验语法合法（未实际触发，因为触发需要真实
推送 tag，留给用户决定时机）；`npm run docs` 校验通过。

---

## 2026-07-03 0.7.27 README 大改（卖点先行）+ 补回迁移遗漏的 CI/钩子（用户要求，claude/plugin-repo-audit-avuhui）

**做了什么**：延续上一周期的上架审计，处理用户追加的三项要求。

- **README.md / README.zh.md 重写**：原版是功能清单式写法，改为**痛点先行**——开篇三段直接点出
  「插入一节后手动改编号」「改标题名链接跟着断」「一种编号风格套不了整个库」三个真实用户痛点，
  再给出本插件的对应解法。`## Features` 从「亮点五条」展开为按主题分类的详细小节（编号引擎本身 /
  模板 / 路径规则 / 白名单 / Backlink 同步 / 清除命令 / 单文件覆盖 / 双语与移动端），补齐此前只在
  `spec.md` 里才有的细节——如白名单**点击词条原地编辑**、`=/≈/▸` 分段控件切换匹配方式带 tooltip、
  命中数角标 hover 列出具体标题、⚠ 子标题告警、过滤排序工具栏；模板的祖先序号渲染两种风格；路径
  规则拖拽排序 + 路径自动补全 + 无根规则告警。GIF/截图占位保留（用户明确暂不做，纯文字说明已足够
  支撑上架）。双语内容逐段对照，非机翻腔。
- **补回 monorepo 迁移时遗漏的基础设施**（用户提供原件，按单项目结构改写）：
  - `.claude/settings.json` + `.claude/hooks/session-start.sh`：远程会话启动自动 `npm install`
    + 启用 `.githooks`；原版按"monorepo 多 Addon 循环安装"写的，本仓库只有一个项目，简化为直接
    对仓库根操作。
  - `.githooks/pre-commit`：文档守卫。**原版有个在单项目仓库里会静默失效的 bug**——它用
    `find *//scripts/docs.mjs` 循环 + 路径前缀匹配来判断"本次提交是否触及该 Addon"，当
    `addon_dir` 恰好等于仓库根时，`${addon_dir#"$REPO_ROOT"/}` 因缺少末尾 `/` 不会被替换，
    `grep -q "^${addon_rel}/"` 用绝对路径去匹配 `git diff` 给的相对路径，永远匹配不上——文档守卫
    会被此仓库直接跳过、形同虚设。已重写为单项目版本：只要有暂存改动且
    `scripts/docs.mjs` 存在就直接跑 `--check`，不再需要按 Addon 循环判断。已本地跑
    `.githooks/pre-commit` 验证：无暂存改动时正常放行、有暂存改动时正确触发文档守卫并通过。
  - `.github/workflows/ci.yml`：原版按 `working-directory: obsidian-auto-headings` 子目录跑
    （monorepo 场景），本仓库根目录即项目根，去掉子目录层级直接在根跑 `npm ci`/`test`/`lint`/
    `format:check`/`build`。
  - `CLAUDE.md` §7 同步更新为「已配置」，说明补回的背景（历史备注）。
- **`npm run bump`**：0.7.26 → 0.7.27（README 改动 + 新增基础设施文件，非纯文档——按 CLAUDE.md
  §4.1 判断新增 `.github/`/`.githooks/`/`.claude/` 三类脚手架文件本身不影响插件运行时行为，但
  README 卖点改写会影响商店展示，与基础设施改动一并算一次版本递增）。

**没做什么**：未生成截图 / GIF（用户明确暂不做，README 占位保留，纯文字说明已足够支撑本轮上架）；
未处理上一周期登记的 testplan H8（`clearAllVaultNumbering` 潜在竞态，仍是 backlog）；未跑
`npm run bump 1.0.0`（M7 手感验证项仍待用户实机确认）。

**下一步**：本次审计到此完成——按用户要求合并回 `master`；后续按上一周期梳理的路径继续：用户实机
验证 → 补截图/GIF（可选）→ `bump 1.0.0` → `community.obsidian.md` 提交。

**验证方式**：`npm test`（328 passed）/ `npm run lint` / `npm run format:check` 全绿（含新增
`.github/workflows/ci.yml`、`.claude/settings.json` 的 Prettier 格式化）；本地直接调用
`.githooks/pre-commit` 验证有/无暂存改动两种场景均按预期放行/拦截；`npm run docs` 校验通过。

---

## 2026-07-03 0.7.26 上架前审计：manifest id 违规修复 + 文档漂移订正（用户要求，claude/plugin-repo-audit-avuhui）

**做了什么**：用户要求全面审计本仓库能否上架 Obsidian 社区插件目录、交叉检查各文档、动手修复问题。

- **发现并修复硬性拦下项**：查证 Obsidian 官方规则（`docs.obsidian.md` 提交要求）明确
  「manifest id 不能包含 `obsidian`」，而本插件 `id` 一直是 `obsidian-auto-headings`——会被商店
  审核直接拦下。仓库尚未发布过任何 GitHub Release、也未提交过商店，改的成本最低；征得用户同意后
  改为 **`auto-headings`**（`name` 早已合规，不含 "Obsidian"/"Plugin"，未动）。同步更新：
  `README.md`/`README.zh.md` 手动安装路径示例、`src/templates/TemplateStore.ts` 注释、
  `scripts/sync-release.mjs` 注释、`spec.md` 开发环境搭建示例。**不改**的：frontmatter 开关键
  `obsidian-auto-headings`（`SWITCH_KEY`，用户数据协议，与 manifest id 无关，改它才是真破坏性变更）、
  `package.json` name 与 GitHub 仓库名 `AArlert/obsidian-auto-headings`（仓库标识，不受该规则约束）。
- **核实提交机制已变更**：`spec.md` M7 原描述的「提交至 `obsidianmd/obsidian-releases` PR」流程已被
  Obsidian 2026-05 上线的 Community Hub（`community.obsidian.md`）取代，改为网页端提交 + 自动化 /
  人工审核；已更新 spec.md 对应条目并保留前置要求（manifest 在默认分支 HEAD、GitHub Release 资产
  齐全、release name 与 manifest version 一致不带 `v` 前缀）。
- **`CLAUDE.md` 全文订正**（用户指出并授权）：本仓库是从私有 monorepo 迁移出的独立发布仓库，
  却仍原样携带 monorepo 版 `CLAUDE.md`——里面描述的多 Addon 结构（`chrome-tab-tree/` 等）、
  `<addon>/` 路径前缀、SessionStart 钩子/`.githooks/`/CI workflow 在本仓库均不存在。逐节核实后
  重写：`§1` 改为单项目结构说明、`§3.1` 路径去掉 addon 前缀、`§6` 多 Addon 表格改为指向
  `status.jsonl`/`log.md` 的一句话、`§7` 如实说明本仓库当前**没有** pre-commit/CI 自动化。
- **交叉检查发现的文档漂移一并修复**：`doc/log.md`/`doc/testplan.md` 中 `[CLAUDE.md](../../CLAUDE.md)`
  链接因迁移少了一层目录嵌套，实际应是 `../CLAUDE.md`（GitHub blob 相对路径验证过，`README.md` 里
  `../../releases/latest` 因 `/blob/<branch>/` 路径段的存在则确认无误、未动）；`README.zh.md` 安装段落
  漏了英文版有的「（一旦通过审核）」限定语，补齐中英一致。
- **代码层面顺带发现一处待修**（**未改代码**，只登记 backlog）：`clearAllVaultNumbering`（面板
  [清除全库编号]）逐文件用 `vault.read`+`vault.modify`，而非 M18 刚验证过更安全的 `vault.process`/
  编辑器内存写回路径——若目标文件此刻被打开且有未落盘编辑器改动，理论上与 M18 修复前同源竞态。
  未实测复现（窗口很窄），登记 `testplan.md` **H8** + `spec.md` §3.10，不阻塞本轮发布。
- **审计代码是否符合 Obsidian 官方开发规范**（`Plugin guidelines`）：`console.*`、`innerHTML`/
  `outerHTML`/`insertAdjacentHTML`、全局 `app`（非 `this.app`）、默认快捷键、Node/Electron API
  引入等逐项 `grep` 排查，均**未发现违规**；`isDesktopOnly: false` 的声明属实。
- 回答用户「Obsidian 允许 vibe coding（AI 辅助）插件吗」：查证无禁止性规定，官方 2026-05
  Community Hub 用自动化扫描 + 人工复核把关**代码质量与安全**，不问写作方式；已有插件在商店说明中
  公开披露部分代码由 AI 辅助编写的先例。

**没做什么**：未生成截图 / GIF（README 占位仍在，需实机 Obsidian）；未跑 `npm run bump 1.0.0`
（M7 尚有 J9/K12/L17/L22/K11/E14/E16 等待用户实机手感验证，未到转正时机）；未提交
Community Hub、未打 GitHub Release；未修复新登记的 H8（vault.modify 竞态）——留给下一周期评估是否
值得在 1.0 前动手。

**下一步**：用户实机手感验证遗留项 → 补截图/GIF → `npm run bump 1.0.0` → 在
`community.obsidian.md` 提交并打 `v1.0.0` Release → 视时间决定是否顺手修 H8。

**验证方式**：`npm test`（328 passed）/ `npm run lint` / `npm run format:check`（含本次修复
`CLAUDE.md`/`README.md` 的既存格式化漂移）全绿；`npm run bump` → `npm run release` 确认
`release/manifest.json` id 已更新为 `auto-headings`、zip 重命名为 `auto-headings.zip`；
`npm run docs` 校验通过（周期块 3/3、状态行 13/13、目录树与磁盘一致）。

---

## 2026-07-03 0.7.25 修复「清除编号」自链接竞态致清除不生效（testplan M18，用户实测报告）（claude/numbering-clear-bug-fix-e4woim）

**做了什么**：修复用户实测报告的 bug：文件已格式化 → 关全局自动编号 + 单文件 `fm:false`（编号冻结，
符合预期）→ 跑「清除编号」→ Notice 提示「已清除编号」但文件其实**没变**（预期外）→ 切到别的文件再
切回、重跑「清除编号」才真的清掉。

- **根因定位**：正文里有一条指向本文件自己标题的内链（如 TOC 常见的 `[[#1 简介]]`）时，
  `syncBacklinks` 把「引用方 = 本文件自身」这一支也交给 `vault.process` 处理——但 `vault.process`
  读的是 vault 缓存 / 磁盘内容，而本文件此刻的 `editor.transaction`（刚做的清除）**尚未被 Obsidian
  自动保存**，二者异步竞态：`vault.process` 读到旧内容，写回覆盖掉刚发生的清除。Notice 在 transaction
  那一刻已经据实弹出（清除确实发生过），只是随后被这次读盘覆盖悄悄撤销，故用户看到「说清了但没变」。
  `spec.md §3.12` 此前已把这类冲突登记为「已知限制」，本轮实修而非继续搁置。
  再次切换文件重跑能成功，是因为第二次 `syncBacklinks` 用的改名表基线（`headingSnapshots`）已对齐
  第一轮清除后的状态、算出**空改名表**，从而完全跳过了那次会覆盖内容的 `vault.process` 调用——纯属
  巧合而非设计如此，验证了竞态假说但并非可依赖的绕过方式。
- **`main.ts` 新增 `foldSelfBacklinks(target, oldContent, newContent)`**：本文件自身这一支不再走
  `vault.process`——改名表在手（`computeSnapshotRenames`/`computeHeadingRenames`，与原 `syncBacklinks`
  同一套口径）后，直接对**内存里的** `newContent` 做 `rewriteBacklinksInContent` 字符串重写，随原
  编号/清除**同一个** `editor.transaction` 一起写回。不读盘、不异步，天然无竞态。`applyRenumber` /
  `runClearNumbering` / `runClearForeignNumbering` 三处写回入口统一接入。
- **`syncAndSnapshot`/`syncBacklinks` signature 简化**：改名表由 `foldSelfBacklinks` 算好传入，
  不再各自重算；`syncBacklinks` 只处理**别的**引用文件，且显式 `sourcePath === target.path` 时
  `continue`（避免万一 `getBacklinksForFile` 报出自身、重新踩回竞态）；本文件自链接命中数并入最终
  Notice 合计。
- **`doc/spec.md §3.12`**：流程步骤改写为「①算改名表 → ②同文件内链就地折叠（新）→ ③反查别的引用方
  → ④重写 → ⑤写回」；「已知限制」条目划掉标注 0.7.25 已修，写清根因与修法。`doc/testplan.md` 新增
  **M18**。

**没做什么**：未处理「**别的**文件正被打开且有未保存改动」这类更广的竞态（testplan M12，仍 🔲）——
那是「引用方 ≠ 本文件」的情形，`vault.process` 依然是唯一可行的写回方式（我们管不到别的文件的编辑器
缓冲区），属不同性质的限制，留 backlog。未改 `rewriteBacklinksInContent`/`computeHeadingRenames` 等
纯函数本身（无 bug，问题完全在 `main.ts` 的写回时机与路径选择）。

**下一步**：用户实机复验 M18（按报告的完整操作序列：关全局自动 + `fm:false` → 清除编号 → 确认 Notice
与文件内容一致，不必切换文件即可成功）；连同上一周期遗留的 J9/K12/L17/L22/K11（及 E14/E16）一并
验收 → M7 截图/发布自检 → bump 1.0.0。

**验证方式**：新增 `main.test.ts` 两条回归（328 passed）——①自链接随清除编号原子写回（同一事务，
`txnCount===1`）；②竞态哨兵值：即便 mock 的 `getBacklinksForFile` 把本文件自身也列为引用方、且
vault 侧有一份「未落盘旧内容」的哨兵值，清除后哨兵值**不被触碰**（证明不再经 `vault.process` 读改写
自身）。用临时切回旧版 `main.ts` 复验：同样两条测试在旧实现下确实失败（自链接完全未更新），确认
测试真实捕获了该 bug。`npm test`（328 passed）/ `npm run lint` / `format:check` / `npm run test:fuzz`
（5000×80）全绿；`npm run release` 重建 `release/`。

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
