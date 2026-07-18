/**
 * UVM 框架的功能覆盖率收集器（{@link Coverage}）与序列失败异常（{@link SequenceError}）。
 */

import type { NumeralStyle } from "../../../src/numbering";
import type { OpKind } from "./config";
import { NUMERALS } from "./stimulus";

/** 功能覆盖率收集器（UVM functional coverage）：确认随机真的撞到了关心的场景。 */
export class Coverage {
	readonly ops = new Map<OpKind, number>();
	readonly numerals = new Set<NumeralStyle>();
	inheritFalse = false;
	skipDrop = false;
	skipFill = false;
	/** skipFill=none（跳级标题完全不编号，0.7.15）曾被设入模板。 */
	skipNone = false;
	ancestorArabic = false;
	ancestorSelf = false;
	topLevelLowered = false;
	/** topLevel 被**升高**（C3 修复后放开，见框架顶部注释）。 */
	topLevelRaised = false;
	/** 前缀 / 后缀曾被切换（验证 B2/B3 的状态转移）。 */
	affixToggled = false;
	/** 曾在「前缀或后缀非空」的状态下触发编号。 */
	affixNonEmptyTrigger = false;
	fencePresent = false;
	whitelistHit = false;
	/** 白名单三种匹配方式各自曾被设入模板（真实 whitelist 驱动，0.6.5）。 */
	whitelistExact = false;
	whitelistPartial = false;
	whitelistSubtree = false;
	/** 曾出现「子树根命中且其下确有更深子标题被一并豁免」的情形。 */
	whitelistSubtreeWithChildren = false;
	/** 结束编号层级 bottomLevel 曾被收窄到 < 6（编号区间下界，0.6.5）。 */
	bottomLevelNarrowed = false;
	/** 起始编号数字 startIndex 曾被设为 0（0 起编号 `0.1.1`，M8 批次 1）。 */
	startIndexZero = false;
	/** 起始编号数字曾被设为非默认值（≠1，覆盖首段偏移 + 改值后再触发剥净）。 */
	startIndexNonDefault = false;
	emptyTitle = false;
	levelGE5 = false;
	levelJump = false;
	selfEatingTitle = false;
	/** 曾就地编辑过「已带前缀」的标题（保留旧前缀改文本）。 */
	inPlaceEdited = false;
	/** 曾手动破坏过前缀区（explore）。 */
	prefixMutated = false;
	/** 曾把已编号标题降级为正文（删光 `#`），触发 ③ 残留清理路径（0.7.20）。 */
	demoted = false;
	/** 曾在「前后缀非空」状态下翻转 inherit（explore，验证 B8）。 */
	inheritWithAffix = false;
	/** 曾发生过标题锚点改名（编号改写标题 → Backlink 改名表非空，M7）。 */
	backlinkRename = false;
	/** 两层门控（缺口②）：曾因 frontmatter / 全局开关把自动触发门控关掉（rendered 冻结）。 */
	gatedOff = false;
	/** 曾设过 frontmatter 开关的各值（驱动真实 readFileSwitch + shouldAutoTrigger）。 */
	fmFalse = false;
	fmTrue = false;
	fmIllegal = false;
	/** 曾在「全局自动编号=关」下走自动触发（应被冻结）。 */
	autoNumberOffTrigger = false;
	/** 曾走过手动触发路径（绕过门控，对应「立即重新编号」命令）。 */
	manualTriggered = false;
	/** 清除还原律 S4 曾被断言（清除当前文件编号 → 还原裸文档，缺口①）。 */
	clearRestore = false;
	/** 清外来不动律 S5 曾被断言（清理外来编号 → 自家 WJ 编号不动，缺口①）。 */
	clearForeignNoop = false;
	// ── 阶段 2（缺口③）：多文件 + 多模板 + 路径规则 ──
	templateCreated = false;
	templateDeleted = false;
	templateRenamed = false;
	ruleAdded = false;
	ruleDeleted = false;
	ruleEdited = false;
	ruleRetargeted = false;
	ruleReordered = false;
	fileSwitched = false;
	/** 曾在某时刻同时存在 ≥2 个模板。 */
	multiTemplate = false;
	/** 某文件两次有效触发之间，其生效模板名发生过变化（跨模板状态转移）。 */
	crossTemplateSwitch = false;
	/** 某次触发时当前文件无可用模板（无规则命中 → 静默跳过，对应 I7/K6）。 */
	nullResolution = false;
	/** 触发时生效规则的具体度：根 / 文件夹 / 精确文件各命中过。 */
	resolveRoot = false;
	resolveFolder = false;
	resolveFile = false;
	triggers = 0;

