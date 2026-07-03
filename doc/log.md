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

## 2026-07-03 1.0.0 版本转正 + 新增 Release 自动化（用户明确指示直接上架，claude/plugin-repo-audit-avuhui）

**做了什么**：用户看完上一周期的审计结果后明确表态「直接 1.0.0，准备上架」，不再等 testplan 里
M18/J9/K12/L17/L22/K11/E14/E16 等手感项逐条实机验完——这是用户的选择，本轮**没有**替用户跑这些
验证、也没有把它们的状态标注为已验证（testplan 对应行保持原状态，如实反映"未验证但用户接受直接
上架"，不是"已验证"）。

- **`npm run bump 1.0.0`**：0.7.27 → 1.0.0。`manifest.json`/`package.json`/`package-lock.json`/
  `versions.json`/`release/manifest.json` 一键同步。上架后版本策略自此生效：仅行为/产物变化才
  bump manifest，纯文档改动只记 log（`spec.md` §5 M7 已有此约定，见 §4.1）。
- **新增 `.github/workflows/release.yml`**：此前只有 `npm run release` 把产物同步进本地
  `release/` 目录入库，**没有对外发布的自动化**——真要发 GitHub Release 仍得手动上传三个文件。
  新增的 workflow 在推送任意 tag 时触发：`npm run build` → `gh release create <tag> --generate-notes
  main.js manifest.json styles.css`。用 Actions runner 自带的 `gh` CLI（无需额外配置 token，
  `GITHUB_TOKEN` 由 Actions 自动注入，workflow 声明 `permissions: contents: write`）。tag 名与
  manifest version 完全一致、不带 `v` 前缀，满足 Obsidian 商店对 Release 命名的硬性要求。
  这个能力此前完全没有——GitHub MCP 工具集里没有"创建 Release"这个操作，Agent 自己不能越权
  帮用户点 GitHub 网页按钮，所以补一条 CI 是唯一能让"打 tag = 有 Release"这件事可重复、
  不依赖人工点击的路径（下次改动想发新版本，打个 tag 就行，不用记着手动传三个文件）。
- **`doc/spec.md` M7 清单收尾**：「发布物料」「版本转正」「发布自检」标记完成（各自附带"未做
  什么"的老实说明——截图/GIF 仍是占位、user_tests 全量手动回归未逐条重跑，均是用户知情选择，
  不是遗漏）；「提交至 Obsidian 社区插件目录」保持未完成——这一步需要用户自己的 Obsidian
  账号登录 community.obsidian.md，Agent 没有、也不该有这个账号的访问权限。

**没做什么**：未替用户跑 testplan 里剩余的手感验证项；未生成截图/GIF（用户明确表示纯文字已够）；
未推送 `1.0.0` tag 触发 release.yml（是否现在就打 tag、正式对外发布，留给用户决定时机——workflow
已就绪，用户想发的时候 `git tag 1.0.0 && git push origin 1.0.0` 或在 GitHub 网页 Releases 页手动
打 tag 即可）；未替用户去 community.obsidian.md 提交（做不到，需要用户本人登录）。

**下一步**：用户视时机打 `1.0.0` tag 触发 GitHub Release → 去 community.obsidian.md 完成账号
登录 + 关联仓库 + 提交审核。上架后如有社区反馈的 bug/改动需求，回到「仅行为/产物变化才 bump」
的版本策略继续迭代。

**验证方式**：`npm test`（328 passed）/ `npm run lint` / `npm run format:check` 全绿；
`npm run release` 确认 `release/manifest.json` version 已是 `1.0.0`；`.github/workflows/release.yml`
本地过 `python3 -c "import yaml; yaml.safe_load(...)"` 校验语法合法（未实际触发，因为触发需要真实
推送 tag，留给用户决定时机）；`npm run docs` 校验通过。

---

## 2026-07-03 0.7.27 README 大改（卖点先行）+ 补回迁移遗漏的 CI/钩子（用户要求，claude/plugin-repo-audit-avuhui）

**做了什么**：延续上一周期的上架审计，处理用户追加的三项要求。

