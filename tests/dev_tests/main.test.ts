/**
 * Layer 2 集成测试：`main.ts` 的**触发层**（防抖 / 单一事务写回 / 双层开关 + frontmatter 门控 /
 * 自动 vs 手动两条生效路径 / 按路径解析模板 / 设置面板改模板后即时重排）。
 *
 * 经 `vitest.config.ts` 的 `obsidian` 别名（→ `obsidian-mock.ts`）加载真正的 `AutoHeadingsPlugin`，
 * 用一个**假编辑器**（记录事务次数 + 应用整行替换）和 **vitest 假定时器**驱动其触发方法，断言可观察行为。
 *
 * 对应 doc/testplan.md **J 类**（J1–J5、J7）与 **I 类**（I1/I2/I3/I4/I6/I7：双层开关 + frontmatter
 * ON 强制 + 手动绕过 + 无路径规则命中）。`window.setTimeout` 由 `globalThis.window = globalThis` +
 * 假定时器提供（源码用 `window.setTimeout` 调度防抖）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AutoHeadingsPlugin from "../../src/main";
import { DEFAULT_TEMPLATE, WORD_JOINER, type Template } from "../../src/numbering";
import type { PathRule } from "../../src/pathrules";
import { Notice, TFile as MockTFile } from "./obsidian-mock";

/** 假编辑器：持有按行切分的文本，记录 `transaction` 调用次数（用于「单一事务」断言）。 */
class FakeEditor {
	private lines: string[];
	/** `transaction` 被调用的次数。一次完整重排应只产生 **1** 次事务。 */
	txnCount = 0;

	constructor(text: string) {
		this.lines = text.split("\n");
	}

	getValue(): string {
		return this.lines.join("\n");
	}

	/** 模拟**用户**编辑（直接替换全文，不计入插件事务数）。 */
	setValue(text: string): void {
		this.lines = text.split("\n");
	}

	/** main.ts 的整文重排永不增删行，每个 change 都是「整行替换」（from.ch=0 → 旧行长度）。 */
	transaction(tx: {
		changes: Array<{ from: { line: number; ch: number }; to: unknown; text: string }>;
	}): void {
		this.txnCount++;
		for (const c of tx.changes) {
			this.lines[c.from.line] = c.text;
		}
	}
}

/** 被测插件的内部/私有面（运行时存在，TS 私有不阻止访问）。 */
interface PluginInternals {
	settings: {
		autoNumber: boolean;
		debounceDelay: number;
		pathRules: PathRule[];
		language: "auto" | "zh" | "en";
		updateBacklinks: boolean;
		backlinksIntroShown?: boolean;
	};
	templateStore: {
		getDefault(): Template;
		all(): Template[];
		get(name: string): Template | undefined;
		has(name: string): boolean;
	};
	getTemplateForFile(path: string | undefined | null): Template | null;
	scheduleRenumber(editor: unknown, info: unknown): void;
	runImmediateRenumber(editor: unknown, ctx: unknown): void;
	strippableAffixes(): { prefixes: string[]; suffixes: string[] };
	renumberActiveFile(): void;
	renumberOnOpen(file: { path: string }): void;
	clearAllVaultNumbering(): Promise<void>;
	onunload(): void;
}

/** 以 H2 中文样式覆盖默认模板（用于「改模板后即时重排」）。 */
function cjkTemplate(): Template {
	return {
		...DEFAULT_TEMPLATE,
		levels: {
			...DEFAULT_TEMPLATE.levels,
			h2: { ...DEFAULT_TEMPLATE.levels.h2, numeral: "cjk" },
		},
	};
}

/** 以 H2 带圈样式覆盖默认模板（用于「改样式后已编号刷新」回归）。 */
function circledTemplate(): Template {
	return {
		...DEFAULT_TEMPLATE,
		levels: {
			...DEFAULT_TEMPLATE.levels,
			h2: { ...DEFAULT_TEMPLATE.levels.h2, numeral: "circled" },
		},
	};
}

/** 以 H2 前缀「第」覆盖默认模板（用于「全模板前后缀并集」接线）。 */
function prefixTemplate(): Template {
	return {
		...DEFAULT_TEMPLATE,
		name: "带前缀",
		levels: {
			...DEFAULT_TEMPLATE.levels,
			h2: { ...DEFAULT_TEMPLATE.levels.h2, prefix: "第" },
		},
	};
}

const defaultRules: PathRule[] = [{ pattern: "/", template: "默认" }];

