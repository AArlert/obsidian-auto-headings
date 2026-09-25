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
> 均可整读）；仍大的 `main.ts`（~2600 行）与 `i18n.ts`（~1100 行）先 `grep` 定位、别整读。
> UVM 压测框架（`tests/dev_tests/uvm/`）已按职责拆成 9 个文件、均可整读，入口仍是 `framework.ts`。

> 一句话：**改代码 → `npm run bump` → 写本文件新块 + `status.jsonl` → `npm run preflight`（= docs + release + test + lint + format:check）→ 提交（含 `release/`）。**

---

## 2026-09-25 CI 升到 Node 24 + 清理 worktree（1.2.0，纯基础设施不 bump，交接：master）

### 做了什么

- `ci.yml` / `release.yml`：`node-version` 20 → 24，`actions/checkout`、`actions/setup-node` v4 → v5（v4 跑在已弃用的
  Node 20 运行时上，Actions 每次都告警）。CI 与本机同为 npm 11，1.2.0 那种「本机锁文件 CI 不认」的错位随之消失；
  现有锁文件（npm 10 兼容版）本机 npm 11 `npm ci` 已验证可用。
- 清理本机 worktree：两个 feature-coder 的 `agent-*`（已合并）与 `obsidian-auto-headings-wjfix`（占着 master）；
  删掉已合并的本地分支 `claude/h8-batch-rewrite`、`claude/copy-commands`、`worktree-agent-*`；主工作区切回 master。
  `obsidian-auto-headings-pr8-review` 有未提交改动，未动。
- 本周期派发 0 次。

### 没做什么

- 未动 `attest-build-provenance@v2`；未把锁文件改用 npm 11 重算（现版本两边都能用，无需折腾）。

### 下一步

- 同上一块：确认 Community Hub 跟上 1.2.0；1.3.0 候选见上一块。

### 验证方式

- 推 master 后 CI 在 Node 24 下全绿（见本块提交后的 CI 运行）。

---

## 2026-09-25 发版前一轮开发：大纲显示虚拟编号、两条复制命令、H8（1.2.0，交接：claude/m14-virtual-mode）

### 做了什么

- **内置大纲面板显示虚拟编号**（原 M14 二期，用户要求提前；testplan V40–V45）：新增 `src/virtual/outlineView.ts`。
  动手前从本机 `E:\Obsidian\resources\obsidian.asar` 只读解出 app.js 核对 1.10 的大纲实现，据此推翻了参照竞品
  Heading Decorator 的思路（扫屏幕 DOM、按层级 + 文本对齐标题）——1.10 的大纲是虚拟滚动，屏幕外条目不在 DOM 里，
  那样滚动 / 折叠 / 过滤后会错位。现做法：
  - 遍历视图的条目对象 `cachedHeadingDom`，按 `heading.position.start.line` 取编号并核对级别，写成 `innerEl` 上的
    `data-ah-number` 属性，CSS `::before` 画出（大纲每次刷新都 `setText` 重写文字，插节点会被冲掉）；
  - `requestUpdate` 构造时就捕获了原始 `update`，实例打补丁挂不住 → 用 MutationObserver 看 `childList`，合并到
    微任务里核对全部条目；新开 / 关闭的大纲靠 `layout-change` / `active-leaf-change` 挂摘观察器；
  - 残留旧编号（WJ 开头）的标题不画；设置「在大纲中显示编号」`showOutlineNumbers` 默认开，关掉后对大纲零接触；
    结构认不出静默。
- **两条复制命令**（testplan R1–R6，spec A.11 借鉴；feature-coder 实现、我审）：`src/copycommands.ts` + main.ts
  `registerCopyCommands`。「复制编号大纲」用 `checkCallback`（阅读视图可用），写入模式取标题所见文本、仅显示取
  虚拟编号，按全文最浅级别缩进两格；「复制当前小节链接」用 `editorCheckCallback`，锚点保留 WJ（与标题链接建议
  同口径，否则写入模式解析不到）、别名剥编号，链接由 `generateMarkdownLink` 按用户的链接设置生成。
