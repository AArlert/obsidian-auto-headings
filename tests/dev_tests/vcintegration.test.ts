/**
 * M13 Various Complements 联动（vcintegration.ts）单测（对应 testplan Q 类逻辑部分：
 * Q10 未安装探测 / Q12 自动配置两条路径 / Q13 schema 校验失败整体放弃 / Q14 reload 兜底）。
 *
 * 全部用文件内联的最小假 app/adapter 对象（不需要扩展公用的 obsidian-mock.ts，
 * 参照方案 §8.1）。"obsidian" 在 vitest 下被别名为 obsidian-mock.ts（normalizePath 可用）。
 */
import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import {
	buildVcDictionaryJson,
	detectVcStatus,
	enableAutoIntegration,
	isValidVcSettingsShape,
	mergeDictionaryPath,
	tryReloadVcDictionaries,
	vcDictionaryPath,
} from "../../src/vcintegration";

/** 假 adapter：内存 Map 承载 data.json（及其他文件）。 */
function makeAdapter(initial?: Record<string, string>) {
	const files = new Map<string, string>(Object.entries(initial ?? {}));
	return {
		files,
		exists: vi.fn(async (p: string) => files.has(p)),
		read: vi.fn(async (p: string) => files.get(p) ?? ""),
		write: vi.fn(async (p: string, c: string) => {
			files.set(p, c);
		}),
	};
}

/** 假 app：vault.configDir + adapter + 可选 plugins 注册表 + 可选 commands。 */
function makeApp(
	opts: {
		installed?: boolean;
		enabled?: boolean;
		liveSettings?: unknown;
		liveSaveData?: (d: unknown) => Promise<void>;
		dataJson?: string;
		commands?: { executeCommandById?: (id: string) => boolean };
	} = {},
) {
	const adapter = makeAdapter(
		opts.dataJson !== undefined
			? { ".obsidian/plugins/various-complements/data.json": opts.dataJson }
			: undefined,
	);
	const app = {
		vault: { configDir: ".obsidian", adapter },
	} as unknown as App & {
		plugins?: {
			manifests?: Record<string, unknown>;
			plugins?: Record<string, unknown>;
		};
		commands?: { executeCommandById?: (id: string) => boolean };
		vault: { configDir: string; adapter: ReturnType<typeof makeAdapter> };
	};
	if (opts.installed) {
		app.plugins = {
			manifests: { "various-complements": { id: "various-complements" } },
			plugins: opts.enabled
				? {
						"various-complements": {
							settings: opts.liveSettings ?? {},
							saveData: opts.liveSaveData,
						},
					}
				: {},
		};
	}
	if (opts.commands) {
		app.commands = opts.commands;
	}
	return app;
}

const VC_DATA = ".obsidian/plugins/various-complements/data.json";
const DICT = "plugins/auto-headings/vc-heading-dictionary.json";

describe("mergeDictionaryPath：换行分隔字符串合并（最容易写错的一步）", () => {
	it("空值/空串：直接返回新路径", () => {
		expect(mergeDictionaryPath(undefined, "p1")).toBe("p1");
		expect(mergeDictionaryPath("", "p1")).toBe("p1");
		expect(mergeDictionaryPath("  ", "p1")).toBe("p1");
	});

	it("已有内容：追加新行、保留其余行格式", () => {
		expect(mergeDictionaryPath("p1", "p2")).toBe("p1\np2");
		expect(mergeDictionaryPath("p1\n", "p2")).toBe("p1\np2");
	});

	it("已存在：原样返回，不重复添加", () => {
		const base = "p1\np2";
		expect(mergeDictionaryPath(base, "p2")).toBe(base);
		expect(mergeDictionaryPath(base, "p1")).toBe(base);
	});

	it("已有行带空白：去重时按 trim 后比较，但写回保留原格式", () => {
		expect(mergeDictionaryPath(" p1 \np2", "p1")).toBe(" p1 \np2");
	});
});

describe("isValidVcSettingsShape：最小 schema 校验", () => {
	it("合法形状（含字段缺失）通过", () => {
		expect(isValidVcSettingsShape({})).toBe(true);
		expect(isValidVcSettingsShape({ customDictionaryPaths: "a\nb" })).toBe(true);
		expect(isValidVcSettingsShape({ enableCustomDictionaryComplement: true })).toBe(true);
		expect(
			isValidVcSettingsShape({
				customDictionaryPaths: "a",
				enableCustomDictionaryComplement: false,
				other: 1,
			}),
		).toBe(true);
	});

	it("字段类型不符判非法（存在才校验类型）", () => {
		expect(isValidVcSettingsShape({ customDictionaryPaths: 3 })).toBe(false);
		expect(isValidVcSettingsShape({ enableCustomDictionaryComplement: "yes" })).toBe(false);
		expect(
			isValidVcSettingsShape({ customDictionaryMinNumberOfCharactersForTrigger: "x" }),
		).toBe(false);
	});

	it("非对象（null / 字符串 / 数组）判非法", () => {
		expect(isValidVcSettingsShape(null)).toBe(false);
		expect(isValidVcSettingsShape("data")).toBe(false);
		expect(isValidVcSettingsShape([])).toBe(false);
	});
});

