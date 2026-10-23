/**
 * i18n 多语言（繁體中文 / 日本語 / Español / Français / Deutsch / Русский / 한국어 / Português）单测：键合法性、缺键回落英文、auto 判定、一行化约束。
 */
import { afterEach, describe, expect, it } from "vitest";
import { __setMockLanguage } from "./obsidian-mock";
import {
	detectObsidianLang,
	getMessages,
	isLang,
	LANG_SELF_NAMES,
	PARTIAL_MESSAGES,
	resolveLang,
	withEnglishFallback,
} from "../../src/i18n";

const PARTIAL_LANGS = ["zh-TW", "ja", "es", "fr", "de", "ru", "ko", "pt-BR"] as const;

afterEach(() => {
	__setMockLanguage(() => "en");
});

describe("auto 判定", () => {
	const cases: Array<[string, string]> = [
		["zh-TW", "zh-TW"],
		["zh-tw", "zh-TW"],
		["zh_TW", "zh-TW"],
		["zh-HK", "zh-TW"],
		["zh-MO", "zh-TW"],
		["zh-Hant", "zh-TW"],
		["zh-Hant-TW", "zh-TW"],
		["zh", "zh"],
		["zh-CN", "zh"],
		["zh-Hans", "zh"],
		["ja", "ja"],
		["ja-JP", "ja"],
		["es", "es"],
		["es-419", "es"],
		["fr", "fr"],
		["fr-CA", "fr"],
		["de", "de"],
		["de-AT", "de"],
		["ru", "ru"],
		["ko", "ko"],
		["ko-KR", "ko"],
		["pt", "pt-BR"],
		["pt-BR", "pt-BR"],
		["pt_BR", "pt-BR"],
		["pt-PT", "pt-BR"],
		["dev", "en"],
		["it", "en"],
		["en", "en"],
	];
	it.each(cases)("getLanguage=%s → %s", (raw, expected) => {
		__setMockLanguage(() => raw);
		expect(detectObsidianLang()).toBe(expected);
		expect(resolveLang("auto")).toBe(expected);
	});

	it("显式选择优先于 Obsidian 语言；非法值走 auto", () => {
		__setMockLanguage(() => "ja");
		expect(resolveLang("zh-TW")).toBe("zh-TW");
		expect(resolveLang("en")).toBe("en");
		expect(resolveLang("xx" as never)).toBe("ja");
	});

	it("isLang 只认十种语言（含原型键也不误判）；下拉自称齐全", () => {
		for (const l of ["zh", "en", "zh-TW", "ja", "es", "fr", "de", "ru", "ko", "pt-BR"]) {
			expect(isLang(l)).toBe(true);
		}
		expect(isLang("auto")).toBe(false);
		expect(isLang("it")).toBe(false);
		expect(isLang("constructor")).toBe(false);
		expect(LANG_SELF_NAMES.es).toBe("Español");
		expect(LANG_SELF_NAMES.fr).toBe("Français");
		expect(LANG_SELF_NAMES.de).toBe("Deutsch");
		expect(LANG_SELF_NAMES.ru).toBe("Русский");
		expect(LANG_SELF_NAMES.ko).toBe("한국어");
		expect(LANG_SELF_NAMES["pt-BR"]).toBe("Português do Brasil");
		expect(LANG_SELF_NAMES["zh-TW"]).toBe("繁體中文");
		expect(LANG_SELF_NAMES.ja).toBe("日本語");
	});
});

