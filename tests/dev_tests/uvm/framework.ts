/**
 * UVM 风格的「约束随机序列」测试框架（针对编号引擎 `renumberContent`）。
 *
 * ## 为什么要它
 *
 * 单测「一次编号」往往全绿，真正的 bug 几乎都藏在**操作序列**里——「已经有编号了、用户又改了某个
 * 配置 / 又编辑了文本，下一次触发才炸」（见 doc/testplan.md 的状态转移类）。手写穷举这些组合不现实，
 * 故借鉴硬件验证的 **UVM（Universal Verification Methodology）**：用**约束随机**的激励序列大面积撞，
 * 配一个**参考模型记分板**自动判对错，再用**功能覆盖率**确认真的撞到了关心的场景。
 *
 * ## UVM 组件映射（本文件各部分）
 *
 * | UVM 概念 | 这里的对应 |
 * |----------|------------|
 * | Sequence item / 激励 | {@link Op}（编辑文本 / 改模板 / 触发） |
 * | Sequencer（约束随机产生激励） | {@link World.step}（依当前状态、在约束内随机选一个 Op） |
 * | Driver（把激励打到 DUT） | {@link World.apply}（把 Op 施加到「裸文档真值」与「编辑器文本」） |
 * | DUT（被测对象） | `renumberContent`（剥旧前缀 + 重新编号） |
 * | Reference model + Scoreboard（判对错） | {@link World.check}：DUT 输出必须等于「从裸文档真值直接编号」 |
 * | Functional coverage（覆盖率闭合） | {@link Coverage} |
 *
 * ## 记分板核心不变量（oracle）
 *
 * 维护两份状态：`bare`（**规范裸文档**，无任何编号，是「用户真实意图」的真值）与 `rendered`
 * （**当前编辑器各行文本**，含上一次触发写入的前缀，与 `bare` 行一一锁步）。每次「触发」后断言：
 *
 * ```
 *   join(rendered)  ===  renumberContent(serialize(bare), 当前模板)
 *   └─ DUT：对带历史前缀的文本剥离+重编        └─ 参考：对裸文本直接编号（strip 对裸文本是 no-op）
 * ```
 *
 * 两者相等 ⟺ `stripPrefix` 把历史前缀剥得干干净净。**任何前缀叠加 / 残留都会让两侧不等而被当场抓出**
 * （B1–B5、C3 都能被这一条逮到），且参考侧复用**可信的 build 路径**、不重复实现编号逻辑。
 *
 * ## 两种模式与两块记分板（0.6.2 升级）
 *
 * 由 {@link GenConfig} 切换：
 * - **默认模式**（{@link DEFAULT_GEN}，参考模型记分板 {@link World.check}）：在「已修好、参考不变量恒成立」
 *   的受约束空间里随机，确保 CI 常绿、专逮残留 / 叠加。本轮在此**放开 inherit×非空前后缀**（B8 实测无 bug）、
 *   **新增就地安全编辑** {@link OpKind editTitleInPlace}（模拟在已编号标题里继续打字）。
 * - **explore 模式**（{@link EXPLORE_GEN}，幂等性记分板 {@link World.checkIdempotent}）：**放开全部约束**
 *   （字母样式 / inherit×非空前后缀 / 脏标题 / 手动破坏前缀），用恒成立的幂等性（`renumber∘renumber===renumber`）
 *   找 bug。本轮在 20000×80 里撞出 testplan §3.2 的 **U1**（低于 topLevel 标题逐次侵蚀）、**U2**（标点
 *   titleSeparator 吞标题首段数字）、**U3**（字母样式吞英文起头标题）。
 *
 * ## 约束（= 默认模式下 strip 健壮性的精确刻画）
 *
 * - `prefix` / `suffix`：**已放开**——「空 ↔ 候选」随机切换（B2/B3 已修，方案 A）。数字起头标题**不再回避**
 *   （L2 已修）。
 * - `inherit`：**0.6.2 已放开**——可在非空前后缀下翻转（B8 实测无叠加、幂等，原约束过保守）。
 * - `topLevel`：**已放开**（0.6.0 C3 修复）。
 * - 默认模式随机样式仍只用 arabic/cjk/circled（字母样式 L1/U3 取舍，仅 explore 放开）；默认模式不喂脏标题、
 *   不破坏前缀区（E5/U1/U2 取舍/未修 bug，仅 explore 放开）。
 * - 其余（numeral、两个间隔符、skipFill、ancestorNumeral、文本编辑、就地编辑、层级、代码块、白名单）：自由变。
 *
 * > 默认约束**就是 bug 边界**：放开一条 = 扩大覆盖，放开后变红即没修彻底。explore 模式则故意越过这些边界
 * > 找新 bug（U1/U2/U3 即此而来）。详见 uvm/README.md「放开约束」。
 *
 * ## 0.6.5 升级：扩大验证空间与自由度
 *
 * 把「插件全部可设置 + 用户可操作」更完整地纳入激励空间：
 * - **真实白名单驱动**：删去旧版注入的 `isWhitelisted` 回调，改由 `template.whitelist`（随机 0–2 条，
 *   匹配方式含 **exact/partial/subtree**）驱动引擎的 {@link computeWhitelistExemptions}——旧版**完全没
 *   覆盖子树 / 部分匹配与「子标题随根豁免」**。新增 `setWhitelist` 配置激励（增 / 删 / 改条目，覆盖
 *   「改白名单后再触发」的状态转移）。DUT 与参考两侧均走真实 whitelist，故能逮「带历史前缀 vs 裸文档」
 *   的豁免分叉（8000×80 默认模式全绿 → 确认 exact/partial/subtree 引擎实现一致、无前缀敏感分叉）。
 * - **结束编号层级 bottomLevel**：新增 `setBottomLevel` 激励（在 [topLevel,6] 随机），覆盖「只编号区间」
 *   与「收窄区间后剥残留」。
 * - **起始编号数字 startIndex**（0.7.13，M8 批次 1）：新增 `setStartIndex` 激励（0/1/2/5 随机，偏 0/1），
 *   覆盖「0 起编号首段偏移」与「改值后再触发旧前缀剥净」；配 startIndex=0 / non-default 两个覆盖 bin。
 * - **覆盖率新 bin**：whitelist-exact/partial/subtree、subtree-带子标题、bottomLevel-narrowed（默认 500×60 闭合）。
 * - explore 模式（新维度叠加脏编辑）撞出 **U4**（标题正文以**空白起头**时连续触发非幂等：首次保留前导空格、
 *   再次被 parser `[ \t]+` 收拢，见 testplan §3.2）——登记未修。
 *
 * ## 0.7.1 升级：纳入 Backlink 往返不变量（M7）
 *
 * 编号改写标题文本 → 指向旧标题的内部链接需同步（见 spec.md §3.12）。新增第三块记分板
 * {@link World.checkBacklinkRoundTrip}：对每次触发的「编号前→后」文本，断言 `src/backlinks.ts` 的
 * **改名表幂等** + **链接重写往返一致**（指向旧标题的 `[[Target#旧]]` 重写后恰指向同一标题的新名）。
 * 两种 oracle 都跑（纯属文本性质），在整个随机编号空间里压测 backlink 核心；新增覆盖率 bin `backlink-rename`。
 *
 * ## 0.7.5 升级：纳入「清除命令」与「两层触发门控」（扩展蓝图阶段 1，见 testplan §4.1）
 *
 * 把更多**真实用户操作**纳入激励空间，原框架只压 `renumberContent`，现补两类：
 * - **缺口①清除命令**：新增激励 {@link OpKind clearNumbering}（`clearNumberingContent`）/
 *   {@link OpKind clearForeign}（`clearForeignNumberingContent`），并配两条记分板——
 *   **S4 清除还原律**（清除编号 → 还原裸文档）+ **S5 清外来不动律**（清外来 → 不动自家 WJ 编号）。
 *   只在「裸文档为 clear 定点」时施加（排除自食/外来样标题），且**仅参考模式**（explore 的 mutatePrefix
 *   故意抹 WJ，此后清外来剥掉残缺前缀属预期，见 testplan §3.2 S5b）。
 * - **缺口②两层触发门控**：新增 {@link OpKind setFrontmatterSwitch}（true/false/非法/删除）/
 *   {@link OpKind setAutoNumber}，触发分**手动**（{@link OpKind manualTrigger}，绕过门控）/**自动**
 *   （`trigger`，过真实 {@link readFileSwitch} + 全局开关的 `shouldAutoTrigger`）。**S6 门控**：门控关时
 *   `rendered` 冻结、且真实开关解析与结构化 fm 状态一致（{@link World.checkGate}）。
 *
 * 8000×80 两记分板全绿、**未发现引擎 bug**。
 *
 * ## 0.7.6 升级：World→Vault 多文件 + 多模板 + 路径规则 + S7（扩展蓝图阶段 2，缺口③）
 *
 * 把「单文件单模板」升级为**仓库模型**，覆盖远更多真实用户操作：
 * - **多文件**：{@link World.files} 持若干文件（各自 bare/rendered/frontmatter），`switchFile` 切换当前
 *   编辑 / 触发对象；每文件按真实 {@link resolvePathRule} + 查找解析**各自的生效模板**。
 * - **多模板**：{@link World.templates} 命名模板集（共享前后缀候选池，保固定剥离并集为真实
 *   `strippableAffixes()` 上界）；config 类激励改**随机一个模板**的字段。生命周期：createTemplate /
 *   deleteTemplate（锚点「默认」不可删；引用其的规则降级/改投/连删）/ renameTemplate（改名 + 同步规则）。
 * - **路径规则**：{@link World.pathRules}（addRule/deleteRule/editRulePattern/setRuleTemplate/reorderRule），
 *   删根规则 → 该文件无模板（自动静默 / 手动无操作，I7/K6）。
 * - **S7 模板解析记分板**（{@link World.checkResolution}）：无悬挂引用（生命周期同步正确）+ 锚点恒在 +
 *   真实解析与独立参考 {@link World.expectedResolve} 一致。跨模板残留（B2/B3）由参考模型每文件压测。
 *
 * 8000×80 + 20000×80 三记分板全绿、**未发现引擎 bug**。剥离并集取共享候选池上界（动态活模板并集 +
 * 删模板孤儿残留留 backlog，见 testplan §4.1.1 注）。Backlink 开关门控（缺口④）属集成层，留 main.test。
 */

