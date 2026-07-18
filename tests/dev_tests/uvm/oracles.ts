/**
 * World 的各记分板（oracle）实现（从 `framework.ts` 拆出）：门控 S6、模板解析 S7、Backlink 往返、
 * 白名单 / 层级跳变覆盖率探测、幂等性记分板、参考模型记分板 `check`。
 */

import { renumberContent, type Template } from "../../../src/numbering";
import { parseHeadings, type Heading } from "../../../src/parser";
import {
	computeHeadingRenames,
	linkAnchor,
	rewriteBacklinksInContent,
} from "../../../src/backlinks";
import { resolvePathRule, type PathRule } from "../../../src/pathrules";
import { headingLevels, serialize, type Line } from "./model";
import { ANCHOR_TEMPLATE } from "./stimulus";
import { SequenceError } from "./coverage";
import type { World } from "./framework";

/**
 * 独立重实现的「规则是否匹配 / 具体度」（S7 参考模型，与 `src/pathrules.ts` 解耦）：用于核对真实
 * {@link resolvePathRule} 的解析结果。生成器只产出已归一化的干净模式（无反斜杠 / `./` / 重复斜杠），
 * 故此处无需归一化——归一化边界由 `pathrules.test.ts` 静态覆盖，本参考模型聚焦「具体度 + 并列取后者」。
 */
function indepMatch(pattern: string, path: string): boolean {
	if (pattern === "/") return true;
	if (pattern.endsWith("/")) return path.startsWith(pattern);
	return path === pattern;
}
function indepSpec(pattern: string): number {
	if (pattern === "/") return 0;
	if (pattern.endsWith("/")) return pattern.length;
	return 1_000_000 + pattern.length;
}

/**
 * **门控记分板 S6**（缺口②）：用真实 `readFileSwitch` 解析当前 frontmatter，断言其结果与本框架
 * 设定的结构化状态 {@link World.frontmatterState} 一致（true→true / false→false / none·illegal→null）。
 * 这把真实的单文件开关解析器（含引号剥离、非法值兜底）纳入随机 frontmatter 空间压测。
 */
export function runCheckGate(w: World, sw: boolean | null): void {
	const expected =
		w.frontmatterState === "true" ? true : w.frontmatterState === "false" ? false : null; // none / illegal → 跟随全局开关（readFileSwitch 返回 null）。
	if (sw !== expected) {
		throw new SequenceError(
			w.seed,
			w.trace,
			`S6 门控解析不一致：frontmatter=${w.frontmatterState} 时 readFileSwitch=${JSON.stringify(
				sw,
			)} ≠ 期望 ${JSON.stringify(expected)}`,
		);
	}
}

/**
 * **模板解析记分板 S7**（缺口③）：核对路径规则解析的自洽性——
 * 1. **无悬挂引用**：每条规则引用的模板名都存在（删 / 改名后同步正确，= 插件 renameTemplate / 删模板降级）。
 * 2. **锚点恒在**：默认模板不可删 → 必存在（保证根规则恒可解析）。
 * 3. **解析一致**：真实 {@link resolvePathRule} 的结果与独立参考模型 {@link expectedResolve} 一致
 *    （具体度：精确文件 ＞ 最长文件夹 ＞ 根；并列取列表靠后者）。
 */
export function runCheckResolution(w: World): void {
	const live = new Set(w.templates.map((t) => t.name));
	if (!live.has(ANCHOR_TEMPLATE)) {
		throw new SequenceError(w.seed, w.trace, `S7：锚点模板「${ANCHOR_TEMPLATE}」丢失`);
	}
	for (const r of w.pathRules) {
		if (!live.has(r.template)) {
			throw new SequenceError(
				w.seed,
				w.trace,
				`S7 悬挂引用：规则 ${JSON.stringify(r)} 指向不存在的模板（生命周期同步漏改）`,
			);
		}
	}
	for (const f of w.files) {
		const real = resolvePathRule(w.pathRules, f.path);
		const exp = expectedResolve(w, f.path);
		if ((real?.pattern ?? null) !== (exp?.pattern ?? null)) {
			throw new SequenceError(
				w.seed,
				w.trace,
				`S7 解析不一致（${f.path}）：真实=${JSON.stringify(real)} 参考=${JSON.stringify(exp)}`,
			);
		}
	}
}