	bumpOp(kind: OpKind): void {
		this.ops.set(kind, (this.ops.get(kind) ?? 0) + 1);
	}

	/** 返回未被覆盖到的关键 bin 列表（空数组表示覆盖闭合）。 */
	gaps(): string[] {
		const missing: string[] = [];
		const allOps: OpKind[] = [
			"insertHeading",
			"insertRaw",
			"insertFence",
			"deleteLine",
			"retitle",
			"editTitleInPlace",
			"changeLevel",
			"setNumeral",
			"setNumberSep",
			"setTitleSep",
			"setInherit",
			"setPrefix",
			"setSuffix",
			"setTopLevel",
			"setBottomLevel",
			"setStartIndex",
			"setSkipFill",
			"setAncestor",
			"setWhitelist",
			"setFrontmatterSwitch",
			"setAutoNumber",
			"clearNumbering",
			"clearForeign",
			"createTemplate",
			"deleteTemplate",
			"renameTemplate",
			"addRule",
			"deleteRule",
			"editRulePattern",
			"setRuleTemplate",
			"reorderRule",
			"switchFile",
			"manualTrigger",
			"trigger",
		];
		for (const op of allOps) {
			if ((this.ops.get(op) ?? 0) === 0) missing.push(`op:${op}`);
		}
		for (const n of NUMERALS) if (!this.numerals.has(n)) missing.push(`numeral:${n}`);
		if (!this.inheritFalse) missing.push("inherit=false");
		if (!this.skipDrop) missing.push("skipFill=drop");
		if (!this.skipFill) missing.push("skipFill=fill");
		if (!this.skipNone) missing.push("skipFill=none");
		if (!this.ancestorArabic) missing.push("ancestor=arabic");
		if (!this.ancestorSelf) missing.push("ancestor=self");
		if (!this.topLevelLowered) missing.push("topLevel-lowered");
		if (!this.topLevelRaised) missing.push("topLevel-raised");
		if (!this.affixToggled) missing.push("affix-toggled");
		if (!this.affixNonEmptyTrigger) missing.push("affix-nonempty-trigger");
		if (!this.fencePresent) missing.push("fence");
		if (!this.whitelistHit) missing.push("whitelist-hit");
		if (!this.whitelistExact) missing.push("whitelist-exact");
		if (!this.whitelistPartial) missing.push("whitelist-partial");
		if (!this.whitelistSubtree) missing.push("whitelist-subtree");
		if (!this.whitelistSubtreeWithChildren) missing.push("whitelist-subtree-children");
		if (!this.bottomLevelNarrowed) missing.push("bottomLevel-narrowed");
		if (!this.startIndexZero) missing.push("startIndex=0");
		if (!this.startIndexNonDefault) missing.push("startIndex-non-default");
		if (!this.emptyTitle) missing.push("empty-title");
		if (!this.levelGE5) missing.push("level>=5");
		if (!this.levelJump) missing.push("level-jump");
		if (!this.selfEatingTitle) missing.push("self-eating-title");
		if (!this.demoted) missing.push("demote-heading");
		if (!this.inPlaceEdited) missing.push("in-place-edit");
		if (!this.backlinkRename) missing.push("backlink-rename");
		// 缺口①②新增 bin。
		if (!this.gatedOff) missing.push("gated-off");
		if (!this.fmFalse) missing.push("fm=false");
		if (!this.fmTrue) missing.push("fm=true");
		if (!this.fmIllegal) missing.push("fm=illegal");
		if (!this.autoNumberOffTrigger) missing.push("autoNumber-off-trigger");
		if (!this.manualTriggered) missing.push("manual-trigger");
		if (!this.clearRestore) missing.push("clear-restore(S4)");
		if (!this.clearForeignNoop) missing.push("clear-foreign-noop(S5)");
		// 缺口③新增 bin。
		if (!this.multiTemplate) missing.push("multi-template");
		if (!this.crossTemplateSwitch) missing.push("cross-template-switch");
		if (!this.nullResolution) missing.push("null-resolution");
		if (!this.resolveRoot) missing.push("resolve-root");
		if (!this.resolveFolder) missing.push("resolve-folder");
		if (!this.resolveFile) missing.push("resolve-file");
		if (!this.fileSwitched) missing.push("file-switched");
		return missing;
	}
}

/** 失败时抛出，携带种子 + 操作轨迹 + 三方文本，便于直接复现定位。 */
export class SequenceError extends Error {
	constructor(seed: number, trace: string[], detail: string) {
		super(`UVM 序列失败（seed=${seed}）：${detail}\n操作轨迹：\n  ${trace.join("\n  ")}`);
		this.name = "SequenceError";
	}
}