import {
	computeWhitelistExemptions,
	DEFAULT_TEMPLATE,
	renumberContent,
	type Template,
	type WhitelistEntry,
} from "../../../src/numbering";
import { parseHeadings } from "../../../src/parser";
import { readFileSwitch } from "../../../src/frontmatter";
import { resolvePathRule, type PathRule } from "../../../src/pathrules";
import { Rng } from "./rng";
import {
	serialize,
	serializeLine,
	type FileState,
	type FrontmatterState,
	type Line,
} from "./model";
import {
	ANCHOR_TEMPLATE,
	FILE_PATHS,
	MATCH_MODES,
	MESSY_TITLES,
	PREFIX_CANDIDATES,
	RULE_PATTERNS,
	SUFFIX_CANDIDATES,
	TITLES,
	WHITELIST_WORDS,
} from "./stimulus";
import { DEFAULT_GEN, type GenConfig } from "./config";
import { Coverage } from "./coverage";
import { applyClearForeign, applyClearNumbering, applyEdit } from "./operations";
import { applyConfig } from "./config-ops";
import {
	runCheck,
	runCheckBacklinkRoundTrip,
	runCheckGate,
	runCheckIdempotent,
	runCheckResolution,
	runDetectLevelJump,
	runDetectWhitelistCoverage,
} from "./oracles";

