import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import AutoHeadingsPlugin from "../../src/main";
import {
	DEFAULT_SETTINGS,
	clampDebounceDelay,
	defaultPathRules,
	freshInstallPathRules,
} from "../../src/settings/model";

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

	it("新装规则与默认规则只差根规则的 mode（M14）", () => {
		expect(freshInstallPathRules()).toEqual([
			{ pattern: "/", template: "默认", mode: "virtual" },
		]);
		expect(freshInstallPathRules()).not.toBe(freshInstallPathRules());
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

/**
 * M14 新装判据（spec §3.22「新装与升级」，testplan V1–V6）：走真实的 `loadSettings`，
 * 用假 adapter 模拟插件目录下 templates/ 在不在。
 */
describe("M14：新装默认仅显示，升级保持写入", () => {
	function makeLoadable(data: unknown, hasTemplatesDir: boolean) {
		const PluginCtor = AutoHeadingsPlugin as unknown as new (
			app: unknown,
			manifest: unknown,
		) => AutoHeadingsPlugin;
		const exists = vi.fn(
			async (p: string) => hasTemplatesDir && p === "plugins/auto-headings/templates",
		);
		const app = { vault: { configDir: ".obsidian", adapter: { exists } } };
		const plugin = new PluginCtor(app, { id: "auto-headings", dir: "plugins/auto-headings" });
		const saveData = vi.fn(async () => {});
		const host = plugin as unknown as {
			loadData(): Promise<unknown>;
			saveData(d: unknown): Promise<void>;
		};
		host.loadData = async () => data;
		host.saveData = saveData;
		return { plugin, exists, saveData };
	}

	it("V1：无 data.json 且无 templates/ → 根规则为仅显示", async () => {
		const { plugin } = makeLoadable(undefined, false);
		await plugin.loadSettings();
		expect(plugin.settings.pathRules).toEqual([
			{ pattern: "/", template: "默认", mode: "virtual" },
		]);
	});

	it("V2：无 data.json 但已有 templates/（老用户从没改过设置）→ 视为升级，保持写入", async () => {
		const { plugin } = makeLoadable(undefined, true);
		await plugin.loadSettings();
		expect(plugin.settings.pathRules).toEqual([{ pattern: "/", template: "默认" }]);
	});

	it("V3：有 data.json 的老用户不探测目录，规则原样（缺省 mode = 写入），非法 mode 被删", async () => {
		const { plugin, exists } = makeLoadable(
			{ pathRules: [{ pattern: "/", template: "默认", mode: "bogus" }] },
			false,
		);
		await plugin.loadSettings();
		expect(exists).not.toHaveBeenCalled();
		expect(plugin.settings.pathRules).toEqual([{ pattern: "/", template: "默认" }]);
	});

	it("V3：探测目录失败时按升级处理（宁可保持老行为）", async () => {
		const { plugin, exists } = makeLoadable(undefined, false);
		exists.mockRejectedValueOnce(new Error("io"));
		await plugin.loadSettings();
		expect(plugin.settings.pathRules).toEqual([{ pattern: "/", template: "默认" }]);
	});

	it("V4：新装分支只改内存，loadSettings 不落盘", async () => {
		const { plugin, saveData } = makeLoadable(undefined, false);
		await plugin.loadSettings();
		expect(saveData).not.toHaveBeenCalled();
	});

	it("V6：data.json 被同步改写后 onExternalSettingsChange 重新载入真实配置", async () => {
		const { plugin } = makeLoadable(undefined, false);
		await plugin.loadSettings();
		expect(plugin.settings.pathRules[0].mode).toBe("virtual"); // 同步到位前被误判为新装。
		(plugin as unknown as { loadData(): Promise<unknown> }).loadData = async () => ({
			pathRules: [{ pattern: "/", template: "默认" }],
		});
		await plugin.onExternalSettingsChange();
		expect(plugin.settings.pathRules).toEqual([{ pattern: "/", template: "默认" }]);
	});

	it("V5：onload 里 loadSettings 先于 templateStore.init（否则新装判据永远失效）", () => {
		const src = readFileSync(
			fileURLToPath(new URL("../../src/main.ts", import.meta.url)),
			"utf8",
		);
		const onload = src.slice(src.indexOf("async onload()"));
		const load = onload.indexOf("await this.loadSettings()");
		const init = onload.indexOf("await this.templateStore.init()");
		expect(load).toBeGreaterThan(-1);
		expect(init).toBeGreaterThan(-1);
		expect(load).toBeLessThan(init);
	});
});