/** S7 的独立参考解析：在干净模式池里选最具体（并列取后者）的匹配规则。 */
function expectedResolve(w: World, path: string): PathRule | null {
	let best: PathRule | null = null;
	let bestSpec = -1;
	for (const r of w.pathRules) {
		if (!indepMatch(r.pattern, path)) continue;
		const s = indepSpec(r.pattern);
		if (s >= bestSpec) {
			best = r;
			bestSpec = s;
		}
	}
	return best;
}

/**
 * **Backlink 往返记分板**（M7，见 spec.md §3.12）：对本次触发的「编号前 → 编号后」文本，
 * 校验 `src/backlinks.ts` 的改名表 + 链接重写自洽：
 *
 * 1. **改名表幂等**：`computeHeadingRenames(after, after)` 必为空（编号后锚点已稳定，再算无改名）。
 * 2. **往返一致**：为每个「唯一旧锚点」标题造一条 `[[Target#旧标题]]` 链接，经 `rewriteBacklinksInContent`
 *    重写后，其锚点归一必须等于**该行新标题**的锚点——即「指向旧标题的链接，重写后恰好指向同一标题的新名」。
 *
 * 它在整个随机编号空间里压测 backlink 核心：任何「改名表算错 / 重写错位 / 漏改 / 误改」都会被逮。
 * 重复锚点（歧义）按设计跳过（保守不改），故只在唯一锚点上断言。
 */
