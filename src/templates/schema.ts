/**
 * 模板 schema 的定义、校验与序列化（Milestone 3）。
 *
 * 模板以独立的 `.json` 文件存储于插件文件夹的 `templates/` 子目录。本模块负责：
 * - 将磁盘上（可能不完整或被手动改坏）的 JSON 规范化为合法的 {@link Template}；
 * - 将内存中的模板序列化为稳定、可读的 JSON；
 * - 由模板名生成跨平台安全的文件名。
 *
 * 校验策略：**尽量容错**——缺失或非法的字段回退到默认值，而非抛错，
 * 以免一处手改的 JSON 让整个插件无法加载。
 */

import {
	DEFAULT_SKIP_FILL,
	DEFAULT_TEMPLATE,
	type LevelFormat,
	normalizeAncestorNumeral,
	normalizeBottomLevel,
	normalizeStartIndex,
	normalizeTopLevel,
	type NumeralStyle,
	sanitizePlaceholder,
	type SkipFill,
	type Template,
	type WhitelistEntry,
} from "../numbering";

/** 默认模板的固定名称（`default.json` 在面板中始终显示为「默认」）。 */
export const DEFAULT_TEMPLATE_NAME = "默认";

/** 默认模板的固定文件名（不经名称安全化，始终为 `default.json`）。 */
export const DEFAULT_TEMPLATE_FILENAME = "default.json";

/** 模板各级的键，按 H1–H6 顺序。 */
export const LEVEL_KEYS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
export type LevelKey = (typeof LEVEL_KEYS)[number];

/** 合法的序号样式枚举（用于校验）。 */
const NUMERAL_STYLES: readonly NumeralStyle[] = [
	"arabic",
	"cjk",
	"circled",
	"lower-alpha",
	"upper-alpha",
	"lower-roman",
	"upper-roman",
];

/** 合法的白名单匹配方式枚举（用于校验）。 */
const MATCH_KINDS: readonly WhitelistEntry["match"][] = ["exact", "partial", "subtree"];

