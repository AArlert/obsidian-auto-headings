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

## 2026-07-03 1.0.1 商店完整扫描反馈修复：源码 Error/Warning 清零（claude/obsidian-plugin-review-fixes-8fy6ck）

**做了什么**：用户带回 Community Hub 的**完整扫描报告**（比上周期多出源码级检查），逐项修复。
本次含行为变化（命令 ID、语言探测、minAppVersion），按 §4.1 bump 到 **1.0.1**。

- **Error：`as any` + 无说明 eslint-disable（main.ts 98/177/196/818/820，审核明确不允许）**：
  五处全部消灭——① `metadataTypeManager`（内部 API）改用 `App & { metadataTypeManager?: … }`
  结构化收窄；② file-open 播种改用**公开** `vault.cachedRead`（typings 一直有，原 any 属历史包袱）；
  ③ rename/delete 快照同步改用**公开** `vault.on("rename"/"delete")` 重载；④⑤ `syncBacklinks` 的
  `getBacklinksForFile`（仍是半公开，1.13 typings 依旧未声明）以「可选方法」形状收窄，新增纯函数
  `backlinkMap()` 适配裸 Map / `{data:Map}` 两种返回形状。src 现已零 `any`、零 eslint-disable。
- **localStorage 语言探测（Behavior 标记 + Warning）**：`detectObsidianLang` 改走官方
  `getLanguage()`（1.8.0+）；obsidian devDep 1.7.2 → 1.13.1（取类型）；**minAppVersion 1.4.0 →
  1.8.0**（getLanguage 硬下限；顺带满足 css-scrollbar 的 Chromium 版本要求）。obsidian-mock 补
  `getLanguage` 替身（`__setMockLanguage` 可注入返回值/抛错），i18n.test 三个用例改走替身。
- **命令 ID 含插件 ID**：`toggle-auto-headings` → `toggle-auto-numbering`（Obsidian 注册时自动加
  `auto-headings:` 前缀）。副作用：已给旧命令设过快捷键的用户需重新绑定（上架前改，代价最小）。
- **`document` → `activeDocument`（弹出窗口兼容）**：main.ts IME 组合监听两处 +
  WhitelistEditor 行内编辑 `createElement` 一处。
- **Promise-in-void 回调（8 处）**：EditPanel / PathRules / WhitelistEditor 里 `addEventListener`
  的 `async` 回调统一改同步包装 `void fn()` / `void save().then(…)`，执行顺序不变。
- **多余类型断言（5 处）**：GeneralTab 语言三元、PathRules `createEl("datalist")`、
  `(e as InputEvent).isComposing` ×3 改 `e instanceof InputEvent && e.isComposing`。
- **`builtin-modules` 依赖（Warning，es-tooling 建议弃用）**：esbuild.config 改用官方
  `node:module` 的 `builtinModules`（含 `node:` 前缀双份 external），依赖已卸载。
- **CSS `!important`（4 处）**：分段控件选中态 / 活动 TAB 改为 `button.类.类` 叠写特异性
  （(0,2,1)，压过主题的类级规则）；主题若也用 !important 仍会盖过，属主题侧问题，注释已注明。
- **TemplateStore `JSON.parse` 未类型化**：显式标注 `unknown`（下游 `normalizeTemplate` 本就收
  `unknown`）。
- 扫描报告里的 License / README 两条 Warning 经核实**已在上周期修掉**（报告是旧快照）；
  「Vault Enumeration」标记来自 `getMarkdownFiles`（全库清除编号功能所必需）属合理使用，不改。

**没做什么**：未验证 Community Hub 重扫结果（需用户推 master 后触发）；未对 activeDocument 做
多弹出窗口的完整覆盖（仅活动窗口注册，与原 document 行为等价，真正的多窗口 IME 覆盖属 backlog）；
旧命令 ID 未做迁移兼容（上架前无存量用户）。

**下一步**：推 master 后回 Community Hub 触发重新扫描，确认 Error 清零、Warning 只剩可解释项
（如主题级 CSS 判定若仍报，可在提交说明里引用本块理由）；随后继续商店审核流程。

**验证方式**：`npm test` 328 passed / `npm run test:fuzz` 通过 / `npm run lint`、
`npm run format:check`、`npm run build`（tsc 严格类型检查）全绿；`grep` 复核 src 零
`as any`、零 `eslint-disable`、零裸 `document`；`npm run release` 产物已重建入库。

---

## 2026-07-03 1.0.0 商店自动审核反馈修复：README 占位符 + LICENSE 无法识别（claude/plugin-repo-audit-avuhui）

**做了什么**：用户提交后收到 Obsidian Community Hub 自动审核的两条 Warning，逐条修复。**纯文档
改动、不涉及行为/产物**，按 §4.1「上架后策略」不 bump manifest 版本，只记本条 log。

- **README 占位符警告**：审核器逐字扫描源码文本里的字面 `TODO`，命中 `README.md`/`README.zh.md`
  里各一行 `<!-- hero screenshot / GIF 占位 -->` 注释——尽管渲染后不可见，源码里确有 `TODO` 字样。
  用户此前已决定不做 GIF、纯文字说明足够撑起上架，故直接删掉这两行占位注释（不是留白等着填，是
  确认这次发布就不需要它），警告随之消失。
- **LICENSE 无法识别警告**：排查发现现有 `LICENSE` 文件其实是 **MIT + Commons Clause（禁商用）+
  Anti-996** 三段拼接、且自相矛盾——MIT 正文写"可自由使用/复制/修改/**出售**"，紧接着 Commons
  Clause 又说"不得商用"，GitHub 的 `licensee` 库（Obsidian 该警告大概率的数据来源）做的是模糊
  文本比对，认不出这种自定义拼接文本，判定"无法识别标准许可证"。
  查证 `licensee` 当前收录的许可证列表（57 个，`cc-by-4.0`/`cc0-1.0`/`mit` 等）**不含任何非商业
  许可证**——CC-BY-NC 系列、PolyForm Noncommercial 均不在其中。这意味着用户最初想要的"非商业+
  消除警告"两个目标**互斥**：换成任何真实的非商业许可证文本，警告大概率依然存在（该工具压根不
  认识这类许可证）。就此用 `AskUserQuestion` 请用户裁决，用户选择**优先消除警告**——改回纯净、
  未加料的标准 MIT 文本（保留原 `Copyright (c) 2025 AArlert`），删掉 Commons Clause 与 Anti-996
  两段。

**没做什么**：未保留非商业限制（用户主动放弃，换取许可证可被识别）；未额外验证 Community Hub
的警告扫描器是否真的就是调用 GitHub `licensee`（是我方合理推断，未见到官方文档明确写死数据源，
但两处线索一致——① Obsidian 提交要求页原话提到需要"LICENSE 文件"、② licensee 是 GitHub 生态
里事实标准的许可证检测工具）；未重新提交 Community Hub 审核（是用户下一步的动作）。

**下一步**：用户把改动推到 `master`（这次 Agent 已代为 commit + merge）后，回 Community Hub 页面
触发重新扫描 / 重新提交，确认两条 Warning 是否清零。

**验证方式**：`npm test`（328 passed，未受影响，纯文档改动）/ `npm run lint` / `npm run format:check`
全绿；`grep -n -i "TODO"` 复核 README 两个文件已无残留；`LICENSE` 手工核对确认只剩单一 MIT 正文、
无拼接痕迹。

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
│   │       ├── PathRules.ts       路径规则表（拖拽排序/补全/根规则/删模板确认）
│   │       ├── DangerTab.ts       敏感操作（清除全库编号）
│   │       └── AboutTab.ts        关于/帮助
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
