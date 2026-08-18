/**
 * M13 标题索引（headingindex.ts）的 UVM 风格「约束随机序列」压测。
 *
 * 与 uvm/framework.ts（编号引擎）同一方法论：随机激励序列大面积撞 + **参考模型记分板**
 * 自动判对错。DUT 是 `HeadingIndex`（按 matchKey 排序的扁平数组 + 二分查找 + 增量维护），
 * 参考模型是「裸 `Map<path, 条目>` + 全量 filter + 排序」的朴素实现——两侧存储/查询路径
 * 完全独立（`buildEntriesForFile` 同源，但索引结构、排序、二分、增删改逻辑全部不同实现），
 * 任何排序错误 / 二分边界错 / 增量更新漏改（setFile/removeFile/renameFile 的索引不同步）
 * 都会让两侧结果不一致而被当场抓出。
 *
 * 记分板不变量（每步操作后全量对拍）：
 * - `size` / `allEntries` 数量一致；
 * - 对一组**前缀查询**（含命中/未命中/大小写归一化冲突），DUT `queryPrefix(q, 20)` 的结果
 *   序列与参考「filter(startsWith) + (matchKey, path) 排序 + slice(0,20)」逐条一致；
 * - `hasAnyPrefixMatch` 一致；
 * - **Q22 后缀触发解析**（1.0.29）：对一组「无标点连写」样本，`resolveTriggerQuery` 经索引
 *   二分选出的候选，与参考「候选序列 + 全量扫描」选出的候选一致，且 `start` 与 `text` 自洽
 *   （替换区间不会吃掉用户已打的前半截）。
 *
 * 失败时抛错携带：种子 / 步号 / 操作轨迹 / 查询 / 两侧结果——照同一种子可复现（AAH_FUZZ_*）。
 */

import {
	HeadingIndex,
	buildEntriesForFile,
	type HeadingIndexEntry,
} from "../../../src/headingindex";
import { resolveTriggerQuery, suffixCandidates } from "../../../src/headingtrigger";
import { normalizeForWhitelist } from "../../../src/whitelist";
import { Rng } from "./rng";

/** 文件路径池：含子目录路径，覆盖 path 次级排序与 rename 目标。 */
const PATHS = ["a.md", "b.md", "c.md", "sub/d.md", "e.md", "f.md", "g.md"];
/** 标题词池：中英混排；刻意含前缀冲突（交叉/交叉矩阵/交叉验证）、大小写归一化冲突
 * （Appendix/appendix）、数字/标点起头（3.1 版本说明）。 */
const TITLE_POOL = [
	"交叉矩阵",
	"交叉矩阵与其应用",
	"交叉验证",
	"交叉",
	"应用",
	"引言",
	"Appendix",
	"appendix",
	"目录",
	"附录",
	"3.1 版本说明",
	"第 3 章 概述",
	"使用说明",
	"总结",
	"Reference",
	"参考文献",
];
/** 对拍查询集：命中前缀 / 未命中 / 大小写变体 / 空串。 */
const QUERIES = [
	"交",
	"交叉",
	"交叉矩",
	"a",
	"app",
	"附录",
	"参",
	"第",
	"3",
	"使用",
	"使",
	"zzz",
	"",
];

/**
 * 「用户连着打出来的一段无标点文字」样本（Q22，1.0.29）：中文正文没有词边界，触发词提取会把
 * 前面已有的字一起吞进来，故这些样本的**整段**基本都不命中，靠后缀才可能命中。刻意混入
 * 全落空样本（「一笔事务」——「事务」不在词池里）与整段直接命中样本（「交叉矩阵」）。
 */
const TYPED_SAMPLES = [
	"一个交叉矩阵",
	"前置附录",
	"某某使用说明",
	"这是总结",
	"xxappendix",
	"交叉矩阵",
	"一笔事务",
	"zzz",
];