/**
 * 一条序列的「世界」（阶段 2 起为**多文件 + 多模板 + 路径规则**的仓库模型）：持有若干文件
 * （各自裸文档 / 编辑器文本 / frontmatter）、一组命名模板、一组路径规则与全局开关，并提供
 * step（约束随机产生并施加一个 Op）与各记分板（参考模型 / 幂等 / Backlink / 清除 S4·S5 / 门控 S6 /
 * 模板解析 S7）。
 *
 * **当前文件**（{@link cur}）是编辑 / 触发的作用对象；其**生效模板**由 `pathRules` 经真实
 * {@link resolvePathRule} + 模板查找解析（= 插件 `getTemplateForFile`），无命中则该文件无模板
 * （自动静默 / 手动无操作）。`bare` / `rendered` / `frontmatterState` 经 getter/setter 委托到当前文件。
 *
 * > **可见性说明**：为配合把编辑类激励 / 配置类激励 / 各记分板拆分到 `operations.ts` / `config-ops.ts` /
 * > `oracles.ts`，下面不少原为 `private` 的字段与方法放宽为 `public`，以便这些自由函数以 `w.xxx` 的
 * > 形式访问 World 的内部状态。这是拆分后的框架内部约定，不代表对外公开 API。
 */
export class World {
	/** 仓库内的若干文件（缺口③）；编辑 / 触发作用于 {@link cur} 指向的当前文件。 */
	readonly files: FileState[];
	cur = 0;
	/** 命名模板集合（缺口③）：全部共享同一前后缀候选池（方案 A，使固定剥离并集恒覆盖）。 */
	templates: Template[];
	/** 路径规则（缺口③）：路径模式 → 模板名；经真实 {@link resolvePathRule} 解析当前文件的模板。 */
	pathRules: PathRule[];
	/** 全序列共享的非空前缀 / 后缀候选；各模板前后缀在「空 ↔ 候选」间切换（验证 B2/B3）。 */
	readonly prefixCandidate: string;
	readonly suffixCandidate: string;
	/**
	 * 传给 `renumberContent` 的剥离选项：`strippablePrefixes` / `strippableSuffixes` 取「空 + 候选」，
	 * 模拟 main.ts 的 `strippableAffixes()`「全模板前后缀并集」（方案 A）。**全部模板共享同一候选池**，
	 * 故固定并集恒等于真实全模板并集的上界，即便文件在模板间切换、旧模板前缀仍被剥净（跨模板 B2/B3）。
	 *
	 * 0.6.5 起不再注入 `isWhitelisted` 回调——改由引擎按 `template.whitelist` 自动计算豁免。
	 */
	readonly opts: {
		strippablePrefixes: string[];
		strippableSuffixes: string[];
	};
	/** 本序列的标题取样池；方案 A 后不再回避「数字/字母起头」标题（恒含空前缀候选 → 对称处理）。 */
	readonly titlePool: string[];
	readonly trace: string[] = [];
	/** 全局自动编号面板开关（缺口②）；自动触发须过 `shouldAutoTrigger`，手动触发绕过。 */
	autoNumber = true;
	/** 每个文件上次**有效触发**时的生效模板名，用于检测「跨模板切换」覆盖（缺口③）。 */
	private readonly lastResolved = new Map<string, string | null>();

