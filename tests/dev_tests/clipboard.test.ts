/**
 * 剪贴板净化（M11「复制净化开关」，spec.md §2.8「同步净化 + 内存映射双通道」）单测。
 *
 * 对应 doc/testplan.md **O8**（出口净化 / 覆写决策）与 **O9**（粘贴回还原避免双重编号 +
 * 各守卫放行面）。分三层：
 * 1. `src/clipboard.ts` 纯函数与 LRU 缓存；
 * 2. 内容级 O9 回归：还原原文 → `renumberContent` 重排无双重编号，反例（未还原）对照；
 * 3. 插件级守卫矩阵：经 obsidian-mock 加载真 `AutoHeadingsPlugin`，直调其私有
 *    `sanitizeClipboardEvent` / `restoreSanitizedPaste`（TS 私有不阻止运行时访问，同 main.test.ts）。
 */
import { describe, expect, it } from "vitest";
import {
	CLIPBOARD_CACHE_MAX_CHARS,
	CLIPBOARD_CACHE_MAX_ENTRIES,
	ClipboardOriginalCache,
	normalizeClipboardText,
	stripWordJoiners,
	stripWordJoinersFromHtml,
} from "../../src/clipboard";
import AutoHeadingsPlugin from "../../src/main";
import { DEFAULT_TEMPLATE, renumberContent, WORD_JOINER, type Template } from "../../src/numbering";
import type { PathRule } from "../../src/pathrules";

const WJ = WORD_JOINER;

