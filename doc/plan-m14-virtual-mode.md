> **临时计划文档**：周期 0 把设计定案落进 `spec.md` §3.x 与 Roadmap 后，按 CLAUDE.md §3.1「单一事实源纪律」删除本文件。

# 计划：虚拟编号模式（M14）+ 路线图重排

> 交给本地 agent 执行。开工前按 CLAUDE.md §3 跑 `npm run docs -- --handover`，并读 `dev-cycle` 技能。
> 在一个功能分支上开发，分 5 个周期提交；每个周期都写 `log.md` 块，都跑 preflight。只在功能完整时 bump 一次到 `1.2.0`。

## Context

竞品分析（2026-09-24）的结论是：最大的短板是**没有「只显示、不写文件」的虚拟编号模式**。gurjar1、Heading Keeper（nestealin）、Number Suite 都已经支持这种模式；Heading Keeper 还把它设成了默认。写入文件的 U+2060 标记字符是重度用户的信任成本，而虚拟模式能从根上消除它。spec 附录 A §8.5 早已论证过这个方向，但一直压在 M9 候选池里，排在 M11 之后。

用户拍板（长期维护，自己也在用）：
- **粒度**：跟着路径规则走。每条路径规则可以单独选「写入文件」或「仅显示」。
- **默认**：新安装默认「仅显示」，老用户保持「写入」。**切换模式时，把插件自己写进文件的编号清除掉。**
- **范围**：标题链接建议和 VC 联动保持现状，但虚拟模式下必须照常可用。
- 另外借鉴竞品：在 README 里明说插件的资源和隐私承诺，比如「不联网、不收集数据、开销低」。

## 已核实的可复用件（不用新写引擎）

| 需求 | 复用 |
|---|---|
| 算每个标题的编号 | `numberHeadings(parseHeadings(content), template, opts)`（`src/numbering.ts:78`）是纯函数，返回 `{lineIndex, level, text, prefix}`。`prefix===null` 表示这一行不编号（白名单、`<!-- skip -->`、超出层级范围）。`opts` 用 `plugin.strippableAffixes()`（main.ts:645） |
| 去掉 WJ 得到显示文本 | `stripWordJoiners(prefix)`（`src/strip.ts:37`）。`buildPrefix` 输出一定带首尾 WJ（`render.ts:261`） |
| 文件对应哪个模板 | `resolvePathRule`（`pathrules.ts:126`）、`getTemplateForFile`（main.ts:478）、`NO_NUMBERING_TEMPLATE`（pathrules.ts:42） |
| 开关门控 | `shouldAutoTrigger`（main.ts:515，按 retired → 清库中 → frontmatter → autoNumber 的顺序）、`guardForeignNumbering`（main.ts:961） |
| 清除插件编号 | `cleanup.ts` 里的内容级清除，以及清除命令路径（main.ts 约 1238–1321） |
| 某条规则命中的文件 + 批量改写 | main.ts:1341（规则命中文件）、1405 / 1430（已打开 / 未打开文件两条批量通道，后者走 `vault.process`） |
| Backlink 在虚拟文件上 | 独立同步路径 `applyBacklinkStandaloneSync`（main.ts:1634、1671）已经不依赖编号写入 |
| CM6 依赖 | `@codemirror/state` / `view` 已随 obsidian 装好，`esbuild.config.mjs:20-30` 已设为 external；建议显式加进 devDependencies，版本锁到 lock 里的 6.5.0 / 6.38.6 |

标题索引和链接建议不用改：虚拟文件里的标题没有前缀也没有 WJ，`stripPrefix` 会原样放行（headingindex.ts:61），锚点就是纯文本。

## 设计定案（先写进 spec 新节，再写代码）

