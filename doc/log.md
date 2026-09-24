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

## 2026-09-25 M14 虚拟编号模式 周期 0：计划审计 + 文档先行（1.1.4，纯文档不 bump）

交接人：`claude/m14-virtual-mode`

### 做了什么

- **审计远端交来的计划** `doc/plan-m14-virtual-mode.md`：派 repo-scout 逐条核对源码引用（13 处全部属实），
  对照竞品商店数据与 README 复核（2026-09-25：Heading Decorator 5,388 纯显示、计划原先漏了它；gurjar1 2,406
  虚拟非默认、只在编辑器里显示；Number Suite 355；Heading Keeper 54 默认虚拟，作者即 PR #8 贡献者）。
  修订了 7 处设计，先单独提交（`c8fe091`），要点：
  - 模式切换清除**不复用**清除命令路径（会剥手写编号、会写 `fm:false` 关掉虚拟渲染、走 `vault.modify`
    有 H8 同类竞态），改为新纯函数 `clearPluginNumberingContent`（只剥 WJ）+ 批量通道（已带 backlink 同步）；
  - 删规则 / 改路径 / 改「不编号」也会让文件落到仅显示模式，同样弹确认框；残留前缀不许悄悄盖掉，
    要有 stale 样式提示 + 单文件清除命令；
  - 新装判据补多设备同步竞态对策（新装不立即落盘 + `onExternalSettingsChange`）；核实 `loadSettings`
    （main.ts:169）先于 `templateStore.init()`（190），判据可用，要加顺序锁测试；
  - frontmatter `true` 碰上「不编号」规则时跟随根规则模式；
  - 输入法组合期间暂停重算；阅读视图缓存改字符串比较、补 `getSectionInfo` 为 null 的兜底；
  - README 原定的「从不在后台扫描全库」**不成立**（`buildInitialHeadingIndex` 启动时读全库），改如实口径；
  - 大纲面板从「做不到」改为「一期不做」；周期 1 即 bump 到 1.2.0。
- **周期 0 文档先行**：
  - `spec.md`：§2.2 非目标翻案；新增 §3.22「虚拟编号模式（M14）」（设计定案全文）；目录补 3.20–3.22；
    §5 Roadmap 重排（M14 → M11 → M12 → M8a → M8b → M10 → M13），新增 Milestone 14 节（5 个周期清单 + 二期候选）；
    M9 的「虚拟编号模式」「只读装饰预览」两条并入 M14 只留指针，新增候选「把虚拟编号一次性烧录成纯文本」；
    M12 新增「内置三套预设模板」「README 资源与隐私承诺」；附录 A.8.5 / A.9 同步。
  - `testplan.md`：新增 V 组 V1–V32，全部 🔲。
  - 按单一事实源纪律**删除** `doc/plan-m14-virtual-mode.md`（内容已全部落进 spec §3.22 与 Roadmap M14）。
- 本周期派发 2 次（repo-scout × 1：计划源码引用核对；quality-gate × 1：收尾 preflight）。

### 没做什么

- 没写任何代码，没 bump（纯文档）。
- 竞品只读了 README 与商店统计，没深读源码（Heading Keeper / Number Suite 的实现细节留待周期 2 渲染时按需参考）。

### 下一步

- **周期 1**（见 spec Roadmap M14）：`PathRule.mode`、新装判据与延迟落盘、`onExternalSettingsChange`、
  `resolveNumberingMode`、`src/virtual/compute.ts`、`shouldAutoTrigger` 对虚拟文件返回 false、
  `clearPluginNumberingContent`；配套单测与 UVM oracle；`npm run bump minor` → 1.2.0；跑 `test:fuzz`。

### 验证方式

- `npm run preflight` 全绿（纯文档改动）。

---

## 2026-09-24 README 瘦身为商店门面 + 新增双语使用指南（1.1.4，纯文档不 bump）

### 做了什么

用户诉求：README 是商店展示页，要「简洁易懂、看了想装、技术细节隐藏」；GIF 由用户自录，
**README 里不得留图片占位**（断图过不了 Obsidian 自动审查）。