describe("buildVcDictionaryJson：词典内容（Q11/Q12 逻辑面）", () => {
	it("顶层 words 数组（VC 当前版本要求的 JsonDictionary 形状），每条为 value（完整链接）+ displayed（干净原文）", () => {
		const wj = "\u2060";
		const out = buildVcDictionaryJson([
			{
				path: "a.md",
				basename: "a",
				level: 2,
				lineIndex: 0,
				displayText: "交叉矩阵",
				matchKey: "交叉矩阵",
				anchor: `1.1 ${wj}交叉矩阵`,
			},
			{
				path: "b.md",
				basename: "b",
				level: 1,
				lineIndex: 0,
				displayText: "引言",
				matchKey: "引言",
				anchor: "引言",
			},
		]);
		expect(out.total).toBe(2);
		expect(out.truncated).toBe(false);
		const parsed = JSON.parse(out.json) as {
			words: Array<{ value: string; displayed: string }>;
		};
		// 关键：顶层必须是 words 数组（裸数组会让 VC 解析抛错、整个词典加载失败，用户实测 #5 根因）
		expect(parsed.words).toEqual([
			{ value: `[[a#1.1 ${wj}交叉矩阵|交叉矩阵]]`, displayed: "交叉矩阵" },
			{ value: "[[b#引言|引言]]", displayed: "引言" },
		]);
	});

	it("超过 MAX_VC_DICTIONARY_ENTRIES（20,000）时截断并置 truncated", () => {
		const entries = Array.from({ length: 20001 }, (_, i) => ({
			path: `f${i}.md`,
			basename: `f${i}`,
			level: 1,
			lineIndex: 0,
			displayText: `标题${i}`,
			matchKey: `标题${i}`,
			anchor: `标题${i}`,
		}));
		const out = buildVcDictionaryJson(entries);
		expect(out.total).toBe(20001);
		expect(out.truncated).toBe(true);
		const parsed = JSON.parse(out.json) as { words: unknown[] };
		expect(parsed.words).toHaveLength(20000);
	});
});

describe("vcDictionaryPath：词典文件固定落在插件目录下", () => {
	it("拼接并规范化路径", () => {
		expect(vcDictionaryPath("plugins/auto-headings")).toBe(
			"plugins/auto-headings/vc-heading-dictionary.json",
		);
	});
});

describe("detectVcStatus：安装/启用探测", () => {
	it("未安装 → not-installed", () => {
		expect(detectVcStatus(makeApp())).toBe("not-installed");
	});

	it("已安装未启用 → disabled", () => {
		expect(detectVcStatus(makeApp({ installed: true }))).toBe("disabled");
	});

	it("已安装且启用 → enabled", () => {
		expect(detectVcStatus(makeApp({ installed: true, enabled: true }))).toBe("enabled");
	});
});

