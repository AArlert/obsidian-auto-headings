/**
 * Various Complements（VC）联动（M13，见 spec.md Roadmap M13 与 doc/research 方案 §5）。
 *
 * 目标：把本插件的标题索引以「VC JSON 词典」的形式喂给 VC 的自定义词典补全，让 VC 用户
 * 不用离开自己习惯的建议框就能补全标题链接。**安全优先**（分层防御）：
 * - Layer 0：探测安装状态（app.plugins.manifests，不在官方 .d.ts 里，结构化收窄）。
 * - Layer 1（首选）：VC 活体实例读写（.settings + 继承自 Plugin 的 saveData）。
 * - Layer 2（兜底）：直接读改写 VC 的 data.json——JSON.parse 全量解析、只改已知字段、
 *   JSON.stringify 全量写回，**绝不重建对象**（否则会清空 VC 其余配置）。
 * - Layer 3：两层都失败或 schema 校验不通过 → 整体放弃，不做部分写入。
 *
 * 本模块无状态、不碰 this.settings（Obsidian 事件接线与落盘在 main.ts）。
 *
 * 涉及 VC 内部结构的断言已对照 VC 源码逐条核实（clone 留档于 doc/research/
 * vc-source-verification.md，基准：VC main 分支 2026-08-11）；Obsidian 内部 API
 * （app.plugins / .suggestions）仍按「结构化收窄 + 运行时判空 + 真机核对」处理。
 * 校验失败就该老实回退到手动模式，不能为「让代码能跑」绕过校验。
 */

import { normalizePath, type App } from "obsidian";
import type { HeadingIndexEntry } from "./headingindex";

const VC_PLUGIN_ID = "various-complements";
/** VC 数据文件相对 vault 根的路径（configDir 即 .obsidian）。 */
const VC_DATA_REL_PATH = "plugins/various-complements/data.json";
/** VC「重新加载自定义词典」命令的运行时 id（`插件id:命令id` 惯例，已对照 VC 源码核实）。 */
const VC_RELOAD_COMMAND_ID = "various-complements:reload-custom-dictionaries";
/** VC 词典文件重写节流（方案 §5.8，可调常量）：重写整个 JSON 文件比更新内存索引昂贵得多。 */
export const VC_DICTIONARY_THROTTLE_MS = 3000;
/**
 * VC 词典条数上限（可调常量）：VC 端会全量加载词典建索引（wordByValue + 首字母桶），
 * 独立于本插件内存索引上限（50,000）设更小值——20,000 条紧凑 JSON ≈ 2.2MB，控制 VC 侧
 * 成本与 iCloud 同步体积；超出截断并弹一次性 Notice（见 main.ts writeVcDictionary）。
 */
export const MAX_VC_DICTIONARY_ENTRIES = 20000;

export type VcInstallStatus = "not-installed" | "disabled" | "enabled";

/**
 * 本插件的标题建议框是否应当放弃触发、把弹框位置让给 VC（1.0.29，纯判定，便于单测）。
 *
 * Obsidian 的 `EditorSuggest` 同一时刻**只显示一个**弹框（先返回非 null 触发信息的那个赢），
 * 而 VC 与本插件都以普通 `EditorSuggest` 注册——本插件一命中，VC 自己的文件链接/词补全建议
 * 就整个看不见。仅在 VC **确实已启用**（`"enabled"`）时才需要让路：未安装/已禁用时没有竞争者，
 * 让路只会白白丢掉功能。
 */
export function shouldYieldSuggestToVc(mode: "yield" | "own", status: VcInstallStatus): boolean {
	return mode === "yield" && status === "enabled";
}

/**
 * VC data.json 的最小已知形状——只声明我们要读写的字段，其余字段原样透传，绝不重建对象
 * （重建对象会把 VC 的其余配置全部清空，是一次真正的数据破坏）。字段名/类型已对照 VC
 * 源码核实（doc/research/vc-source-verification.md）。
 */
