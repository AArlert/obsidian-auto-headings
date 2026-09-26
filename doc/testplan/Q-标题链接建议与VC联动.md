# Q. 标题链接建议 + Various Complements 联动（M13，1.0.26） — dev + user

> 规格见 [spec §3.23](../spec/3.23-标题链接建议与VC联动.md)。索引 / 触发 / 联动由 `headingindex` / `headingtrigger` / `vcintegration` / `main` 单测覆盖；
> 建议框 DOM、真实 VC、输入法、移动端交互留真机手验。

| ID | 操作 | 预期 | 状态 |
|----|------|------|------|
| Q1 | 面板关闭「标题链接建议」开关后，打出与某标题原文匹配的文字 | 不弹出任何建议；`headingIndex.size` 为 0（内存索引未构建，验证「关闭即零成本」） | ✅ 逻辑（`main.test.ts`：关闭不安排更新 / 关闭即清空）/ 🔲 面板点击手验 |
| Q2 | 面板打开该开关（默认即打开），在任意笔记正文里打出与 vault 内某个标题「剥编号前缀后的原文」完全匹配的文字（如该标题为 `## 1.1 交叉矩阵`，打「交叉矩阵」） | 出现建议候选，候选文案为该标题的原文（不含编号），候选下方显示来源文件路径 | ✅ 逻辑（`headingindex.test.ts` 剥前缀收录 + `main.test.ts`）/ 🔲 建议框 DOM 手验 |
| Q3 | 只打出候选标题的**前缀**（如标题是「交叉矩阵与其应用」，只打「交叉矩阵」） | 候选照常出现（前缀增量匹配，边打边筛，随每敲一个字符候选集合收窄） | ✅ 逻辑（`queryPrefix` 前缀匹配单测）/ 🔲 逐字符 UI 手验 |
| Q4 | **桌面端**：候选出现后按 Tab | 建议被接受：刚打的文字被替换为 `[[basename#锚点\|完整标题名]]`（目标在当前文件内则省略 basename，写作 `[[#锚点\|完整标题名]]`；**1.0.27 起 alias 自动补全为剥编号前缀后的完整标题名**，不再保留残缺前缀）；点击可正确跳转（**尤其目标标题已被编号、锚点含 WORD_JOINER 的情况**）；光标落在插入内容之后 | ✅ 逻辑（`headingtrigger.test.ts` 链接构造）/ 🔲 Tab 键行为待真机手验（`.suggestions.useSelectedItem` 是内部 API） |
| Q5 | **移动端**：候选出现后用手指点按某一条候选（不通过键盘） | 与 Q4 效果一致（EditorSuggest 候选项本身即可点击 DOM 元素，点按共享同一 `selectSuggestion` 回调，理论不需要移动端分支） | 🔲 **待真机手验** |
| Q6 | vault 里**多个文件**存在同名（或同前缀）标题，打出匹配文字 | 建议框列出全部候选，各自标注来源文件路径以区分；用户可用 ↑/↓ 切换后 Tab/点按接受任一条 | ✅ 逻辑（`headingindex.test.ts` 同名多文件 + `sortEntries`）/ 🔲 UI 手验 |
| Q7 | 光标所在整行本身就是一个 ATX 标题行（`## …`），在标题文本内打字命中 vault 里某标题原文 | **不**弹出建议（避免「正在写标题时把自己的标题内容误建议成链接」） | ✅（`headingtrigger.test.ts` `isBlockedContext`，含 3 空格缩进边界） |
| Q8 | 在 `[[` 尚未闭合的括号内打字（如 `[[交叉`），恰好与某标题匹配 | **不**弹出本插件自己的建议（避免与 Obsidian 原生 `[[` 补全/VC 的 internal link 补全抢同一建议框名额） | ✅（`headingtrigger.test.ts` 未闭合 `[[` / 紧邻 `[` / `#` 屏蔽） |
| Q9 | 中文拼音输入法组合期间（`compositionstart` 之后、`compositionend` 之前），组合中间态字符恰好匹配某标题前缀 | 组合过程中**不**弹出/不接受建议，不打断拼音输入；上屏后（`compositionend` 之后）按正常规则重新判断是否触发 | 🔲 **需真机手验中文输入法**（复用 `main.ts` `imeComposing` 标志位，`onTrigger` 首行读取） |
| Q10 | vault 里未安装 Various Complements，打开设置面板选择「手动配置」或「自动配置」 | 明确提示未检测到 Various Complements（「手动配置」不依赖 VC 是否安装，仍可走；「自动配置」探测层返回 `not-installed` 并放弃） | ✅ 逻辑（`vcintegration.test.ts` 探测三态）/ 🔲 面板提示手验 |
| Q11 | vault 里已安装并启用 Various Complements，选择「手动配置」并确认 | 生成 / 刷新 JSON 词典文件到插件目录（格式见 spec §3.23）；确认框展示词典文件路径 + 一键复制；**不**修改 VC 的任何配置；用户把路径填进 VC 的「Custom dictionary paths」并启用「Custom dictionary complement」后，在 VC 框打字命中标题能看到候选、接受后插入正确链接 | 🔲 需真实 VC 手验（词典生成已 dev 单测：`buildVcDictionaryJson` 格式 / 截断 + `mergeDictionaryPath`）|
| Q12 | 同上前提，改选「自动配置」并确认 | VC 的 `customDictionaryPaths` 追加本插件词典路径（不覆盖已有路径），开启 custom dictionary，触发阈值置 1，清空全局显示项 `displayedTextSuffix`（确认框单列说明其影响），`maxNumberOfSuggestions` 只抬不降到 10；尝试调用 VC 的 reload 命令；成功后直接在 VC 框打字即见标题候选（字段与理由见 spec §3.23） | ⚠️（三层写入路径 / 阈值写入已 dev 单测；VC 活体实例与加载行为需真机核对，`app.plugins` 属 Obsidian 内部 API）|
| Q13 | 模拟 VC 的 `data.json`/活体 `settings` 形状不符合 schema 校验（如字段类型对不上） | 自动配置整体放弃，不写入任何字段、不破坏原有 `data.json` 其余内容；设置面板下拉视觉复位到切换前的值；弹出明确失败 Notice，引导改用「手动配置」 | ✅ 逻辑（`vcintegration.test.ts` invalid-shape 放弃且不触碰文件）/ 🔲 面板复位手验 |
| Q14 | 自动配置写入成功，但 reload 命令调用失败或该命令 id 不存在 | 词典文件与 VC 配置写入仍然成功（不因 reload 失败回滚）；额外弹出一条独立提示，说明需用户手动执行 VC 的「Reload custom dictionaries」命令或重启 Obsidian（与「写入失败」提示文案不同） | ✅ 逻辑（`vcintegration.test.ts` `tryReloadVcDictionaries` 三态）/ 🔲 真实 VC 命令手验 |
| Q15 | 从「自动配置」或「手动配置」切换回「不联动」 | 停止后续词典文件维护（后续标题变化不再触发词典重写）；已生成的词典文件保留在磁盘原处不删除；已写入 VC 的 `customDictionaryPaths`/`enableCustomDictionaryComplement` **不做反向撤销**（v1 明确不做反向清理） | 🔲 待手验（`setVcIntegrationOff` 清计时器逻辑在 `main.ts`，未单独拆测） |
| Q16 | 模拟标题总数超过 `MAX_INDEXED_HEADINGS`（50,000）上限的超大 vault（测试中调小上限模拟） | 索引达到上限后停止继续收录后续文件；弹出一次性 Notice 告知「因 vault 规模过大未完整构建，已索引 N 个标题」；已索引部分功能正常可用，不报错 | ✅（`headingindex.test.ts` 截断 + `main.test.ts` 截断 Notice） |
| Q17 | 运行期（不重载插件/不重启 Obsidian）把「标题链接建议」开关从关闭切换为开启 | 立即触发一次补建索引（`buildInitialHeadingIndex`），无需重启即可开始弹出建议 | ✅（`main.test.ts` 运行期切换补建） |
| Q18 | 已被索引的某个标题所在文件被重命名或删除 | 索引通过 `vault.on("rename"/"delete")` 增量更新；重命名后候选的来源路径/basename 同步更新；删除后该文件标题不再出现在候选里 | ✅（`headingindex.test.ts` `renameFile`/`removeFile`） |
| Q19 | 用户在文件 A 里新建一个标题，几百毫秒防抖窗口内还未被索引更新时，立刻切到文件 B 打字命中这个新标题 | 建议可能暂时不出现（已知的最终一致性代价，见调研方案 §2.5，不是 bug）；防抖窗口过后重新打同样的文字应该能看到建议 | ✅（`main.test.ts` 去抖窗口/重置/切走作废） |
| Q20 | **词典轻量与格式**：① 词典 JSON 顶层为 `{"words":[...]}`；② 标题无变化时（如防抖窗口内重复编辑相同内容）；③ 标题总数超 20,000；④ 自动配置后单字符输入 | ① 词典可被 VC 正常加载；② 不重写词典文件（写盘次数不随无变化编辑增长）；③ 词典截断（≤ ~2.2MB）并弹一次性 Notice；④ VC 框单字符即触发 | ✅（1.0.27：`vcintegration.test.ts` 格式 / 截断 / 阈值 + `main.test.ts` 节流 / 去重 / 截断 Notice）|
| Q21 | **升级/重启场景的词典同步（1.0.28）**：已自动联动的用户升级插件（或重启 Obsidian）后，不打任何字、等几秒 | VC 侧自动拿到新词典：插件启动后在 `onLayoutReady` 主动重写词典 + 调用 VC reload 命令（VC 只在启动与 reload 两个时机加载词典，已对照 VC 源码核实）；reload 因 VC 未就绪失败时按 2s 间隔重试 5 次，耗尽静默（不打扰启动） | ⚠️（`main.test.ts` 重写 + 调用 / 重试耗尽两例；真实 VC 加载需真机确认） |
| Q22 | **无标点连写时的尾部词触发**：已有文本「一笔」继续打成「一笔事务」，或「一个交叉矩阵」，或光标停在行中间的「一笔事务\|拆成」 | 标题【事务】/【交叉矩阵】出现在候选里；接受建议只替换被匹配上的那一段，不吃掉前面的「一笔」（匹配规则见 spec §3.23） | ✅（1.0.29：`headingtrigger.test.ts` 9 例 + `uvm/heading-index.ts` 每步对拍解析结果与替换起点自洽）|
| Q23 | **与 Various Complements 的建议框共存**：VC 已启用，在正文里打出能命中标题的文字 | 默认「让路」：VC 已启用**且词典联动开着**时本插件不触发，标题建议由 VC 框经词典联动呈现；可切「本插件优先」恢复本插件弹框；VC 未安装 / 未启用时该项不渲染也不生效；让路条件不满足时面板如实告知「当前仍由本插件接管」（规则见 spec §3.23） | ✅ 逻辑（1.0.31：`vcintegration.test.ts` `shouldYieldSuggestToVc` 两模式 × 三安装态 × 三联动态）/ 🔲 真机手验（两插件同装，切换该项观察弹框归属）|
| Q24 | **「本插件优先」时隐藏 VC 相关配置**：把「Various Complements 启用时」切到「本插件优先」，且词典联动是「不联动」 | 设置面板不渲染 VC 词典联动区（下拉 + 词典路径行 + 复制按钮）；两条例外照常渲染：① 词典联动已经开着（避免「还在写词典却看不见也关不掉」）；② VC 未安装（手动联动允许先生成词典，见 Q10） | 🔲 真机手验（面板显隐；1.0.31）|
| Q25 | **同名标题在 VC 框里都要出现**：`axi.md` 与 `交叉矩阵.md` 各有一个标题【交叉矩阵】，词典联动开着，在 VC 框里打「交叉」 | 两条候选都出现：冲突项加 `(文件名)` 后缀（组内文件名重名则整组用完整路径，仍撞加 ` #2`），唯一标题保持纯净；短查询下也不被挤出候选列表（规则见 spec §3.23） | ✅ 逻辑（1.0.32 / 1.1.0：`vcintegration.test.ts` `disambiguateVcDisplayed` 6 例 + 同名词典场景 + 上限抬升两例；根因：VC 按显示文本去重会砍掉同名词条，且按显示文本长度截断候选）/ 🔲 真机手验 |
| Q26 | **两个建议框观感统一**：分别在「本插件的框」与「VC 的框」里看同一个标题候选 | 两边观感一致：本插件的框图标改为书架语义、第二行字号 / 配色对齐 VC；VC 的 `descriptionOnSuggestion` 设为 `None` 时第二行不显示，面板如实提示一句（规则见 spec §3.23） | 🔲 真机手验（1.0.32；观感对比、提示是否出现）|
