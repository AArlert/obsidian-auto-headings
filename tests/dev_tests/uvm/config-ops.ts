/**
 * World 的「配置类激励」实现（从 `framework.ts` 拆出）：格式字段 + 模板生命周期 + 路径规则 +
 * 多文件切换 + 两层门控相关配置的随机变更分发，单独成文件因原 `config()` 体量本身就有 ~300 行。
 */

import type { AncestorNumeral, SkipFill } from "../../../src/numbering";
import type { FrontmatterState } from "./model";
import {
	ANCHOR_TEMPLATE,
	MATCH_MODES,
	NUMBER_SEPS,
	RULE_PATTERNS,
	TITLE_SEPS,
	WHITELIST_WORDS,
} from "./stimulus";
import type { OpKind } from "./config";
import type { World } from "./framework";

// ── 配置类激励（在约束内）─────────────────────────────────────────────────
export function applyConfig(w: World): void {
	// 格式类激励作用于**随机挑的一个模板** tpl（缺口③：多模板，改 A 模板未必影响用 B 模板的文件）。
	const tpl = w.pickTemplate();
	// inherit 翻转仍按**当前**前后缀是否都为空门控（约束未放开；非空前后缀下 inherit 翻转另案）。
	const affixEmptyNow = tpl.levels.h2.prefix === "" && tpl.levels.h2.suffix === "";
	const choices: OpKind[] = [
		"setNumeral",
		"setNumberSep",
		"setTitleSep",
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
		// 阶段 2（缺口③）：模板生命周期 + 路径规则 + 多文件切换。
		"createTemplate",
		"deleteTemplate",
		"renameTemplate",
		"addRule",
		"deleteRule",
		"editRulePattern",
		"setRuleTemplate",
		"reorderRule",
		"switchFile",
	];
	if (affixEmptyNow || w.cfg.allowInheritWithAffix) choices.push("setInherit");
	const kind = w.rng.pick(choices);
	const lvls = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
	switch (kind) {
		case "setNumeral": {
			const n = w.rng.pick(w.cfg.numerals);
			const lvl = w.rng.pick(lvls);
			tpl.levels[lvl].numeral = n;
			w.cov.numerals.add(n);
			w.trace.push(`setNumeral ${tpl.name}.${lvl}=${n}`);
			break;
		}
		case "setNumberSep": {
			const s = w.rng.pick(NUMBER_SEPS);
			for (const lvl of lvls) tpl.levels[lvl].numberSeparator = s;
			w.trace.push(`setNumberSep ${tpl.name} ${JSON.stringify(s)}`);
			break;
		}
		case "setTitleSep": {
			const s = w.rng.pick(TITLE_SEPS);
			for (const lvl of lvls) tpl.levels[lvl].titleSeparator = s;
			w.trace.push(`setTitleSep ${tpl.name} ${JSON.stringify(s)}`);
			break;
		}
		case "setInherit": {
			const v = w.rng.chance(0.5);
			const lvl = w.rng.pick(lvls);
			if (tpl.levels[lvl].prefix !== "" || tpl.levels[lvl].suffix !== "") {
				w.cov.inheritWithAffix = true;
			}
			tpl.levels[lvl].inherit = v;
			if (!v) w.cov.inheritFalse = true;
			w.trace.push(`setInherit ${tpl.name}.${lvl}=${v}`);
			break;
		}
		case "setPrefix": {
			// 在「空 ↔ 候选」间切换（所有级别同步），验证 B2/B3「改前缀后再触发不叠加」。
			const v = w.rng.chance(0.5) ? "" : w.prefixCandidate;
			for (const lvl of lvls) tpl.levels[lvl].prefix = v;
			w.cov.affixToggled = true;
			w.trace.push(`setPrefix ${tpl.name} ${JSON.stringify(v)}`);
			break;
		}
		case "setSuffix": {
			const v = w.rng.chance(0.5) ? "" : w.suffixCandidate;
			for (const lvl of lvls) tpl.levels[lvl].suffix = v;
			w.cov.affixToggled = true;
			w.trace.push(`setSuffix ${tpl.name} ${JSON.stringify(v)}`);
			break;
		}
		case "setTopLevel": {
			const cur = tpl.topLevel;
			const next = w.rng.intRange(1, 4);
			if (next < cur) w.cov.topLevelLowered = true;
			if (next > cur) w.cov.topLevelRaised = true;
			tpl.topLevel = next;
			// 保持 bottomLevel ≥ topLevel（与 GUI 一致），避免退化空区间淹没覆盖。
			if (tpl.bottomLevel < next) tpl.bottomLevel = next;
			w.trace.push(`setTopLevel ${tpl.name} ${cur}->${next}`);
			break;
		}
		case "setBottomLevel": {
			// 结束编号层级（0.6.5）：在 [topLevel, 6] 内随机，覆盖「只编号区间」与收窄后剥残留。
			const cur = tpl.bottomLevel;
			const next = w.rng.intRange(tpl.topLevel, 6);
			tpl.bottomLevel = next;
			if (next < 6) w.cov.bottomLevelNarrowed = true;
			w.trace.push(`setBottomLevel ${tpl.name} ${cur}->${next}`);
			break;
		}
		case "setStartIndex": {
			// 起始编号数字（M8 批次 1）：仅首段渲染期偏移。偏 0/1（各 1/3）再带两个更大值，
			// 覆盖「0 起编号」「改值后再触发旧前缀剥净」（剥离靠 WJ 边界，与数值无关）。
			const cur = tpl.startIndex;
			const next = w.rng.pick([0, 0, 1, 1, 2, 5]);
			tpl.startIndex = next;
			if (next === 0) w.cov.startIndexZero = true;
			if (next !== 1) w.cov.startIndexNonDefault = true;
			w.trace.push(`setStartIndex ${tpl.name} ${cur}->${next}`);
			break;
		}
		case "setSkipFill": {
			// 三策略等概率：补位 / 不补位 / 不编号（0.7.15 新增 none，跳级标题保持原样）。
			const roll = w.rng.int(3);
			const sf: SkipFill =
				roll === 0
					? { mode: "fill", placeholder: w.rng.pick(["0", "1"]) }
					: roll === 1
						? { mode: "drop" }
						: { mode: "none" };
			tpl.skipFill = sf;
			if (sf.mode === "drop") w.cov.skipDrop = true;
			else if (sf.mode === "none") w.cov.skipNone = true;
			else w.cov.skipFill = true;
			w.trace.push(`setSkipFill ${tpl.name} ${sf.mode}`);
			break;
		}
		case "setAncestor": {
			const a: AncestorNumeral = w.rng.chance(0.5) ? "arabic" : "self";
			tpl.ancestorNumeral = a;
			if (a === "arabic") w.cov.ancestorArabic = true;
			else w.cov.ancestorSelf = true;
			w.trace.push(`setAncestor ${tpl.name} ${a}`);
			break;
		}
		case "setWhitelist": {
			// 真实白名单驱动（0.6.5）：随机增 / 删 / 改一条条目（含 subtree），驱动引擎的
			// computeWhitelistExemptions，覆盖「改白名单后再触发」的状态转移与子树豁免。
			const wl = tpl.whitelist;
			const action = wl.length === 0 ? 0 : w.rng.int(3);
			if (action === 0) {
				const text = w.rng.pick(WHITELIST_WORDS);
				const match = w.rng.pick(MATCH_MODES);
				if (!wl.some((e) => e.text === text && e.match === match)) {
					wl.push({ text, match });
				}
			} else if (action === 1) {
				wl.splice(w.rng.int(wl.length), 1);
			} else {
				wl[w.rng.int(wl.length)].match = w.rng.pick(MATCH_MODES);
			}
			w.trace.push(`setWhitelist ${tpl.name} ${JSON.stringify(wl)}`);
			break;
		}
		case "createTemplate": {
			// 缺口③：新建模板（最多 3 个；共享前后缀候选池）。
			if (w.templates.length < 3) {
				const used = new Set(w.templates.map((t) => t.name));
				const name = ["模板B", "模板C", "模板D"].find((n) => !used.has(n));
				if (name) {
					w.templates.push(w.makeTemplate(name));
					w.cov.templateCreated = true;
					w.trace.push(`createTemplate ${name}`);
				}
			}
			w.checkResolution();
			break;
		}
		case "deleteTemplate": {
			// 缺口③：删模板（锚点「默认」不可删，对应真实插件）。删时把引用它的规则**降级/改投/连删**。
			const victims = w.templates.filter((t) => t.name !== ANCHOR_TEMPLATE);
			if (victims.length) {
				const victim = w.rng.pick(victims);
				const others = w.templates.filter((t) => t.name !== victim.name);
				// 去向：改投另一模板（含降级到默认）或「连规则一并删」。
				const deleteRules = w.rng.chance(0.3);
				const redirect = w.rng.pick(others).name;
				if (deleteRules) {
					w.pathRules = w.pathRules.filter((r) => r.template !== victim.name);
				} else {
					for (const r of w.pathRules) {
						if (r.template === victim.name) r.template = redirect;
					}
				}
				w.templates = others;
				w.cov.templateDeleted = true;
				w.trace.push(
					`deleteTemplate ${victim.name} -> ${deleteRules ? "连规则删" : redirect}`,
				);
			}
			w.checkResolution();
			break;
		}
		case "renameTemplate": {
			// 缺口③：改名（锚点不可改名）+ 同步所有引用该模板名的路径规则（= 插件 renameTemplate）。
			const victims = w.templates.filter((t) => t.name !== ANCHOR_TEMPLATE);
			if (victims.length) {
				const victim = w.rng.pick(victims);
				const used = new Set(w.templates.map((t) => t.name));
				const next = ["模板B", "模板C", "模板D", "模板E"].find((n) => !used.has(n));
				if (next) {
					const old = victim.name;
					victim.name = next;
					for (const r of w.pathRules) {
						if (r.template === old) r.template = next; // 同步规则。
					}
					w.cov.templateRenamed = true;
					w.trace.push(`renameTemplate ${old} -> ${next}`);
				}
			}
			w.checkResolution();
			break;
		}
		case "addRule": {
			w.pathRules.push({
				pattern: w.rng.pick(RULE_PATTERNS),
				template: w.rng.pick(w.templates).name,
			});
			w.cov.ruleAdded = true;
			w.trace.push(`addRule ${JSON.stringify(w.pathRules.at(-1))}`);
			w.checkResolution();
			break;
		}
		case "deleteRule": {
			// 允许删任意规则（含根规则 → 部分文件可能无模板，覆盖 null 解析 / I7·K6）。
			if (w.pathRules.length > 1) {
				const i = w.rng.int(w.pathRules.length);
				w.trace.push(`deleteRule #${i} ${JSON.stringify(w.pathRules[i])}`);
				w.pathRules.splice(i, 1);
				w.cov.ruleDeleted = true;
			}
			w.checkResolution();
			break;
		}
		case "editRulePattern": {
			if (w.pathRules.length) {
				const i = w.rng.int(w.pathRules.length);
				w.pathRules[i].pattern = w.rng.pick(RULE_PATTERNS);
				w.cov.ruleEdited = true;
				w.trace.push(`editRulePattern #${i} -> ${w.pathRules[i].pattern}`);
			}
			w.checkResolution();
			break;
		}
		case "setRuleTemplate": {
			if (w.pathRules.length) {
				const i = w.rng.int(w.pathRules.length);
				w.pathRules[i].template = w.rng.pick(w.templates).name;
				w.cov.ruleRetargeted = true;
				w.trace.push(`setRuleTemplate #${i} -> ${w.pathRules[i].template}`);
			}
			w.checkResolution();
			break;
		}
		case "reorderRule": {
			if (w.pathRules.length > 1) {
				const from = w.rng.int(w.pathRules.length);
				const to = w.rng.int(w.pathRules.length);
				const [moved] = w.pathRules.splice(from, 1);
				w.pathRules.splice(to, 0, moved);
				w.cov.ruleReordered = true;
				w.trace.push(`reorderRule ${from}->${to}`);
			}
			w.checkResolution();
			break;
		}
		case "switchFile": {
			// 缺口③：切换当前编辑 / 触发的文件（各文件独立状态、各按路径解析模板）。
			if (w.files.length > 1) {
				let next = w.cur;
				while (next === w.cur) next = w.rng.int(w.files.length);
				w.cur = next;
				w.cov.fileSwitched = true;
				w.trace.push(`switchFile -> ${w.file.path}`);
			}
			break;
		}
		case "setFrontmatterSwitch": {
			// 缺口②：改单文件开关（true/false/非法/删除），驱动真实 readFileSwitch + 门控。
			const next = w.rng.pick<FrontmatterState>(["none", "true", "false", "illegal"]);
			w.frontmatterState = next;
			if (next === "false") w.cov.fmFalse = true;
			else if (next === "true") w.cov.fmTrue = true;
			else if (next === "illegal") w.cov.fmIllegal = true;
			w.trace.push(`setFrontmatterSwitch ${next}`);
			break;
		}
		case "setAutoNumber": {
			// 缺口②：切换全局自动编号面板开关。
			w.autoNumber = w.rng.chance(0.5);
			w.trace.push(`setAutoNumber ${w.autoNumber}`);
			break;
		}
		default:
			break;
	}
	w.cov.bumpOp(kind);
}