describe("非完整语言：键合法 + 回落英文", () => {
	const en = getMessages("en") as unknown as Record<string, unknown>;

	for (const lang of PARTIAL_LANGS) {
		it(`${lang} 的键都是 Messages 的合法键（不多不错）、类型与英文一致`, () => {
			const partial = PARTIAL_MESSAGES[lang] as unknown as Record<string, unknown>;
			for (const [k, v] of Object.entries(partial)) {
				expect(Object.keys(en), `${lang}.${k} 不是合法键`).toContain(k);
				expect(typeof v, `${lang}.${k} 类型`).toBe(typeof en[k]);
				if (Array.isArray(en[k])) {
					expect((v as unknown[]).length, `${lang}.${k} 数组长度`).toBe(
						(en[k] as unknown[]).length,
					);
				}
			}
		});

		it(`${lang} 取用结果键集合与英文完全一致；已译键不同于英文`, () => {
			const m = getMessages(lang) as unknown as Record<string, unknown>;
			expect(Object.keys(m).sort()).toEqual(Object.keys(en).sort());
			expect(m.languageName).not.toBe(en.languageName);
		});
	}

	it("缺的键回落英文（模拟只翻一部分）", () => {
		const merged = withEnglishFallback({ tabGeneral: "X" });
		expect(merged.tabGeneral).toBe("X");
		expect(merged.cancel).toBe(getMessages("en").cancel);
		expect(merged.noticeNoChange).toBe(getMessages("en").noticeNoChange);
		expect(Object.keys(merged).sort()).toEqual(Object.keys(en).sort());
	});

	it("缺省键只能是语言无关项（语言自称 / 数字样式 / 纯格式化函数）", () => {
		const neutral = [
			"langEn",
			"langZh",
			"menuHandleLabel",
			"numeralArabic",
			"numeralCircled",
			"numeralLowerAlpha",
			"numeralLowerRoman",
			"numeralUpperAlpha",
			"numeralUpperRoman",
			"statusLabel",
		];
		const zhKeys = Object.keys(getMessages("zh") as unknown as Record<string, unknown>);
		for (const lang of PARTIAL_LANGS) {
			const missing = zhKeys.filter((k) => !(k in PARTIAL_MESSAGES[lang]));
			// numeralCjk 对 CJK 语言要译出，对拉丁 / 西里尔语言与英文相同可缺省。
			const allowed = ["zh-TW", "ja"].includes(lang) ? neutral : [...neutral, "numeralCjk"];
			expect(missing.sort(), lang).toEqual(allowed.sort());
		}
	});
});

describe("一行化：繁中 ≤ 32 字、日文 ≤ 56 字、韩文 ≤ 56 字、西 / 法 / 德 / 葡 / 俄 ≤ 100 字符", () => {
	const descKeys = [
		"languageDesc",
		"autoNumberDesc",
		"updateBacklinksDesc",
		"headingLinkSuggestDesc",
		"vcTargetDesc",
		"vcStaleDictDesc",
		"clearVaultDesc",
		"freezeVaultDesc",
	] as const;

	it.each([
		["zh-TW", 32],
		["ja", 56],
		["ko", 56],
		["es", 100],
		["fr", 100],
		["de", 100],
		["pt-BR", 100],
		["ru", 100],
	] as const)("%s 设置说明不超过 %i 字", (lang, limit) => {
		const m = getMessages(lang);
		const texts: Array<[string, string]> = descKeys.map((k) => [k, m[k]]);
		texts.push(["debounceDesc", m.debounceDesc(50, 2000, 300)]);
		for (const [key, text] of texts) {
			expect(Array.from(text).length, `${lang}.${key}`).toBeLessThanOrEqual(limit);
		}
	});

	it("新语言文案不含 Markdown 粗体标记", () => {
		for (const lang of PARTIAL_LANGS) {
			for (const [k, v] of Object.entries(
				getMessages(lang) as unknown as Record<string, unknown>,
			)) {
				if (typeof v === "string") {
					expect(v, `${lang}.${k}`).not.toContain("**");
				}
			}
		}
	});

	it("俄语复数：数量相关文案对 1 / 2 / 5 / 11 / 21 都能生成", () => {
		const ru = getMessages("ru");
		expect(ru.inheritLevels(1)).toContain("уровень");
		expect(ru.inheritLevels(2)).toContain("уровня");
		expect(ru.inheritLevels(5)).toContain("уровней");
		expect(ru.inheritLevels(11)).toContain("уровней");
		expect(ru.inheritLevels(21)).toContain("уровень");
	});
});