/** 参考模型排序（与 DUT 的 sorted 同 key：matchKey 主键 + path 次级键）。 */
function compareRef(a: HeadingIndexEntry, b: HeadingIndexEntry): number {
	if (a.matchKey !== b.matchKey) {
		return a.matchKey < b.matchKey ? -1 : 1;
	}
	return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/** 参考模型的朴素前缀查询。 */
function refQuery(
	ref: Map<string, HeadingIndexEntry[]>,
	query: string,
	limit: number,
): HeadingIndexEntry[] {
	if (!query) {
		return [];
	}
	return [...ref.values()]
		.flat()
		.filter((e) => e.matchKey.startsWith(query))
		.sort(compareRef)
		.slice(0, limit);
}

const basenameOf = (p: string) => p.split("/").pop()?.replace(/\.md$/i, "") ?? p;

/** 参考模型：全量扫一遍，判断有没有 matchKey 以 query 开头的条目。 */
function refHasPrefix(ref: Map<string, HeadingIndexEntry[]>, query: string): boolean {
	if (!query) {
		return false;
	}
	return [...ref.values()].flat().some((e) => e.matchKey.startsWith(query));
}

/** 用随机标题生成文件内容。 */
function makeContent(rng: Rng): string {
	const n = rng.int(9); // 0–8 个标题
	const lines: string[] = [];
	for (let i = 0; i < n; i++) {
		lines.push(`## ${rng.pick(TITLE_POOL)}`);
	}
	return lines.join("\n");
}

/**
 * 跑一条「随机增删改 + 查询对拍」序列。
 *
 * @param seed 种子（失败时凭它复现）。
 * @param ops  操作步数。
 */
export function runHeadingIndexSequence(seed: number, ops: number): void {
	const rng = new Rng(seed);
	const dut = new HeadingIndex();
	// 两份参考状态：contents（真值，供 loadInitial 重放）与 ref（派生条目）。
	const contents = new Map<string, string>();
	const ref = new Map<string, HeadingIndexEntry[]>();
	const trace: string[] = [];

	const check = (label: string): void => {
		const flat = [...ref.values()].flat();
		if (dut.size !== flat.length) {
			throw new Error(
				`[M13 压测] seed=${seed} ${label}：size 不一致，DUT=${dut.size} 参考=${flat.length}\n轨迹：${trace.join(" -> ")}`,
			);
		}
		if (dut.allEntries().length !== flat.length) {
			throw new Error(
				`[M13 压测] seed=${seed} ${label}：allEntries 数量不一致\n轨迹：${trace.join(" -> ")}`,
			);
		}
		for (const q of QUERIES) {
			const expected = refQuery(ref, q, 20);
			const actual = dut.queryPrefix(q, 20);
			const key = (e: HeadingIndexEntry) => `${e.path}|${e.displayText}|${e.anchor}`;
			if (actual.map(key).join("\n") !== expected.map(key).join("\n")) {
				throw new Error(
					`[M13 压测] seed=${seed} ${label}：queryPrefix(${JSON.stringify(q)}) 不一致\n` +
						`DUT: ${JSON.stringify(actual.map(key))}\n参考: ${JSON.stringify(expected.map(key))}\n` +
						`轨迹：${trace.join(" -> ")}`,
				);
			}
			if (dut.hasAnyPrefixMatch(q) !== expected.length > 0) {
				throw new Error(
					`[M13 压测] seed=${seed} ${label}：hasAnyPrefixMatch(${JSON.stringify(q)}) 不一致\n轨迹：${trace.join(" -> ")}`,
				);
			}
		}
		// —— Q22 后缀触发解析对拍（1.0.29）——
		// DUT 走「候选序列 + 索引二分」，参考走「候选序列 + 全量扫描」，两侧必须选出同一个候选。
		// 额外断言 start 自洽（`sample.slice(start) === text`）——这是「接受建议只替换被匹配上
		// 的那一段、不吃掉前面已有的字」的地基，错了就是用户文本被吞。
		for (const sample of TYPED_SAMPLES) {
			const hit = resolveTriggerQuery(sample, 0, (q) => dut.hasAnyPrefixMatch(q));
			const expected =
				suffixCandidates(sample, 0).find((c) =>
					refHasPrefix(ref, normalizeForWhitelist(c.text)),
				) ?? null;
			const shape = (v: { text: string; start: number } | null) =>
				v ? `${v.text}@${v.start}` : "null";
			if (shape(hit) !== shape(expected)) {
				throw new Error(
					`[M13 压测] seed=${seed} ${label}：resolveTriggerQuery(${JSON.stringify(sample)}) 不一致\n` +
						`DUT: ${shape(hit)}\n参考: ${shape(expected)}\n轨迹：${trace.join(" -> ")}`,
				);
			}
			if (hit && sample.slice(hit.start) !== hit.text) {
				throw new Error(
					`[M13 压测] seed=${seed} ${label}：resolveTriggerQuery(${JSON.stringify(sample)}) 的 ` +
						`start 与 text 不自洽（替换区间会吃掉用户文本）：start=${hit.start} ` +
						`text=${JSON.stringify(hit.text)}\n轨迹：${trace.join(" -> ")}`,
				);
			}
		}
	};

	const applySetFile = (path: string): void => {
		const content = makeContent(rng);
		contents.set(path, content);
		ref.set(path, buildEntriesForFile(path, basenameOf(path), content));
		dut.setFile(path, basenameOf(path), content);
		trace.push(`setFile(${path}, ${content.split("\n").length} 行)`);
	};

	const applyRemoveFile = (): void => {
		const path = rng.pick(PATHS);
		contents.delete(path);
		ref.delete(path);
		dut.removeFile(path);
		trace.push(`removeFile(${path})`);
	};

	const applyRenameFile = (): void => {
		const oldPath = rng.pick(PATHS);
		if (!ref.has(oldPath)) {
			// 对不存在的文件改名：DUT 应幂等无操作。
			dut.renameFile(oldPath, "x.md", "x");
			trace.push(`renameFile(${oldPath}->x.md, 不存在)`);
			return;
		}
		// 30% 概率显式制造「改名覆盖已有路径」场景（1.0.28 修复的分支：目标文件旧条目须一并
		// 移除、totalCount 同步），其余随机路径。
		const newPath =
			rng.chance(0.3) && ref.size > 1
				? ([...ref.keys()].find((p) => p !== oldPath) ?? "n1/x.md")
				: `${rng.pick(["n1", "n2", "sub"])}/${oldPath.replace(/^.*\//, "")}`;
		const content = contents.get(oldPath) ?? "";
		contents.delete(oldPath);
		contents.set(newPath, content);
		const entries = ref.get(oldPath) ?? [];
		ref.delete(oldPath);
		ref.set(
			newPath,
			entries.map((e) => ({ ...e, path: newPath, basename: basenameOf(newPath) })),
		);
		dut.renameFile(oldPath, newPath, basenameOf(newPath));
		trace.push(`renameFile(${oldPath}->${newPath})`);
	};

	const applyLoadInitial = (): void => {
		const files = [...contents.entries()].map(([path, content]) => ({
			path,
			basename: basenameOf(path),
			content,
		}));
		dut.loadInitial(files);
		ref.clear();
		for (const f of files) {
			ref.set(f.path, buildEntriesForFile(f.path, f.basename, f.content));
		}
		trace.push(`loadInitial(${files.length} 文件)`);
	};

	// 预置：先随机灌 1–4 个文件，让序列从非空状态起步。
	const seedFiles = 1 + rng.int(4);
	for (let i = 0; i < seedFiles; i++) {
		applySetFile(rng.pick(PATHS));
	}
	check("初始");

	for (let step = 0; step < ops; step++) {
		const roll = rng.next();
		if (roll < 0.5) {
			applySetFile(rng.pick(PATHS)); // 新建/更新为主
		} else if (roll < 0.7) {
			applyRemoveFile();
		} else if (roll < 0.9) {
			applyRenameFile();
		} else {
			applyLoadInitial(); // 偶尔全量重建，覆盖 loadInitial 路径
		}
		check(`步 ${step}`);
	}
}