function makePlugin(
	opts: {
		autoNumber?: boolean;
		delay?: number;
		allTemplates?: Template[];
		pathRules?: PathRule[];
		updateBacklinks?: boolean;
		/** 假「其它文件」库：path → 内容，供 Backlink 同步反查 / 写回。 */
		vaultFiles?: Record<string, string>;
		/**
		 * 真实 `getBacklinksForFile` 在「本文件自身含指向自己标题的 `[[#锚点]]` 链接」时，反查结果
		 * 也会把本文件自己列为一个 sourcePath（见 spec.md §3.12「同文件内链」）。默认 mock 会排除
		 * 目标自身（历史上只测「别的文件」），置 true 时改为**包含**目标自身，用于回归自链接场景。
		 */
		selfBacklink?: boolean;
	} = {},
) {
	const tplBox = { current: DEFAULT_TEMPLATE };
	let activeView: { editor: FakeEditor; file?: { path: string } } | null = null;
	// renumberActiveFile 现遍历 getLeavesOfType("markdown")（修设置面板打开时活动视图为 null 的 bug）。
	let leaves: Array<{ view: { editor: FakeEditor; file?: { path: string } } }> = [];
	const templates = () => opts.allTemplates ?? [tplBox.current];
	// 假 vault：getAbstractFileByPath 返回 mock TFile 实例（main.ts 用 instanceof TFile 收窄，
	// 对象字面量会被判为「非文件」跳过），process 读改写回内存。
	const vaultFiles = new Map<string, string>(Object.entries(opts.vaultFiles ?? {}));
	const fileBasename = (p: string) => (p.split("/").pop() ?? p).replace(/\.md$/i, "");
	const makeTFile = (p: string) =>
		Object.assign(new MockTFile(), { path: p, basename: fileBasename(p) });
	const vault = {
		getAbstractFileByPath: (p: string) => (vaultFiles.has(p) ? makeTFile(p) : null),
		process: async (file: { path: string }, fn: (c: string) => string) => {
			const next = fn(vaultFiles.get(file.path) ?? "");
			vaultFiles.set(file.path, next);
			return next;
		},
		// 清除全库编号（敏感操作 TAB）用到的三个最小接口。
		getMarkdownFiles: () =>
			[...vaultFiles.keys()].map((p) => ({ path: p, basename: fileBasename(p) })),
		read: async (file: { path: string }) => vaultFiles.get(file.path) ?? "",
		modify: async (file: { path: string }, content: string) => {
			vaultFiles.set(file.path, content);
		},
	};
	// 假 metadataCache：getBacklinksForFile 返回 { data: Map(sourcePath → []) }，
	// 列出除目标外的全部假文件（rewrite 对不含匹配链接者自然 no-op）。
	const metadataCache = {
		getBacklinksForFile: (target: { path: string }) => {
			const sources = [...vaultFiles.keys()].filter((p) => p !== target.path);
			if (opts.selfBacklink) {
				sources.push(target.path);
			}
			return { data: new Map(sources.map((p) => [p, []])) };
		},
	};
	const app = {
		workspace: {
			getActiveViewOfType: (
				_cls: unknown,
			): { editor: FakeEditor; file?: { path: string } } | null => activeView,
			getLeavesOfType: (_type: string) => leaves,
		},
		vault,
		metadataCache,
	};
	const PluginCtor = AutoHeadingsPlugin as unknown as new (
		app: unknown,
		manifest: unknown,
	) => AutoHeadingsPlugin;
	const plugin = new PluginCtor(app, { id: "auto-headings", dir: "plugins/auto-headings" });
	const p = plugin as unknown as PluginInternals;
	p.settings = {
		autoNumber: opts.autoNumber ?? true,
		debounceDelay: opts.delay ?? 300,
		pathRules: opts.pathRules ?? [...defaultRules],
		// 锁定中文，使 Notice 断言（本测试用中文文案）稳定，不受运行环境 Obsidian 语言探测影响。
		language: "zh",
		updateBacklinks: opts.updateBacklinks ?? false,
	};
	p.templateStore = {
		getDefault: () => tplBox.current,
		all: () => templates(),
		// 「默认」恒映射到当前活动模板；其它名按 allTemplates 查找。
		get: (name: string) =>
			name === "默认" ? tplBox.current : templates().find((t) => t.name === name),
		has: (name: string) => name === "默认" || templates().some((t) => t.name === name),
	};
	return {
		p,
		vaultFiles,
		setTemplate: (t: Template) => {
			tplBox.current = t;
		},
		setActiveView: (v: { editor: FakeEditor; file?: { path: string } } | null) => {
			activeView = v;
			// 设置面板的「改模板即时重排」走 getLeavesOfType；单文件场景下叶子即活动视图。
			leaves = v ? [{ view: v }] : [];
		},
		setLeaves: (vs: Array<{ editor: FakeEditor; file?: { path: string } }>) => {
			leaves = vs.map((view) => ({ view }));
		},
	};
}

