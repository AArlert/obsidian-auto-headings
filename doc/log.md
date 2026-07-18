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

## 2026-07-18 1.0.13（未 bump）UVM 压测框架拆分（1686→9 文件）+ 修 Windows 上失效的 test:fuzz + 订正过期框架文档

**背景**：外部评审给 UVM 压测引擎 8.5/10，指出三条边界 + 一条工程隐患。核查后**三条边界均不动代码**——
它们都已在仓库内明确记录（参考模型复用 build 路径是刻意取舍、幂等 oracle 的分工见 uvm/README，
「明确不入 UVM」清单见本文件 testplan §4 尾部），评审是在复述而非发现。重建一套独立编号实现作参考模型
属高成本低回报（会变成第二处需同步维护且必然漂移的真相源），**不做**。真正落地的是第四条 + 两处评审
没发现的实缺陷。

**做了什么**：

1. **`framework.ts` 1686 行拆成 9 个文件**（原为全仓库最大文件，超过 `main.ts` 1286，违反 CLAUDE.md §3
   「~500 行且多职责 = 拆分信号」）：`framework.ts`(533，World 状态 + step/finish/trigger + runSequence，
   仍是唯一入口并 re-export 公共 API) / `operations.ts`(262) / `config-ops.ts`(317) / `oracles.ts`(246) /
   `coverage.ts`(191) / `stimulus.ts`(111) / `config.ts`(98) / `model.ts`(61) / `rng.ts`(41)。
   `World` 的方法体外移为接收 world 句柄的自由函数、类内保留一行委托，故 `step()` 等调用点零改动；
   三个新模块用 **`import type { World }`** 引入（编译期擦除）保证运行时依赖图单向无环。
   `random_sequence.test.ts` 一行未改。
2. **纯搬运的验收方式（可复用）**：RNG 是种子化 mulberry32 ⇒ 序列完全确定。改动前先采集**黄金基线**
   （DEFAULT_GEN + EXPLORE_GEN 各 500 seeds × 60 ops，dump 每个 seed 的 World 终态全字段 + Coverage
   累加器指纹，8MB）。Phase 1（外移常量/Coverage）与 Phase 2（拆 World）后各比对一次，**md5 全程一致**
   （`4b4552b2…`），实锤 rng 调用序列未被扰动。采集用的临时用例已删。
   > 踩坑记录：`JSON.stringify` 对 `Map`/`Set` 默认产出 `{}`，会**静默掏空指纹**——`Coverage.numerals`
   > 是 Set、`Coverage.ops` 与 `World.lastResolved` 是 Map，replacer 里必须显式处理。首版漏了 Set，
   > 54 个 bin 里只有 1 个是真数字，差点拿一张假的安全网去做重构。
3. **修 `npm run test:fuzz` 在 Windows 上长期失效**：原命令用 POSIX 前缀赋值
   `AAH_FUZZ_RUNS=5000 … vitest`，而 npm 在 Windows 默认走 `cmd.exe`（`script-shell` 未配置），
   该语法直接是语法错误 ⇒ CLAUDE.md §4 第 4 步「动核心逻辑后额外跑一遍 test:fuzz」在本机**一直没生效**。
   新增 `scripts/fuzz.mjs`：以 `process.execPath` 直接拉起 vitest 的 ESM 入口（免 npx / 免 `shell:true`，
   参数不会被二次拆词），注入 `AAH_FUZZ_*`，**透传退出码**（已实测失败场景返回 1，否则 CI 会把失败当通过），
   支持 `--runs=/--ops=/--seed=`。超时从 120s 放宽到 600s（`--runs=20000` 时原值不够）。**不引入 cross-env 依赖**。
4. **订正 `uvm/README.md` 的过期描述**（评审没发现；过期的地图比大文件更坑接手 Agent）：
   ① explore 标注「进 CI？否（`it.skip`，会撞 U1/U2/U3）」——实际 0.6.7 起已转正、每次 `npm test` 都跑，
   且 U1/U2（0.6.3）、U3（0.6.6 方案A）、U4（0.6.7）**全部已修**；② 称 explore 由 `AAH_FUZZ_MODE=explore`
   切换——该变量早已无门控效果；③ 写「默认 400 条 × 40 步」——实际 500×60；④ explore 序号样式漏了
   roman（黄金基线的 coverage dump 实测为 arabic/circled/cjk + lower/upper-alpha + lower/upper-roman）。
   另把「参考侧…**不会和 DUT 一起错**」这句过度声明改准确：它不会与 DUT 各自演化出分歧，但对**共因错误**
   （两侧对同一条规则一起理解错）没有免疫力——这正是 S7 另配独立参考模型 `indepMatch`/`indepSpec` 的原因。
   新增「文件分工」节。