describe("clipboard 纯函数（O8 净化口径）", () => {
	it("stripWordJoiners：剥净全部 WJ（多处 / 首尾），其余字符不动", () => {
		expect(stripWordJoiners(`## ${WJ}1 ${WJ}概述${WJ}`)).toBe("## 1 概述");
		expect(stripWordJoiners("无标记文本")).toBe("无标记文本");
		expect(stripWordJoiners("")).toBe("");
	});

	it("stripWordJoinersFromHtml：原始字符与数字 / 十六进制实体都剥净", () => {
		expect(stripWordJoinersFromHtml(`<h2>${WJ}1 ${WJ}概述</h2>`)).toBe("<h2>1 概述</h2>");
		expect(stripWordJoinersFromHtml("<h2>&#8288;1 &#8288;概述</h2>")).toBe("<h2>1 概述</h2>");
		expect(stripWordJoinersFromHtml("<h2>&#x2060;1 &#X2060;概述</h2>")).toBe("<h2>1 概述</h2>");
	});

	it("normalizeClipboardText：CRLF 与孤立 CR 都归一为 LF", () => {
		expect(normalizeClipboardText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
	});
});

describe("ClipboardOriginalCache（内存映射 LRU）", () => {
	it("record 返回净化文本，lookup 命中返回原文", () => {
		const cache = new ClipboardOriginalCache();
		const original = `## ${WJ}2 ${WJ}细节`;
		const sanitized = cache.record(original);
		expect(sanitized).toBe("## 2 细节");
		expect(cache.lookup(sanitized)).toBe(original);
	});

	it("外部中转改了换行符（CRLF）仍命中（规范化口径）", () => {
		const cache = new ClipboardOriginalCache();
		const original = `## ${WJ}1 ${WJ}甲\n正文\n## ${WJ}2 ${WJ}乙`;
		const sanitized = cache.record(original);
		expect(cache.lookup(sanitized.replace(/\n/g, "\r\n"))).toBe(original);
	});

	it("命中不消耗：同一份复制可多次粘贴还原", () => {
		const cache = new ClipboardOriginalCache();
		const sanitized = cache.record(`${WJ}1 ${WJ}标题`);
		expect(cache.lookup(sanitized)).not.toBeNull();
		expect(cache.lookup(sanitized)).not.toBeNull();
	});

	it("不含 WJ 的文本不入表（还原无意义）", () => {
		const cache = new ClipboardOriginalCache();
		expect(cache.record("纯正文")).toBe("纯正文");
		expect(cache.size).toBe(0);
		expect(cache.lookup("纯正文")).toBeNull();
	});

	it("未命中返回 null（外部内容 / 改动过的文本当新内容处理）", () => {
		const cache = new ClipboardOriginalCache();
		cache.record(`${WJ}1 ${WJ}标题`);
		expect(cache.lookup("1 标题（被外部改过）")).toBeNull();
	});

	it("条数超限逐出最旧；record 重复键与 lookup 命中都刷新新旧序", () => {
		const cache = new ClipboardOriginalCache(2);
		const a = cache.record(`${WJ}a${WJ}A`);
		const b = cache.record(`${WJ}b${WJ}B`);
		cache.lookup(a); // 刷新 a → 最新，b 变最旧
		cache.record(`${WJ}c${WJ}C`); // 逐出 b
		expect(cache.size).toBe(2);
		expect(cache.lookup(a)).not.toBeNull();
		expect(cache.lookup(b)).toBeNull();
	});

	it("总字符量超限逐出最旧；单条超限即不驻留", () => {
		const cache = new ClipboardOriginalCache(10, 40);
		const small = cache.record(`${WJ}12345${WJ}67890`); // 键 10 + 值 12 = 22 字符
		cache.record(`${WJ}abcde${WJ}fghij`); // 再 22 字符 → 44 > 40，逐出最旧 small
		expect(cache.lookup(small)).toBeNull();
		const huge = cache.record(`${WJ}${"x".repeat(60)}`); // 单条 121 字符 > 40 → 自身也不驻留
		expect(cache.lookup(huge)).toBeNull();
	});

	it("默认上限常量可用（条数 / 总字符量为正）", () => {
		expect(CLIPBOARD_CACHE_MAX_ENTRIES).toBeGreaterThan(0);
		expect(CLIPBOARD_CACHE_MAX_CHARS).toBeGreaterThan(0);
	});
});

describe("O9 内容级回归：还原 → 重排无双重编号；未还原反例对照", () => {
	it("命中还原：粘贴回已编号文件后重排，编号正确、无双重编号", () => {
		// 源文件复制区（已编号，含 WJ）——模拟 CM6 copy 写入剪贴板的原文。
		const source = renumberContent("## 细节\n### 子节", DEFAULT_TEMPLATE);
		expect(source).toContain(WJ);
		const cache = new ClipboardOriginalCache();
		const sanitized = cache.record(source);
		expect(sanitized).not.toContain(WJ);
		expect(sanitized).toContain("1 细节"); // 可见序号保留（净化只剥 WJ）
		// 粘贴回：目标文件已含其他编号标题（O9 场景核心前置）。
		const target = renumberContent("## 甲\n## 乙", DEFAULT_TEMPLATE);
		const restored = cache.lookup(sanitized);
		expect(restored).toBe(source);
		const renumbered = renumberContent(`${target}\n${restored}`, DEFAULT_TEMPLATE);
		// 等价于裸标题直接追加编号（还原让 stripPrefix 正常认领旧前缀）。
		expect(renumbered).toBe(
			renumberContent("## 甲\n## 乙\n## 细节\n### 子节", DEFAULT_TEMPLATE),
		);
		expect(stripWordJoiners(renumbered)).toContain("## 3 细节");
		expect(stripWordJoiners(renumbered)).not.toMatch(/\d+ \d+ 细节/);
	});

	it("反例（未还原，直接粘贴净化文本）：裸序号被当正文，出现双重编号——证明还原必要", () => {
		const source = renumberContent("## 细节\n### 子节", DEFAULT_TEMPLATE);
		const sanitized = stripWordJoiners(source);
		const target = renumberContent("## 甲\n## 乙", DEFAULT_TEMPLATE);
		const renumbered = renumberContent(`${target}\n${sanitized}`, DEFAULT_TEMPLATE);
		// `## 1 细节` 的可见序号 1 无 WJ、被 stripPrefix 视为正文（方案 A），叠加新前缀 3。
		expect(stripWordJoiners(renumbered)).toContain("## 3 1 细节");
	});
});

// —— 插件级守卫矩阵（经 obsidian-mock 加载真插件，直调私有方法）——

/** 被测插件的内部面（运行时存在，TS 私有不阻止访问，同 main.test.ts 的做法）。 */
interface ClipboardInternals {
	settings: {
		autoNumber: boolean;
		debounceDelay: number;
		pathRules: PathRule[];
		language: "auto" | "zh" | "en";
		updateBacklinks: boolean;
		backlinksIntroShown: boolean;
		sanitizeClipboard: boolean;
	};
	templateStore: { get(name: string): Template | undefined };
	clipboardCache: ClipboardOriginalCache;
	sanitizeClipboardEvent(evt: unknown, doc: unknown): void;
	restoreSanitizedPaste(evt: unknown, editor: unknown, info: unknown): void;
}

function makeClipboardPlugin(opts: { sanitize?: boolean; pathRules?: PathRule[] } = {}) {
	const PluginCtor = AutoHeadingsPlugin as unknown as new (
		app: unknown,
		manifest: unknown,
	) => AutoHeadingsPlugin;
	const plugin = new PluginCtor({}, { id: "auto-headings", dir: "plugins/auto-headings" });
	const p = plugin as unknown as ClipboardInternals;
	p.settings = {
		autoNumber: true,
		debounceDelay: 300,
		pathRules: opts.pathRules ?? [{ pattern: "/", template: "默认" }],
		language: "zh",
		updateBacklinks: false,
		backlinksIntroShown: false,
		sanitizeClipboard: opts.sanitize ?? true,
	};
	p.templateStore = {
		get: (name: string) => (name === "默认" ? DEFAULT_TEMPLATE : undefined),
	};
	return p;
}

/** 假 DataTransfer：内存 map 实现 getData/setData（copy/cut 事件的 clipboardData）。 */
function makeDataTransfer(init: Record<string, string> = {}) {
	const store = new Map<string, string>(Object.entries(init));
	return {
		getData: (type: string) => store.get(type) ?? "",
		setData: (type: string, value: string) => {
			store.set(type, value);
		},
		store,
	};
}

/** 假 ClipboardEvent（可预置 defaultPrevented，preventDefault 置位）。 */
function makeClipboardEvent(data: ReturnType<typeof makeDataTransfer> | null, prevented = false) {
	const evt = {
		defaultPrevented: prevented,
		clipboardData: data,
		preventDefault() {
			evt.defaultPrevented = true;
		},
	};
	return evt;
}

/** 假粘贴目标编辑器：getValue / listSelections / replaceSelection（记录插入内容）。 */
function makePasteEditor(content: string, selections = 1) {
	return {
		inserted: null as string | null,
		getValue: () => content,
		listSelections: () => Array.from({ length: selections }, () => ({})),
		replaceSelection(text: string) {
			this.inserted = text;
		},
	};
}

describe("copy/cut 出口净化守卫（O8，插件级）", () => {
	const original = `## ${WJ}1 ${WJ}概述\n正文`;

	it("编辑器路径（CM6 已接管）：覆写 text/plain 为净化文本并记录 LRU；text/html 一并剥 WJ", () => {
		const p = makeClipboardPlugin();
		const data = makeDataTransfer({
			"text/plain": original,
			"text/html": `<h2>${WJ}1 ${WJ}概述</h2>`,
		});
		p.sanitizeClipboardEvent(makeClipboardEvent(data, true), {});
		expect(data.getData("text/plain")).toBe("## 1 概述\n正文");
		expect(data.getData("text/html")).toBe("<h2>1 概述</h2>");
		expect(p.clipboardCache.lookup("## 1 概述\n正文")).toBe(original);
	});

	it("WJ 守卫：选区不含 WJ 完全不介入（剪贴板 / LRU 都不动）", () => {
		const p = makeClipboardPlugin();
		const data = makeDataTransfer({ "text/plain": "纯正文，无标记" });
		p.sanitizeClipboardEvent(makeClipboardEvent(data, true), {});
		expect(data.getData("text/plain")).toBe("纯正文，无标记");
		expect(p.clipboardCache.size).toBe(0);
	});

	it("开关关闭：不介入", () => {
		const p = makeClipboardPlugin({ sanitize: false });
		const data = makeDataTransfer({ "text/plain": original });
		p.sanitizeClipboardEvent(makeClipboardEvent(data, true), {});
		expect(data.getData("text/plain")).toBe(original);
	});

	it("clipboardData 缺失（O10 降级）：静默不介入、不抛错", () => {
		const p = makeClipboardPlugin();
		expect(() => p.sanitizeClipboardEvent(makeClipboardEvent(null, true), {})).not.toThrow();
	});

	it("setData 抛错（O10 降级）：吞掉异常、不 preventDefault（维持现状）", () => {
		const p = makeClipboardPlugin();
		const doc = {
			defaultView: {
				getSelection: () => ({ toString: () => `${WJ}1 ${WJ}概述`, rangeCount: 0 }),
			},
			createElement: () => ({ appendChild() {}, innerHTML: "" }),
		};
		const data = makeDataTransfer();
		data.setData = () => {
			throw new Error("WebView 沙箱拒绝");
		};
		const evt = makeClipboardEvent(data, false);
		expect(() => p.sanitizeClipboardEvent(evt, doc)).not.toThrow();
		expect(evt.defaultPrevented).toBe(false);
	});

	it("阅读模式路径（未被接管）：按 DOM 选区构造净化 payload 并 preventDefault，不记 LRU", () => {
		const p = makeClipboardPlugin();
		const doc = {
			defaultView: {
				getSelection: () => ({ toString: () => `${WJ}1 ${WJ}概述`, rangeCount: 0 }),
			},
			createElement: () => ({ appendChild() {}, innerHTML: "" }),
		};
		const data = makeDataTransfer();
		const evt = makeClipboardEvent(data, false);
		p.sanitizeClipboardEvent(evt, doc);
		expect(evt.defaultPrevented).toBe(true);
		expect(data.getData("text/plain")).toBe("1 概述");
		expect(p.clipboardCache.size).toBe(0); // 渲染文本构不成标题行，无 O9 风险，不入表
	});
});

describe("paste 端守卫矩阵（O9，插件级）", () => {
	const original = `## ${WJ}2 ${WJ}细节`;
	const targetContent = `## ${WJ}1 ${WJ}甲\n正文`;

	/** 预置一条 LRU 记录，返回 [插件, 净化文本]。 */
	function seeded(opts: Parameters<typeof makeClipboardPlugin>[0] = {}) {
		const p = makeClipboardPlugin(opts);
		const sanitized = p.clipboardCache.record(original);
		return { p, sanitized };
	}

	it("全守卫通过：preventDefault + 整段插入原文（含 WJ）", () => {
		const { p, sanitized } = seeded();
		const editor = makePasteEditor(targetContent);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }));
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(evt.defaultPrevented).toBe(true);
		expect(editor.inserted).toBe(original);
	});

	it("他人已 preventDefault：放行（不插入）", () => {
		const { p, sanitized } = seeded();
		const editor = makePasteEditor(targetContent);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }), true);
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(editor.inserted).toBeNull();
	});

	it("LRU 未命中（外部内容）：放行", () => {
		const { p } = seeded();
		const editor = makePasteEditor(targetContent);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": "外部粘贴的内容" }));
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(evt.defaultPrevented).toBe(false);
		expect(editor.inserted).toBeNull();
	});

	it("目标文件 frontmatter false（编号未生效）：放行净化文本，不重新引入 WJ", () => {
		const { p, sanitized } = seeded();
		const editor = makePasteEditor("---\nobsidian-auto-headings: false\n---\n## 甲");
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }));
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(evt.defaultPrevented).toBe(false);
		expect(editor.inserted).toBeNull();
	});

	it("全局自动编号关：放行", () => {
		const { p, sanitized } = seeded();
		p.settings.autoNumber = false;
		const editor = makePasteEditor(targetContent);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }));
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(editor.inserted).toBeNull();
	});

	it("无模板命中（路径规则为空）：放行", () => {
		const { p, sanitized } = seeded({ pathRules: [] });
		const editor = makePasteEditor(targetContent);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }));
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(editor.inserted).toBeNull();
	});

	it("多光标：放行（原生多光标粘贴有按行分配语义，不模仿）", () => {
		const { p, sanitized } = seeded();
		const editor = makePasteEditor(targetContent, 2);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }));
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(editor.inserted).toBeNull();
	});

	it("info.file 缺失：放行", () => {
		const { p, sanitized } = seeded();
		const editor = makePasteEditor(targetContent);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }));
		p.restoreSanitizedPaste(evt, editor, { file: null });
		expect(editor.inserted).toBeNull();
	});

	it("开关关闭：放行（还原端与净化端同一开关门控）", () => {
		const { p, sanitized } = seeded();
		p.settings.sanitizeClipboard = false;
		const editor = makePasteEditor(targetContent);
		const evt = makeClipboardEvent(makeDataTransfer({ "text/plain": sanitized }));
		p.restoreSanitizedPaste(evt, editor, { file: { path: "笔记.md" } });
		expect(editor.inserted).toBeNull();
	});
});