/** 排空微任务队列（Backlink 同步是 fire-and-forget 的异步 vault.process，需 flush 后断言）。 */
async function flushPromises(): Promise<void> {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

const fileInfo = (path: string) => ({ file: { path } });

beforeEach(() => {
	(globalThis as unknown as { window: unknown }).window = globalThis;
	vi.useFakeTimers();
	Notice.messages.length = 0;
});

afterEach(() => {
	vi.useRealTimers();
});

describe("scheduleRenumber：写回、单一事务、幂等与 frontmatter / 双层开关门控", () => {
	it("自动触发对未编号内容写回正确编号，且只发起一次事务（J4）", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor(["# 文档", "## 章", "### 节", "## 章二"].join("\n"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe(
			[
				`# 文档`,
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
				`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
				`## ${WORD_JOINER}2 ${WORD_JOINER}章二`,
			].join("\n"),
		);
		// 多行改动合并为一次事务（一次撤销即可回退整次重排）。
		expect(ed.txnCount).toBe(1);
	});

	it("内容已是正确编号时不改动、不发起事务（幂等）", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
	});

	it("frontmatter 显式 false：自动触发跳过、不改动（I2）", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor(
			["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n"),
		);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toContain("## 章");
		expect(ed.getValue()).not.toContain("## 1 章");
		expect(ed.txnCount).toBe(0);
	});

	it("frontmatter 非 OFF（缺省）：照常编号（I1）", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor(["---", "title: 笔记", "---", "## 章"].join("\n"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toContain(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
	});

	it("J8：IME 组合中防抖到点不写回、顺延一个周期，compositionend 后正常写回", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor("## 章");
		p.imeComposing = true; // 模拟 compositionstart（拼音组合中）。
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0); // 组合中：不写回，仅顺延。
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0); // 仍在组合：继续顺延。
		p.imeComposing = false; // 模拟 compositionend（上屏）。
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toContain(`## ${WORD_JOINER}1 ${WORD_JOINER}章`); // 顺延的周期正常写回。
	});
});