export interface VcSettingsShape {
	/** 自定义词典路径列表，**换行分隔的字符串**（不是数组！）。 */
	customDictionaryPaths?: string;
	/** 自定义词典补全总开关。 */
	enableCustomDictionaryComplement?: boolean;
	/**
	 * 自定义词典补全的触发最小字符数（VC 默认 0 = 跟随全局/分词策略阈值，default 策略为 3，
	 * 即打 1–2 个字符根本不触发）。自动配置时置为 1，兑现「打 1 个字就出标题建议」；
	 * 该字段只放宽自定义词典类补全，不影响 VC 其它补全类型。
	 */
	customDictionaryMinNumberOfCharactersForTrigger?: number;
	[key: string]: unknown;
}

/**
 * 各字段「存在才校验类型」——缺失合法（VC 用深合并兜底缺失字段），类型不符才算非法，
 * 避免对「合法但恰好还没写过这些键」的 data.json 误判为不合法。
 */
export function isValidVcSettingsShape(data: unknown): data is VcSettingsShape {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return false;
	}
	const d = data as Record<string, unknown>;
	if ("customDictionaryPaths" in d && typeof d.customDictionaryPaths !== "string") {
		return false;
	}
	if (
		"enableCustomDictionaryComplement" in d &&
		typeof d.enableCustomDictionaryComplement !== "boolean"
	) {
		return false;
	}
	if (
		"customDictionaryMinNumberOfCharactersForTrigger" in d &&
		typeof d.customDictionaryMinNumberOfCharactersForTrigger !== "number"
	) {
		return false;
	}
	return true;
}

/**
 * 把新路径合并进 VC 的换行分隔字符串字段；已存在则原样返回，不重复添加，且不改写其余行的格式。
 * 绝不能当数组用 JSON.parse/join 处理——那会把整个字符串当成「长度为 1 的数组」来操作。
 */
export function mergeDictionaryPath(existing: string | undefined, newPath: string): string {
	const base = existing ?? "";
	const lines = base
		.split("\n")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	if (lines.includes(newPath)) {
		return base; // 已存在：原样返回，不动
	}
	if (base.trim() === "") {
		return newPath;
	}
	return base.endsWith("\n") ? `${base}${newPath}` : `${base}\n${newPath}`;
}

/** 词典文件固定落在插件目录下（与 templates/*.json 同构），不进用户可见的文件树。 */
export function vcDictionaryPath(pluginDir: string): string {
	return normalizePath(`${pluginDir}/vc-heading-dictionary.json`);
}

/** buildVcDictionaryJson 的返回值：词典内容 + 是否因超上限被截断（供调用方弹一次性 Notice）。 */
export interface VcDictionaryOutput {
	/** 词典文件内容（紧凑 JSON，无缩进——控制体积与 iCloud 同步成本）。 */
	json: string;
	/** 标题总数是否超过 {@link MAX_VC_DICTIONARY_ENTRIES}（超出部分被截断）。 */
	truncated: boolean;
	/** 传入的标题条目总数。 */
	total: number;
}

/**
 * 生成 VC JSON 词典内容。
 *
 * 词典是「静态文件」，生成时不知道未来用户会在哪个文件里打字，因此不能用 headingtrigger.ts 的
 * 「同文件省略文件名」优化——一律用完整的 `[[basename#anchor|...]]` 形式；alias 恒为标题的完整
 * 原文（displayText）——VC 按 displayed 匹配、接受时整体替换为 value（「前缀展开为全文」语义）。
 *
 * **格式要求（已对照 VC 源码核实）**：当前 VC 版本的 JSON 词典顶层必须是 `words` 数组
 * （`{ words: [{ value, displayed }] }`）——裸数组会让 VC 解析抛错、整个词典加载失败（用户
 * 实测 #5 的根因之一）。超过 {@link MAX_VC_DICTIONARY_ENTRIES} 时截断并置 `truncated`。
 */
