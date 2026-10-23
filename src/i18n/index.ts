/**
 * 国际化（i18n，Milestone 6）：设置面板、命令名与 Notice 的**中英双语**文案。
 *
 * 设计：
 * - {@link Lang} 含 `zh` / `en`（完整基准）与其余 8 种（`Partial<Messages>`，缺键回落英文）；
 *   用户可在设置里选「自动 / 各语言」（{@link LangSetting}），「自动」由 {@link detectObsidianLang}
 *   跟随 Obsidian 界面语言。
 * - {@link Messages} 是**全部文案**的扁平接口：纯字符串直接给值，需插值的（如范围、计数）给函数。
 *   两套实现 {@link zh} / {@link en} 形状完全一致，由 TypeScript 保证不漏键。
 * - 文案是**界面字符串**，不翻译用户数据（模板名「默认」、白名单词条等保持原样）。
 *
 * 仓库守则要求注释 / 文档用简体中文；面向用户的字符串则按所选语言呈现，故本文件**同时**含中英文案。
 */

import { getLanguage } from "obsidian";
import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import ja from "./ja";
import ko from "./ko";
import ptBR from "./pt-BR";
import ru from "./ru";
import type { Lang, Messages, PartialLang } from "./types";
import zh from "./zh";
import zhTW from "./zh-TW";

export type { Lang, Messages, PartialLang } from "./types";

/** 语言下拉里各语言的自称（不随界面语言变化，便于读不懂当前界面的用户找回）。 */
export const LANG_SELF_NAMES: Record<Lang, string> = {
	zh: "中文",
	"zh-TW": "繁體中文",
	ja: "日本語",
	es: "Español",
	fr: "Français",
	de: "Deutsch",
	ru: "Русский",
	ko: "한국어",
	"pt-BR": "Português do Brasil",
	en: "English",
};

/** 判断任意值是否为合法的 {@link Lang}。 */
export function isLang(v: unknown): v is Lang {
	return typeof v === "string" && Object.prototype.hasOwnProperty.call(LANG_SELF_NAMES, v);
}

/** 语言设置项：`auto` 跟随 Obsidian 界面语言，其余为显式锁定。 */
export type LangSetting = "auto" | Lang;

/** 语言设置的默认值：自动（跟随 Obsidian）。 */
export const DEFAULT_LANG_SETTING: LangSetting = "auto";

/**
 * 探测 Obsidian 的界面语言：走官方 {@link getLanguage}（1.8.7+，返回如 `en` / `zh` / `zh-TW` / `ja`）。
 * 判定：`zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant*` → 繁体；其余 `zh*` → 简体；`ja` / `es` / `fr` / `de` / `ru` / `ko`
 * 前缀 → 对应语言；`pt*` → pt-BR；其余一律英文。
 * 调用失败（受限 / 异常环境）时回退英文（与 Obsidian 默认界面一致）。
 */
export function detectObsidianLang(): Lang {
	try {
		const raw = getLanguage().toLowerCase().replace(/_/g, "-");
		if (raw.startsWith("zh")) {
			return /^zh-(tw|hk|mo|hant)/.test(raw) ? "zh-TW" : "zh";
		}
		const m = /^(ja|es|fr|de|ru|ko|pt)(-|$)/.exec(raw);
		if (!m) {
			return "en";
		}
		return m[1] === "pt" ? "pt-BR" : (m[1] as Lang);
	} catch {
		return "en";
	}
}

/** 将语言设置解析为具体语言：显式语言原样返回；`auto`/缺失/非法走 {@link detectObsidianLang}。 */
export function resolveLang(setting: LangSetting | undefined): Lang {
	if (isLang(setting)) {
		return setting;
	}
	return detectObsidianLang();
}
/** 取某语言的文案表。 */
export function getMessages(lang: Lang): Messages {
	if (lang === "en") {
		return en;
	}
	if (lang === "zh") {
		return zh;
	}
	return mergedCache[lang];
}

/** 把只翻了一部分的文案表与英文合并：缺的键回落英文。 */
export function withEnglishFallback(partial: Partial<Messages>): Messages {
	return { ...en, ...partial };
}

/** 非完整语言的翻译表（缺键回落英文）；社区可只翻一部分后提 PR。 */
export const PARTIAL_MESSAGES: Record<PartialLang, Partial<Messages>> = {
	"zh-TW": zhTW,
	ja,
	es,
	fr,
	de,
	ru,
	ko,
	"pt-BR": ptBR,
};

const mergedCache = Object.fromEntries(
	Object.entries(PARTIAL_MESSAGES).map(([lang, partial]) => [lang, withEnglishFallback(partial)]),
) as Record<PartialLang, Messages>;
