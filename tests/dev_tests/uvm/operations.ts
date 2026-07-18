/**
 * World 的「编辑类激励」实现（从 `framework.ts` 拆出）：`applyEdit` 对应缺口①之外的常规文本编辑
 * 激励分发，`applyClearNumbering` / `applyClearForeign` 对应清除命令 + S4/S5 记分板。
 */

import { clearForeignNumberingContent, clearNumberingContent } from "../../../src/cleanup";
import { serialize, serializeLine, type Line } from "./model";
import { LEVEL_POOL, MESSY_FRAGMENTS, SAFE_FRAGMENTS, SELF_EATING } from "./stimulus";
import type { OpKind } from "./config";
import { SequenceError } from "./coverage";
import type { World } from "./framework";

// ── 编辑类激励 ───────────────────────────────────────────────────────────
export function applyEdit(w: World): void {
	const choices: OpKind[] = [
		"insertHeading",
		"insertRaw",
		"insertFence",
		"deleteLine",
		"retitle",
		"changeLevel",
		"demoteHeading",
	];
	// 清除命令 S4/S5 是「干净空间」不变量（rendered 全是插件自写的 WJ 前缀时才成立），故仅在
	// 参考模式纳入。explore 模式的 mutatePrefix 会**故意抹掉 WJ**，此后「清外来」把失去 WJ 的前缀
	// 当外来编号剥掉是预期行为（非 bug）——S5 的「无操作」前提随之不成立，故 explore 不施加清除命令。
	if (w.cfg.oracle === "reference") {
		choices.push("clearNumbering", "clearForeign");
	}
	if (w.cfg.inPlaceEdit) choices.push("editTitleInPlace");
	if (w.cfg.manualPrefixEdit) choices.push("mutatePrefix");
	const kind = w.rng.pick(choices);
	const len = w.bare.length;
	switch (kind) {
		case "insertHeading": {
			const level = w.rng.pick(LEVEL_POOL);
			const title = w.rng.pick(w.titlePool);
			w.insertAt(w.rng.int(len + 1), { kind: "heading", level, title });
			if (level >= 5) w.cov.levelGE5 = true;
			if (title === "") w.cov.emptyTitle = true;
			if (SELF_EATING.has(title)) w.cov.selfEatingTitle = true;
			w.trace.push(`insertHeading H${level} ${JSON.stringify(title)}`);
			break;
		}
		case "insertRaw": {
			const text = w.rng.pick(["正文一行", "- 列表项", "> 引用", "普通段落 # 不是标题"]);
			w.insertAt(w.rng.int(len + 1), { kind: "raw", text });
			w.trace.push(`insertRaw ${JSON.stringify(text)}`);
			break;
		}
		case "insertFence": {
			const i = w.rng.int(len + 1);
			const fence = w.rng.pick(["```", "~~~"]);
			// 代码块三行：栅栏 + 一行伪标题 + 同种栅栏闭合（块内 # 不应被编号）。
			for (const t of [fence, "# 代码块内的伪标题", fence].reverse()) {
				w.insertAt(i, { kind: "raw", text: t });
			}
			w.cov.fencePresent = true;
			w.trace.push(`insertFence ${fence}`);
			break;
		}
		case "deleteLine": {
			// 不删**栅栏定界行**：删掉它会让代码块失衡，把"已编号的标题"事后埋进未闭合代码块里——
			// 那段冻结的前缀插件再也够不着（视作代码、不剥），但参考模型仍按裸文档重算，二者必然不一致。
			// 这是真实但属边角的行为，非编号 bug；为聚焦状态转移压测，这里始终保持栅栏配平。
			const deletable: number[] = [];
			w.bare.forEach((l, idx) => {
				if (!(l.kind === "raw" && /^ {0,3}(`{3,}|~{3,})/.test(l.text))) deletable.push(idx);
			});
			if (w.bare.length > 1 && deletable.length) {
				const i = w.rng.pick(deletable);
				w.bare.splice(i, 1);
				w.rendered.splice(i, 1);
				w.trace.push(`deleteLine #${i}`);
			}
			break;
		}
		case "retitle": {
			const hs = w.headingIndices();
			if (hs.length) {
				const i = w.rng.pick(hs);
				const title = w.rng.pick(w.titlePool);
				const level = (w.bare[i] as { level: number }).level;
				// 用户清空并重打：两份状态同步成裸标题行。
				w.bare[i] = { kind: "heading", level, title };
				w.rendered[i] = serializeLine(w.bare[i]);
				if (title === "") w.cov.emptyTitle = true;
				if (SELF_EATING.has(title)) w.cov.selfEatingTitle = true;
				w.trace.push(`retitle #${i} -> ${JSON.stringify(title)}`);
			}
			break;
		}
		case "editTitleInPlace": {
			// 「就地编辑」：用户在**已经带编号前缀**的标题行里继续打字 / 改文本，**旧前缀仍留在行上**。
			// 这是真实使用的主线（不像 retitle 把整行清空重打），也是 strip 最易出错处——剥离面对的是
			// 「（可能用旧配置写的）旧前缀 + 新标题文本」。默认模式只追加**安全碎片**（保参考模型干净）；
			// explore 模式允许追加 / 前插**脏碎片**（分隔符 / 数字 / 字母 / 空白起头），撞容差剥离误伤边界。
			const hs = w.headingIndices();
			if (hs.length) {
				const i = w.rng.pick(hs);
				const h = w.bare[i] as Extract<Line, { kind: "heading" }>;
				const oldTitle = h.title;
				// 从当前渲染行提取「旧前缀」= marker 之后、裸标题之前的那段（可能含上次触发写入的编号）。
				const marker = "#".repeat(h.level) + " ";
				const body = w.rendered[i].startsWith(marker)
					? w.rendered[i].slice(marker.length)
					: w.rendered[i];
				const oldPrefix = body.endsWith(oldTitle)
					? body.slice(0, body.length - oldTitle.length)
					: "";
				let newTitle: string | null = null;
				if (w.cfg.messyTitles && w.rng.chance(0.5)) {
					const frag = w.rng.pick(MESSY_FRAGMENTS);
					newTitle = w.rng.chance(0.5) ? frag + oldTitle : oldTitle + frag;
				} else if (
					// 默认模式：避开自食 / 当前被白名单豁免 / 空标题，保证「裸↔渲染」strip 干净、参考模型恒一致。
					// 白名单判定改用引擎真实豁免集合（含 subtree），与 0.6.5 的真实 whitelist 驱动一致。
					w.cfg.messyTitles ||
					(!SELF_EATING.has(oldTitle) &&
						!w.exemptBareIndices(w.resolvedTemplate()).has(i) &&
						oldTitle !== "")
				) {
					newTitle = oldTitle + w.rng.pick(SAFE_FRAGMENTS);
				}
				if (newTitle !== null) {
					w.bare[i] = { kind: "heading", level: h.level, title: newTitle };
					w.rendered[i] = marker + oldPrefix + newTitle;
					w.cov.inPlaceEdited = true;
					if (SELF_EATING.has(newTitle)) w.cov.selfEatingTitle = true;
					w.trace.push(
						`editTitleInPlace #${i} keepPrefix=${JSON.stringify(oldPrefix)} -> ${JSON.stringify(newTitle)}`,
					);
				}
			}
			break;
		}
		case "mutatePrefix": {
			// 手动破坏前缀区（explore 专用）：用户手抖删/改了编号里的字符（删一位、去空格、改数字），
			// 但**裸标题意图不变**。故**不更新 bare**——只能用幂等性记分板校验（参考模型在此无效）。
			const hs = w.headingIndices();
			if (hs.length) {
				const i = w.rng.pick(hs);
				const h = w.bare[i] as Extract<Line, { kind: "heading" }>;
				const marker = "#".repeat(h.level) + " ";
				if (w.rendered[i].startsWith(marker)) {
					const body = w.rendered[i].slice(marker.length);
					// 仅当 body 比裸标题长（带前缀）时才破坏。
					if (body.length > h.title.length) {
						const prefixLen = body.length - h.title.length;
						let pre = body.slice(0, prefixLen);
						const which = w.rng.int(3);
						if (which === 0 && pre.length) {
							const k = w.rng.int(pre.length);
							pre = pre.slice(0, k) + pre.slice(k + 1); // 删一个字符
						} else if (which === 1) {
							pre = pre.replace(" ", ""); // 去一个空格
						} else {
							pre = pre.replace(/\d/, (d) => String((Number(d) + 1) % 10)); // 改一个数字
						}
						w.rendered[i] = marker + pre + h.title;
						w.cov.prefixMutated = true;
						w.trace.push(`mutatePrefix #${i} -> ${JSON.stringify(w.rendered[i])}`);
					}
				}
			}
			break;
		}
		case "changeLevel": {
			const hs = w.headingIndices();
			if (hs.length) {
				const i = w.rng.pick(hs);
				const level = w.rng.pick(LEVEL_POOL);
				const title = (w.bare[i] as { title: string }).title;
				w.bare[i] = { kind: "heading", level, title };
				w.rendered[i] = serializeLine(w.bare[i]);
				if (level >= 5) w.cov.levelGE5 = true;
				w.trace.push(`changeLevel #${i} -> H${level}`);
			}
			break;
		}
		case "demoteHeading": {
			// 把某标题「删光 `#`」降级为正文（0.7.20，验证 ③ 残留清理）：bare 侧变成裸标题文本的
			// raw 段；rendered 侧保留**去掉 `#{level} ` 标记后的原文**——若原是带编号标题，残留即
			// 含 WJ 哨兵 + 编号（正是真实用户降级后的脏态）。下次触发时 ③ 应把残留清净，参考模型
			// （bare 的干净 raw 段）恒等于 renumberContent(裸) → 由现有 check 自动校验。
			const hs = w.headingIndices();
			if (hs.length) {
				const i = w.rng.pick(hs);
				const h = w.bare[i] as Extract<Line, { kind: "heading" }>;
				const marker = "#".repeat(h.level) + " ";
				const residue = w.rendered[i].startsWith(marker)
					? w.rendered[i].slice(marker.length)
					: w.rendered[i];
				w.bare[i] = { kind: "raw", text: h.title };
				w.rendered[i] = residue;
				w.cov.demoted = true;
				w.trace.push(`demoteHeading #${i} -> ${JSON.stringify(residue)}`);
			}
			break;
		}
		case "clearNumbering": {
			w.clearNumbering();
			break;
		}
		case "clearForeign": {
			w.clearForeign();
			break;
		}
	}
	w.cov.bumpOp(kind);
}

/**
 * 「清除当前文件编号」命令（缺口①，DUT = {@link clearNumberingContent}）+ **S4 清除还原律**。
 *
 * 只在「裸文档本身是 clear 的定点」（`clearNumbering(bare)===bare`，即不含会被全样式并集剥离器
 * 误吃的自食/外来样标题）时施加并断言：清除当前 `rendered`（可能含历史前缀）必还原成裸文档。
 * 守卫排除自食前缀（spec §2.3 取舍）与白名单豁免——它们让「裸」本身就不是 clear 定点，断言不成立。
 * 施加后 `rendered` 与裸文档锁步（参考模型在后续触发仍恒成立）。
 */
export function applyClearNumbering(w: World): void {
	const bareText = serialize(w.bare);
	if (clearNumberingContent(bareText, w.cleanupOpts) !== bareText) {
		return; // 裸文档非 clear 定点（自食/外来样标题）→ 排除出 S4 断言。
	}
	const got = clearNumberingContent(w.rendered.join("\n"), w.cleanupOpts);
	if (got !== bareText) {
		throw new SequenceError(
			w.seed,
			w.trace,
			`S4 清除还原律失败：清除编号后未还原裸文档\n  清除得 : ${JSON.stringify(got)}\n  裸文档 : ${JSON.stringify(bareText)}`,
		);
	}
	w.rendered = got.split("\n");
	w.cov.clearRestore = true;
	w.trace.push("— clearNumbering (S4) —");
}

/**
 * 「清理非本插件编号」命令（缺口①，DUT = {@link clearForeignNumberingContent}）+ **S5 清外来不动律**。
 *
 * 只在「裸文档是 foreign-clear 的定点」（`clearForeign(bare)===bare`）时断言：清外来对当前 `rendered`
 * 是**无操作**——自家 WJ 编号被跳过、裸态标题既是 foreign 定点也不被动。守卫排除「裸标题恰像外来编号」
 * （如 `2024 总结`）的情形。无操作故不改 `rendered`，锁步不变。
 */
export function applyClearForeign(w: World): void {
	const bareText = serialize(w.bare);
	if (clearForeignNumberingContent(bareText) !== bareText) {
		return; // 裸标题像外来编号 → 排除出 S5 断言。
	}
	const cur = w.rendered.join("\n");
	const got = clearForeignNumberingContent(cur);
	if (got !== cur) {
		throw new SequenceError(
			w.seed,
			w.trace,
			`S5 清外来不动律失败：清理外来编号动了自家 WJ 编号\n  清理前 : ${JSON.stringify(cur)}\n  清理后 : ${JSON.stringify(got)}`,
		);
	}
	w.cov.clearForeignNoop = true;
	w.trace.push("— clearForeign (S5) —");
}
