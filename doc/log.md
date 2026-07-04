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