describe("scheduleRenumber：防抖合并 / 多文件独立 / 卸载取消 / 全局开关", () => {
	it("延迟内多次触发只在停顿后编号一次（J1）", () => {
		const { p } = makePlugin({ delay: 300 });
		const ed = new FakeEditor("## 章");
		const info = fileInfo("a.md");
		p.scheduleRenumber(ed, info);
		p.scheduleRenumber(ed, info);
		p.scheduleRenumber(ed, info);
		// 到期前不应有任何写回。
		expect(ed.getValue()).toBe("## 章");
		expect(ed.txnCount).toBe(0);
		vi.advanceTimersByTime(300);
		// 三次调度合并为一次编号。
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		expect(ed.txnCount).toBe(1);
	});

	it("防抖以文件路径为单位，互不取消（J3）", () => {
		const { p } = makePlugin({ delay: 300 });
		const edA = new FakeEditor("## 甲");
		const edB = new FakeEditor("## 乙");
		p.scheduleRenumber(edA, fileInfo("a.md"));
		p.scheduleRenumber(edB, fileInfo("b.md"));
		vi.advanceTimersByTime(300);
		expect(edA.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`);
		expect(edB.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}乙`);
	});

	it("卸载插件取消所有待处理更新，不再写回（J2）", () => {
		const { p } = makePlugin({ delay: 300 });
		const ed = new FakeEditor("## 章");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		p.onunload(); // 模拟关闭/卸载：清掉待处理计时器
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe("## 章");
		expect(ed.txnCount).toBe(0);
	});

	it("全局自动编号关 + 无 frontmatter：不安排任何更新（I4）", () => {
		const { p } = makePlugin({ autoNumber: false });
		const ed = new FakeEditor("## 章");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
	});

	it("调度后、到期前关闭全局开关：到期回调再校验后跳过", () => {
		const { p } = makePlugin({ delay: 300 });
		const ed = new FakeEditor("## 章");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		p.settings.autoNumber = false; // 其间用户关掉了开关
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe("## 章");
		expect(ed.txnCount).toBe(0);
	});

	it("全局自动编号关 + frontmatter true：仍自动触发（I3，文件级强制 opt-in）", () => {
		const { p } = makePlugin({ autoNumber: false });
		const ed = new FakeEditor(
			["---", "obsidian-auto-headings: true", "---", "## 章"].join("\n"),
		);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toContain(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		expect(ed.txnCount).toBe(1);
	});

	it("无任何路径规则命中：自动触发静默跳过、不弹提示（I7 自动）", () => {
		const { p } = makePlugin({ pathRules: [] });
		const ed = new FakeEditor("## 章");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe("## 章");
		expect(ed.txnCount).toBe(0);
		expect(Notice.messages).toHaveLength(0);
	});
});

describe("runImmediateRenumber：手动路径绕过开关与 OFF、仅受模板命中约束", () => {
	it("立即编号并取消同文件待处理的防抖（不二次触发，J7）", () => {
		const { p } = makePlugin({ delay: 300 });
		const ed = new FakeEditor("## 章");
		const ctx = fileInfo("a.md");
		p.scheduleRenumber(ed, ctx); // 先排一个待处理更新
		p.runImmediateRenumber(ed, ctx);
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		expect(ed.txnCount).toBe(1);
		expect(Notice.messages).toContain("已重新编号");
		// 待处理的防抖应被取消：推进时间不再产生第二次事务。
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(1);
	});

	it("内容无需改动时提示「无需改动」、不发起事务", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		expect(ed.txnCount).toBe(0);
		expect(Notice.messages).toContain("无需改动");
	});

	it("全局自动编号关 + frontmatter false：手动命令照常编号（I6，绕过开关与 false）", () => {
		const { p } = makePlugin({ autoNumber: false });
		const ed = new FakeEditor(
			["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n"),
		);
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		expect(ed.getValue()).toContain(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		expect(ed.txnCount).toBe(1);
		expect(Notice.messages).toContain("已重新编号");
	});

	it("无任何路径规则命中：手动命令弹 Notice、不改动（I7 手动）", () => {
		const { p } = makePlugin({ pathRules: [] });
		const ed = new FakeEditor("## 章");
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		expect(ed.getValue()).toBe("## 章");
		expect(ed.txnCount).toBe(0);
		expect(Notice.messages).toContain("当前文件未匹配任何路径规则，无法编号");
	});
});

describe("getTemplateForFile：按路径规则解析模板", () => {
	it("/ 根规则匹配任意文件 → 默认模板", () => {
		const { p } = makePlugin();
		expect(p.getTemplateForFile("anywhere/note.md")?.name).toBe(DEFAULT_TEMPLATE.name);
	});

	it("无规则匹配（空规则表）→ null", () => {
		const { p } = makePlugin({ pathRules: [] });
		expect(p.getTemplateForFile("a.md")).toBeNull();
	});

	it("更具体的文件夹规则优先于 / 根规则", () => {
		const tpl: Template = { ...DEFAULT_TEMPLATE, name: "技术文档" };
		const { p } = makePlugin({
			allTemplates: [DEFAULT_TEMPLATE, tpl],
			pathRules: [
				{ pattern: "/", template: "默认" },
				{ pattern: "Projects/", template: "技术文档" },
			],
		});
		expect(p.getTemplateForFile("Projects/a.md")?.name).toBe("技术文档");
		expect(p.getTemplateForFile("Other/a.md")?.name).toBe("默认");
	});
});

describe("renumberActiveFile：设置面板改模板后即时重排（J5）", () => {
	it("改模板后对当前活动文件即时重排（默认 → 中文）", () => {
		const { p, setTemplate, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "active.md" } });
		p.renumberActiveFile();
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		// 模板改成中文样式后再调用：WJ 快速路径精确剥净旧前缀，写入新前缀（不叠加）。
		setTemplate(cjkTemplate());
		p.renumberActiveFile();
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}一 ${WORD_JOINER}章`);
	});

	it("全局自动编号关：renumberActiveFile 静默跳过", () => {
		const { p, setActiveView } = makePlugin({ autoNumber: false });
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "active.md" } });
		p.renumberActiveFile();
		expect(ed.getValue()).toBe("## 章");
	});

	it("无活动 Markdown 视图：不抛错、不动作", () => {
		const { p, setActiveView } = makePlugin();
		setActiveView(null);
		expect(() => p.renumberActiveFile()).not.toThrow();
	});

	it("改模板样式后已编号标题即时刷新（一 → ①，实测 bug 回归）", () => {
		const { p, setTemplate, setLeaves } = makePlugin();
		setTemplate(cjkTemplate());
		const ed = new FakeEditor("## 章");
		setLeaves([{ editor: ed, file: { path: "a.md" } }]);
		p.renumberActiveFile();
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}一 ${WORD_JOINER}章`);
		// 改样式 cjk → circled，已有的「一」编号应被刷新成「①」（此前因活动视图为 null 而不更新）。
		setTemplate(circledTemplate());
		p.renumberActiveFile();
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}① ${WORD_JOINER}章`);
	});

	it("遍历全部打开叶子：多个文件同时重排（不依赖哪个是活动视图）", () => {
		const { p, setLeaves } = makePlugin();
		const edA = new FakeEditor("## 甲");
		const edB = new FakeEditor("## 乙");
		setLeaves([
			{ editor: edA, file: { path: "a.md" } },
			{ editor: edB, file: { path: "b.md" } },
		]);
		p.renumberActiveFile();
		expect(edA.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`);
		expect(edB.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}乙`);
	});
});

describe("renumberOnOpen：打开文件即按当前生效模板自动重排（J9，用户需求）", () => {
	it("路径规则改投新模板后，尚未编辑、只是打开该文件即按新模板重排", () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
	});

	it("已是当前模板的正确格式：打开时静默 no-op，不重复写回", () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		expect(ed.txnCount).toBe(0);
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
	});

	it("全局自动编号关 + 无 frontmatter：打开不触发（同 I4 门控）", () => {
		const { p, setActiveView } = makePlugin({ autoNumber: false });
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		expect(ed.getValue()).toBe("## 章");
	});

	it("frontmatter 显式 false：即便全局开也不触发（同 I2 门控）", () => {
		const { p, setActiveView } = makePlugin();
		const content = ["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n");
		const ed = new FakeEditor(content);
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		expect(ed.getValue()).toBe(content);
	});

	it("无任何路径规则命中：静默跳过、不抛错", () => {
		const { p, setActiveView } = makePlugin({ pathRules: [] });
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		expect(() => p.renumberOnOpen({ path: "a.md" })).not.toThrow();
		expect(ed.getValue()).toBe("## 章");
	});

	it("打开的文件与当前活动视图不一致（如后台/快速切换）：不处理该文件", () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "active.md" } });
		p.renumberOnOpen({ path: "other.md" });
		expect(ed.getValue()).toBe("## 章");
	});

	it("无活动 Markdown 视图：不抛错、不动作", () => {
		const { p, setActiveView } = makePlugin();
		setActiveView(null);
		expect(() => p.renumberOnOpen({ path: "a.md" })).not.toThrow();
	});
});

describe("迁移守卫：疑似外来编号且插件从未接触过的文件，自动路径跳过写入（J10）", () => {
	it("scheduleRenumber 命中守卫：不写回、Notice 提示一次，重复触发不再重复提示", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor("## 1 红米\n### 1.1 工艺");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe("## 1 红米\n### 1.1 工艺");
		expect(ed.txnCount).toBe(0);
		expect(Notice.messages).toHaveLength(1);
		// 用户继续编辑，仍是同样的疑似外来编号内容：静默跳过、不再重复提示。
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
		expect(Notice.messages).toHaveLength(1);
	});

	it("renumberOnOpen 命中守卫：打开疑似迁移文件不写回，仅提示", () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 第3章 引言");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		expect(ed.getValue()).toBe("## 第3章 引言");
		expect(ed.txnCount).toBe(0);
		expect(Notice.messages).toHaveLength(1);
	});

	it("renumberActiveFile 命中守卫：只跳过疑似迁移的文件，其余正常编号", () => {
		const { p, setLeaves } = makePlugin();
		const edForeign = new FakeEditor("## 1 红米");
		const edNormal = new FakeEditor("## 概述");
		setLeaves([
			{ editor: edForeign, file: { path: "old.md" } },
			{ editor: edNormal, file: { path: "new.md" } },
		]);
		p.renumberActiveFile();
		expect(edForeign.getValue()).toBe("## 1 红米");
		expect(edNormal.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}概述`);
	});

	it("已含插件自己 WJ 编号的文件：守卫只在「插件从未接触过」时生效，故不拦截——新段落仍会按方案A叠加（已知边界，非本次修复范围）", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}已编号\n### 1.1 新段落`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		// 守卫未拦截（全文已含 WJ），常规 stripPrefix 只认 WJ 边界：`1.1 新段落` 当正文、叠加编号。
		expect(ed.getValue()).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}已编号\n### ${WORD_JOINER}1.1 ${WORD_JOINER}1.1 新段落`,
		);
		expect(Notice.messages).toHaveLength(0);
	});

	it("手动命令「立即重新编号」绕过守卫，照常执行（与既有开关豁免原则一致）", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor("## 1 红米");
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}1 红米`);
	});

	it("典型迁移工作流：先手动「清理非本插件编号」，守卫随即解除，自动路径正常接管", () => {
		const { p } = makePlugin();
		const ed = new FakeEditor("## 1 红米\n### 1.1 工艺");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0); // 守卫先拦下。

		(
			p as unknown as { runClearForeignNumbering(e: unknown, c: unknown): void }
		).runClearForeignNumbering(ed, fileInfo("a.md"));
		expect(ed.getValue()).toBe("## 红米\n### 工艺");

		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}红米\n### ${WORD_JOINER}1.1 ${WORD_JOINER}工艺`,
		);
	});
});

