# obsidian-auto-headings 测试计划（testplan）

本文档是「在什么状态下、做了什么操作、应当得到什么结果」的场景真值表，**既驱动自动化单元测试（dev_tests），也驱动用户手动实测（user_tests）**。

很多 bug 只在**操作序列**下才暴露（如「默认样式 → 改为中文 → 改标题间隔符 → 得到 `一、一 标题`」），故本文档把状态转移当一等公民枚举。

> **本文件是 testplan 的顶层索引**：正文按章 / 场景组拆在 [`testplan/`](./testplan/) 目录，一组一文件，
> 文件名 = `ID-短名.md`（场景组用字母 A–V，章用数字）。场景 ID（如 `E18`）与节号（如 §3.2）是稳定引用 ID；
> 增删改文件须同步本索引（`npm run docs` 双向校验）。状态计数与全部非 ✅ 待办跑 `npm run docs` 看摘要，不必逐个打开。

## [0. 使用说明](./testplan/0-使用说明.md)

## [1. 核心理念：状态转移测试](./testplan/1-核心理念.md)

## 2. 场景清单

-   [A. 基础编号（单次触发） — dev + user](./testplan/A-基础编号.md)
-   [B. 状态转移：改"格式字段"后再触发 — dev（重点！）★](./testplan/B-状态转移.md)
-   [C. topLevel 与层级边界 — dev + user](./testplan/C-topLevel与层级边界.md)
-   [D. 白名单（M4） — dev](./testplan/D-白名单.md)
-   [E. 解析边界 — dev + user](./testplan/E-解析边界.md)
-   [F. 跳级（skipFill） — dev + user](./testplan/F-跳级.md)
-   [G. 序号样式渲染（纯函数） — dev](./testplan/G-序号样式渲染.md)
-   [H. 清除编号（M6） — dev + user](./testplan/H-清除编号.md)
-   [I. frontmatter / 双层开关 — dev + user](./testplan/I-frontmatter与双层开关.md)
-   [K. 路径规则解析（M5） — dev + user](./testplan/K-路径规则解析.md)
-   [J. 触发、防抖与写回 — dev + user](./testplan/J-触发防抖与写回.md)
-   [L. GUI 与国际化（M6） — dev（i18n 纯函数）+ user（DOM 手验）](./testplan/L-GUI与国际化.md)
-   [M. Backlink 同步（M7） — dev（纯函数 + 集成）+ user（Obsidian 解析手验）](./testplan/M-Backlink同步.md)
-   [N. 起始编号数字 startIndex（M8 批次 1） — dev + user](./testplan/N-起始编号数字.md)
-   [O. 生态与外部写入（M11/M12 规划中） — user（实机为主）+ dev（部分可纯函数）](./testplan/O-生态与外部写入.md)
-   [P. 继承级数 inheritDepth（1.0.22，社区 PR #7） — dev + user](./testplan/P-继承级数.md)
-   [Q. 标题链接建议 + Various Complements 联动（M13，1.0.26） — dev + user](./testplan/Q-标题链接建议与VC联动.md)
-   [R. 复制命令：编号大纲 / 当前小节链接（1.2.0） — dev + user](./testplan/R-复制命令.md)
-   [V. 虚拟编号模式（M14，1.2.0） — dev + user](./testplan/V-虚拟编号模式.md)

## [3. 已知 bug 汇总](./testplan/3-已知bug汇总.md)

## [4. 随机序列压测（UVM 风格）★](./testplan/4-UVM压测.md)

