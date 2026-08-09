---
obsidian-auto-headings: true
---

# 导出与 Pandoc 兼容（M11 导出验证矩阵夹具）

> 本文件是 **实测夹具**，不是说明文档。它刻意包含**真实的 U+2060 WORD JOINER 字符**，
> 用编辑器打开时看不见它们——这正是要验证的东西。**请勿用 prettier / 编辑器的
> 「清理不可见字符」功能格式化本文件**，否则夹具失效。
>
> 对应 `doc/testplan.md` O5a–O5f。**全部 WJ 都只在标题行里**（与真实笔记一致），
> 正文提到 WJ 时一律写成可见占位符 `<WJ>`。校验夹具完好：
>
> ```sh
> # 应输出 13 = 6 个双哨兵标题 × 2 + 1 个旧单哨兵 × 1
> node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');console.log((s.match(/\u2060/g)||[]).length)" tests/user_tests/10-导出与Pandoc兼容.md
> ```

## 用法

**自动化部分（pandoc，已在开发机跑过）**——结论已回填 `doc/testplan.md` O5a–O5e：

```sh
pandoc 10-导出与Pandoc兼容.md -o a.pdf --pdf-engine=typst
pandoc 10-导出与Pandoc兼容.md -o b.pdf --pdf-engine=typst --number-sections
pandoc 10-导出与Pandoc兼容.md -o c.pdf --pdf-engine=typst --number-sections \
       -L ../../assets/pandoc/strip-autoheadings.lua
pandoc 10-导出与Pandoc兼容.md -o d.pdf --pdf-engine=typst \
       -L ../../assets/pandoc/strip-autoheadings.lua -M autoheadings=strip-marker
```

**手验部分（O5f，需真机 Obsidian）**：把本文件放进真实 vault，用 Obsidian 内置
「导出为 PDF」导出，然后：① 肉眼看编号有无 tofu（空白方块）；② 在 PDF 阅读器里
搜索「模块设计」——搜得到说明文本层可用；③ 复制一行编号标题粘贴到记事本，
检查有无多余的不可见字符。结论回填 O5f。

## 1 双哨兵编号（当前格式，0.7.20+）

以下四个标题带真实 WJ 双哨兵。渲染出来应该只看到「1.1 纯文本标题」这样的编号。

### ⁠1.1 ⁠纯文本标题

正文一段，确保标题不是文件最后一行。

### ⁠1.2 ⁠模块**设计**与 `代码` 混排

**这是本夹具最关键的一条**：标题里有粗体与行内代码。旧版 Lua filter 用
`pandoc.utils.stringify` 会把它压平成纯文本，新版遍历 inline 列表应当保住格式。
导出后此标题必须仍是「模块**设计**与 `代码` 混排」，粗体与等宽字体都在。

### ⁠1.3 ⁠含[内部链接](https://pandoc.org)的标题

链接也属于内联格式，同样不能被压平。

## ⁠2 ⁠第二个 H2

本文件**首个标题是 H2**（插件默认 `topLevel = H2`，文中的 `# 导出与 Pandoc 兼容`
是文件标题、不参与编号）。这一条用于验证 pandoc `--number-sections` 在缺少 H1
层级时如何编号——O5e。

### ⁠2.1 ⁠子标题

### ⁠2.2 ⁠另一个子标题

## 3 旧单哨兵格式（0.6.4–0.7.19）

下面这个标题是**旧格式**：只有一个 WJ，位于前缀末尾（`3.1 <WJ>标题` 而非 `<WJ>3.1 <WJ>标题`）。
filter 必须同样剥得掉。

### 3.1 ⁠旧格式遗留标题

## 4 未编号标题（对照组）

下面这个标题**完全不含 WJ**——按标记契约，无 WJ 即插件从未碰过它。
无论哪种模式，filter 都必须**原样保留**，一个字符都不能动。

### 这个标题没有编号，也没有任何不可见字符

## 5 预期结果速查

| 命令 | 预期 |
| --- | --- |
| 直转（无 filter、无 `--number-sections`） | 插件编号保留；WJ 随之进输出 |
| `--number-sections`（无 filter） | **双重编号**，如 `1.1 1.1 纯文本标题` |
| `--number-sections` + filter 默认模式 | 单层干净编号；内联格式完好；零 WJ |
| filter `strip-marker` 模式 | 插件编号保留；零 WJ；内联格式完好 |