**没做什么**：未 bump（按 CLAUDE.md §4.1 上架后策略：只碰 `tests/` `doc/` `scripts/`，`src/` 一行未动、
无行为与产物变化，故不推送空更新给线上用户），未重建 `release/`。未重建独立参考模型（理由见背景）。
未动任何 oracle 语义 / 约束表 / 覆盖率 bin 定义。`framework.ts` 533 行仍略超 500，其中 112 行是顶部
设计文档注释（含 0.6.2→0.7.6 各轮升级史），代码本体约 420 行、职责单一，**未强行再拆**——若日后仍嫌大，
可考虑把历史升级段落下沉到 log-archive 而非继续切分代码。

**验证方式**：黄金基线逐字节比对（Phase 1 / Phase 2 各一次，md5 全程一致）；`npm test` 409/410 通过
（唯一红灯是 `whitelist.test.ts:406` 的本机 ICU collation 预存噪音，CI 为准）；
**`npm run test:fuzz` 5000×80 两块记分板全绿（4.7s）**——这条同时实证了新脚本在 Windows 上真能跑；
`eslint` + `prettier --check` 对 `tests/dev_tests/uvm` 全绿。

**本周期派发 4 次（Explore × 2、feature-coder × 2）**。

**下一步**：接 1.0.13 原有待办——用户真机手验 K15/K16、打 tag `1.0.13` 发布、M12 余项。
UVM 侧 backlog 不变（放开「各模板不同前后缀候选」+ 按活模板动态算剥离并集，探「删含唯一前缀模板 →
旧文件孤儿残留」）；新增可选项：默认模式样式约束（arabic/cjk/circled）的原因已随方案A失效，
可专项放开跑一轮，绿了就删约束。

---

## 2026-07-18 1.0.13 M12 两项落地：批量重编号 +「不编号」伪模板；K14/K14b 手验回填 + 箭头图标统一

**做了什么**：

1. **用户真机手验 1.0.12 通过**（「效果达标」）：testplan K14/K14b 的「手验 DOM」回填 ✅。随手感
   反馈做小改：分层浏览的 `⬅` 返回 / `▸` 下钻改用**同族 lucide 图标**（`setIcon` `arrow-left` /
   `arrow-right`，`--icon-size: var(--icon-s)`，点击区扩大手法不变）。
2. **M12「不编号」伪模板（testplan K15）**：`pathrules.ts` 新增哨兵 `NO_NUMBERING_TEMPLATE = "$none"`；
   `getTemplateForFile` 对哨兵返回无模板（复用「无可用模板」既有语义，自动路径静默跳过、已有编号
   冻结）；伪模板**参与具体度解析并可胜出**（`daily/→不编号` 压过根规则）；手动命令经
   `resolvesToNoNumbering` 弹专用 Notice；`TemplateStore.rename` 拒占哨兵名；GUI 下拉在真实模板后
   固定伪选项，「失效模板」兜底不误伤哨兵。
3. **M12 多文件批量重编号（testplan K16）**：`main.ts` 新增 `batchRenumberRule`——作用域=规则**路径
   模式**命中的全部 Markdown 文件，**每个文件用它自己解析出的模板**；跳过 fm `false` / 未接管外来
   编号（J10 同源）/「不编号」；**已打开文件走编辑器单一事务**（可撤销、无 `vault.process` 竞态），
   未打开走 `vault.process`；backlink 照常同步且改写数**汇总一条 Notice**（`syncBacklinksCounted`
   从 `syncBacklinks` 拆出计数核心 + `notifyBacklinkTotal` 统一出口）。GUI：行内 `list-ordered`
   图标按钮（「不编号」行置灰）+ `BatchRenumberModal` 确认框（显示命中文件数，内联在
   `PathRules.ts`，随 `DeleteTemplateModal` 先例）；表格加第 6 列（grid 28px×2）。
4. **测试**：`main.test.ts` 新增 K15×3 + K16×5 共 8 例（含「点根规则批量不覆盖子规则文件」「编辑器
   通道不被 vault 竞态覆盖」），68 例全过；`pathrules.test.ts` 45 例全过；tsc 干净。
5. **文档**：spec §3.8 新增两段规格 + M12 两项勾选；README 双语补「规则级两件配套工具」段并修
   「没打开的文件永远不会被碰」表述（显式确认的批量操作除外）；release-notes/1.0.13.md 双语。

**没做什么**：K15/K16 的 GUI 手验 DOM 仍 🔲（下拉伪选项观感、批量确认框、批量后实测编号），留用户
真机确认；批量重编号未做进度条 / 取消（命中数极大的库一次跑完，Notice 只在结束时汇总）——如有需求
再立项。

**验证方式**：`main.test.ts` 68 例 + `pathrules.test.ts` 45 例全过（quality-gate 定向）；
`npm run preflight` 全绿（Windows ICU collation 预存噪音除外，CI 为准）。

**本周期派发 3 次（repo-scout × 1、quality-gate × 2）**。