- **H8 + H17–H19**（feature-coder 实现、我审）：清全库 / 固化改走 `batchRewrite`（已打开走编辑器事务、未打开走
  `vault.process`），清全库顺带同步链接（H17）。审方案时发现同一类竞态还在 `syncBacklinksCounted`：已打开的
  引用方仍走 `vault.process`，批量通道里互相引用的两篇都开着时会读到落盘前的旧内容、冲掉刚做的改写（M18 同源），
  一并改为走引用方的编辑器（H18，所有同步路径受益）。固化时 `linkAnchor` 剥 WJ 比较，纯去 WJ 不算改名，同步实为
  空操作，不会多写、不会多弹提示。
- 模板同名冲突提示：用户认为 `default.json` 恒生效、冲突副本被忽略可以接受，**不做**。
- 文档：spec §3.22（渲染 / 已知限制 / 代码组织）、§3.10、§3.12、§3.1 命令表、Roadmap M11 / M12 / M14；使用指南中英
  （两种模式对照表、大纲一条、命令表）；README 中英；1.2.0 发布说明补大纲、两条命令、清全库同步链接；实测样例
  `tests/user_tests/13-仅显示大纲与复制命令.md`；记忆补「从 asar 查 Obsidian 内部实现」。
- 两个 feature-coder 都因 API 额度上限中断过一次，用 SendMessage 续跑完成。本周期派发 5 次（feature-coder × 2、
  quality-gate × 3）。

### 没做什么

- **清全库 / 固化没上真机**（会改动整个库，只有单测）。写入模式下的两条命令、R6 写入模式没上真机；在大纲里拖动
  小节没单独测（与插入标题同一刷新路径）；停用插件后大纲复原只有单测。
- M11「清库撤销」（自建快照 / 还原）未做。

### 发版（用户同意后，2026-09-25）

- 合并 master（`873c0df`）+ 打 `1.2.0` tag。**Release 首跑失败在 `npm ci`**，master 的 CI 同样挂：M14 分支从没在
  CI 上跑过（CI 只盯 master），它的锁文件由本机 npm 11 重算，删掉了 `vite-node` 下的可选 peer 条目
  （`@types/node@26`、`undici-types`），CI 的 Node 20 自带 npm 10，判定锁文件与 package.json 不同步。日志匿名
  拉不到（403），靠步骤名 + 锁文件 diff 定位。
- 修法（`87c8f63`）：以 master（`1a84d17`，CI 通过）的锁文件为底，只套 M14 的本意改动（版本号、两个
  `@codemirror` 显式开发依赖、去掉 peer 标记）——与原锁文件的差别仅是补回那两个条目。master CI #72 通过后，把
  `1.2.0` tag 挪到修复提交重推（首个 tag 没生成任何 Release），Release #23 通过：非草稿、三个产物齐全、说明取自
  `doc/release-notes/1.2.0.md`。

### 下一步

- 看 Community Hub 公开页 `community.obsidian.md/plugins/auto-headings` 的 Current version 是否到 1.2.0；滞后就
  请用户登录维护者面板点「修复」。
- 以后改依赖后先用 CI 同版本的 npm（npm 10）生成锁文件，或者先推 master 看 CI 再打 tag；CI 迟早也该升到
  Node 22/24（Node 20 已停止维护，Actions 已提示弃用）。
- 1.3.0 候选：M12 内置三套预设模板；`main.ts` 已约 2600 行，改到相关代码时顺手拆。
- 1.2.0 已在 master，此后在 master 上开新分支。主工作区 `D:/Documents/Code/obsidian-auto-headings` 还停在旧的
  `claude/m14-virtual-mode`（`6f8e8ff`），`master` 被 `obsidian-auto-headings-wjfix` 那个 worktree 占着且落后于
  origin——接着干前先在 wjfix 里 `git pull --ff-only`（或删掉该 worktree），主工作区再切到 master。

### 验证方式

- quality-gate（合并后全量）：`release` 通过；`npm test` 787 通过 / 1 失败（whitelist.test.ts:406 ICU 排序，Windows
  既有伪影）；`lint`、`format:check`、`docs --check` 通过；`test:fuzz` 三块记分板通过（标题索引 34.1s）。
