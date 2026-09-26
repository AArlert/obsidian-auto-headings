# P. 继承级数 inheritDepth（1.0.22，社区 PR #7） — dev + user

> 每级可选字段 `inheritDepth`：`inherit=true` 时最多往上继承几个祖先段，永不越过 `topLevel`，缺省 = 继承到 `topLevel`（老模板零迁移）。
> 规格见 [spec §3.6](../spec/3.6-模板系统.md)；dev 断言全在 `dev_tests/inherit-depth.test.ts`。

| ID | 操作 | 预期 | 状态 |
|----|------|------|------|
| P1 | **向后兼容**：字段缺失（老 `data.json`）/ 显式 `null` / 老模板三者对同一文档编号 | 三者输出**逐字节相同**，均为继承到 `topLevel` 的完整段（H3 得 `1.1.1`） | ✅（`inherit-depth.test.ts`）|
| P2 | `topLevel=H1`，H3 设 depth=1 / depth=2；H4 设 depth=1 / depth=2 | 分别得 `1.1` / `1.1.1`、`1.1` / `1.1.1`——段数 = depth+1，只含最近的 depth 个祖先 | ✅ |
| P3 | **上限夹紧**：`topLevel=H2`，H4 设 depth=5（超过实际可继承的 2 级） | 在 `topLevel` 截断得 `1.1.1`，**绝不**把 H1 段拼进来；不报错、不回退成"不继承" | ✅ |
| P4 | `inherit=false` 且 `inheritDepth=1` | depth 完全被忽略，只输出本级序号（`1`）；**字段值仍保留**在模板对象里 | ✅ |
| P5 | **起始编号偏移**：`startIndex=5`，H3 分别 depth=2（含 topLevel 段）/ depth=1（不含） | depth=2 得 `5.1.1`（偏移落在真正的 topLevel 段）；depth=1 得 `1.1`——**截掉 topLevel 段后偏移不再乱加到首段上**（此前 `i===0` 的写法会误加） | ✅ |
| P6 | **祖先样式**：H1 `cjk` / H2 `lower-alpha` / H3 `circled` / H4 `upper-roman`，H4 depth=2，`ancestorNumeral` 取 `self` 与 `arabic` | `self` 得 `a.①.I`、`arabic` 得 `1.1.I`；两者都**不含**被截掉的 H1 的 `一` | ✅ |
| P7 | **skipFill=fill/drop**：`topLevel=H1`，H4 depth=1，文档 `H1→H2→H4`（缺 H3） | fill 得 `0.1`、drop 得 `1`——占位 / 丢弃只作用于**截取后**的序列，不受被截掉的祖先影响 | ✅ |
| P8 | **skipFill=none**：H4 depth=1，① 直接父级 H3 在场（`H2→H3→H4`）② 直接父级缺失（`H2→H4`） | ① 照常编号 `1.1`——继承范围外的浅层缺失**不再**否决本级；② 仍拒绝编号（裸标题）——范围内缺父级依旧不编号 | ✅ |
| P9 | skipFill=none 且 depth=null / `inherit=false` | 检查范围回到 `topLevel`，与 1.0.21 行为逐字节一致（`H2→H3→H4` 之外的跳级仍不编号） | ✅ |
| P10 | **幂等与往返**：全继承编号 → 切 depth=1 重排 → 再切回全继承 | 每步都剥净旧前缀重编、连续触发幂等；切回全继承后与最初输出**逐字节相同**，无叠加、无残留 | ✅ |
| P11 | **白名单回归**：`partial` 命中的「附录…」标题 + depth 生效 | 白名单照常透明（不编号、不占计数），depth 不影响豁免语义 | ✅ |
| P12 | GUI：编辑面板新增「继承级数」列（下拉：全部 / 1…level-1） | 选项数随级别递增（H1 无可选、置灰）；「继承前级」取消勾选时该下拉同步置灰；改动即写回模板并刷新本级实时预览 | ✅ 逻辑（`previewLevel` 走同一 `buildPrefix`）/ 🔲 DOM 手验 |