	constructor(
		public readonly rng: Rng,
		public readonly seed: number,
		public readonly cov: Coverage,
		public readonly cfg: GenConfig = DEFAULT_GEN,
	) {
		this.titlePool = cfg.messyTitles ? [...TITLES, ...MESSY_TITLES] : TITLES;
		this.prefixCandidate = rng.pick(PREFIX_CANDIDATES);
		this.suffixCandidate = rng.pick(SUFFIX_CANDIDATES);
		this.opts = {
			strippablePrefixes: ["", this.prefixCandidate],
			strippableSuffixes: ["", this.suffixCandidate],
		};
		// —— 模板集合：锚点「默认」+ 随机 1–2 个额外模板（各自格式不同，但共享前后缀候选池）——
		this.templates = [this.makeTemplate(ANCHOR_TEMPLATE)];
		const extra = rng.int(2); // 0/1：再加 0~1 个，半数序列多模板。
		const extraNames = ["模板B", "模板C"];
		for (let i = 0; i < extra + 1; i++) {
			this.templates.push(this.makeTemplate(extraNames[i]));
		}
		// —— 路径规则：恒含根规则「/」→默认（锚点），再随机叠 0–2 条更具体的规则 ——
		this.pathRules = [{ pattern: "/", template: ANCHOR_TEMPLATE }];
		const ruleCount = rng.int(3);
		for (let i = 0; i < ruleCount; i++) {
			this.pathRules.push({
				pattern: rng.pick(RULE_PATTERNS),
				template: rng.pick(this.templates).name,
			});
		}
		// —— 文件：随机 1–3 个不同路径，各自最小裸文档 + 随机 frontmatter ——
		const fileCount = rng.intRange(1, 3);
		const paths = [...FILE_PATHS];
		this.files = [];
		const startFm: FrontmatterState[] = ["none", "none", "true", "false", "illegal"];
		for (let i = 0; i < fileCount && paths.length; i++) {
			const path = paths.splice(rng.int(paths.length), 1)[0];
			const bare: Line[] = [
				{ kind: "heading", level: rng.intRange(2, 3), title: rng.pick(this.titlePool) },
			];
			this.files.push({
				path,
				bare,
				rendered: bare.map(serializeLine),
				frontmatterState: rng.pick(startFm),
			});
		}
		this.cur = 0;
		this.autoNumber = rng.chance(0.5);
	}