describe("enableAutoIntegration：分层防御编排（Q12/Q13/Q10 逻辑面）", () => {
	it("Layer 1 活体实例：改内存 settings + saveData，不碰文件（Q12 主路径）", async () => {
		const saveData = vi.fn(async () => {});
		const liveSettings: Record<string, unknown> = { other: 1 };
		const app = makeApp({
			installed: true,
			enabled: true,
			liveSettings,
			liveSaveData: saveData,
		});
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "ok", via: "live-instance" });
		expect(liveSettings.customDictionaryPaths).toBe(DICT);
		expect(liveSettings.enableCustomDictionaryComplement).toBe(true);
		expect(liveSettings.customDictionaryMinNumberOfCharactersForTrigger).toBe(1); // 触发阈值放宽到 1 字符
		expect(liveSettings.other).toBe(1); // 其余字段原样保留
		expect(saveData).toHaveBeenCalledOnce();
		expect(app.vault.adapter.write).not.toHaveBeenCalled(); // 未走文件路径
	});

	it("触发阈值已是 1：保持不动（用户显式设置优先）", async () => {
		const saveData = vi.fn(async () => {});
		const liveSettings: Record<string, unknown> = {
			customDictionaryMinNumberOfCharactersForTrigger: 1,
		};
		const app = makeApp({
			installed: true,
			enabled: true,
			liveSettings,
			liveSaveData: saveData,
		});
		await enableAutoIntegration(app, DICT);
		expect(liveSettings.customDictionaryMinNumberOfCharactersForTrigger).toBe(1);
	});

	it("Layer 1 已存在路径：不重复添加", async () => {
		const saveData = vi.fn(async () => {});
		const app = makeApp({
			installed: true,
			enabled: true,
			liveSettings: {
				customDictionaryPaths: `p0\n${DICT}`,
				enableCustomDictionaryComplement: false,
			},
			liveSaveData: saveData,
		});
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "ok", via: "live-instance" });
		expect(
			(
				app.plugins?.plugins?.["various-complements"] as {
					settings: { customDictionaryPaths: string };
				}
			).settings.customDictionaryPaths,
		).toBe(`p0\n${DICT}`);
	});

	it("VC 未启用：退化为 Layer 2 文件级读改写，其余字段原样透传（Q12 兜底路径）", async () => {
		const app = makeApp({
			installed: true,
			dataJson: JSON.stringify(
				{ customDictionaryPaths: "p0", other: { keep: 1 } },
				null,
				"\t",
			),
		});
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "ok", via: "adapter-file" });
		const written = JSON.parse(app.vault.adapter.files.get(VC_DATA) ?? "{}") as Record<
			string,
			unknown
		>;
		expect(written.customDictionaryPaths).toBe(`p0\n${DICT}`);
		expect(written.enableCustomDictionaryComplement).toBe(true);
		expect(written.customDictionaryMinNumberOfCharactersForTrigger).toBe(1);
		expect(written.other).toEqual({ keep: 1 }); // 关键约束：绝不重建对象吞掉其余配置
	});

	it("活体实例可用但缺 saveData（形状不符）：继续尝试 Layer 2", async () => {
		const app = makeApp({
			installed: true,
			enabled: true,
			liveSettings: {},
			liveSaveData: undefined,
			dataJson: JSON.stringify({}),
		});
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "ok", via: "adapter-file" });
	});

	it("未安装：整体放弃，不写任何文件（Q10 逻辑面）", async () => {
		const app = makeApp();
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "not-installed" });
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
	});

	it("已安装未启用且无 data.json：disabled-and-no-file", async () => {
		const app = makeApp({ installed: true });
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "disabled-and-no-file" });
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
	});

	it("Layer 1 形状非法：整体放弃，不再尝试 Layer 2、不写文件（Q13 逻辑面）", async () => {
		const app = makeApp({
			installed: true,
			enabled: true,
			liveSettings: { customDictionaryPaths: 42 }, // 类型不符
			liveSaveData: vi.fn(async () => {}),
			dataJson: JSON.stringify({}),
		});
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "invalid-shape" });
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
		expect(app.vault.adapter.read).not.toHaveBeenCalled();
	});

	it("Layer 2 data.json 不是合法 JSON：invalid-shape，不写坏文件", async () => {
		const app = makeApp({ installed: true, dataJson: "{broken json" });
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "invalid-shape" });
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
		expect(app.vault.adapter.files.get(VC_DATA)).toBe("{broken json"); // 原文件未被触碰
	});

	it("Layer 2 字段类型不符：invalid-shape，不写坏文件", async () => {
		const app = makeApp({
			installed: true,
			dataJson: JSON.stringify({ customDictionaryPaths: 7 }),
		});
		const result = await enableAutoIntegration(app, DICT);
		expect(result).toEqual({ outcome: "invalid-shape" });
		expect(app.vault.adapter.write).not.toHaveBeenCalled();
	});
});

describe("tryReloadVcDictionaries：reload 命令调用与兜底（Q14 逻辑面）", () => {
	it("命令可用且返回 true", async () => {
		const executeCommandById = vi.fn(() => true);
		const app = makeApp({ commands: { executeCommandById } });
		expect(await tryReloadVcDictionaries(app)).toBe(true);
		expect(executeCommandById).toHaveBeenCalledWith(
			"various-complements:reload-custom-dictionaries",
		);
	});

	it("命令注册表缺失：返回 false", async () => {
		expect(await tryReloadVcDictionaries(makeApp())).toBe(false);
	});

	it("命令调用抛异常：捕获并返回 false", async () => {
		const app = makeApp({
			commands: {
				executeCommandById: () => {
					throw new Error("boom");
				},
			},
		});
		expect(await tryReloadVcDictionaries(app)).toBe(false);
	});
});