1. **数据模型**：`PathRule` 加 `mode?: "write" | "virtual"`（`src/pathrules.ts:24`），缺省按 `"write"` 处理，老数据零迁移。新增纯函数 `resolveNumberingMode(rules, path)`，返回 `"write" | "virtual" | null`。
2. **区分新装和升级**：在 `loadSettings`（main.ts 约 1524）里判断。`loadData()` 返回空，**并且**插件目录下没有 `templates/` 目录，才算全新安装，这时根规则 `/` 的 `mode = "virtual"`。其余情况都算升级，不动 mode。原因：老用户可能从没改过设置、所以没有 data.json，但首次启用时一定建过 `templates/default.json`。**动手前先核实**插件首次加载时会不会写 data.json、会不会建 templates 目录，再定判据。
3. **虚拟文件不走任何写入路径**：`scheduleRenumber`、`renumberOnOpen*`、`runImmediateRenumber`、批量重编号都要先判断 mode。虚拟文件改走 backlink 独立同步路径，保证用户手动改标题时链接仍然跟随。对虚拟文件执行「立即重新编号」＝只刷新显示，弹 Notice 说明「此文件为仅显示模式」。
4. **门控和写入模式一致**：retired、frontmatter `false`、全局自动编号关闭、「不编号」规则，这几种情况都**不渲染**。frontmatter `true` 强制渲染。有外来编号的文件复用 `guardForeignNumbering` 的提示，不渲染，避免出现两套数字。
5. **残留保护**：如果虚拟文件里还有插件写过的前缀（比如老数据、没清干净），渲染时用 `Decoration.replace` 把旧前缀区间（从行首 `#` 和空格之后，到第二个 WJ）盖掉，只显示虚拟编号，绝不出现两层数字。
6. **切换模式**（在路径规则行上改 mode 时）：
   - **写入 → 仅显示**：弹确认框，写明「将清除 N 个文件中本插件写入的编号」，确认后批量清除。只处理**有效规则就是这一条**的文件，用 `resolvePathRule(file) === rule` 过滤，排除被更具体规则覆盖的文件。已打开的文件走编辑器事务，未打开的走 `vault.process`（复用 1405 / 1430 两条通道，把变换函数换成清除）。
   - **仅显示 → 写入**：不需要清除。确认框里给一个可选勾选项「立即对这 N 个文件写入编号」，复用现有的批量重编号；不勾就等下次编辑时再写。
   - 取消确认 ＝ mode 不变。
7. **编辑器渲染（CM6）**：`registerEditorExtension` 注册一个 `ViewPlugin`。
   - 用 obsidian 导出的 `editorInfoField` 拿到文件路径，再按上面的门控 + 模板算出 `numberHeadings`。
   - 在每个标题正文起点放一个 `WidgetType`（`<span class="ah-virtual-number">`，`eq` 按文本比较）。
   - 性能：`docChanged` 时先 `decorations.map(tr.changes)` 保持位置不漂移，完整重算放到约 100ms 的去抖里。模板、设置或规则变化时，用一个 `StateEffect` 广播给所有已打开的编辑器，触发重算。
8. **阅读视图**：`registerMarkdownPostProcessor`。
   - 用 `ctx.getSectionInfo(el)` 拿到整篇原文和行号，按「路径 + 原文哈希」缓存 `numberHeadings` 的结果。
   - 给 `h1`–`h6` 前面插同样 class 的 span，已经插过的不重复插。
   - 这样 Obsidian 内置的「导出 PDF」预期也能带上编号，需要真机验证。
9. **已知限制**（写进使用指南，不回避）：大纲面板、文件内搜索、Publish、GitHub 和外部编辑器里都**看不到**虚拟编号。
10. **「固化编号并交还所有权」**：一期只处理写入模式的文件，虚拟文件跳过。在按钮说明里写清楚。「把虚拟编号一次性烧录成纯文本」作为后续候选，登记进 M9。

## 代码组织

`main.ts` 已经 2170 行，**虚拟模式的新代码不要往里加**。新建 `src/virtual/`：
- `compute.ts`：纯函数。输入原文、模板和选项，输出 `[{lineIndex, label, burnedPrefixRange?}]`。node 环境可测。
- `editorExtension.ts`：CM6 ViewPlugin、StateEffect、Widget。
- `readingView.ts`：post-processor 和缓存。
- `modeSwitch.ts`：切换确认、命中文件筛选、批量清除和写入的编排，通过接口回调 main.ts 的批量通道。

main.ts 里只加接线：注册两个扩展，写入路径前加一行 mode 判断。有余力的话，顺手把批量通道（main.ts 约 1340–1520）抽到 `src/batch.ts` 供 `modeSwitch` 复用。新增的文件要回填 `log.md` 的「目录结构约定」块，否则 `docs --check` 会拦提交。

## 分周期执行

**周期 0｜文档先行（不 bump）**
- `doc/spec.md`：
  - §2.2 把虚拟模式从「候选翻案」改为「已定案：与写入模式并列的第二哲学」。
  - 新增 §3.x「虚拟编号模式」，写入上面的设计定案 1–10。
  - §5 Roadmap 重排：新建 **M14 虚拟编号模式**，排第 1。M11 信任包排第 2（H8 清库竞态是数据安全问题，可以随时插队小修）。之后依次是 M12、M8a、M8b、M10。
  - M9 的虚拟模式条目和「装饰预览」条目合并进 M14，删掉原条目，只留一行指针。
  - M12 新增候选「内置学术 / 书稿 / 公文三套预设模板」（对标 Number Suite），以及「README 资源与隐私承诺」。
