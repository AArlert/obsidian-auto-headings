# M. Backlink 同步（M7） — dev（纯函数 + 集成）+ user（Obsidian 解析手验）

> 开关 `updateBacklinks` **0.7.11 起默认开**（曝光度决策，见 spec §3.12；内测期曾默认关）。编号 / 清除改写标题文本后，更新别处指向旧标题锚点的内部链接。
> 见 spec.md §3.12。纯函数核心在 `backlinks.test.ts`，触发接线在 `main.test.ts`，往返不变量纳入 UVM（见 §4）。
>
> **不依赖编号模板的触发路径（M19–M25，2026-07-10 落地，CR-18，见 spec §3.12「独立于编号模板的触发」，
> 1.0.9 并入 `updateBacklinks` 单开关全局生效）**：`updateBacklinks` 开启后，文件无可用模板、或全局
> 自动编号关且未 `fm:true` 强制时，即便 `applyRenumber` 本轮不会跑，只要标题文本对照
> `headingSnapshots` 快照基线发生了改写，仍复用 `foldSelfBacklinks`/`syncBacklinks` 同步引用链接，
> **跳过 `renumberContent`**（本路径永不写入编号前缀）。仍尊重文件级 frontmatter 显式 `false`（用户
> 对该文件的「别碰」表态优先级最高）；清除全库进行中同样压制，避免批量写回期间被放大。1.0.8 曾以
> 独立开关 `backlinkStandaloneTrigger`（默认关）opt-in 该行为，1.0.9 起随 `updateBacklinks` 默认全局
> 生效，字段已删除。