- 真机（Oblivion 库 `Claude测试/`，电脑操作）：大纲 V40 / V41（搜索过滤、折叠、最前面插标题、2000 标题长大纲滚到
  末尾）/ V43（设置开关）；命令 R2–R6（仅显示）；H18（两篇分屏，刚粘贴未落盘的链接随改名同步）。测后测试笔记
  逐字节核对还原。

---

## 2026-09-25 把 master 的 stripPrefix 修复合进 M14（1.2.0，交接：claude/m14-virtual-mode）

### 做了什么

- 用户决定 1.1.5 **不单独发版**，修复随 1.2.0 一起发。把 master（`1a84d17`，含 `claude/fix-wj-midtext`）合进 M14 分支。
- 冲突处理：
  - `src/cleanup.ts` `hasUnclaimedForeignNumbering`：先走修复加的结构性证据（`CLAIMED_LINE_RE` 行首 WJ +
    `hasPluginPrefix`），末行用 M14 的 `looksForeignNumbered`；M14 的 `isMostlyForeignNumbered` 原样保留，
    它按 `!startsWith(WJ)` 判归属，与修复同一口径。
  - 版本号文件取 1.2.0；`versions.json` **保留 `1.1.5` 条目**（仓库惯例：每次 bump 都登记，没发版的
    1.0.26–1.0.32 也在列）。
  - `log.md` / `status.jsonl`：修复周期块 / 概括行插在 M14 各块之上；两份 archive 以 M14 为准（已是超集）。
  - `release/` 重建。
- 同类排查：M14 新代码里判 WJ 归属的地方都只认行首 WJ。`computeVirtualNumbers` 的残留区间取自编号引擎
  剥出的纯文本，合入修复后，E39 形态（尾哨兵被毁 + 标题里有带 WJ 的链接）的残留区间从「一直吞到链接锚点」
  变成只含残缺前缀，自动受益；阅读视图 `decorateHeading` 只在首个文本节点里找尾哨兵（链接是独立元素），
  不受影响。
- `doc/release-notes/1.2.0.md` 补修复条目（中英）。
- testplan 里 `M18` 有两行重名，合并前三方就都是这样，未动。
- 本周期派发 1 次（quality-gate × 1）。

### 没做什么

- 没合并 master、没打 tag（发版须用户明确同意）。

### 下一步

- 发版前一轮开发（用户已选定）：H8（清全库 / 固化改走 `batchRewrite`）、「复制编号大纲」「复制当前小节链接」
  两条命令、**内置大纲面板显示虚拟编号**（原登记为 M14 二期，用户要求提前）。模板同名提示**不做**——用户
  认为 `default.json` 恒生效、冲突副本被忽略可以接受。

### 验证方式

- 分项跑（quality-gate）：`release` 通过；`npm test` 740 通过 / 1 失败（whitelist.test.ts:406 ICU 排序，Windows
  既有伪影）；`lint`、`format:check`、`docs --check` 通过；`test:fuzz` 三块记分板通过（31.9s）。

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
│   ├── pathrules.ts        路径规则 → 模板 / 编号模式解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── copycommands.ts     「复制编号大纲」「复制当前小节链接」两条命令的纯逻辑（R 组，spec §A.11）
│   ├── virtual/            虚拟编号模式（M14，只显示不写文件，spec §3.22）
│   │   ├── compute.ts      纯逻辑：每个标题的显示编号 + 残留前缀区间 + 自动路径门控 resolveNumberingAction
│   │   ├── editorExtension.ts 编辑视图：CM6 ViewPlugin + 编号 widget + 重算信号（纯函数 buildVirtualDecorations）
│   │   ├── readingView.ts  阅读视图：markdown post-processor + 缓存 + 兜底匹配
│   │   ├── outlineView.ts  内置大纲面板：条目上挂属性 + CSS 画编号，MutationObserver 跟大纲刷新（1.2.0）
│   │   └── modeSwitch.ts   规则变动引起的模式切换：改动前后逐文件比较有效模式（纯函数）
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
├── README.md / README.zh.md ← 商店门面（卖点 + 上手 + 命令 + FAQ，技术细节下沉 doc/user-guide*.md）
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + user-guide(.zh).md 面向用户的完整使用指南 + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A；research/ 本地调研留档、.gitignore 排除不入库，见该目录 README.md）
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
