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
> 均可整读）；仍大的 `main.ts`（~800 行）与 `i18n.ts`（~600 行）先 `grep` 定位、别整读。

> 一句话：**改代码 → `npm run bump` → 写本文件新块 + `status.jsonl` → `npm run preflight`（= docs + release + test + lint + format:check）→ 提交（含 `release/`）。**

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

## 目录结构约定（按职责分类）

```
obsidian-auto-headings/
├── src/                  ← 源代码（TypeScript）
│   ├── main.ts             插件入口：生命周期、命令、防抖、事务写回、Backlink 同步接线
│   ├── parser.ts           Markdown 标题解析（ATX、代码块边界）
│   ├── numbering.ts        编号引擎编排（numberHeadings/renumberContent）+ 对外 barrel（↓四模块经它转发）
│   ├── template.ts         模板数据模型：类型/默认值/字段规范化
│   ├── count.ts            计数器状态机 HeadingCounter
│   ├── render.ts           序号渲染器 + 前缀拼装 buildPrefix + 面板预览
│   ├── strip.ts            三个剥离器（WJ 边界/清除全样式/清理外来）+ WORD_JOINER
│   ├── whitelist.ts        白名单归一化/命中判定/面板预览分析
│   ├── backlinks.ts        Backlink 同步纯函数核心（改名表/锚点归一/链接重写）
│   ├── cleanup.ts          清除编号命令的内容级封装
│   ├── pathrules.ts        路径规则 → 模板解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── settings/
│   │   ├── model.ts        设置数据模型（全局开关、防抖延迟、路径规则持久化）
│   │   ├── SettingsTab.ts  设置 GUI 壳：TAB 栏 + 分发（内容在 tabs/，M7 多 TAB 已拆完）
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关）
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
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive，见 CLAUDE.md §3.1）
├── release/              ← 可分发插件文件（main.js/manifest/styles/README；zip 本地生成不入库）★每周期必更新
├── publish/              ← 对外发布仓库的专属模板（双语 README、精简 package.json；npm run publish:repo 同步）
├── scripts/
│   ├── sync-release.mjs    把构建产物同步到 release/（被 npm run release 调用）
│   ├── sync-plugin-repo.mjs 同步到独立的对外发布仓库（npm run publish:repo，开发/发布分离）
│   ├── bump.mjs            一键版本号同步（npm run bump）
│   └── docs.mjs            文档维护：归档/滚动/摘要/守卫/交接（npm run docs [-- --handover|--check]）
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
