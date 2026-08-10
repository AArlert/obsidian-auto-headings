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

- 待用户真机确认这次修复在实际敲字场景下观感正常（快捷键转空标题后能不能直接接着打字）。
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
│   │   ├── ForeignNumberingCleanupModal.ts 迁移守卫 Notice 点击入口：清理预览确认框（testplan J14）
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关；复制净化 1.0.16 起恒开无开关）
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
