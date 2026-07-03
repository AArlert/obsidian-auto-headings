/**
 * i18n（Milestone 6）单测：语言解析、双语文案形状一致性、插值文案。
 */
import { afterEach, describe, expect, it } from "vitest";
// vitest.config.ts 把 "obsidian" alias 到 obsidian-mock.ts；这里直连替身文件（同一模块实例）
// 取测试专用开关，避免经 "obsidian" 导入时撞真实类型声明。
import { __setMockLanguage } from "./obsidian-mock";
import {
	DEFAULT_LANG_SETTING,
	detectObsidianLang,
	getMessages,
	type Messages,
	resolveLang,
} from "../../src/i18n";

describe("resolveLang", () => {
	it("显式 zh / en 原样返回", () => {
		expect(resolveLang("zh")).toBe("zh");
		expect(resolveLang("en")).toBe("en");
	});

	it("auto / 缺失走 Obsidian 探测", () => {
		// detectObsidianLang 走 obsidian-mock 的 getLanguage 替身（默认 en，见下组用例）。
		expect(["zh", "en"]).toContain(resolveLang("auto"));
		expect(["zh", "en"]).toContain(resolveLang(undefined));
	});

	it("默认语言设置为 auto", () => {
		expect(DEFAULT_LANG_SETTING).toBe("auto");
	});
});

describe("detectObsidianLang", () => {
	afterEach(() => {
		__setMockLanguage(() => "en");
	});

	it("getLanguage 以 zh 前缀 → 中文", () => {
		__setMockLanguage(() => "zh-TW");
		expect(detectObsidianLang()).toBe("zh");
	});

	it("getLanguage 为 en / 其它 → 英文", () => {
		__setMockLanguage(() => "en");
		expect(detectObsidianLang()).toBe("en");
	});

	it("getLanguage 抛错（受限环境）→ 回退英文", () => {
		__setMockLanguage(() => {
			throw new Error("no api");
		});
		expect(detectObsidianLang()).toBe("en");
	});
});

describe("getMessages 双语", () => {
	it("zh / en 形状一致（键集合相同、类型相同）", () => {
		const zh = getMessages("zh") as unknown as Record<string, unknown>;
		const en = getMessages("en") as unknown as Record<string, unknown>;
		expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
		for (const k of Object.keys(zh)) {
			expect(typeof zh[k]).toBe(typeof en[k]);
		}
	});

	it("纯字符串文案非空", () => {
		for (const lang of ["zh", "en"] as const) {
			const m = getMessages(lang) as unknown as Record<string, unknown>;
			for (const [k, v] of Object.entries(m)) {
				if (typeof v === "string") {
					expect(v.length, `${lang}.${k} 不应为空`).toBeGreaterThan(0);
				}
			}
		}
	});

	it("插值文案：防抖范围 / 计数 / 模板名正确代入", () => {
		const zh = getMessages("zh");
		expect(zh.debounceDesc(50, 2000, 300)).toContain("50");
		expect(zh.debounceDesc(50, 2000, 300)).toContain("2000");
		expect(zh.noticeClearedVault(3)).toContain("3");
		expect(zh.delModalTitle("学术")).toContain("学术");

		const en = getMessages("en");
		expect(en.debounceDesc(50, 2000, 300)).toContain("300");
		expect(en.wlPreviewSome(2, "目录 · 附录")).toContain("2");
		expect(en.templateMissingSuffix("X")).toContain("X");
	});

	it("中英命令名互不相同（确实翻译了）", () => {
		const zh: Messages = getMessages("zh");
		const en: Messages = getMessages("en");
		expect(zh.cmdRenumber).not.toBe(en.cmdRenumber);
		expect(zh.autoNumberName).not.toBe(en.autoNumberName);
	});
});
