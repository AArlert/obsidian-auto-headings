# UVM 风格「约束随机序列」测试框架

把硬件验证里的 **UVM（Universal Verification Methodology）**思想搬来压测编号引擎：用**约束随机**的
「用户操作序列」大面积撞 bug，配一个**参考模型记分板**自动判对错，再用**功能覆盖率**确认真撞到了
关心的场景。专治 testplan 里那类「单测没事、特定操作序列才炸」的**状态转移** bug。

## 为什么需要它

`renumberContent` 每次触发 = **剥旧前缀 + 重新编号**。绝大多数诡异 bug 出在「剥」——旧前缀是用
**旧配置**写的，剥离器拿的是**新配置**。手写穷举「先用配置 A 编号 → 改某字段 → 再触发」的组合不现实，
随机序列能在几千条里把这些路径都走一遍。

## UVM 组件映射

| UVM 概念                      | 这里                                          | 文件/符号                               |
| ----------------------------- | --------------------------------------------- | --------------------------------------- |
| Sequence item（激励）         | 一个操作：编辑文本 / 改模板字段 / 触发编号    | `config.ts` 的 `OpKind`                 |
| Sequencer（约束随机产生激励） | 依当前状态在约束内随机选一个操作              | `framework.ts` 的 `World.step`          |
| Driver（把激励打到 DUT）      | 把操作施加到「裸文档真值」与「编辑器文本」    | `operations.ts` / `config-ops.ts`       |
| DUT（被测对象）               | 编号引擎                                      | `renumberContent`（`src/numbering.ts`） |
| Reference model + Scoreboard  | DUT 输出 **必须等于**「从裸文档真值直接编号」 | `oracles.ts` 的 `runCheck`              |
| Functional coverage           | 关键场景 bin 是否都撞到                       | `coverage.ts` 的 `Coverage`             |

## 文件分工

框架原先是单文件 1686 行（曾是全仓库最大的文件），已按职责拆开；`framework.ts` 仍是**唯一入口**，
对外 re-export `runSequence` / `Coverage` / `DEFAULT_GEN` / `EXPLORE_GEN`，调用方无需感知内部分文件。

| 文件            | 职责                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `framework.ts`  | `World` 的状态与世界模型（多文件仓库 / 模板集 / 路径规则）+ `step`/`finish`/`trigger` + `runSequence`                     |
| `operations.ts` | 编辑类与清除类激励的施加：`applyEdit` / `applyClearNumbering` / `applyClearForeign`                                       |
| `config-ops.ts` | 配置类激励的施加：`applyConfig`（格式字段 / 模板生命周期 / 路径规则 / 多文件与开关）                                      |
| `oracles.ts`    | 全部记分板：`runCheck`（参考模型）/ `runCheckIdempotent`（幂等）/ S4–S7 各条 + S7 的独立参考模型 `indepMatch`/`indepSpec` |
| `coverage.ts`   | 功能覆盖率收集器 `Coverage` + 失败诊断载体 `SequenceError`                                                                |
| `config.ts`     | 生成配置 `GenConfig` / `DEFAULT_GEN` / `EXPLORE_GEN` + 激励字母表 `OpKind`                                                |
| `stimulus.ts`   | 全部随机取样池（标题 / 白名单词 / 序号样式 / 路径 / 前后缀候选…）                                                         |
| `model.ts`      | 世界模型的行与文件类型 + 序列化                                                                                           |
| `rng.ts`        | 可复现随机数（mulberry32），同种子跨机一致                                                                                |

> 拆分是**纯搬运**：以种子化黄金基线（1000 条序列的 `World` 终态 + `Coverage` 指纹）逐字节比对，
> 拆分前后完全一致，`rng` 调用序列未被扰动。改动本文件树时请沿用这套验收方式。

## 0.6.2 升级：两种模式 + 两块记分板 ★

为「发现潜在 bug 能力不够强」做的增强（本轮即用它撞出 testplan §3.3 的 U1/U2/U3）：

| 维度               | 默认模式（`DEFAULT_GEN`）                                 | explore 模式（`EXPLORE_GEN`）                                           |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| 记分板             | **参考模型**（裸文档直接编号，强、逮残留/叠加）           | **幂等性** `renumber∘renumber===renumber`（恒成立、容脏输入与放开约束） |
| 标题编辑           | retitle（清空重打）+ **就地安全编辑**（保留旧前缀改文本） | + 脏就地编辑（分隔符/数字/字母/空白碎片）、手动破坏前缀区               |
| 序号样式           | arabic/cjk/circled                                        | + lower/upper-alpha、lower/upper-roman                                  |
| inherit×非空前后缀 | **放开**（B8 实测无 bug）                                 | 放开                                                                    |
| 脏标题 / 破坏前缀  | 否                                                        | 是                                                                      |
| 进 CI？            | 是（常绿）                                                | **是**（0.6.7 起转正，见下）                                            |

> **两种模式现在都随 `npm test` 常态跑。** explore 早期因会撞 U1/U2/U3 而挂 `it.skip`，
> 但 U1/U2（0.6.3）、U3（0.6.6 方案A）、U4（0.6.7）均已修复（见 `doc/testplan.md` §3.3），
> 故 0.6.7 起转正为常规回归测试。环境变量 `AAH_FUZZ_MODE` **已无门控效果**，仅为兼容保留
> （`random_sequence.test.ts:11`）——两条用例由 `DEFAULT_GEN` / `EXPLORE_GEN` 各自固定选择记分板。