/** 单级格式的兜底默认值（纯阿拉伯、点分、空格分隔、继承前级）。 */
function defaultLevel(): LevelFormat {
	return {
		prefix: "",
		numeral: "arabic",
		suffix: "",
		numberSeparator: ".",
		titleSeparator: " ",
		inherit: true,
	};
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeString(v: unknown, fallback: string): string {
	return typeof v === "string" ? v : fallback;
}

function normalizeNumeral(v: unknown): NumeralStyle {
	return NUMERAL_STYLES.includes(v as NumeralStyle) ? (v as NumeralStyle) : "arabic";
}

/** 将磁盘上的单级格式对象规范化为合法的 {@link LevelFormat}（`inherit` 缺省视为 true）。 */
function normalizeLevel(raw: unknown): LevelFormat {
	const base = defaultLevel();
	if (!isObject(raw)) {
		return base;
	}
	return {
		prefix: normalizeString(raw.prefix, base.prefix),
		numeral: normalizeNumeral(raw.numeral),
		suffix: normalizeString(raw.suffix, base.suffix),
		numberSeparator: normalizeString(raw.numberSeparator, base.numberSeparator),
		titleSeparator: normalizeString(raw.titleSeparator, base.titleSeparator),
		// inherit 缺省视为 true；仅当显式为 false 时关闭。
		inherit: raw.inherit === false ? false : true,
	};
}

/** 将磁盘上的白名单数组规范化为合法的条目列表（`match` 缺省视为 `exact`）。 */
function normalizeWhitelist(raw: unknown): WhitelistEntry[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	const out: WhitelistEntry[] = [];
	for (const item of raw) {
		if (!isObject(item) || typeof item.text !== "string") {
			continue;
		}
		const match = MATCH_KINDS.includes(item.match as WhitelistEntry["match"])
			? (item.match as WhitelistEntry["match"])
			: "exact";
		out.push({ text: item.text, match });
	}
	return out;
}

/**
 * 将磁盘上的跳级占位策略规范化为合法的 {@link SkipFill}。
 * - `{ mode: "drop" }`：不补位。
 * - `{ mode: "fill", placeholder }`：补位；占位文本缺失/为空时回退为 `0`（避免空段）。
 * - `{ mode: "none" }`：跳级标题完全不编号（0.7.15）。
 * - 缺失/非法（含历史上没有该字段的旧模板）：回退到默认（补 `0`）。
 */
function normalizeSkipFill(raw: unknown): SkipFill {
	if (isObject(raw)) {
		if (raw.mode === "drop") {
			return { mode: "drop" };
		}
		if (raw.mode === "none") {
			return { mode: "none" };
		}
		if (raw.mode === "fill") {
			// 占位字符仅允许数字（保证可干净剥离，见 sanitizePlaceholder）；非数字滤除、空回退 0。
			const placeholder = sanitizePlaceholder(
				typeof raw.placeholder === "string" ? raw.placeholder : "",
			);
			return { mode: "fill", placeholder };
		}
	}
	return { ...DEFAULT_SKIP_FILL };
}

/**
 * 将任意已解析的 JSON 值规范化为合法的 {@link Template}。
 *
 * @param raw 已 `JSON.parse` 的对象（可能不完整或被手改坏）。
 * @param fallbackName 当 `raw.name` 缺失时使用的名称（通常由文件名还原）。
 */
export function normalizeTemplate(raw: unknown, fallbackName: string): Template {
	const obj = isObject(raw) ? raw : {};
	const levels = isObject(obj.levels) ? obj.levels : {};
	return {
		name: normalizeString(obj.name, fallbackName),
		levels: {
			h1: normalizeLevel(levels.h1),
			h2: normalizeLevel(levels.h2),
			h3: normalizeLevel(levels.h3),
			h4: normalizeLevel(levels.h4),
			h5: normalizeLevel(levels.h5),
			h6: normalizeLevel(levels.h6),
		},
		whitelist: normalizeWhitelist(obj.whitelist),
		skipFill: normalizeSkipFill(obj.skipFill),
		topLevel: normalizeTopLevel(obj.topLevel),
		bottomLevel: normalizeBottomLevel(obj.bottomLevel),
		startIndex: normalizeStartIndex(obj.startIndex),
		ancestorNumeral: normalizeAncestorNumeral(obj.ancestorNumeral),
	};
}

/** 将模板序列化为稳定、可读（缩进）的 JSON 字符串，便于人工查看与版本管理。 */
export function serializeTemplate(template: Template): string {
	const normalized = normalizeTemplate(template, template.name);
	return JSON.stringify(normalized, null, 2) + "\n";
}

/** 返回内置默认模板的深拷贝（名称固定为「默认」）。 */
export function createDefaultTemplate(): Template {
	return normalizeTemplate(DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_NAME);
}

/** 文件名中的非法/保留字符（Windows 与 POSIX 取并集）。 */
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

/**
 * 由模板名生成跨平台安全的文件名（不含目录，含 `.json` 后缀）。
 *
 * - 「默认」固定映射为 `default.json`。
 * - 非法/保留字符（`\\ / : * ? " < > |`）替换为 `-`，空格保留。
 * - 折叠多余空白与连字符，去除首尾的 `.`、`-`、空白。
 * - 全部被替换为空时回退为 `template`。
 */
export function templateFileName(name: string): string {
	if (name === DEFAULT_TEMPLATE_NAME) {
		return DEFAULT_TEMPLATE_FILENAME;
	}
	let safe = name.replace(ILLEGAL_FILENAME_CHARS, "-");
	safe = safe.replace(/\s+/g, " ");
	safe = safe.replace(/-{2,}/g, "-");
	safe = safe.replace(/^[.\-\s]+|[.\-\s]+$/g, "");
	if (safe === "") {
		safe = "template";
	}
	return `${safe}.json`;
}