- `doc/testplan.md`：新增 V 组场景（先 `grep -n '^### ' doc/testplan.md` 确认字母没被占用），全部标 🔲。至少覆盖：
  - 新装默认虚拟、升级保持写入
  - 虚拟文件编辑后文件字节不变
  - 白名单、skip、层级范围在虚拟下生效
  - 残留前缀被盖掉，只显示一层数字
  - 写入 → 虚拟时清除，只清有效规则命中的文件，取消即不变
  - 虚拟 → 写入的可选写入
  - frontmatter、全局开关、retired 门控
  - 外来编号不渲染
  - 虚拟文件改标题时 backlink 仍同步
  - 链接建议、VC 在虚拟文件上可用
  - 阅读视图有编号，内置 PDF 导出有编号（手验）
  - 移动端（手验）
  - 大文件（约 2000 标题）打字不卡（手验）
- `status.jsonl` 首行更新「下一步」。

**周期 1｜模型 + 纯逻辑 + 门控（无 UI）**
- `PathRule.mode`、`loadSettings` 归一化（非法值回落 `"write"`）、新装判据、`resolveNumberingMode`。
- `src/virtual/compute.ts`。
- 所有写入入口加 mode 判断；虚拟文件改走 backlink 独立路径。
- 测试：
  - `settings.test.ts`：新装和升级的判据
  - `pathrules.test.ts`：mode 解析与具体度
  - 新建 `virtual.test.ts`：compute 输出、门控、残留前缀区间
  - `main.test.ts`：虚拟文件不触发写入，只走 backlink
  - UVM 加一条 oracle：虚拟文件在任意操作序列下字节不变

**周期 2｜渲染**
- `editorExtension.ts`、`readingView.ts`。
- `styles.css` 加 `.ah-virtual-number`：颜色跟随标题，`user-select: none`，保证复制出去不带编号。
- 设置、模板、规则变化时广播刷新。
- `tests/dev_tests/obsidian-mock.ts` 补 `registerEditorExtension`、`registerMarkdownPostProcessor` 两个空实现。
- 用 `@codemirror/state` 直接测「状态 → DecorationSet」和 `map` 后的位置正确性，放在 node 环境；不引入 jsdom，除非确实需要。

**周期 3｜UI 与切换**
- `src/settings/tabs/PathRules.ts`：每行加 mode 下拉框（「写入文件」/「仅显示」）。虚拟行的「批量重编号」按钮隐藏或禁用。
- 新增切换确认 Modal，参照清库确认框的写法。
- `src/i18n.ts`：`Messages` 接口加中英对应的 key，`i18n.test.ts` 会校验两边一致。
- 「立即重新编号」对虚拟文件的提示。
- 「固化」按钮说明补一句虚拟文件的行为。
- `modeSwitch.ts` 测命中文件筛选和取消语义。

**周期 4｜对外文档与发版**
- `npm run bump minor`，升到 1.2.0。
- `doc/release-notes/1.2.0.md`（双语）。
- `README.md` / `README.zh.md`：
  - 卖点加一条「可以只显示编号、完全不改文件」。
  - FAQ「会往笔记里加隐藏的东西吗？」改成：「仅显示」模式什么都不写；「写入」模式才有标记字符。
  - **新增 FAQ「占资源吗？」**，借鉴竞品写法。只写已核实的事实：
    - 不联网、不收集任何数据。已 grep 确认 `src/` 里没有 `requestUrl` / `fetch`，发版前再查一次。
    - 只处理当前正在编辑的笔记，从不在后台扫描全库。
    - 内存有上限：标题索引最多 5 万条（`headingindex.ts:22`），剪贴板缓存最多 2MB（`clipboard.ts:30`）。
  - README 仍然不放图片占位，链接一律用 GitHub 绝对地址。
- `doc/user-guide(.zh).md`：新增「两种模式」一节，写清切换、已知限制和「烧录」的现状。
- manifest 的 description 可以顺带改成把「可不改文件」「链接跟随」放在前面（M12 项）。
- 按 §5.1 合并 master，打 tag。

## 验证

- 每个周期：`npm run preflight`（docs + release + test + lint + format:check）全绿。周期 1、2 动了核心逻辑，额外跑 `npm run test:fuzz`。
- 真机手验（`release/` 丢进测试库），逐项回填 testplan V 组：
  - 新库装插件 → 默认显示虚拟编号，用 git diff 或外部编辑器确认文件没被改。
  - 老库升级 → 行为不变。
  - 实时预览、源码模式、阅读视图三种视图都显示编号，光标移动和打字时不闪、不错位。
  - 把规则从写入切到仅显示 → 确认框的 N 正确，确认后文件里的 WJ 前缀清空，界面只显示一层编号。
  - 在虚拟文件里改被引用的标题 → 别的笔记里的链接跟着更新。
  - 内置「导出 PDF」带编号；复制标题文字不带编号。
  - 移动端（iOS / Android 任一台）。
  - 约 2000 个标题的长文件里连续打字不卡。
