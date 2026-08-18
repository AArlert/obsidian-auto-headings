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
	disambiguateVcDisplayed,
	enableAutoIntegration,
	isValidVcSettingsShape,
	mergeDictionaryPath,
	shouldYieldSuggestToVc,
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
		expect(isValidVcSettingsShape({ displayedTextSuffix: 1 })).toBe(false);
	});

	it("displayedTextSuffix 为字符串（含空串）时合法（1.0.32 新增字段）", () => {
		expect(isValidVcSettingsShape({ displayedTextSuffix: " => ..." })).toBe(true);
		expect(isValidVcSettingsShape({ displayedTextSuffix: "" })).toBe(true);
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
			words: Array<{ value: string; displayed: string; description: string }>;
		};
		// 关键：顶层必须是 words 数组（裸数组会让 VC 解析抛错、整个词典加载失败，用户实测 #5 根因）
		// description = 来源路径：VC 把它渲染成条目第二行小字（1.0.32，与本插件建议框两行观感对齐）
		expect(parsed.words).toEqual([
			{
				value: `[[a#1.1 ${wj}交叉矩阵|交叉矩阵]]`,
				displayed: "交叉矩阵",
				description: "a.md",
			},
			{ value: "[[b#引言|引言]]", displayed: "引言", description: "b.md" },
		]);
	});

	it("同名标题：value 各指各的文件，displayed 带区分后缀（否则 VC 会去重掉一条，Q25）", () => {
		const out = buildVcDictionaryJson([
			{
				path: "axi.md",
				basename: "axi",
				level: 2,
				lineIndex: 0,
				displayText: "交叉矩阵",
				matchKey: "交叉矩阵",
				anchor: "交叉矩阵",
			},
			{
				path: "交叉矩阵.md",
				basename: "交叉矩阵",
				level: 2,
				lineIndex: 0,
				displayText: "交叉矩阵",
				matchKey: "交叉矩阵",
				anchor: "交叉矩阵",
			},
		]);
		const parsed = JSON.parse(out.json) as {
			words: Array<{ value: string; displayed: string; description: string }>;
		};
		expect(parsed.words.map((w) => w.displayed)).toEqual([
			"交叉矩阵 (axi)",
			"交叉矩阵 (交叉矩阵)",
		]);
		// 接受后插入的仍是各自正确的链接，消歧只影响“显示/匹配”文本
		expect(parsed.words.map((w) => w.value)).toEqual([
			"[[axi#交叉矩阵|交叉矩阵]]",
			"[[交叉矩阵#交叉矩阵|交叉矩阵]]",
		]);
		expect(parsed.words.map((w) => w.description)).toEqual(["axi.md", "交叉矩阵.md"]);
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
		expect(liveSettings.displayedTextSuffix).toBe(""); // 1.0.32：清空「 => ...」显示后缀
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

	it("displayedTextSuffix 已是空串：保持不动（不做无谓写入）", async () => {
		const saveData = vi.fn(async () => {});
		const liveSettings: Record<string, unknown> = { displayedTextSuffix: "" };
		const app = makeApp({
			installed: true,
			enabled: true,
			liveSettings,
			liveSaveData: saveData,
		});
		await enableAutoIntegration(app, DICT);
		expect(liveSettings.displayedTextSuffix).toBe("");
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

describe("shouldYieldSuggestToVc：建议框共存策略（Q23；1.0.31 补第三个条件）", () => {
	it("让路 + VC 已启用 + 词典联动开着：放弃触发，把唯一的弹框位置交给 VC", () => {
		expect(shouldYieldSuggestToVc("yield", "enabled", "manual")).toBe(true);
		expect(shouldYieldSuggestToVc("yield", "enabled", "auto")).toBe(true);
	});

	it("让路 + VC 已启用，但词典联动关着：**不让路**——VC 词典里没有标题条目，让了就什么都看不到（1.0.31 死角修复，用户实测撞上）", () => {
		expect(shouldYieldSuggestToVc("yield", "enabled", "off")).toBe(false);
	});

	it("让路模式但 VC 未安装 / 已禁用：没有竞争者，照常弹自己的框", () => {
		expect(shouldYieldSuggestToVc("yield", "not-installed", "auto")).toBe(false);
		expect(shouldYieldSuggestToVc("yield", "disabled", "auto")).toBe(false);
	});

	it("本插件优先模式：无论 VC 状态与联动模式都不让路（1.0.28 及以前的行为）", () => {
		expect(shouldYieldSuggestToVc("own", "enabled", "auto")).toBe(false);
		expect(shouldYieldSuggestToVc("own", "enabled", "off")).toBe(false);
		expect(shouldYieldSuggestToVc("own", "disabled", "manual")).toBe(false);
		expect(shouldYieldSuggestToVc("own", "not-installed", "off")).toBe(false);
	});
});

describe("disambiguateVcDisplayed：同名标题消歧（Q25，1.0.32）", () => {
	/** 只有本函数关心的三个字段，其余给占位值。 */
	const e = (path: string, displayText: string) => ({
		path,
		basename: path.split("/").pop()?.replace(/\.md$/i, "") ?? path,
		level: 2,
		lineIndex: 0,
		displayText,
		matchKey: displayText,
		anchor: displayText,
	});

	it("标题全库唯一：保持纯净，不加任何后缀（绝大多数条目）", () => {
		expect(disambiguateVcDisplayed([e("a.md", "引言"), e("b.md", "总结")])).toEqual([
			"引言",
			"总结",
		]);
	});

	it("跨文件同名：各自带上文件名——这是 VC 按显示文本去重时唯一能保住两条的办法", () => {
		expect(
			disambiguateVcDisplayed([e("axi.md", "交叉矩阵"), e("交叉矩阵.md", "交叉矩阵")]),
		).toEqual(["交叉矩阵 (axi)", "交叉矩阵 (交叉矩阵)"]);
	});

	it("不同目录下的同名文件：文件名仍撞，退到去掉 .md 的完整路径", () => {
		expect(disambiguateVcDisplayed([e("x/同.md", "标题"), e("y/同.md", "标题")])).toEqual([
			"标题 (x/同)",
			"标题 (y/同)",
		]);
	});

	it("同一文件里两个同名标题：最具体的候选后面挂序号", () => {
		expect(disambiguateVcDisplayed([e("a.md", "小结"), e("a.md", "小结")])).toEqual([
			"小结 (a)",
			"小结 (a) #2",
		]);
	});

	it("某标题原文恰好长得像消歧后的形态：不与之撞车", () => {
		// 真有一个标题就叫「交叉矩阵 (axi)」，消歧结果必须避开它。
		const out = disambiguateVcDisplayed([
			e("axi.md", "交叉矩阵"),
			e("交叉矩阵.md", "交叉矩阵"),
			e("c.md", "交叉矩阵 (axi)"),
		]);
		expect(out[2]).toBe("交叉矩阵 (axi)"); // 唯一标题保持纯净
		expect(new Set(out).size).toBe(3); // 三条互不相同 => VC 不会去重掉任何一条
		expect(out[0]).not.toBe("交叉矩阵 (axi)");
	});

	it("确定性：同一输入两次调用输出一致（保证内容未变时不重写词典文件）", () => {
		const input = [e("axi.md", "交叉矩阵"), e("交叉矩阵.md", "交叉矩阵"), e("b.md", "引言")];
		expect(disambiguateVcDisplayed(input)).toEqual(disambiguateVcDisplayed(input));
	});
});