describe("strippableAffixes：把全模板前后缀并集接进重排（方案 A）", () => {
	it("收集全部模板各级在用的前后缀并集，并恒含空串", () => {
		const { p } = makePlugin({ allTemplates: [DEFAULT_TEMPLATE, prefixTemplate()] });
		const { prefixes, suffixes } = p.strippableAffixes();
		expect(prefixes).toContain("");
		expect(prefixes).toContain("第");
		expect(suffixes).toContain("");
	});

	it("方案A（0.6.6）：插件写出的「第1 ⁠」前缀（带 WJ）切到无前缀模板后被剥净（WJ 定界，与并集无关）", () => {
		// 0.6.6 起常规重排只认 WJ 边界：`## 第1 ⁠标题` 是插件写过的（带 WJ）→ WJ 精确剥 → 重排成 `## 1 ⁠标题`。
		// （strippableAffixes 并集现仅用于「清除编号」命令，不再参与常规重排。）
		const { p } = makePlugin({ allTemplates: [DEFAULT_TEMPLATE, prefixTemplate()] });
		const ed = new FakeEditor(`## ${WORD_JOINER}第1 ${WORD_JOINER}标题`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}标题`);
	});
});

describe("Backlink 同步（M7，opt-in，见 spec.md §3.12）", () => {
	it("编号改写标题后更新别处指向它的内部链接（updateBacklinks 开）", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": "见 [[a#简介]] 一节。" },
		});
		const ed = new FakeEditor("## 简介");
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		await flushPromises();
		// 目标文件正常编号。
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}简介`);
		// 引用文件的链接锚点被更新，**保留 WJ**（字节对齐含 WJ 的标题，确保 Obsidian 能解析）。
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}1 ${WORD_JOINER}简介]] 一节。`);
		expect(Notice.messages).toContain("已更新 1 处内部链接");
	});

	it("默认关（updateBacklinks 关）：不触碰引用文件", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: false,
			vaultFiles: { "b.md": "见 [[a#简介]] 一节。" },
		});
		const ed = new FakeEditor("## 简介");
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		await flushPromises();
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}简介`);
		expect(vaultFiles.get("b.md")).toBe("见 [[a#简介]] 一节。"); // 未改
		expect(Notice.messages).not.toContain("已更新 1 处内部链接");
	});

	it("清除当前文件编号也同步链接（带前缀 → 裸标题）", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": `跳到 [[a#1 简介]]。` },
		});
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}简介`);
		(p as unknown as { runClearNumbering(e: unknown, c: unknown): void }).runClearNumbering(
			ed,
			fileInfo("a.md"),
		);
		await flushPromises();
		expect(ed.getValue()).toBe("## 简介");
		expect(vaultFiles.get("b.md")).toBe("跳到 [[a#简介]]。");
	});

	it("标题文本未变（幂等触发）：不产生链接改动、不弹 Notice", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": "见 [[a#1 简介]]。" },
		});
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}简介`); // 已是正确编号
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe("见 [[a#1 简介]]。");
		expect(Notice.messages).not.toContain("已更新 1 处内部链接");
	});

	it("M14：纯文本改名（编号不变、无写回）也同步链接（对照快照基线），且链式改名连续有效", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": `见 [[a#1 ${WORD_JOINER}细目甲]]。` },
		});
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}细目甲`);
		// 第一次触发：内容已是正确编号，无写回，但播种快照基线。
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#1 ${WORD_JOINER}细目甲]]。`); // 尚无改名

		// 用户只改标题正文（编号不变）→ 防抖自动触发：编号无变化、不发事务，但链接被同步。
		ed.setValue(`## ${WORD_JOINER}1 ${WORD_JOINER}细目甲改名`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(ed.txnCount).toBe(0); // 编号侧确实无写回
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}1 ${WORD_JOINER}细目甲改名]]。`);
		expect(Notice.messages).toContain("已更新 1 处内部链接");

		// 快照已刷新：再改一次名，链接继续跟上（链式）。
		ed.setValue(`## ${WORD_JOINER}1 ${WORD_JOINER}细目乙`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}1 ${WORD_JOINER}细目乙]]。`);
	});

	it("M15：文本与编号同时变（改名命中白名单致前缀剥除）：链接一步同步到位", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": `见 [[a#1 ${WORD_JOINER}甲]]。` },
		});
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`);
		p.runImmediateRenumber(ed, fileInfo("a.md")); // 播种基线
		await flushPromises();

		// 用户把标题改成默认白名单词「附录」→ 触发后前缀被剥（文本与编号同轮变化）。
		ed.setValue(`## ${WORD_JOINER}1 ${WORD_JOINER}附录`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(ed.getValue()).toBe("## 附录");
		expect(vaultFiles.get("b.md")).toBe("见 [[a#附录]]。");
	});

	it("结构变化（新增标题）：快照口径保守回退，编号侧改名仍正常同步", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": `见 [[a#1 ${WORD_JOINER}乙]]。` },
		});
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}乙`);
		p.runImmediateRenumber(ed, fileInfo("a.md")); // 播种基线
		await flushPromises();

		// 用户在最上方新增标题（结构变化：1 个标题 → 2 个）→ 乙 的编号 1→2。
		ed.setValue(["## 新章", `## ${WORD_JOINER}1 ${WORD_JOINER}乙`].join("\n"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(ed.getValue()).toBe(
			[`## ${WORD_JOINER}1 ${WORD_JOINER}新章`, `## ${WORD_JOINER}2 ${WORD_JOINER}乙`].join(
				"\n",
			),
		);
		// 按序配对不安全（快照 1 个标题 vs 现 2 个）→ 回退「编号前→编号后」，编号改名仍同步。
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}2 ${WORD_JOINER}乙]]。`);
	});

	it("M14 × 开关关：纯文本改名也不触碰引用文件（快照维护不代表同步）", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: false,
			vaultFiles: { "b.md": `见 [[a#1 ${WORD_JOINER}甲]]。` },
		});
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`);
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		await flushPromises();
		ed.setValue(`## ${WORD_JOINER}1 ${WORD_JOINER}甲改`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#1 ${WORD_JOINER}甲]]。`); // 未改
	});

	it("已知限制实修：同文件内链 [[#锚点]] 随清除编号一起原子写回（spec §3.12）", async () => {
		const { p } = makePlugin({ updateBacklinks: true });
		// 正文里一条指向本文件自己标题的 TOC 式链接（本文件既是编辑目标又是引用方）。
		const ed = new FakeEditor(
			[`## ${WORD_JOINER}1 ${WORD_JOINER}简介`, `见 [[#1 ${WORD_JOINER}简介]]。`].join("\n"),
		);
		(p as unknown as { runClearNumbering(e: unknown, c: unknown): void }).runClearNumbering(
			ed,
			fileInfo("a.md"),
		);
		await flushPromises();
		// 标题与自链接在**同一次**事务里一起改写——不依赖任何异步 vault.process 读写。
		expect(ed.getValue()).toBe(["## 简介", "见 [[#简介]]。"].join("\n"));
		expect(ed.txnCount).toBe(1);
		expect(Notice.messages).toContain("已清除编号");
	});

	it("同文件内链竞态回归：即便 metadataCache 把本文件自身也列为引用方，也不再走 vault.process（避免读盘覆盖未落盘的编辑器内容）", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			selfBacklink: true,
			// 模拟磁盘/vault 缓存里的「未落盘」旧内容（本次编辑器事务尚未被 Obsidian 自动保存）。
			vaultFiles: { "a.md": "STALE-ON-DISK-SENTINEL" },
		});
		const ed = new FakeEditor(
			[`## ${WORD_JOINER}1 ${WORD_JOINER}简介`, `见 [[#1 ${WORD_JOINER}简介]]。`].join("\n"),
		);
		(p as unknown as { runClearNumbering(e: unknown, c: unknown): void }).runClearNumbering(
			ed,
			fileInfo("a.md"),
		);
		await flushPromises();
		// 编辑器内容正确、原子写回。
		expect(ed.getValue()).toBe(["## 简介", "见 [[#简介]]。"].join("\n"));
		expect(ed.txnCount).toBe(1);
		// 关键断言：本文件自身这一支不再经 vault.process 读改写——vaultFiles 里的「陈旧磁盘内容」
		// 岿然不动。若回归到旧实现（把自身也交给 vault.process），这里会被改写、且可能覆盖式地
		// 把编辑器刚写入的内容冲掉（对应用户报告的「提示已清除但文件不变」）。
		expect(vaultFiles.get("a.md")).toBe("STALE-ON-DISK-SENTINEL");
	});
});