**为什么需要第二块记分板**：旧的参考模型本质是**单次施加等价性**（「对 rendered 编一次」=「对 bare 编一次」），
逮不到**多次施加**才暴露的侵蚀——尤其「剥了不补」的低于 topLevel / 白名单路径（参考侧同样吃一层 → 两侧仍相等）。
幂等性记分板恰好补这个结构盲区，**U1 即由它逮到**。两者互补：参考模型守干净空间逮叠加，幂等性在脏空间找新 bug。

加压探索（两块记分板会一起跑）：

```bash
node scripts/fuzz.mjs --runs=20000 --ops=80
```

## 记分板核心不变量（oracle）

维护两份状态：

-   `bare`：**规范裸文档**（无任何编号），是「用户真实意图」的真值。
-   `rendered`：**当前编辑器各行文本**，含上一次触发写入的前缀，与 `bare` 行一一锁步。

每次「触发」后断言：

```
join(rendered)  ===  renumberContent(serialize(bare), 当前模板)
└ DUT：对带历史前缀的文本剥离+重编      └ 参考：对裸文本直接编号（strip 对裸文本是 no-op）
```

两者相等 ⟺ `stripPrefix` 把历史前缀剥得干干净净。**任何前缀叠加 / 残留都会让两侧不等而被当场抓出**
（B1–B5、C3 都逮得到），且参考侧复用**可信的 build 路径**、不重复实现编号逻辑，因而不会与 DUT 各自演化出分歧。

此外还断言：标题 `#` 层级不被改写、原样行（正文/代码块）不被动。

> **这块记分板的能力边界**（别把它当成"编号语义绝对正确"的证明）：参考侧调用的仍是同一套
> `renumberContent`，所以它证明的是**「带历史前缀的状态」与「裸文档状态」殊途同归**，而非编号规则本身正确。
> 若 DUT 与参考对某条规则的理解**同时**错了（共因错误），两侧会一起错、这块记分板不会报警——那类问题
> 归静态单测（`numbering.test.ts` 等）与 `doc/testplan.md` 的真值表守。
> 真正需要独立实现来交叉验证的窄路径（路径规则的匹配与具体度）已另配独立参考模型
> `indepMatch`/`indepSpec`（`oracles.ts`，记分板 S7）——这是有意的成本分配：**只在最易共因出错处**
> 重写一份，而不是把整个编号引擎实现两遍（第二份实现只会成为第二处需要同步维护、且会漂移的真相源）。

## 约束 = 当前 strip 健壮性的精确刻画

默认生成器只在「当前已修好、参考不变量恒成立」的空间里随机，确保 CI 常绿。约束表（每条约束对应的
testplan ID 与放开状态）的唯一出处是 [`doc/testplan/4-UVM压测.md`](../../../doc/testplan/4-UVM压测.md)，
此处只记机制：

放开 B2/B3 的做法：前后缀在「空 ↔ 本序列候选」间随机切换，并把「空 + 候选」并集经 `strippablePrefixes`
/ `strippableSuffixes` 传给 `renumberContent`（模拟 main.ts 传入的全模板并集，即**方案 A**）。
放开 L2 的做法：剥离恒纳入空前缀候选 → 裸态与带前缀态对称地都吃数字起头标题，参考模型一致；配合
引擎「只剥一层」，`1 2024` 这类用户补回的数字得以保留（E5b 静态覆盖）。

## 怎么跑

```bash
npm test                                   # 两条用例各 500 条 × 60 步（<2s），随 CI 一起跑
npm run test:fuzz                          # 重型：5000 条 × 80 步（找新 bug / 改完引擎后压一遍）
node scripts/fuzz.mjs --runs=20000 --ops=80  # 专项加压
```

> 重型压测经 `scripts/fuzz.mjs` 注入 `AAH_FUZZ_*` 环境变量，**三大平台一致**。早期 `test:fuzz` 写成
> `AAH_FUZZ_RUNS=5000 … vitest`（POSIX 前缀赋值），而 npm 在 Windows 上默认用 `cmd.exe` 跑 script，
> 该语法解析不了 ⇒ 这条命令在 Windows 开发机上长期是失效的。手写 `npx vitest` 时同理，请改用上面的脚本。

## 复现失败

失败会抛 `SequenceError`，内含 **seed + 完整操作轨迹（含每次 trigger）+ DUT/期望/裸文档三方文本**。
照种子单跑那一条即可稳定复现：

```bash
node scripts/fuzz.mjs --seed=9 --runs=1 --ops=60
```

> RNG 是 mulberry32（`rng.ts`），同种子结果跨机一致，故失败 100% 可复现。

## 加新维度 / 新操作

1. 在 `config.ts` 的 `OpKind` 加类型；在 `operations.ts`（编辑/清除类）或 `config-ops.ts`（配置类）
   加生成与施加逻辑；在 `coverage.ts` 的 `Coverage` 加对应 bin；新的取样池放 `stimulus.ts`。
2. 若新维度可能触达**已知 bug**，先加相应**约束**（并在上表登记对应 testplan ID），保持 CI 绿。
3. 跑 `npm run test:fuzz` 几轮确认不误报，再提交。

## 扩展现状与覆盖范围

「把用户全部操作纳入验证」的覆盖清单、S4–S7 不变量表、未建模边界（backlog）与不入 UVM 清单
只维护在 [`doc/testplan/4-UVM压测.md`](../../../doc/testplan/4-UVM压测.md) §4.1，此处不再复制。
S4/S5 仅参考模式施加的边界见 testplan §3.2 取舍 S5b。