export function buildVcDictionaryJson(entries: HeadingIndexEntry[]): VcDictionaryOutput {
	const total = entries.length;
	const taken = entries.slice(0, MAX_VC_DICTIONARY_ENTRIES);
	const items = taken.map((e) => ({
		value: `[[${e.basename}#${e.anchor}|${e.displayText}]]`,
		displayed: e.displayText,
	}));
	return {
		json: JSON.stringify({ words: items }),
		truncated: total > MAX_VC_DICTIONARY_ENTRIES,
		total,
	};
}

/**
 * app.plugins 不在官方 obsidian.d.ts 里（内部/非公开 API）——与本仓库既有的
 * metadataTypeManager / getBacklinksForFile 同一套「结构化收窄 + 运行时判空」防御手法，不用 any。
 */
function getPluginsRegistry(
	app: App,
): { manifests?: Record<string, unknown>; plugins?: Record<string, unknown> } | undefined {
	return (
		app as App & {
			plugins?: { manifests?: Record<string, unknown>; plugins?: Record<string, unknown> };
		}
	).plugins;
}

/**
 * 探测 VC 安装/启用状态：`manifests[id]`（安装即有，无论是否启用）与 `plugins[id]`（仅启用且
 * 已加载时有）这套区分是社区共识用法、不在官方 .d.ts 里（方案 §12 核实清单第 2 条）。
 */
export function detectVcStatus(app: App): VcInstallStatus {
	const registry = getPluginsRegistry(app);
	if (!registry?.manifests?.[VC_PLUGIN_ID]) {
		return "not-installed";
	}
	if (!registry.plugins?.[VC_PLUGIN_ID]) {
		return "disabled";
	}
	return "enabled";
}

/**
 * Layer 1：VC 活体实例读写（首选路径）。
 *
 * 好处：不需要自己拼 VC 的 data.json 路径；直接改 VC 当前持有的内存对象，saveData 是 VC 从
 * Plugin 基类继承的公开方法，语义上等价于「帮 VC 自己按一次保存」，不会跟 VC 尚未落盘的其它
 * 内存态修改产生竞态。`.settings` 公开字段已对照 VC 源码核实（`VariousComponents extends
 * Plugin`，标准 `this.settings`，见 doc/research/vc-source-verification.md）。
 */
async function tryWriteViaLiveInstance(
	app: App,
	dictionaryPath: string,
): Promise<"ok" | "unavailable" | "invalid-shape"> {
	const registry = getPluginsRegistry(app);
	const vc = registry?.plugins?.[VC_PLUGIN_ID] as
		| { settings?: unknown; saveData?: (data: unknown) => Promise<void> }
		| undefined;
	if (!vc || typeof vc.saveData !== "function") {
		return "unavailable";
	}
	if (!isValidVcSettingsShape(vc.settings)) {
		return "invalid-shape";
	}
	const settings = vc.settings as VcSettingsShape;
	settings.customDictionaryPaths = mergeDictionaryPath(
		settings.customDictionaryPaths,
		dictionaryPath,
	);
	settings.enableCustomDictionaryComplement = true;
	applyTriggerThreshold(settings);
	await vc.saveData(settings);
	return "ok";
}

/**
 * Layer 2：文件级读改写兜底（VC 未启用/未加载/活体形状不符时）。
 *
 * 关键约束：JSON.parse 整个文件、只改已知字段、JSON.stringify 整个对象写回——绝不用
 * 「已知字段拼一个新对象」的写法，否则会把 VC 的其余设置全部清空。
 */