	// ── 当前文件 / 生效模板访问器 ─────────────────────────────────────────────
	get file(): FileState {
		return this.files[this.cur];
	}
	get bare(): Line[] {
		return this.file.bare;
	}
	set bare(v: Line[]) {
		this.file.bare = v;
	}
	get rendered(): string[] {
		return this.file.rendered;
	}
	set rendered(v: string[]) {
		this.file.rendered = v;
	}
	get frontmatterState(): FrontmatterState {
		return this.file.frontmatterState;
	}
	set frontmatterState(v: FrontmatterState) {
		this.file.frontmatterState = v;
	}

	/** 造一个共享前后缀候选池、格式随机的命名模板。 */
	makeTemplate(name: string): Template {
		const tpl = structuredClone(DEFAULT_TEMPLATE);
		tpl.name = name;
		const startPrefix = this.rng.chance(0.5) ? "" : this.prefixCandidate;
		const startSuffix = this.rng.chance(0.5) ? "" : this.suffixCandidate;
		for (const k of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
			tpl.levels[k].prefix = startPrefix;
			tpl.levels[k].suffix = startSuffix;
			tpl.levels[k].numeral = this.rng.pick(this.cfg.numerals);
		}
		tpl.topLevel = this.rng.intRange(1, 3);
		tpl.whitelist = this.randomWhitelist();
		return tpl;
	}

	/** 当前文件经真实 `resolvePathRule` + 模板查找解析到的生效模板（= 插件 getTemplateForFile）。 */
	resolvedTemplate(): Template | null {
		const rule = resolvePathRule(this.pathRules, this.file.path);
		if (!rule) {
			return null;
		}
		return this.templates.find((t) => t.name === rule.template) ?? null;
	}

	/** 随机挑一个模板来「改格式字段」（config 类激励的作用对象）。 */
	pickTemplate(): Template {
		return this.rng.pick(this.templates);
	}

	/** 把结构化 frontmatter 状态渲染成实际的 `---` 块行（none 时为空块）。 */
	private frontmatterLines(): string[] {
		if (this.frontmatterState === "none") {
			return [];
		}
		const value =
			this.frontmatterState === "true"
				? "true"
				: this.frontmatterState === "false"
					? "false"
					: "ON"; // illegal：旧版文本值，readFileSwitch 按非法 → null 处理。
		return ["---", `obsidian-auto-headings: ${value}`, "---"];
	}

	/** 组合「frontmatter + 编辑器正文」的完整文件文本（供真实 readFileSwitch 读单文件开关）。 */
	private composeFull(): string {
		const fm = this.frontmatterLines();
		return fm.length ? [...fm, ...this.rendered].join("\n") : this.rendered.join("\n");
	}

	/** 当前序列的剥离选项（清除命令与剥离器共用同一前后缀并集）。 */
	get cleanupOpts(): { strippablePrefixes: string[]; strippableSuffixes: string[] } {
		return this.opts;
	}

