# 4. 随机序列压测（UVM 风格）★

状态转移 bug 的组合是**爆炸**的，手写穷举不现实。引入借鉴硬件验证 **UVM** 的**约束随机序列**框架（`tests/dev_tests/uvm/`，入口 `random_sequence.test.ts`）：随机生成「编辑文本 / 改模板 / 触发编号」的长序列，用**记分板**自动判对错，并以**功能覆盖率**确认真撞到了关心的场景。随 `npm test` 默认跑 500 条×60 步（<2s），重型用 `npm run test:fuzz`。

> **分工**：框架**怎么用**（组件映射、文件分工、两种模式、跑法、复现失败、加新操作）的唯一出处是
> [`tests/dev_tests/uvm/README.md`](../../tests/dev_tests/uvm/README.md)；本章只登记**验证了什么**——记分板、约束、覆盖范围。

**记分板互补**：

- **参考记分板**（默认模式，常绿）：维护「裸文档真值 `bare`」与「编辑器文本 `rendered`」锁步状态，每次触发后断言 `join(rendered) === renumberContent(serialize(bare), 当前模板)`——旧前缀剥干净时相等，任何叠加/残留当场被抓。
- **幂等性记分板**（explore 模式）：断言 `renumber(renumber(x)) === renumber(x)`，恒成立与配置无关，专逮「再触发就变样」的多次侵蚀（U1 正是它逮到的）。
- **Backlink 往返记分板**（M7，两种模式都跑）：每次触发后对「编号前→后」文本断言 `src/backlinks.ts` 的**改名表幂等**（`computeHeadingRenames(after, after)` 为空）+ **链接重写往返一致**（指向旧标题的 `[[Target#旧]]` 重写后恰指向同一标题的新名）。在整个随机编号空间压测 backlink 核心；覆盖率新增 `backlink-rename` bin。8000×80 全绿。
- **S4 清除还原 / S5 清外来不动**（0.7.5，参考模式）：把清除命令 `clearNumberingContent`/`clearForeignNumberingContent` 纳入激励空间，断言「清除编号还原裸文档」「清外来不动自家 WJ 编号」（裸文档为 clear 定点时施加）。
- **S6 两层门控**（0.7.5，两种模式）：用真实 `readFileSwitch` + 全局 `autoNumber` 决定自动触发是否放行（手动触发绕过），断言门控关时 `rendered` 冻结、且真实开关解析与结构化 fm 状态一致。
- **S7 模板解析稳定**（0.7.6，两种模式）：`World` 为多文件 + 多模板 + 路径规则仓库；每次触发前 `checkResolution` 断言无悬挂引用（建/删/改名同步正确）+ 锚点恒在 + 真实 `resolvePathRule` 与独立参考解析一致。多文件各按路径解析不同模板，跨模板残留（B2/B3）由参考模型每文件压测。8000×80 + 20000×80 三记分板全绿、未发现引擎 bug。

**约束 = 当前 strip 健壮性的精确刻画**（每条默认模式约束对应一个已登记 bug/取舍，故 CI 常绿；explore 模式放开全部约束、改用幂等性记分板专门找 bug）：

| 约束 | 对应 | 状态 |
|------|------|------|
| ~~`prefix`/`suffix` 整条序列固定~~ → 现在「空 ↔ 候选」随机切换，并传并集给剥离 | B2/B3（改前后缀后剥不净）| ✅ 已放开（0.3.18）|
| ~~回避数字/字母起头标题~~ → 现在恒喂全部标题（含 `2024 总结`）| L2（数字起头标题的历史相关吃号）| ✅ 已放开（0.3.18）|
| ~~`inherit` 仅当前前后缀都空时才翻转~~ → 现在可在非空前后缀下翻转 | B8（实测无叠加、幂等，原约束过保守）| ✅ 已放开（0.6.2）|
| ~~`topLevel` 只减不增~~ → 现在可双向随机，升高后两侧一致 | C3 | ✅ 已放开（0.6.0）|
| 默认模式随机样式只用 arabic/cjk/circled（不混字母/罗马）| 历史约束（原因 L1/U3 已随方案A失效）| 保守保留；放开 = 下一轮压测专项（放开后仍绿即可删）|
| 默认模式不用脏标题 / 不破坏前缀区 | E5 / U1 / U2（侵蚀 / 标点 titleSep 吞数字）| 仍约束（U1/U2 已修；explore 模式仍放开探索幂等性）|