async function tryWriteViaAdapterFile(
	app: App,
	dictionaryPath: string,
): Promise<"ok" | "not-found" | "invalid-shape"> {
	const vcDataPath = normalizePath(`${app.vault.configDir}/${VC_DATA_REL_PATH}`);
	if (!(await app.vault.adapter.exists(vcDataPath))) {
		return "not-found";
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(await app.vault.adapter.read(vcDataPath));
	} catch {
		return "invalid-shape";
	}
	if (!isValidVcSettingsShape(parsed)) {
		return "invalid-shape";
	}
	const settings = parsed as VcSettingsShape;
	settings.customDictionaryPaths = mergeDictionaryPath(
		settings.customDictionaryPaths,
		dictionaryPath,
	);
	settings.enableCustomDictionaryComplement = true;
	applyTriggerThreshold(settings);
	await app.vault.adapter.write(vcDataPath, JSON.stringify(settings, null, "\t"));
	return "ok";
}

/**
 * 把自定义词典的触发阈值放宽到 1 字符（用户实测：只打一个字应能出标题建议）。
 *
 * VC 默认 0 = 跟随全局/分词策略阈值（default 策略为 3，1–2 字符不触发）；置 1 后
 * VC 取 `min(全局阈值, 1)` = 1。仅当现值不是 1 才写（用户显式设为 1 则不动）。
 */
function applyTriggerThreshold(settings: VcSettingsShape): void {
	if (settings.customDictionaryMinNumberOfCharactersForTrigger !== 1) {
		settings.customDictionaryMinNumberOfCharactersForTrigger = 1;
	}
}

export type VcAutoIntegrationResult =
	| { outcome: "ok"; via: "live-instance" | "adapter-file" }
	| { outcome: "not-installed" | "disabled-and-no-file" | "invalid-shape" };

/**
 * 自动配置编排入口：探测 → Layer 1（活体实例）→ Layer 2（文件级）→ 整体放弃。
 *
 * 校验失败 = 整体放弃，不做部分写入：任何一层返回 "invalid-shape" 时不再尝试另一层
 * （避免写坏一次）；调用方（main.ts）须弹明确失败 Notice，并把设置面板的三态选择器
 * 回退为写入前的值，绝不假装「自动配置」已生效。
 */
export async function enableAutoIntegration(
	app: App,
	dictionaryPath: string,
): Promise<VcAutoIntegrationResult> {
	const status = detectVcStatus(app);
	if (status === "not-installed") {
		return { outcome: "not-installed" };
	}
	if (status === "enabled") {
		const r1 = await tryWriteViaLiveInstance(app, dictionaryPath);
		if (r1 === "ok") {
			return { outcome: "ok", via: "live-instance" };
		}
		if (r1 === "invalid-shape") {
			return { outcome: "invalid-shape" };
		}
		// r1 === "unavailable"：活体实例形状不符预期，继续尝试 Layer 2。
	}
	const r2 = await tryWriteViaAdapterFile(app, dictionaryPath);
	if (r2 === "ok") {
		return { outcome: "ok", via: "adapter-file" };
	}
	if (r2 === "not-found") {
		return { outcome: "disabled-and-no-file" };
	}
	return { outcome: "invalid-shape" };
}

/**
 * 尝试调用 VC 的「重新加载自定义词典」命令；失败返回 false。
 *
 * 调用失败 ≠ 写入失败：写入已成功，只是需要用户手动执行该命令（或重启 Obsidian）才能让 VC
 * 读到新词典——调用方须用独立的提示文案区分这两种情况（见 i18n noticeVcReloadFailed）。
 * [C：未核实] `插件id:命令id` 拼接规则与 executeCommandById 均不在官方 .d.ts（方案 §12 第 5 条）。
 */
export async function tryReloadVcDictionaries(app: App): Promise<boolean> {
	try {
		const commands = (
			app as App & {
				commands?: { executeCommandById?: (id: string) => boolean };
			}
		).commands;
		if (typeof commands?.executeCommandById !== "function") {
			return false;
		}
		return commands.executeCommandById(VC_RELOAD_COMMAND_ID);
	} catch {
		return false;
	}
}
