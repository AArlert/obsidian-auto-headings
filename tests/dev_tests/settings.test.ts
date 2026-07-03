import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, clampDebounceDelay, defaultPathRules } from "../../src/settings/model";

describe("DEFAULT_SETTINGS", () => {
	it("默认开启全局自动编号", () => {
		expect(DEFAULT_SETTINGS.autoNumber).toBe(true);
	});

	it("默认防抖延迟为 300ms 且在合法范围内", () => {
		expect(DEFAULT_SETTINGS.debounceDelay).toBe(300);
		expect(clampDebounceDelay(DEFAULT_SETTINGS.debounceDelay)).toBe(300);
	});

	it("默认预置一条 / 根规则指向「默认」模板", () => {
		expect(DEFAULT_SETTINGS.pathRules).toEqual([{ pattern: "/", template: "默认" }]);
		// defaultPathRules 每次返回独立数组，避免共享引用被意外改写。
		expect(defaultPathRules()).not.toBe(DEFAULT_SETTINGS.pathRules);
	});

	it("默认语言为 auto（跟随 Obsidian 界面语言）", () => {
		expect(DEFAULT_SETTINGS.language).toBe("auto");
	});
});

describe("Backlink 同步默认值（0.7.11 曝光度决策）", () => {
	it("默认开启（1.0 头牌卖点；显式设 false 的用户不受影响，见 main.loadSettings）", () => {
		expect(DEFAULT_SETTINGS.updateBacklinks).toBe(true);
	});

	it("首次说明 Notice 默认未弹过", () => {
		expect(DEFAULT_SETTINGS.backlinksIntroShown).toBe(false);
	});
});