export function runCheckBacklinkRoundTrip(w: World, before: string, after: string): void {
	if (computeHeadingRenames(after, after).length !== 0) {
		throw new SequenceError(w.seed, w.trace, `Backlink 改名表非幂等：after→after 应为空`);
	}
	const map = new Map(computeHeadingRenames(before, after).map((r) => [r.from, r.to]));
	const beforeH = parseHeadings(before);
	const afterByLine = new Map<number, Heading>(parseHeadings(after).map((h) => [h.lineIndex, h]));
	// 旧锚点出现次数：重复=歧义（设计上保守不改），只在唯一锚点上断言往返。
	const oldCount = new Map<string, number>();
	for (const h of beforeH) {
		const a = linkAnchor(h.text);
		if (a) oldCount.set(a, (oldCount.get(a) ?? 0) + 1);
	}
	const targetable = beforeH.filter((h) => {
		const a = linkAnchor(h.text);
		const nh = afterByLine.get(h.lineIndex);
		if (!nh) return false;
		// 新锚点为空（标题被编号吃成空，如 explore 里的「（0.0.1）」）时，computeHeadingRenames 按设计
		// **不改名**（无法链到空标题，spec §2.3 自食取舍）→ 链接保持旧值不动，故排除出往返断言。
		const na = linkAnchor(nh.text);
		// 排除空锚点 / 歧义 / 含链接语法字符（避免造出畸形 synthetic 链接）。
		return a !== "" && na !== "" && (oldCount.get(a) ?? 0) === 1 && !/[[\]#|]/.test(h.text);
	});
	if (targetable.length === 0) return;
	const synthetic = targetable.map((h) => `[[Target#${h.text}]]`).join("\n");
	const rewritten = rewriteBacklinksInContent(synthetic, "Target", false, map).content.split(
		"\n",
	);
	targetable.forEach((h, i) => {
		const newAnchor = linkAnchor((afterByLine.get(h.lineIndex) as Heading).text);
		const m = rewritten[i].match(/^\[\[Target#(.*)\]\]$/);
		const got = m ? linkAnchor(m[1]) : "";
		if (got !== newAnchor) {
			throw new SequenceError(
				w.seed,
				w.trace,
				`Backlink 往返不一致：旧锚点 ${JSON.stringify(linkAnchor(h.text))} 重写后 ${JSON.stringify(
					got,
				)} ≠ 新标题锚点 ${JSON.stringify(newAnchor)}`,
			);
		}
		if (linkAnchor(h.text) !== newAnchor) w.cov.backlinkRename = true;
	});
}

/** 收集白名单相关覆盖率（匹配方式 / 命中 / 子树带子标题），与真实豁免集合一致。 */
export function runDetectWhitelistCoverage(w: World, template: Template): void {
	for (const e of template.whitelist) {
		if (e.match === "exact") w.cov.whitelistExact = true;
		else if (e.match === "partial") w.cov.whitelistPartial = true;
		else if (e.match === "subtree") w.cov.whitelistSubtree = true;
	}
	const exempt = w.exemptBareIndices(template);
	if (exempt.size > 0) w.cov.whitelistHit = true;
	// 子树带子标题：存在 subtree 条目，且相邻两个被豁免标题中后者更深（= 子标题被一并豁免）。
	if (template.whitelist.some((e) => e.match === "subtree") && exempt.size >= 2) {
		const headings = parseHeadings(serialize(w.bare));
		for (let i = 0; i < headings.length - 1; i++) {
			if (
				exempt.has(headings[i].lineIndex) &&
				exempt.has(headings[i + 1].lineIndex) &&
				headings[i + 1].level > headings[i].level
			) {
				w.cov.whitelistSubtreeWithChildren = true;
				break;
			}
		}
	}
}

export function runDetectLevelJump(w: World): void {
	const hs = w.bare.filter((l): l is Extract<Line, { kind: "heading" }> => l.kind === "heading");
	for (let i = 1; i < hs.length; i++) {
		if (hs[i].level - hs[i - 1].level >= 2) {
			w.cov.levelJump = true;
			return;
		}
	}
}

/**
 * **幂等性记分板**（explore 模式）：对刚触发得到的文本**再触发一次**，必须不变
 * （`renumber(renumber(x)) === renumber(x)`，见 testplan §1「幂等性总断言」）。
 *
 * 它**恒成立、与配置无关**，故能容纳放开的约束（字母样式 / inherit×非空前后缀）与脏激励
 * （就地脏编辑 / 手动破坏前缀）——这些会让「裸文档参考模型」因既定取舍（E5/L1）误报，而幂等性不会。
 * 它逮的是「再触发就变样」的**非定点叠加**（旧前缀没剥净、下一次又叠一层且与上次不同）。
 *
 * > 局限：若叠加后的形态本身已是**定点**（再触发不变，如 L1 残留 `1 a) 标题`），幂等性逮不到——
 * > 那类「定点但错」的残留由默认模式的参考模型在受约束空间里把守。两记分板**互补**。
 */
export function runCheckIdempotent(w: World, template: Template): void {
	const once = w.rendered.join("\n"); // = 本次触发输出（已写回 rendered）。
	const twice = renumberContent(once, template, w.opts);
	if (twice !== once) {
		throw new SequenceError(
			w.seed,
			w.trace,
			`幂等性失败（连续触发两次不一致 → 旧前缀未剥净 / 非定点叠加）\n  1× : ${JSON.stringify(
				once,
			)}\n  2× : ${JSON.stringify(twice)}`,
		);
	}
}

/** 记分板：DUT 输出必须等于「裸文档真值直接编号」，且层级 / 原样行不被改写。 */
export function runCheck(w: World, template: Template): void {
	const dut = w.rendered.join("\n");
	const reference = renumberContent(serialize(w.bare), template, w.opts);
	if (dut !== reference) {
		throw new SequenceError(
			w.seed,
			w.trace,
			`参考模型不一致（旧前缀未被剥净 / 叠加）\n  DUT  : ${JSON.stringify(dut)}\n  期望 : ${JSON.stringify(
				reference,
			)}\n  裸文档 : ${JSON.stringify(serialize(w.bare))}`,
		);
	}
	// 结构不变量：标题级别数量与顺序不被改写（插件只增删前缀、绝不动 #）。
	const dutLevels = headingLevels(dut);
	const bareLevels = w.bare
		.filter((l): l is Extract<Line, { kind: "heading" }> => l.kind === "heading")
		.map((l) => l.level);
	// 注：被栅栏夹住的标题不计入——参考与 DUT 同口径，这里仅核对二者一致即可。
	const refLevels = headingLevels(reference);
	if (dutLevels.join(",") !== refLevels.join(",")) {
		throw new SequenceError(
			w.seed,
			w.trace,
			`标题层级被改写：DUT=${dutLevels} 参考=${refLevels} 裸=${bareLevels}`,
		);
	}
}