- **README.md / README.zh.md 重写**（各 ~210 行 → ~95 行）：一句话定位 → 6 条卖点 → 三步上手 →
  6 个功能小节（每节 1–3 句）→ 命令表 → FAQ（5 问）→ 安装 → 了解更多。参考主流插件门面写法
  （卖点先行、每节一句话、细节外链）。全部链接改 GitHub 绝对地址（商店页相对链接不可靠）。
  顺手订正三处与现状不符的旧文案：「人工审核仍在进行中」（已通过）、英文命令名
  「Clean foreign numbering」（实为 `Clear non-plugin heading numbering`）、命令表漏了
  「切换全局自动编号」。
- **技术细节下沉到新文件 `doc/user-guide.md` / `doc/user-guide.zh.md`**：由旧 README「开箱即用」
  起的全部内容平移（删去营销开场与安装节，修相对链接、命令名），信息零丢失。附录 A 定下的
  信任类承诺（WJ 披露、导出与外发、干净离开、Number Headings 迁移）在 README 各保留 FAQ 一问 + 链接，
  不再展开；`<!-- skip -->` 手写标记按 spec 纪律「不得当卖点」，README 不提，只留在指南。
- 登记新文件：根 `CLAUDE.md` §3.1 表（并写明 README 写作纪律）、本文件「目录结构约定」块、
  `spec.md` A.9 落点索引行。
- 本周期派发 2 次（quality-gate × 2：接手基线门槛 + 收尾 preflight）。

### 没做什么

- 未录 / 未引用任何 GIF / 截图（用户自录，建议清单已在会话中给出；录好后放 `assets/` 并用
  GitHub raw 绝对地址引用）。
- 未改 `manifest.json` 的 description（M12「manifest description 卖点重排」仍待做，改它需发版）。
- 未动 i18n / 关于页里的文案。

### 下一步

- 用户录好 GIF 后插回 README（首图放一句话定位下方，其余各配一个功能小节）。
- 开发侧建议：先做一个整理周期（刷新 status 首行、拆 `main.ts` 2170 行、压缩 spec Roadmap 已完成项），
  再开 M11「H8 修复 + 清库撤销」→「Backlink 审阅模式」。

### 验证方式

- `npm run preflight` 全绿（纯文档改动，release 重建无差异）。
- 人工核对：README 内无 `![` 图片语法、无相对链接；user-guide 内相对链接（`marker-contract.md`、
  `../assets/pandoc/…`、`../README*.md`）均指向存在的文件。

---

## 2026-09-13 修复嵌套围栏数量不匹配致编号重置（1.1.4，issue #9）

### 做了什么