describe("子树白名单经自动触发路径生效（WL-int：引擎+触发接线正确，问题在模板解析口径）", () => {
	function subtreeTpl(): Template {
		return { ...DEFAULT_TEMPLATE, whitelist: [{ text: "附录", match: "subtree" }] };
	}

	it("当前文件解析到的模板带『附录』子树白名单 → 附录及其子标题不被编号", () => {
		const { p, setTemplate, setActiveView } = makePlugin();
		setTemplate(subtreeTpl()); // 「默认」模板带子树白名单（file a.md 经 / 根规则解析到它）
		const ed = new FakeEditor(
			["## 甲", "## 乙", "## 附录", "### 命名", "### 你你你主任"].join("\n"),
		);
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe(
			[
				`## ${WORD_JOINER}1 ${WORD_JOINER}甲`,
				`## ${WORD_JOINER}2 ${WORD_JOINER}乙`,
				"## 附录", // 子树根：豁免、不占槽位
				"### 命名", // 子树子标题：一并豁免
				"### 你你你主任",
			].join("\n"),
		);
		// 幂等：再次触发不变。
		const after = ed.getValue();
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.getValue()).toBe(after);
	});

	it("机制说明：文件解析到的模板**没有**该白名单 → 标题被编号（预览口径不一致的根因）", () => {
		// a.md 经 / 根规则解析到「默认」；把「默认」设成**无白名单**的干净模板（去掉内置结构词表，
		// 并用一个不在默认词表里的词「方法」作子树根），另有个带白名单的「学术」但 a.md 用不到它。
		const cleanDefault: Template = { ...DEFAULT_TEMPLATE, whitelist: [] };
		const academic: Template = {
			...DEFAULT_TEMPLATE,
			name: "学术",
			whitelist: [{ text: "方法", match: "subtree" }],
		};
		const { p, setTemplate, setActiveView } = makePlugin({
			allTemplates: [cleanDefault, academic],
			pathRules: [{ pattern: "/", template: "默认" }],
		});
		setTemplate(cleanDefault); // 「默认」= 无白名单
		const ed = new FakeEditor(["## 方法", "### 步骤"].join("\n"));
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		// 用「默认」编号 → 都被编号（即便在「学术」面板里预览会显示豁免，故面板需提示模板不一致）。
		expect(ed.getValue()).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}方法\n### ${WORD_JOINER}1.1 ${WORD_JOINER}步骤`,
		);
	});
});

