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

## 2026-09-26 升 1.2.1 重发（Hub 不给同版本二次审核，交接：chore/release-1.2.1）

### 做了什么

- 上一块挪 tag 重发 1.2.0 后，Community Hub **不对同一版本号做第二次审核**，只能升版本：`npm run bump -- 1.2.1`。
  代码无改动，与重发后的 1.2.0 仅版本号不同。
- `scripts/bump.mjs`：`versions.json` 带 UTF-8 BOM（387d2fd 合并时引入，疑为 PowerShell 写入），`JSON.parse` 直接报错、
  bump 半途退出留下半套改动。`readJson` 改为先 `trimStart()`（U+FEFF 属 JS 空白）；写回不带 BOM，`versions.json` 顺带修好。
- `doc/release-notes/1.2.1.md`：商店用户从未拿到 1.2.0，故沿用 1.2.0 全文，开头加一句双语说明。
- 本周期派发 1 次（quality-gate × 1）。

### 没做什么

- 1.2.0 的 tag / Release 保留不动（GitHub 上已是修好描述的版本）。

### 下一步

- 推 tag 1.2.1 后请用户在维护者面板点「Check for new releases」，确认审核通过、公开页 Current version 变为 1.2.1。

### 验证方式

- bump 输出「1.2.0 → 1.2.1」且五处同步；preflight；Release 工作流成功、资产 attestation 查询 200。

---

## 2026-09-25 manifest 描述去掉「Obsidian」一词并重发 1.2.0（不 bump，交接：fix/manifest-desc-no-obsidian）

### 做了什么

- Community Hub 审核 1.2.0 报 Manifest 错误：description 不得含「Obsidian」一词（目录上下文已隐含，属冗余）。
  `manifest.json` / `release/manifest.json` 的 `shown only in Obsidian or written into your notes` 改为
  `display-only or written into your notes`，其余措辞不变。
- 按用户要求**不 bump**，把 tag `1.2.0` 挪到修复后的 master 提交、强推重发（`release.yml` 先删同名 Release 再建，可重复触发）。
- 此前面板的「No release matches your manifest version」是 Hub 在首跑 Release 失败的空窗期读到 manifest 所致，
  点「Check for new releases」即可；GitHub 侧三资产 attestation 均已核实存在。
- 本周期派发 0 次。

### 没做什么

- `package.json` 的中文 description 不进商店，未动；README 未改（无相关措辞）。

### 下一步

- 重发后在维护者面板点「Check for new releases」，确认 1.2.0 审核通过、公开页 Current version 变为 1.2.0。

### 验证方式

- `grep -n Obsidian manifest.json` 无命中；preflight 全绿；Release 工作流重跑成功且资产中 manifest 描述已更新。

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