用户报告（[issue #9](https://github.com/AArlert/obsidian-auto-headings/issues/9)，附截图）：多层
代码块嵌套、内层围栏用注释符号 `#` 时，其后标题序号会从 1 重新开始。用 GitHub API 取 issue 原文
+ 下载截图核实（WebFetch 摘要与 API 原文一致，本次未撞上 [[webfetch-verification-blind-spots]]
记录的截断/编造问题），复现出的具体场景是：外层 4 个反引号围栏包一段示例 Markdown，内嵌一段
3 个反引号的 yaml 围栏，两层都各有一行 `#` 开头的注释。

- **根因定位**（派 `repo-scout` 定位 + 主模型用 vitest 写 scratch 测试实测复现）：`src/scan.ts`
  的 `scanSkipRegions` 围栏状态机（`FENCE_RE` 捕获组其实带了完整反引号游程长度，但状态机只取
  `fence[1][0]` 比较**符号种类**，从未比较**数量**）。按 CommonMark，闭合围栏须同符号**且数量
  ≥ 开启行**；内层 3 个反引号本不该闭合外层 4 个反引号的围栏，但旧实现见到同符号就直接切换
  `inFence`，导致内层 3 反引号「关闭」了外层围栏，内层 `# 这是最里层代码块` 被当成真标题
  （level 1，浅于周围 H2 标题），推进计数器时把更深层的 H2 计数器清零——这就是「序号被清零
  回 1」的完整链路，用 `renumberContent` 实测复现出与截图完全一致的 `## 2 标题二` → `## 1
  标题三`（而非线性递增到 4），根因链条到此闭环，无需再猜。
- **修复**：`scanSkipRegions` 新增 `fenceLen` 状态，闭合判定改为「同符号 **且** 本行游程长度
  ≥ 开启时的长度」；数量不足（或符号不同）的类围栏行不再切换 `inFence`、也不再标记为
  `isFenceMarker`，原样落入「围栏内普通内容」分支——语义上更贴合 `SkipState.isFenceMarker`
  自己的文档定义（「本行**就是**围栏定界行」），不只是打个补丁。`parser.ts`、`scan.ts` 顶部
  文档注释与 `doc/spec.md` §3.17（新增裁决表 R11）同步更新，避免下次改动时规格与实现再次漂移。
- **回归测试**：`parser.test.ts` 新增 2 例（数量不足不闭合的嵌套写法；数量更多的闭合行合法，
  对称验证没有矫枉过正）；`known_bugs.test.ts` 新增 issue #9 端到端 describe 块，直接断言
  `renumberContent` 在 issue 原始场景下的输出（含幂等性）。`doc/testplan.md` 补 `E3b` 行
  （✅，链接两个回归测试）。
- 质量门槛：派 `quality-gate` 跑 `npm test`（639 通过，唯一失败是既有 zh-CN locale 排序环境
  伪影，与本次无关）、`lint`、`format:check` 全绿；核心逻辑改动按规则额外跑一遍 `test:fuzz`
  （5000 序列 × 80 步）全绿。本周期派发 2 次（repo-scout × 1 定位根因，quality-gate × 1 验证）。

### 没做什么

- 未改 `isSkipped()` 的对外行为——`isFenceMarker` 语义收紧后 `inFence` 仍覆盖同一行，
  `isSkipped = inFence || isFenceMarker || inComment` 的外部可见结果（哪些行被跳过）不变，
  只有「这一行算不算定界行本身」这个内部细节更准了，`cleanDemotedResidue` 因此受益
  （之前会把这类误判的类围栏行当定界行跳过清理，现在正确按「围栏内普通内容」走
  `scope.fences` 开关）——顺带验证过 `cleanup.test.ts` 全过，未额外补测试（行为改进但无
  用户可见入口触发这条路径的已知场景，且现有测试已覆盖足够多样例）。
- 未处理 `doc/testplan.md` 里 E3（不同符号不闭合）状态标记为 🔲 但实际早被
  `parser.test.ts`「不同栅栏符号不互相闭合」覆盖的既有偏差——与本次改动无关的历史遗留，
  不在本 issue 范围内，未顺手修，留给下次涉及该区域时处理。

### 下一步

- 已 `npm run bump` → `1.1.3 → 1.1.4`；已写 `doc/release-notes/1.1.4.md`（双语，如实描述
  用户可见的编号 bug 修复）。
- 待 `npm run preflight` 全绿后提交（含 `release/`）、按 §5.1 合并回 `master`，打 `1.1.4` tag
  并推送，`release.yml` 自动创建 GitHub Release。
- 可考虑回 issue #9 留评论告知已修复、将在 1.1.4 发布，但本仓库当前无 `gh` CLI
  （见 [[windows-env-quirks]]），需用户自己评论或后续会话走 API/网页操作。

### 验证方式

- `npx vitest run tests/dev_tests/parser.test.ts tests/dev_tests/known_bugs.test.ts`：新增用例
  与既有用例全过。
- `npm test` 639 通过（1 个既有 locale 环境伪影，基线同样失败，非本次引入）；`lint` /
  `format:check` / `test:fuzz`（5000×80）全绿。
- 用 issue 原始截图的确切文本（外层 4 反引号 + 内层 3 反引号 yaml，各一行 `#` 注释）跑
  `renumberContent`，修复前输出 `## 1 标题三`（复现截图），修复后输出 `## 3 标题三`
  （正确续号），且二次调用幂等。

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