	/** 随机生成一组白名单条目（0–2 条，词去重，匹配方式随机）。 */
	private randomWhitelist(): WhitelistEntry[] {
		const count = this.rng.int(3); // 0/1/2
		const out: WhitelistEntry[] = [];
		const used = new Set<string>();
		for (let i = 0; i < count; i++) {
			const text = this.rng.pick(WHITELIST_WORDS);
			if (used.has(text)) continue;
			used.add(text);
			out.push({ text, match: this.rng.pick(MATCH_MODES) });
		}
		return out;
	}

	/**
	 * 计算**裸文档**里被白名单豁免的标题所在行下标（供就地编辑守卫与覆盖率）。
	 * 直接复用引擎的 {@link computeWhitelistExemptions}，与 DUT 同口径。
	 */
	exemptBareIndices(template: Template | null): Set<number> {
		const out = new Set<number>();
		if (!template) {
			return out;
		}
		const headings = parseHeadings(serialize(this.bare));
		const exemptSet = computeWhitelistExemptions(headings, template, this.opts);
		for (const h of headings) {
			if (exemptSet.has(h)) out.add(h.lineIndex);
		}
		return out;
	}

	/** 当前 bare 文档里的标题行下标。 */
	headingIndices(): number[] {
		const out: number[] = [];
		this.bare.forEach((l, i) => {
			if (l.kind === "heading") out.push(i);
		});
		return out;
	}

	/** 在两份状态的同一下标处插入同一行（裸形式）。 */
	insertAt(i: number, line: Line): void {
		this.bare.splice(i, 0, line);
		this.rendered.splice(i, 0, serializeLine(line));
	}

	/** 约束随机地产生并施加一个 Op；触发类 Op 之后会调用 {@link check}。 */
	step(): void {
		const r = this.rng.next();
		if (r < 0.35) {
			// 触发分两路（缺口②）：约 30% 走手动（「立即重新编号」，绕过门控），其余走自动（受门控）。
			this.trigger(this.rng.chance(0.3));
		} else if (r < 0.65) {
			this.edit();
		} else {
			this.config();
		}
	}

	/**
	 * 收尾：确保每条序列至少**有效结算一次**——补一条根规则→默认（若已被删），再对每个文件**手动**触发
	 * （绕过门控、必命中模板），让所有文件的参考模型在终态都被校验一遍。
	 */
	finish(): void {
		if (!this.pathRules.some((r) => r.pattern === "/")) {
			this.pathRules.unshift({ pattern: "/", template: ANCHOR_TEMPLATE });
		}
		for (let i = 0; i < this.files.length; i++) {
			this.cur = i;
			this.trigger(true);
		}
	}

	// ── 编辑类激励（实现见 operations.ts）─────────────────────────────────────
	private edit(): void {
		applyEdit(this);
	}

	/** 「清除当前文件编号」命令 + S4 清除还原律（实现见 operations.ts）。 */
	clearNumbering(): void {
		applyClearNumbering(this);
	}

	/** 「清理非本插件编号」命令 + S5 清外来不动律（实现见 operations.ts）。 */
	clearForeign(): void {
		applyClearForeign(this);
	}

	// ── 配置类激励（实现见 config-ops.ts）──────────────────────────────────────
	private config(): void {
		applyConfig(this);
	}

	/** 门控记分板 S6（实现见 oracles.ts）。 */
	private checkGate(sw: boolean | null): void {
		runCheckGate(this, sw);
	}