> **放开约束 = 扩大覆盖**：每修好一个 bug，就放开对应约束让框架自动覆盖更大空间；放开后若变红说明修得不彻底。

## 4.1 覆盖范围：用户全部操作 × UVM ★

把**真实人类会触及的全部操作**逐一映射进 UVM，每个可纯函数化的操作配一条**恒成立的不变量**。
清除命令（S4/S5）、两层门控（S6）、多文件 + 多模板 + 路径规则（S7）、标题降级残留均已落地
（0.7.5 / 0.7.6 / 0.7.20，实现过程见 `log-archive.md` 对应周期块）。

### 4.1.1 人类操作全清单 × UVM 覆盖状态

| 面 | 操作 | DUT / 语义 | 现状 |
|----|------|-----------|------|
| 编辑器 | 增删标题/正文/代码块、改标题文本、改层级 | `renumberContent` | ✅ 已覆盖 |
| 编辑器 | **把标题删光 `#` 降级为正文**（残留 WJ 哨兵 + 编号） | `renumberContent` ③ 残留清理 | ✅ 已建模（`demoteHeading` 激励 + `demote-heading` bin，0.7.20；参考模型自动校验残留清净）|
| 编辑器 | 改 frontmatter 开关 `obsidian-auto-headings: true/false/非法/删除` | `readFileSwitch`→`shouldAutoTrigger` | ✅ 已建模（`setFrontmatterSwitch` + S6，0.7.5）|
| 命令 | 立即重新编号（手动路径，绕过开关/防抖）| `renumberContent` | ✅ 区分手动/自动路径（`manualTrigger` vs `trigger`，0.7.5）|
| 命令 | **清除当前文件编号** | `clearNumberingContent`（全样式并集，独立模板）| ✅ 已建模（`clearNumbering` 激励 + S4，0.7.5）|
| 命令 | **清理非本插件编号**（WJ 感知）| `clearForeignNumberingContent` | ✅ 已建模（`clearForeign` 激励 + S5，0.7.5）|
| 命令/面板 | 切换全局自动编号 `autoNumber` | 门控 `shouldAutoTrigger` | ✅ 已建模（`setAutoNumber` + S6 门控，0.7.5）|
| 面板 | 切换 Backlink 同步开关 `updateBacklinks` | 门控 `syncBacklinks` | 🚫 门控属集成层（main.ts），留 `main.test`（M2）；纯函数往返已压 |
| 面板 | 防抖滑块/重置、语言下拉 | 时序 / 文案 | 🚫 不入 UVM（无文本语义，留手验）|
| 路径规则 | 增/删/改 pattern、改规则模板、拖拽排序、加根规则 | `resolvePathRule` | ✅ 已建模（`addRule`/`deleteRule`/`editRulePattern`/`setRuleTemplate`/`reorderRule` + S7，0.7.6）|
| 模板管理 | 新建/删除（降级·改投·连删）/重命名（同步规则）| `TemplateStore` + 规则同步 | ✅ 已建模（`createTemplate`/`deleteTemplate`/`renameTemplate` + S7 无悬挂，0.7.6）|
| 多模板共存 | 剥离用**全模板前后缀并集** | `strippableAffixes()` | ✅ 多模板真实并存；并集取「共享候选池」上界（方案 A，见下注）|
| 多文件 | 不同文件按路径命中**不同模板** | 每文件独立状态 + resolvePathRule | ✅ 已建模（`files[]` + `switchFile` + 每文件解析模板，0.7.6）|
| 危险区 | 清除全库编号 | `clearAllVaultNumbering`（逐文件 clearNumbering）| ⚠️ 单文件 clear（S4）已压；全库批量循环 + 防抖压制已有 `main.test` 回归（H6，0.7.11）|
| GUI | 白名单命中预览、拖拽/补全/滚动/折叠、光标保留 | DOM | 🚫 留 `main.test`/`user_tests`（L4–L8、J6）|

