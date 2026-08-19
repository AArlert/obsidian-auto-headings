# Markdown 标题反链（testplan M26）

本场景需要两篇笔记，验证标题编号改变后 Wikilink 与 Markdown link/image 同步更新，并确认代码区不被误改。

## 操作

1. 暂时关闭「全局自动编号」，确保建夹具时不会提前触发。
2. 新建 `M26-Target.md`，粘贴「目标文件」。
3. 新建 `M26-Refs.md`，粘贴「引用文件」。
4. 打开 `M26-Target.md`，运行「立即重新编号」。
5. 回读两篇笔记；测试结束后恢复原来的全局自动编号设置。

### 目标文件

````md
# M26 目标

- Wiki 同文件：[[#链接 同步验证|Wiki 同文件]]
- Markdown 同文件：[Markdown 同文件](#%E9%93%BE%E6%8E%A5%20%E5%90%8C%E6%AD%A5%E9%AA%8C%E8%AF%81)
- Block（应保持）：[[#^m26-block]]

## 链接 同步验证

正文。 ^m26-block
````

### 引用文件

````md
# M26 引用

- Wiki：[[M26-Target#链接 同步验证|Wiki]]
- Wiki embed：![[M26-Target#链接 同步验证]]
- Markdown：[Markdown](M26-Target.md#%E9%93%BE%E6%8E%A5%20%E5%90%8C%E6%AD%A5%E9%AA%8C%E8%AF%81)
- Markdown title：[Title](M26-Target.md#%E9%93%BE%E6%8E%A5%20%E5%90%8C%E6%AD%A5%E9%AA%8C%E8%AF%81 "保留 title")
- Markdown image：![Embed](M26-Target.md#%E9%93%BE%E6%8E%A5%20%E5%90%8C%E6%AD%A5%E9%AA%8C%E8%AF%81)
- 外链（应保持）：[External](https://example.com/M26-Target.md#heading)
- Block（应保持）：[Block](M26-Target.md#%5Em26-block)
- 行内代码（应保持）：`[Code](M26-Target.md#%E9%93%BE%E6%8E%A5%20%E5%90%8C%E6%AD%A5%E9%AA%8C%E8%AF%81)`

```md
[Fence](M26-Target.md#%E9%93%BE%E6%8E%A5%20%E5%90%8C%E6%AD%A5%E9%AA%8C%E8%AF%81)
```
````

## 预期

- 目标标题变为带编号的「1 链接 同步验证」，同文件 Wiki 与 Markdown fragment 同步。
- 引用文件的 Wiki link/embed、Markdown link/title/image 都指向带编号的新 fragment；label、路径、title 与 `!` 保持。
- 外链、Block、行内代码和 fenced code 原字节保持。
- Obsidian metadata cache 中所有被更新的 heading fragment 与目标 heading 逐字节一致（包含不可见 WJ）。