**下一步**：用户真机手验 K15/K16（伪模板下拉 + 批量按钮/确认框）；打 tag `1.0.13` 发布（release
工作流取 `doc/release-notes/1.0.13.md`）；M12 余项（注释块跳过、断链扫描命令、description 重排、
公开 API 改名事件、迁移指南与社区发布）。

---

## 2026-07-18 1.0.12 路径建议弹窗：统一「已配置行再次点击」的外观（K14b，用户实测反馈）

**做了什么**：

1. **用户实测 1.0.11 后反馈**：新增空行进分层浏览外观正确，但**把某行配好 `/` 或 `A/` 后再次点击
   该行**，弹窗又回落成「匹配一堆」的扁平列表——视觉设计与功能设计不统一。
2. **根因**：1.0.11 的模式判断只看「输入框是否为空」（`value.trim() === ""`），配好的行 value 非空
   ⇒ 一律走扁平搜索分支（`/` 经前导斜杠剥离后 needle 为空 ⇒ `filterPathCandidates` 返回全部候选；
   `A/` ⇒ 匹配一堆含 `a/` 的项）。
3. **修复（1.0.12，行为变化已 bump）**：
   - `pathrules.ts` 新增纯函数 `browseDirForInput(value, folderPaths)`——决定该进分层浏览还是扁平
     搜索并返回要浏览的目录：空 / 根 `/`（含 `//`、`\` 归一化写法）/ **真实存在的文件夹（尾斜杠，
     如 `A/`）** → 返回目录路径（`A/` 返回 `A`，浏览**进** A）；正在打字的片段（`Pro`）/ 文件规则
     （`A/note.md` 无尾斜杠）/ 尚不存在的文件夹名 → 返回 `null`（交给扁平搜索）；
   - `PathSuggest.ts` `refresh()` 改由 `browseDirForInput` 决定模式（替换原「是否为空」判断），并把
     `getCandidates()` 结果复用、顺带算出 `folderPaths`；类注释与 spec §3.8 同步。
4. **测试**：`pathrules.test.ts` 新增 `browseDirForInput` 14 例（空/根/真实文件夹/前导斜杠反斜杠/
   打字片段/文件规则/非实文件夹边界），全过；`npm test` 401 通过、`lint`/`format`/`tsc` 全绿。

**没做什么**：DOM 交互仍无自动化覆盖（同 1.0.11），K14b 标 🔲 手验 DOM，留用户实测「配好后再点击
的外观一致性」。

**验证方式**：`pathrules.test.ts` 45 例全过（含新增 14 例）、`npm test` 401 通过、`lint`/`format`
全绿；唯一红灯是本机预存 Windows ICU collation 排序噪音（`whitelist.test.ts:406`，与本改动无关，
CI 为准）。

**本周期派发 1 次（quality-gate × 1）**。

**下一步**：用户实测 1.0.12 分层浏览（含配好后再点击）的完整手感，回填 K14/K14b 手验；M11 其余项
（导出验证矩阵、Canvas O1、E8 拍板、Backlink 审阅模式、H8+清库撤销、CM6 原子区域）。

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
│   ├── clipboard.ts        剪贴板净化纯逻辑（WJ 剥离/换行规范化/净化→原文 LRU，spec §2.8）
│   ├── pathrules.ts        路径规则 → 模板解析（纯函数）
│   ├── frontmatter.ts      单文件开关（obsidian-auto-headings: true/false）读取
│   ├── i18n.ts             中英双语文案（Messages 接口 + zh/en 两套）
│   ├── settings/
│   │   ├── model.ts        设置数据模型（全局开关、防抖延迟、路径规则持久化）
│   │   ├── SettingsTab.ts  设置 GUI 壳：TAB 栏 + 分发（内容在 tabs/，M7 多 TAB 已拆完）
│   │   └── tabs/           七个 TAB 的实现
│   │       ├── GeneralTab.ts      常规设置（全局开关、防抖、语言、Backlink 开关、复制净化开关）
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
├── doc/                  ← 文档（spec/testplan/log/log-archive/status/status-archive + marker-contract 下游契约 + release-notes/ 各版本发布说明（Release 工作流按 tag 取用），见 CLAUDE.md §3.1；grill 方向审查已收编为 spec 附录 A）
├── release/              ← 可分发插件文件（main.js/manifest/styles/README；zip 本地生成不入库）★每周期必更新
├── scripts/
│   ├── sync-release.mjs    把构建产物同步到 release/（被 npm run release 调用）
│   ├── bump.mjs            一键版本号同步（npm run bump）
│   ├── fuzz.mjs            跨平台跑重型随机压测（npm run test:fuzz [-- --runs=/--ops=/--seed=]）
│   └── docs.mjs            文档维护：归档/滚动/摘要/守卫/交接（npm run docs [-- --handover|--check]）
├── .claude/agents/       ← SubAgent 定义（quality-gate / repo-scout / mech-editor / feature-coder）
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