> **剥离并集口径（0.7.6）**：全部模板**共享同一前后缀候选池**（`{"", prefixCandidate}` / `{"", suffixCandidate}`），
> 故固定并集 `["", 候选]` 恒等于真实 `strippableAffixes()` 全模板并集的上界——文件在模板间切换、用旧模板前缀写出的
> 历史编号仍被剥净（跨模板 B2/B3 由参考模型在每文件压测）。**未建模的边界（backlog）**：若放开「各模板用
> 不同候选」并按**活模板**动态算并集，则删掉某含唯一前缀的模板会让旧文件留下无法剥离的孤儿残留（真实插件
> `strippableAffixes()` 只并活模板）——这是「删模板」的真实边角，留作后续 explore 专项。

### 4.1.2 不变量 S4–S7（恒成立的记分板）

| ID | 不变量 | 逮什么 | 状态 |
|----|--------|--------|------|
| **S4** 清除还原律 | `clearNumberingContent(renumberContent(bare)) === bare` | 编号器写的 WJ 前缀，全样式并集剥离器须能剥净还原 | ✅ 已实现（0.7.5，8000×80 全绿）|
| **S5** 清外来不动律 | `clearForeignNumberingContent(renumberContent(bare)) === renumberContent(bare)` | 自家 WJ 编号不被「清外来」误碰（WJ 边界正确性）| ✅ 已实现（0.7.5，8000×80 全绿）|
| **S6** 门控冻结律 | autoTrigger 在 `shouldAutoTrigger=false`（fm:false 或全局关且非 fm:true）时 rendered 不变；真实 `readFileSwitch` 解析与结构化 fm 状态一致 | 门控误放行 / 冻结失效 / fm 解析错 | ✅ 已实现（0.7.5，8000×80 全绿）|
| **S7** 模板解析稳定律 | ① 无悬挂引用：每条规则引用的模板都存在（建/删/改名后同步正确）；② 锚点「默认」恒在；③ 真实 `resolvePathRule` 与独立参考解析一致（精确文件＞最长文件夹＞根，并列取后者）；旧前缀仍可剥净（参考模型保证）| 规则同步漏改 / 解析分叉 / 删模板留悬挂 | ✅ 已实现（0.7.6，`checkResolution`，8000×80+20000×80 全绿）|

> **S4/S5 的排除项（实测确立，0.7.5）**：只在「裸文档本身是 clear 的定点」（`clearNumbering(bare)===bare`
> / `clearForeign(bare)===bare`）时施加并断言——这自动排除自食前缀（`2024 总结`）、白名单豁免（裸态命中）、
> 像外来编号的裸标题等让等式天然不成立的情形，与现 backlink 往返记分板对「空锚点 / 歧义」的排除同理。
> **S4/S5 仅在参考（默认）模式施加**：explore 模式的 `mutatePrefix` 会**故意抹掉 WJ**，此后「清外来」把
> 失去 WJ 的前缀当外来编号剥掉属**预期行为**（用户手动破坏了编号、插件认不出是自家的），S5「无操作」前提
> 随之不成立——故 explore 不施加清除命令（见 §3.2 取舍表）。

### 4.1.3 明确不入 UVM

留 `main.test` 集成 / `user_tests` 手验：防抖时序(J1–J3)、光标选区(J6)、拖拽/补全/滚动/折叠 DOM(L4–L8)、
语言文案、白名单命中预览、Backlink 开关门控（`updateBacklinks=false` 的「绝不触碰引用方」属集成层 `syncBacklinks`）、
`getBacklinksForFile` 半公开 API 适配、全库批量清除循环。
