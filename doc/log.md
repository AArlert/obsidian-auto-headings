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

## 2026-07-25 1.0.15 三处「用户已表态、插件仍自作主张」：清除即暂停 / 不抢键盘 / 迁移守卫误伤

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
│   ├── pathrules.ts        路径规则 → 模板解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── settings/
│   │   ├── model.ts        设置数据模型（全局开关、防抖延迟、路径规则持久化）
│   │   ├── SettingsTab.ts  设置 GUI 壳：TAB 栏 + 分发（内容在 tabs/，M7 多 TAB 已拆完）
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关、复制净化开关）
│   │       ├── TemplatesTab.ts    模板列表（自绘 header：折叠/命名/删除）
│   │       ├── EditPanel.ts       模板编辑面板（级别格式网格 + 跳级/占位字符）
│   │       ├── WhitelistEditor.ts 白名单行编辑器（分段控件/行内编辑/命中角标）
│   │       ├── PathRules.ts       路径规则表（拖拽排序/建议弹窗/根规则/删模板确认）
│   │       ├── PathSuggest.ts     路径建议弹窗组件（非 TAB，供 PathRules.ts 用，1.0.4）
│   │       ├── DangerTab.ts       敏感操作（清除全库编号）
│   │       └── AboutTab.ts        关于/帮助/鸣谢
│   └── templates/
│       ├── schema.ts       模板 schema 校验/序列化/文件名安全化
│       └── TemplateStore.ts 模板文件 CRUD（vault adapter 读写 templates/*.json）
├── tests/                ← 测试
│   ├── dev_tests/          自动化单元测试（Vitest，无需 Obsidian 运行时，npm test 跑它）+ uvm/ 压测框架
│   └── user_tests/         可复制粘贴进 Obsidian 实测的 .md 样例（每个对应 testplan 某场景）
├── README.md             ← 面向读者的简介（核心功能 + Milestone 概览，入口文档）
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A）
├── release/              ← 可分发插件文件（main.js/manifest/styles/README；zip 本地生成不入库）★每周期必更新
├── scripts/
│   ├── sync-release.mjs    把构建产物同步到 release/（被 npm run release 调用）
│   ├── bump.mjs            一键版本号同步（npm run bump）
│   ├── fuzz.mjs            跨平台跑重型随机压测（npm run test:fuzz [-- --runs=/--ops=/--seed=]）
│   └── docs.mjs            文档维护：归档/滚动/摘要/守卫/交接（npm run docs [-- --handover|--check]）
├── .claude/agents/       ← SubAgent 定义（quality-gate / repo-scout / mech-editor / feature-coder）
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