describe("Backlink 曝光度（0.7.11：默认开 + 首次说明 Notice，见 spec.md §3.12）", () => {
	it("首次实际改写引用文件时弹一次说明 Notice，之后只弹常规计数 Notice", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": "见 [[a#简介]]。" },
		});
		const ed = new FakeEditor("## 简介");
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}1 ${WORD_JOINER}简介]]。`);
		// 首次：说明 Notice 恰好一次，并持久化标记。
		expect(Notice.messages.filter((m) => m.includes("本提示只出现一次")).length).toBe(1);
		expect(p.settings.backlinksIntroShown).toBe(true);

		// 第二次同步（纯文本改名）：常规计数 Notice 有、说明 Notice 不再弹。
		Notice.messages.length = 0;
		ed.setValue(`## ${WORD_JOINER}1 ${WORD_JOINER}简介二`);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(Notice.messages).toContain("已更新 1 处内部链接");
		expect(Notice.messages.filter((m) => m.includes("本提示只出现一次")).length).toBe(0);
	});
});

describe("清除全库编号（敏感操作 TAB，0.7.11：清除期间压制自动编号）", () => {
	it("清除全库：剥净各文件前缀、取消待处理防抖（清掉的编号不被编回去）", async () => {
		const { p, vaultFiles } = makePlugin({
			vaultFiles: {
				"a.md": `## ${WORD_JOINER}1 ${WORD_JOINER}甲\n### ${WORD_JOINER}1.1 ${WORD_JOINER}子`,
				"b.md": "## 乙", // 无前缀，不应被计入修改数。
			},
		});
		// 用户正在编辑 a.md：防抖计时器已挂起。
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md"));

		await p.clearAllVaultNumbering();
		expect(vaultFiles.get("a.md")).toBe("## 甲\n### 子");
		expect(vaultFiles.get("b.md")).toBe("## 乙");
		expect(Notice.messages).toContain("已清除全库编号（共修改 1 个文件）");

		// 挂起的防抖已被取消：计时器到期后编辑器不被写回。
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
	});

	it("H7（0.7.17）：清除全库前先持久关闭「全局自动编号」——清完不会一编辑又被编回去", async () => {
		const { p, vaultFiles } = makePlugin({
			vaultFiles: { "a.md": `## ${WORD_JOINER}1 ${WORD_JOINER}甲` },
		});
		expect(p.settings.autoNumber).toBe(true); // 前置：默认开。

		await p.clearAllVaultNumbering();
		expect(vaultFiles.get("a.md")).toBe("## 甲");
		expect(p.settings.autoNumber).toBe(false); // 开关已持久关闭。

		// 清库后继续编辑：自动路径被关闭的开关门控，不再编号。
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
	});
});