- **README.md / README.zh.md 重写**：原版是功能清单式写法，改为**痛点先行**——开篇三段直接点出
  「插入一节后手动改编号」「改标题名链接跟着断」「一种编号风格套不了整个库」三个真实用户痛点，
  再给出本插件的对应解法。`## Features` 从「亮点五条」展开为按主题分类的详细小节（编号引擎本身 /
  模板 / 路径规则 / 白名单 / Backlink 同步 / 清除命令 / 单文件覆盖 / 双语与移动端），补齐此前只在
  `spec.md` 里才有的细节——如白名单**点击词条原地编辑**、`=/≈/▸` 分段控件切换匹配方式带 tooltip、
  命中数角标 hover 列出具体标题、⚠ 子标题告警、过滤排序工具栏；模板的祖先序号渲染两种风格；路径
  规则拖拽排序 + 路径自动补全 + 无根规则告警。GIF/截图占位保留（用户明确暂不做，纯文字说明已足够
  支撑上架）。双语内容逐段对照，非机翻腔。
- **补回 monorepo 迁移时遗漏的基础设施**（用户提供原件，按单项目结构改写）：
  - `.claude/settings.json` + `.claude/hooks/session-start.sh`：远程会话启动自动 `npm install`
    + 启用 `.githooks`；原版按"monorepo 多 Addon 循环安装"写的，本仓库只有一个项目，简化为直接
    对仓库根操作。
  - `.githooks/pre-commit`：文档守卫。**原版有个在单项目仓库里会静默失效的 bug**——它用
    `find *//scripts/docs.mjs` 循环 + 路径前缀匹配来判断"本次提交是否触及该 Addon"，当
    `addon_dir` 恰好等于仓库根时，`${addon_dir#"$REPO_ROOT"/}` 因缺少末尾 `/` 不会被替换，
    `grep -q "^${addon_rel}/"` 用绝对路径去匹配 `git diff` 给的相对路径，永远匹配不上——文档守卫
    会被此仓库直接跳过、形同虚设。已重写为单项目版本：只要有暂存改动且
    `scripts/docs.mjs` 存在就直接跑 `--check`，不再需要按 Addon 循环判断。已本地跑
    `.githooks/pre-commit` 验证：无暂存改动时正常放行、有暂存改动时正确触发文档守卫并通过。
  - `.github/workflows/ci.yml`：原版按 `working-directory: obsidian-auto-headings` 子目录跑
    （monorepo 场景），本仓库根目录即项目根，去掉子目录层级直接在根跑 `npm ci`/`test`/`lint`/
    `format:check`/`build`。
  - `CLAUDE.md` §7 同步更新为「已配置」，说明补回的背景（历史备注）。
- **`npm run bump`**：0.7.26 → 0.7.27（README 改动 + 新增基础设施文件，非纯文档——按 CLAUDE.md
  §4.1 判断新增 `.github/`/`.githooks/`/`.claude/` 三类脚手架文件本身不影响插件运行时行为，但
  README 卖点改写会影响商店展示，与基础设施改动一并算一次版本递增）。

**没做什么**：未生成截图 / GIF（用户明确暂不做，README 占位保留，纯文字说明已足够支撑本轮上架）；
未处理上一周期登记的 testplan H8（`clearAllVaultNumbering` 潜在竞态，仍是 backlog）；未跑
`npm run bump 1.0.0`（M7 手感验证项仍待用户实机确认）。

**下一步**：本次审计到此完成——按用户要求合并回 `master`；后续按上一周期梳理的路径继续：用户实机
验证 → 补截图/GIF（可选）→ `bump 1.0.0` → `community.obsidian.md` 提交。

**验证方式**：`npm test`（328 passed）/ `npm run lint` / `npm run format:check` 全绿（含新增
`.github/workflows/ci.yml`、`.claude/settings.json` 的 Prettier 格式化）；本地直接调用
`.githooks/pre-commit` 验证有/无暂存改动两种场景均按预期放行/拦截；`npm run docs` 校验通过。

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