	// ── 触发（DUT）+ 记分板（参考模型 + 两层门控 S6）──────────────────────────
	/**
	 * @param manual 手动触发（「立即重新编号」命令）绕过门控；自动触发须过 `shouldAutoTrigger`。
	 */
	private trigger(manual: boolean): void {
		this.checkResolution(); // S7：每次触发前核对路径解析一致 + 无悬挂引用。
		// 两层门控（缺口②）：自动路径由真实 readFileSwitch + 全局开关决定是否放行；手动路径恒放行。
		const sw = readFileSwitch(this.composeFull());
		this.checkGate(sw);
		const gateOpen = manual || (sw === false ? false : sw === true ? true : this.autoNumber);
		if (!gateOpen) {
			// 门控关：自动触发不应用任何改动，rendered 冻结（S6 冻结律的行为体现）。
			this.cov.gatedOff = true;
			if (sw !== true && !this.autoNumber) this.cov.autoNumberOffTrigger = true;
			this.trace.push(`— autoTrigger gated-off (fm=${this.frontmatterState}) —`);
			return;
		}
		// 缺口③：当前文件按路径规则解析生效模板；无命中 → 无可用模板（自动静默 / 手动无操作，I7/K6）。
		const rule = resolvePathRule(this.pathRules, this.file.path);
		const template = this.resolvedTemplate();
		if (!template) {
			this.cov.nullResolution = true;
			this.trace.push(`— trigger no-template (${this.file.path}) —`);
			return;
		}
		// 解析具体度覆盖 + 跨模板切换检测（与上次该文件有效触发的生效模板比对）。
		if (rule) {
			if (rule.pattern === "/") this.cov.resolveRoot = true;
			else if (rule.pattern.endsWith("/")) this.cov.resolveFolder = true;
			else this.cov.resolveFile = true;
		}
		const prev = this.lastResolved.get(this.file.path);
		if (prev !== undefined && prev !== template.name) this.cov.crossTemplateSwitch = true;
		this.lastResolved.set(this.file.path, template.name);
		if (this.templates.length >= 2) this.cov.multiTemplate = true;

		if (manual) this.cov.manualTriggered = true;
		if (template.levels.h2.prefix !== "" || template.levels.h2.suffix !== "") {
			this.cov.affixNonEmptyTrigger = true;
		}
		const before = this.rendered.join("\n");
		const after = renumberContent(before, template, this.opts);
		this.rendered = after.split("\n");
		this.cov.bumpOp(manual ? "manualTrigger" : "trigger");
		this.cov.triggers++;
		this.trace.push(manual ? "— manualTrigger —" : "— autoTrigger —");
		this.detectLevelJump();
		this.detectWhitelistCoverage(template);
		// Backlink 改名表 + 链接重写往返不变量（M7，两种 oracle 均跑：纯属 before→after 文本性质）。
		this.checkBacklinkRoundTrip(before, after);
		if (this.cfg.oracle === "reference") {
			this.check(template);
		} else {
			this.checkIdempotent(template);
		}
	}

	/** 模板解析记分板 S7（实现见 oracles.ts）；config-ops.ts 的多个规则/模板变更分支也会调用它。 */
	checkResolution(): void {
		runCheckResolution(this);
	}

	/** Backlink 往返记分板（实现见 oracles.ts）。 */
	private checkBacklinkRoundTrip(before: string, after: string): void {
		runCheckBacklinkRoundTrip(this, before, after);
	}

	/** 白名单相关覆盖率探测（实现见 oracles.ts）。 */
	private detectWhitelistCoverage(template: Template): void {
		runDetectWhitelistCoverage(this, template);
	}

	/** 层级跳变覆盖率探测（实现见 oracles.ts）。 */
	private detectLevelJump(): void {
		runDetectLevelJump(this);
	}

	/** 幂等性记分板（explore 模式，实现见 oracles.ts）。 */
	private checkIdempotent(template: Template): void {
		runCheckIdempotent(this, template);
	}

	/** 参考模型记分板（默认模式，实现见 oracles.ts）。 */
	private check(template: Template): void {
		runCheck(this, template);
	}
}

/** 跑一条序列：给定种子与操作步数，全程在记分板监督下随机推进。失败抛 {@link SequenceError}。 */
export function runSequence(
	seed: number,
	ops: number,
	cov: Coverage,
	cfg: GenConfig = DEFAULT_GEN,
): void {
	const rng = new Rng(seed);
	const world = new World(rng, seed, cov, cfg);
	for (let i = 0; i < ops; i++) {
		world.step();
	}
	world.finish();
}

// ── 对外入口：本文件是 uvm 框架唯一入口，下列符号均从拆分出去的子模块 re-export ──
export { Coverage, SequenceError } from "./coverage";
export { DEFAULT_GEN, EXPLORE_GEN } from "./config";
export type { GenConfig, OpKind } from "./config";