| ID | 操作 | 预期 | 状态 |
|----|------|------|------|
| M1 | 开关开：`## 简介` 首次编号，别处有 `[[a#简介]]` | 链接更新为 `[[a#1 ⁠简介]]`（**保留 WJ**，字节对齐含 WJ 的标题以能解析）；Notice「已更新 1 处内部链接」 | ✅（`main.test.ts`）|
| M2 | 开关**关**：同 M1 | 引用文件**不被触碰** | ✅（`main.test.ts`；0.7.11 起默认开，关闭为显式 opt-out）|
| M3 | 重排 `1.1`→`1.2`：`[[a#1.1 简介]]` | 更新为 `[[a#1.2 简介]]` | ✅（`backlinks.test.ts` 改名表 + 重写）|
| M4 | 清除当前文件编号：`[[a#1 简介]]` | 还原为 `[[a#简介]]` | ✅（`main.test.ts`）|
| M5 | 保留别名 / 嵌入：`[[a#简介\|看这里]]` / `![[a#简介]]` | 锚点改、别名与 `!` 保留 | ✅（`backlinks.test.ts`）|
| M6 | basename 命中：`[[notes/a#简介]]` / `[[a.md#简介]]` | 命中并改；`[[other#简介]]` 不改 | ✅（`backlinks.test.ts`）|
| M7 | 同文件内链 `[[#简介]]` | 仅源即目标文件时改 | ✅（`backlinks.test.ts`）/ 🔲 Obsidian 手验 |
| M8 | 块引用 `[[a#^blk]]` / 多级锚点 `[[a#A#B]]` | 保守**跳过不改** | ✅（`backlinks.test.ts`）|
| M9 | 重复同名标题（`## 附录` × 2） | 锚点歧义 → 改名表剔除、**不改**（保守，已知限制） | ✅（`backlinks.test.ts`）|
| M10 | 标题文本未变（幂等触发） | 不产生链接改动、不弹 Notice | ✅（`main.test.ts`）|
| M11 | **WJ 与解析**：编号标题含 WJ，写出的链接 | 链接**保留 WJ**（`displayAnchor`）→ 与含 WJ 标题字节对齐 → Obsidian 能解析 | ✅ 修复（0.7.3，`backlinks.test.ts displayAnchor`）/ 🔲 Obsidian 复测 |
| M13 | **只在编号改写标题时同步**：标题已是编号态，之后手敲不匹配的 `[[a#旧名]]` | **不主动修**（无标题变更触发）；需一次真实编号变更才会同步——设计取舍 | ✅ 设计（spec §3.12）|
| M12 | 大库 / 多引用文件性能；被引用文件正打开且有未保存改动 | 不卡顿；冲突属边角、已知限制 | 🔲 手验 |
| **M14** | **纯文本改名**：`## 细目甲` 改为 `## 细目甲改**名**`（编号不变），别处有 `[[a#1 ⁠细目甲]]` | 链接更新为新标题锚点；链式改名连续有效；编号侧无写回（txn=0）也同步 | ✅（0.7.8：`headingSnapshots` 快照基线——文件打开播种、每次插件写回刷新；`computeSnapshotRenames` 按**序**配对（行号可因正文增删移位）。`main.test.ts` + `backlinks.test.ts` 覆盖）|
| M15 | 编号与文本**同时**改（改标题正文后防抖编号触发） | 链接同时更新编号段与文本段（一步到位） | ✅（0.7.8，快照口径天然覆盖；`main.test.ts` 白名单改名场景）|
| M16 | 改名**同轮**还增删了标题 / 改了层级（快照结构不匹配） | **保守回退**「编号前→编号后」口径：编号侧改名仍同步，纯文本改名当轮放弃（避免按序错配） | ⚠️ 设计取舍（0.7.8，`main.test.ts` 回归；下轮编辑结构稳定后文本改名恢复可见）|
| **M17** | **默认开**（0.7.11 曝光度决策）：新装 / 旧 data.json 缺失字段 | `DEFAULT_SETTINGS.updateBacklinks === true`；缺失字段迁移为开；显式设过 `false` 保留 | ✅（`settings.test.ts`；迁移逻辑 `main.loadSettings`）|
| **M18** | **用户实测报告的 bug**：文件已格式化，关全局自动 + `fm:false`（编号冻结符合预期），文件正文里有指向自己标题的 `[[#锚点]]`；跑「清除编号」 | 旧版：Notice 提示「已清除编号」但文件实际未变（`vault.process` 读到本文件未落盘的旧内容、写回覆盖掉刚做的清除）——切到别的文件再切回、给足时间落盘后重跑才会成功 | ✅（0.7.25 实修：`foldSelfBacklinks` 把「引用方=本文件自身」直接对内存 `newContent` 重写、随原编号/清除同一个 `editor.transaction` 写回，不再经 `vault.process` 读盘，无竞态；`main.test.ts` 两条回归：自链接原子写回 + 竞态哨兵值不被覆盖）|
| **M18** | **首次说明 Notice**：首次实际改写引用文件 | 弹一次较长说明（改了什么 / 不在 undo 内 / 在哪关），`backlinksIntroShown` 持久化，此后只弹常规计数 Notice | ✅（0.7.11，`main.test.ts`）|
| **M20** | **`updateBacklinks` 开 + 无模板**：文件无可用模板，`## 甲` 改为 `## 甲改`，别处有 `[[a#甲]]` | 不写入任何编号前缀（`renumberContent` 全程未被调用，`ed.txnCount` 反映的仅是自链接折叠）；引用链接同步为 `[[a#甲改]]` | ✅（`main.test.ts`） |
| **M21** | **全局自动编号关且未 `fm:true`**：文件命中模板但 `autoNumber` 关、无 `fm:true` 强制，标题改名 | 不写编号（仍受全局开关约束）；链接仍同步 | ✅（`main.test.ts`） |
| **M22** | **frontmatter `false` 优先**：`updateBacklinks` 开，文件 `fm:false`，标题改名 | 不触发（显式关闭覆盖一切自动路径，与 `shouldAutoTrigger` 对 `fm:false` 的处理口径一致） | ✅（`main.test.ts`） |
| **M23** | **依赖总开关**：`updateBacklinks` 关，无模板文件标题改名 | 不触发编号，也不同步链接（总开关关闭时该路径完全不生效） | ✅（`main.test.ts`） |
| **M24** | **清库压制**：`vaultClearInProgress` 置位期间，`updateBacklinks` 开，编辑器 `editor-change` 触发 | 该路径同样被压制，避免批量写回期间被放大 | ✅（`main.test.ts`） |
| **M25** | **常规路径优先、不重复同步**：文件命中模板且够格自动触发，标题改名 | 只走常规 `applyRenumber` 一次（含其内置的 backlink 同步），不叠加该路径的第二次同步（无重复 Notice / 计数翻倍） | ✅（`main.test.ts`） |
| **M26** | **Markdown 标题链接同步**：标题改名或编号变化时，引用方含同文件 / 跨文件 / 相对路径的 `[label](note.md#heading)` 与 `![alt](note.md#heading)`，并混有 URL 编码、angle destination、可选 title、外链、block、多级 fragment、转义语法及代码区文本 | 仅更新目标 Markdown inline link/image 的 heading fragment，并统一 URL 编码新 fragment；label、路径、title 与 `!` 原字节保留；外链、纯文件、block、多级 fragment、坏编码、转义链接、行内代码与 fenced code 保守不动；既有 Wikilink 同步及统一计数保持 | ✅（1.1.2，`backlinks.test.ts` 9 例 + `tests/user_tests/12-Markdown标题反链.md` + NesDev / Obsidian 1.12.7 运行态回读） |
| **M27** | **Markdown 链接同步保守边界补强（PR #8 审核修复）**：标题改名时，引用方含 `%%…%%` / `<!--…-->` 注释内的链接、`[[wikilink]](literal)` 形态（wikilink 后紧跟括号段）、以及单行数万未闭合 `[` / `[x](` 的病理长行 | 注释区间与 fenced / inline code 一并排除、注释结束同行的链接照常改写；`[[…]]` 整段跳过、其后的括号段按字面文本保留（不二次改写、计数不重复）；行级括号配对表 O(n) 预处理后长输入线性时间完成、病理行不改写任何链接 | ✅（1.1.2，`backlinks.test.ts` 新增 5 例：注释中 / 注释未闭合 / wikilink+括号段 / 嵌套未闭合 label 内层仍改 / 2 万未闭合 `[` 快速完成） |
