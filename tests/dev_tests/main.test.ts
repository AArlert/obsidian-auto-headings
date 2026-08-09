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
import { NO_NUMBERING_TEMPLATE, type PathRule } from "../../src/pathrules";
import { Modal, Notice, TFile as MockTFile } from "./obsidian-mock";

/** 编辑器坐标。 */
interface Pos {
	line: number;
	ch: number;
}

/** 假编辑器：持有按行切分的文本，记录 `transaction` 调用次数（用于「单一事务」断言）。 */
class FakeEditor {
	private lines: string[];
	/** `transaction` 被调用的次数。一次完整重排应只产生 **1** 次事务。 */
	txnCount = 0;
	/** 最近一次事务的变更清单，供断言写回范围（J19：最小范围改写，不整行替换）。 */
	lastChanges: Array<{ from: Pos; to?: Pos; text: string }> = [];
	/** 光标位置。默认 `-1` 行 = 不在任何行上，使既有用例不触发「光标所在行保护」（J11）。 */
	private cursor: Pos = { line: -1, ch: 0 };

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

	getCursor(): Pos {
		return this.cursor;
	}

	/** 把光标放到某行（J11：模拟「用户正停在这一行敲字」）。 */
	setCursor(line: number, ch = 0): void {
		this.cursor = { line, ch };
	}

	/**
	 * 施加一次事务。整文重排的 change 都是「整行替换」，但自 1.0.15 起同一事务里还可能夹带
	 * **会改变行数**的 frontmatter 增删（清除即暂停 / 重新编号即恢复），逐行赋值已不够用。
	 * 故按**原文档**坐标折算成绝对偏移、从后往前施加——与 CM6 变更集的语义一致。
	 */
	transaction(tx: { changes: Array<{ from: Pos; to?: Pos; text: string }> }): void {
		this.txnCount++;
		this.lastChanges = tx.changes;
		const offset = (p: Pos) => {
			let o = 0;
			for (let i = 0; i < p.line; i++) {
				o += this.lines[i].length + 1;
			}
			return o + p.ch;
		};
		const sorted = [...tx.changes].sort((a, b) => offset(b.from) - offset(a.from));
		let out = this.getValue();
		for (const c of sorted) {
			const from = offset(c.from);
			out = out.slice(0, from) + c.text + out.slice(c.to ? offset(c.to) : from);
		}
		this.lines = out.split("\n");
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
	/** 「清除全库编号」进行中标志（见 spec.md §3.10），M24 直接置位模拟并发场景，绕开真实异步时序。 */
	vaultClearInProgress: boolean;
	scheduleRenumber(editor: unknown, info: unknown): void;
	runImmediateRenumber(editor: unknown, ctx: unknown): void;
	runClearNumbering(editor: unknown, ctx: unknown): void;
	batchRenumberRule(rule: PathRule): Promise<void>;
	strippableAffixes(): { prefixes: string[]; suffixes: string[] };
	renumberActiveFile(): void;
	renumberOnOpen(file: { path: string }): void;
	clearAllVaultNumbering(): Promise<void>;
	freezeVaultNumbering(): Promise<void>;
	resumeFromRetired(): Promise<void>;
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
	/**
	 * 「当前活动文件」的显式覆盖：用于模拟**活动文件与被检查文件不一致**的真实场景——防抖计时器
	 * 在用户已经切走之后才到期、批量刷新遍历后台叶子。不设时回落到活动视图的文件（J13/J14）。
	 */
	let activeFileOverride: { path: string } | null = null;
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
		/**
		 * 「这个文件自己的内容」——`renumberOnOpen` 的判断依据（J15）。**刻意不走编辑器**：真实
		 * Obsidian 在 `file-open` 那一刻编辑器还显示着上一篇，读编辑器会拿到别的文件的内容。
		 * 显式给了 `vaultFiles` 就用它（可与编辑器内容不一致，正是要建模的那个瞬间）；
		 * 没给则回落到持有该文件的视图，保持既有用例（内容只活在 FakeEditor 里）行为不变。
		 */
		cachedRead: async (file: { path: string }) => {
			if (vaultFiles.has(file.path)) {
				return vaultFiles.get(file.path) ?? "";
			}
			const leaf = leaves.find((l) => l.view.file?.path === file.path);
			if (leaf) {
				return leaf.view.editor.getValue();
			}
			if (activeView?.file?.path === file.path) {
				return activeView.editor.getValue();
			}
			return "";
		},
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
			// 「用户当前正看着哪个文件」——迁移守卫据此决定要不要弹提示（J13：只为活动文件发声）。
			// 由 setActiveView / setActiveFile 驱动；两者都没设过时返回 null（= 无活动文件）。
			getActiveFile: (): { path: string } | null =>
				activeFileOverride ?? activeView?.file ?? null,
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
		/** 显式指定「用户当前正看着哪个文件」，与被检查的文件解耦（J13：跨文件误弹的回归）。 */
		setActiveFile: (f: { path: string } | null) => {
			activeFileOverride = f;
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
	Notice.lastFragment = null;
	Notice.instances.length = 0;
	Modal.instances.length = 0;
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
		// 1.0.15：本命令顺带移除 fm:false（H15 闭环）——该键是唯一一项，整个块一并移除。
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		expect(ed.txnCount).toBe(1);
		expect(Notice.messages).toContain("已重新编号，并恢复本文件的自动编号");
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
	it("路径规则改投新模板后，尚未编辑、只是打开该文件即按新模板重排", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
	});

	it("已是当前模板的正确格式：打开时静默 no-op，不重复写回", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(ed.txnCount).toBe(0);
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
	});

	it("全局自动编号关 + 无 frontmatter：打开不触发（同 I4 门控）", async () => {
		const { p, setActiveView } = makePlugin({ autoNumber: false });
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(ed.getValue()).toBe("## 章");
	});

	it("frontmatter 显式 false：即便全局开也不触发（同 I2 门控）", async () => {
		const { p, setActiveView } = makePlugin();
		const content = ["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n");
		const ed = new FakeEditor(content);
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(ed.getValue()).toBe(content);
	});

	it("无任何路径规则命中：静默跳过、不抛错", async () => {
		const { p, setActiveView } = makePlugin({ pathRules: [] });
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		expect(() => p.renumberOnOpen({ path: "a.md" })).not.toThrow();
		await flushPromises();
		expect(ed.getValue()).toBe("## 章");
	});

	it("打开的文件与当前活动视图不一致（如后台/快速切换）：不处理该文件", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "active.md" } });
		p.renumberOnOpen({ path: "other.md" });
		await flushPromises();
		expect(ed.getValue()).toBe("## 章");
	});

	it("无活动 Markdown 视图：不抛错、不动作", async () => {
		const { p, setActiveView } = makePlugin();
		setActiveView(null);
		expect(() => p.renumberOnOpen({ path: "a.md" })).not.toThrow();
		await flushPromises();
	});
});

describe("迁移守卫：疑似外来编号且插件从未接触过的文件，自动路径跳过写入（J10）", () => {
	it("scheduleRenumber 命中守卫：不写回、Notice 提示一次，重复触发不再重复提示", () => {
		const { p, setActiveFile } = makePlugin();
		const ed = new FakeEditor("## 1 红米\n### 1.1 工艺");
		setActiveFile({ path: "a.md" }); // 用户正看着这个文件（提示只为活动文件发声，J13）。
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

	it("renumberOnOpen 命中守卫：打开疑似迁移文件不写回，仅提示", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 第3章 引言");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
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

describe("file-open 判断依据是文件自身内容而非编辑器缓冲区（J15，1.0.21 修第四轮真机反馈）", () => {
	/**
	 * 真机链路（用户第四轮给的干净复现）：a、b 是正常文件，C 含外来编号。
	 * `a → C` 不弹提示、`C → b` 反而弹且没什么可清理——**编辑器内容正好落后一个文件**：
	 * 打开 C 时编辑器还显示 a 的内容（干净 ⇒ 不弹），打开 b 时编辑器还显示 C 的内容
	 * （脏 ⇒ 弹，但提示挂在 b 上，点进去按 b 的真实内容算自然是「没什么可清理」）。
	 *
	 * 建模方式：`vaultFiles` 放**文件自己的真实内容**，`FakeEditor` 放**滞后一个文件的内容**。
	 * 只要实现读的是 `vault.cachedRead(file)` 而不是 `editor.getValue()`，两条断言就都成立。
	 */
	const clean = "## 普通标题";
	const foreign = "## 1 红米";

	it("a → C（编辑器还显示 a 的干净内容）：仍能认出 C 是脏的并**立即**提示", async () => {
		const { p, setActiveView, setActiveFile } = makePlugin({
			vaultFiles: { "C.md": foreign },
		});
		// 编辑器滞后：view.file 已是 C.md，内容却还是上一篇 a.md 的。
		const shared = new FakeEditor(clean);
		setActiveView({ editor: shared, file: { path: "C.md" } });
		setActiveFile({ path: "C.md" });

		p.renumberOnOpen({ path: "C.md" });
		await flushPromises();

		expect(Notice.messages).toHaveLength(1); // 打开 C 就该弹。
	});

	it("C → b（编辑器还显示 C 的脏内容）：**不**为干净的 b 弹提示", async () => {
		const { p, setActiveView, setActiveFile } = makePlugin({
			vaultFiles: { "b.md": clean },
		});
		// 编辑器滞后：view.file 已是 b.md，内容却还是上一篇 C.md 的（脏）。
		const shared = new FakeEditor(foreign);
		setActiveView({ editor: shared, file: { path: "b.md" } });
		setActiveFile({ path: "b.md" });

		p.renumberOnOpen({ path: "b.md" });
		await flushPromises();

		expect(Notice.messages).toHaveLength(0); // b 是干净的，不该弹。
	});

	it("编辑器尚未换到位时**只判断不写入**（宁可这轮不重排，也不能把别的文件的编号写进来）", async () => {
		const { p, setActiveView, setActiveFile } = makePlugin({
			vaultFiles: { "b.md": clean },
		});
		const shared = new FakeEditor(foreign); // 仍持上一篇的内容。
		setActiveView({ editor: shared, file: { path: "b.md" } });
		setActiveFile({ path: "b.md" });

		p.renumberOnOpen({ path: "b.md" });
		await flushPromises();

		expect(shared.getValue()).toBe(foreign); // 一个字都没动。
		expect(shared.txnCount).toBe(0);
	});

	it("编辑器已换到位（内容与文件一致）：照常按模板重排（J9 语义不受影响）", async () => {
		const { p, setActiveView, setActiveFile } = makePlugin({
			vaultFiles: { "b.md": clean },
		});
		const ed = new FakeEditor(clean); // 与文件内容一致 = 已换到位。
		setActiveView({ editor: ed, file: { path: "b.md" } });
		setActiveFile({ path: "b.md" });

		p.renumberOnOpen({ path: "b.md" });
		await flushPromises();

		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}普通标题`);
	});

	it("延后之后用户又切走了：整轮作废，不动任何文件", async () => {
		const { p, setActiveView, setActiveFile } = makePlugin();
		const ed = new FakeEditor("## 章");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		setActiveFile({ path: "a.md" });

		p.renumberOnOpen({ path: "a.md" });
		setActiveFile({ path: "b.md" }); // 这一瞬用户又切走了。
		await flushPromises();

		expect(ed.getValue()).toBe("## 章"); // 没有按 a.md 的模板动 b.md 的编辑器。
		expect(ed.txnCount).toBe(0);
	});

	it("防抖到期时该叶子已切到别的文件：本轮作废（不为看不见的文件弹提示、更不写错文件）", () => {
		const { p, setActiveFile } = makePlugin();
		const ed = new FakeEditor("## 1 红米");
		// info.file 与 editor 都是「同一个叶子」的引用；切换文件后 info.file.path 会变。
		const info = { file: { path: "a.md" } };
		setActiveFile({ path: "a.md" });

		p.scheduleRenumber(ed, info);
		info.file.path = "b.md"; // 叶子在防抖窗口内切到了 b.md。
		setActiveFile({ path: "b.md" });
		vi.advanceTimersByTime(300);

		expect(Notice.messages).toHaveLength(0);
		expect(ed.txnCount).toBe(0);
	});
});

describe("迁移守卫提示只为当前活动文件发声（J13，1.0.19 修真机跨文件误弹）", () => {
	it("**真机复现**：防抖计时器在用户切走之后才到期 → 不为已经看不见的文件弹提示", () => {
		// 用户报告的链路：在 a.md（外来编号）里敲了字 → 300ms 还没到就切到 b.md →
		// 计时器在切换之后才到期。旧实现此时会弹出一条「说的是 a.md」的提示，而用户眼前是
		// b.md，于是读成「b.md 有问题」，点进去又发现没什么可清理。
		const { p, setActiveFile } = makePlugin();
		const a = new FakeEditor("## 1 红米");

		setActiveFile({ path: "a.md" });
		p.scheduleRenumber(a, fileInfo("a.md")); // 在 a.md 里打字，安排计时器。
		setActiveFile({ path: "b.md" }); // 计时器到期前切走。
		vi.advanceTimersByTime(300);

		expect(Notice.messages).toHaveLength(0); // 不为看不见的 a.md 弹提示。
	});

	it("批量刷新遍历全部叶子时，只有当前活动的那个疑似文件会弹提示", () => {
		// renumberActiveFile（改模板后即时重排）遍历所有打开的叶子，后台文件同样会过守卫检查——
		// 若不加活动文件校验，改一次模板就会为每个后台脏文件各弹一条。
		const { p, setLeaves, setActiveFile } = makePlugin();
		const front = new FakeEditor("## 1 红米");
		const back = new FakeEditor("## 2 工艺");
		setLeaves([
			{ editor: front, file: { path: "front.md" } },
			{ editor: back, file: { path: "back.md" } },
		]);
		setActiveFile({ path: "front.md" });

		p.renumberActiveFile();

		expect(Notice.messages).toHaveLength(1); // 只有 front.md 那条。
	});

	it("同一文件内连续打字：屏幕上始终只有一条提示，不堆叠也不闪烁", () => {
		const { p, setActiveFile } = makePlugin();
		const a = new FakeEditor("## 1 红米");
		setActiveFile({ path: "a.md" });

		for (let i = 0; i < 3; i++) {
			p.scheduleRenumber(a, fileInfo("a.md"));
			vi.advanceTimersByTime(300);
		}

		expect(Notice.messages).toHaveLength(1); // 已有一条就不重建。
		expect(Notice.instances.filter((n) => !n.hidden)).toHaveLength(1);
	});

	it("切到别的文件：上一条提示被收起（不留下指向另一篇笔记的孤儿提示）", async () => {
		const { p, setActiveView, setActiveFile } = makePlugin();
		const a = new FakeEditor("## 1 红米");
		const b = new FakeEditor("## 普通标题");

		setActiveView({ editor: a, file: { path: "a.md" } });
		setActiveFile({ path: "a.md" });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(Notice.messages).toHaveLength(1);
		expect(Notice.instances[0].hidden).toBe(false);

		// 切到 b.md：file-open 触发，a.md 那条提示应当被收起。
		setActiveView({ editor: b, file: { path: "b.md" } });
		setActiveFile({ path: "b.md" });
		p.renumberOnOpen({ path: "b.md" });
		await flushPromises();
		expect(Notice.instances[0].hidden).toBe(true);
	});

	it("切走再切回仍命中守卫：重新提示（这是 1.0.17 反馈要修的原始诉求）", async () => {
		const { p, setActiveView, setActiveFile } = makePlugin();
		const a = new FakeEditor("## 1 红米");
		const b = new FakeEditor("## 普通标题");

		setActiveView({ editor: a, file: { path: "a.md" } });
		setActiveFile({ path: "a.md" });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(Notice.messages).toHaveLength(1);

		setActiveView({ editor: b, file: { path: "b.md" } });
		setActiveFile({ path: "b.md" });
		p.renumberOnOpen({ path: "b.md" });
		await flushPromises();

		setActiveView({ editor: a, file: { path: "a.md" } });
		setActiveFile({ path: "a.md" });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(Notice.messages).toHaveLength(2); // 回来后重新提示。
	});

	it("文件被清理干净后：那条提示主动收起（告警已不成立）", () => {
		const { p, setActiveFile } = makePlugin();
		const a = new FakeEditor("## 1 红米");
		setActiveFile({ path: "a.md" });

		p.scheduleRenumber(a, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(Notice.instances[0].hidden).toBe(false);

		a.setValue("## 红米"); // 用户自己清理干净。
		p.scheduleRenumber(a, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(Notice.instances[0].hidden).toBe(true);
	});

	it("重新打开后若已清理干净，不再命中守卫、也不再提示", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 1 红米");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(Notice.messages).toHaveLength(1);

		ed.setValue("## 红米"); // 用户手动清理干净。
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(Notice.messages).toHaveLength(1); // 未再命中守卫，无新提示。
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}红米`); // 正常接管编号。
	});
});

describe("迁移守卫 Notice 可点击 → 清理预览确认框（J14/J17）", () => {
	it("点击链接：打开确认框，预览已套用模板（非仅剥离中间态）；全部勾选时确认后一步到位、不必等下一次防抖", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 1 红米\n### 1.1 工艺");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		expect(Notice.messages).toHaveLength(1);

		const frag = Notice.lastFragment;
		expect(frag).not.toBeNull();
		expect(frag!.children).toHaveLength(1); // 唯一的可点击链接。
		const link = frag!.children[0];
		expect(link.tagName).toBe("a");

		link.click();

		// 原 Notice 收起。
		expect(Notice.instances[0]?.hidden).toBe(true);
		// 打开了恰好一个确认框，候选与 previewForeignNumberingCleanup 的计算结果一致。
		expect(Modal.instances).toHaveLength(1);
		const modal = Modal.instances[0] as unknown as {
			candidates: { lineIndex: number; before: string }[];
			computePreview: (
				keepLines: ReadonlySet<number>,
			) => { lineIndex: number; before: string; after: string }[];
			onConfirm: (keepLines: ReadonlySet<number>) => void;
		};
		expect(modal.candidates).toEqual([
			{ lineIndex: 0, before: "## 1 红米" },
			{ lineIndex: 1, before: "### 1.1 工艺" },
		]);

		// 默认全部勾选（keepLines 为空集）时的预览：已套模板，不是仅剥离外来编号的中间态。
		expect(modal.computePreview(new Set())).toEqual([
			{ lineIndex: 0, before: "## 1 红米", after: `## ${WORD_JOINER}1 ${WORD_JOINER}红米` },
			{
				lineIndex: 1,
				before: "### 1.1 工艺",
				after: `### ${WORD_JOINER}1.1 ${WORD_JOINER}工艺`,
			},
		]);

		// 确认清理（全部勾选）：一步到位立即套模板，与手动「清理非本插件的标题编号」+ 等一轮防抖的
		// 最终效果一致，但不必等待（J17）。
		modal.onConfirm(new Set());
		expect(ed.getValue()).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}红米\n### ${WORD_JOINER}1.1 ${WORD_JOINER}工艺`,
		);
	});

	it("取消勾选某条：保留原文，模板编号仍照常叠加在前面，且此后不再触发迁移守卫（J17）", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 1 红米\n### 1.1 工艺");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		Notice.lastFragment!.children[0].click();

		const modal = Modal.instances[0] as unknown as {
			computePreview: (
				keepLines: ReadonlySet<number>,
			) => { lineIndex: number; before: string; after: string }[];
			onConfirm: (keepLines: ReadonlySet<number>) => void;
		};

		// 取消勾选第 0 行（保留「1 红米」原文，不剥离）。
		const preview = modal.computePreview(new Set([0]));
		expect(preview[0].after).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}1 红米`); // 模板前缀 + 原文，双重编号观感（既有语义）。
		expect(preview[1].after).toBe(`### ${WORD_JOINER}1.1 ${WORD_JOINER}工艺`); // 勾选的仍正常剥离 + 套模板。

		modal.onConfirm(new Set([0]));
		expect(ed.getValue()).toBe(
			`## ${WORD_JOINER}1 ${WORD_JOINER}1 红米\n### ${WORD_JOINER}1.1 ${WORD_JOINER}工艺`,
		);

		// 写入后全文已含 WJ，迁移守卫此后不会再对本文件命中——不存在「保留的那条下一轮又被拦」的问题。
		Notice.messages.length = 0;
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(Notice.messages).toHaveLength(0);
	});

	it("不确认（相当于点「取消」/直接关闭）不改动文件内容", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 1 红米");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		Notice.lastFragment!.children[0].click();
		expect(Modal.instances).toHaveLength(1);
		// 不调用 onConfirm：内容原封不动。
		expect(ed.getValue()).toBe("## 1 红米");
	});

	it("点击时该文件已不在任何已打开的标签页：提示改为重新打开，不抛错、不开确认框", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 1 红米");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		const link = Notice.lastFragment!.children[0];

		setActiveView(null); // 模拟该文件的标签页已关闭。
		expect(() => link.click()).not.toThrow();
		expect(Modal.instances).toHaveLength(0);
		expect(Notice.messages).toContain("该文件已不在任何标签页中，请重新打开后再清理");
	});

	it("点击时内容已不含外来编号（用户已自行清理）：提示无可清理，不开确认框", async () => {
		const { p, setActiveView } = makePlugin();
		const ed = new FakeEditor("## 1 红米");
		setActiveView({ editor: ed, file: { path: "a.md" } });
		p.renumberOnOpen({ path: "a.md" });
		await flushPromises();
		const link = Notice.lastFragment!.children[0];

		ed.setValue("## 红米"); // 点击前用户已手动清理干净。
		link.click();
		expect(Modal.instances).toHaveLength(0);
		expect(Notice.messages).toContain("当前文件无可清理的外来编号");
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
		// 1.0.15：清除顺带暂停（H13）——链接同步这一半不受影响。
		expect(ed.getValue()).toBe(
			["---", "obsidian-auto-headings: false", "---", "## 简介"].join("\n"),
		);
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
		// 标题、自链接与暂停开关（1.0.15 H13）在**同一次**事务里一起改写——不依赖异步 vault.process。
		expect(ed.getValue()).toBe(
			["---", "obsidian-auto-headings: false", "---", "## 简介", "见 [[#简介]]。"].join("\n"),
		);
		expect(ed.txnCount).toBe(1);
		expect(Notice.messages.some((m) => m.includes("已清除编号"))).toBe(true);
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
		// 编辑器内容正确、原子写回（含 1.0.15 的暂停开关，H13）。
		expect(ed.getValue()).toBe(
			["---", "obsidian-auto-headings: false", "---", "## 简介", "见 [[#简介]]。"].join("\n"),
		);
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

describe("Backlink 独立于编号模板的触发（CR-18，M20–M25，1.0.9 起随 updateBacklinks 全局生效，见 spec.md §3.12）", () => {
	it("M20：无模板文件标题改名 → 同步链接，且从不写入编号前缀", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			pathRules: [], // 无模板可用。
			vaultFiles: { "b.md": "见 [[a#甲]]。" },
		});
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md")); // 播种快照基线。
		vi.advanceTimersByTime(300);
		await flushPromises();

		ed.setValue("## 甲改");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(ed.getValue()).toBe("## 甲改"); // 编辑器内容不含任何编号前缀 / WJ。
		expect(vaultFiles.get("b.md")).toBe("见 [[a#甲改]]。");
		expect(Notice.messages).toContain("已更新 1 处内部链接");
	});

	it("M21：全局自动编号关且未 fm:true（文件命中模板） → 不写编号，链接仍同步", async () => {
		const { p, vaultFiles } = makePlugin({
			autoNumber: false, // 全局自动编号关，文件也未 fm:true 强制。
			updateBacklinks: true,
			vaultFiles: { "b.md": "见 [[a#甲]]。" },
		});
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md")); // 播种快照基线。
		vi.advanceTimersByTime(300);
		await flushPromises();

		ed.setValue("## 甲改");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(ed.getValue()).toBe("## 甲改"); // 全局开关关：不写编号。
		expect(vaultFiles.get("b.md")).toBe("见 [[a#甲改]]。"); // 独立路径仍同步链接。
	});

	// M22 原为「fm:false 优先——显式关闭该文件时连链接也不同步」。1.0.15 有意收窄该键的含义为
	// 「不自动**编号**」（testplan I8）：清除编号命令自此会写 fm:false 来真正止住重编号（H13），
	// 若链接同步跟着停，等于用一次清除编号换掉了插件的第一价值。要彻底静默改用 updateBacklinks。
	it("M22（1.0.15 改）：fm:false 只关编号，不关链接同步", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			pathRules: [],
			vaultFiles: { "b.md": "见 [[a#甲]]。" },
		});
		const fm = "---\nobsidian-auto-headings: false\n---\n## 甲";
		const ed = new FakeEditor(fm);
		p.scheduleRenumber(ed, fileInfo("a.md")); // 播种快照基线（独立触发路径够格）。
		vi.advanceTimersByTime(300);
		await flushPromises();

		ed.setValue(fm.replace("## 甲", "## 甲改"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe("见 [[a#甲改]]。"); // 链接照常同步。
		expect(ed.getValue()).not.toContain(WORD_JOINER); // 但一个编号也没写进去。
	});

	it("M23：依赖总开关——updateBacklinks 关时，无模板文件标题改名不触发编号也不同步链接", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: false,
			pathRules: [],
			vaultFiles: { "b.md": "见 [[a#甲]]。" },
		});
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md")); // 播种快照基线（无模板不影响快照维护）。
		vi.advanceTimersByTime(300);
		await flushPromises();

		ed.setValue("## 甲改");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(ed.txnCount).toBe(0); // 未写入任何编号。
		expect(vaultFiles.get("b.md")).toBe("见 [[a#甲]]。"); // 链接未同步。
	});

	it("M24：清库进行中（vaultClearInProgress）压制独立触发", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			pathRules: [],
			vaultFiles: { "b.md": "见 [[a#甲]]。" },
		});
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md")); // 播种快照基线。
		vi.advanceTimersByTime(300);
		await flushPromises();

		// 直接置位「清库进行中」标志，模拟批量写回期间恰好触发了别的已打开文件的 editor-change
		// （与 `clearAllVaultNumbering` 内部时序解耦，聚焦断言 `shouldBacklinkStandaloneTrigger` 的压制）。
		p.vaultClearInProgress = true;
		ed.setValue("## 甲改");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe("见 [[a#甲]]。"); // 清库期间未被独立触发同步。

		// 清库结束后恢复：同一次改动继续能被独立触发看见（不是永久卡死）。
		p.vaultClearInProgress = false;
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe("见 [[a#甲改]]。");
	});

	it("M25：常规路径优先，命中模板时不重复同步（只走 applyRenumber 一次）", async () => {
		const { p, vaultFiles } = makePlugin({
			updateBacklinks: true,
			vaultFiles: { "b.md": "见 [[a#甲]]。" },
		});
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		await flushPromises();
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`); // 常规编号正常写入。
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}1 ${WORD_JOINER}甲]]。`);
		// 只弹一次计数 Notice（未被独立触发重复处理导致计数翻倍或二次 Notice）。
		expect(Notice.messages.filter((m) => m.includes("已更新")).length).toBe(1);
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

describe("M12：固化编号并交还所有权（敏感操作 TAB，testplan H9–H11）", () => {
	it("H9：编号保留为普通文本，全库 WJ 归零——**链接锚点里的一并剥净**，内链不断", async () => {
		// 这条是本功能的核心不变量：displayAnchor 刻意把 WJ 写进 [[file#锚点]]，只剥标题行
		// 会让链接侧仍带 WJ、与标题字节对不上 → 全库内链集体断链。两侧必须同步归零。
		const { p, vaultFiles } = makePlugin({
			vaultFiles: {
				"a.md": `## ${WORD_JOINER}1 ${WORD_JOINER}甲\n### ${WORD_JOINER}1.1 ${WORD_JOINER}子`,
				"b.md": `见 [[a#${WORD_JOINER}1 ${WORD_JOINER}甲]] 一节。`,
				"c.md": "## 从没被编号过", // 无 WJ，不应被计入修改数。
			},
		});

		await p.freezeVaultNumbering();

		// 编号原样保留、只掉标记
		expect(vaultFiles.get("a.md")).toBe("## 1 甲\n### 1.1 子");
		// 链接侧同步归零 ⇒ 与标题字节一致 ⇒ 仍解析得到
		expect(vaultFiles.get("b.md")).toBe("见 [[a#1 甲]] 一节。");
		expect(vaultFiles.get("c.md")).toBe("## 从没被编号过");
		// 全库不残留任何标记
		for (const content of vaultFiles.values()) {
			expect(content).not.toContain(WORD_JOINER);
		}
		expect(p.settings.retired).toBe(true);
	});

	it("H10：离场后连 frontmatter `true` 的文件也不再自动编号（硬闸凌驾于 fm 开关）", async () => {
		// 只关 autoNumber 是不够的：fm:true 本就绕开全局开关，会把已成普通文本的编号叠成双重编号。
		const { p } = makePlugin({ vaultFiles: { "a.md": `## ${WORD_JOINER}1 ${WORD_JOINER}甲` } });
		await p.freezeVaultNumbering();

		const ed = new FakeEditor("---\nobsidian-auto-headings: true\n---\n## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
	});

	it("H10：离场刻意**不动** autoNumber——那是用户偏好，恢复接管时不该要他重设", async () => {
		const { p } = makePlugin({ vaultFiles: { "a.md": `## ${WORD_JOINER}1 ${WORD_JOINER}甲` } });
		expect(p.settings.autoNumber).toBe(true);
		await p.freezeVaultNumbering();
		expect(p.settings.autoNumber).toBe(true); // 与 clearAllVaultNumbering（H7）刻意不同
		expect(p.settings.retired).toBe(true);
	});

	it("H11：恢复接管后，固化过的编号被既有迁移守卫接住（不叠成双重编号）", async () => {
		const { p } = makePlugin({ vaultFiles: { "a.md": `## ${WORD_JOINER}1 ${WORD_JOINER}甲` } });
		await p.freezeVaultNumbering();
		await p.resumeFromRetired();
		expect(p.settings.retired).toBe(false);

		// 固化后的 `## 1 甲` 已无 WJ ⇒ 对插件来说就是「外来编号」⇒ guardForeignNumbering 命中、
		// 跳过自动写入（而不是在 `1 甲` 左边再叠一个 `1 `）。恢复路径不必新建机制。
		const ed = new FakeEditor("## 1 甲");
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
	});

	it("固化期间挂起的防抖被取消，刚固化的内容不会被立刻编回去", async () => {
		const { p } = makePlugin({
			vaultFiles: { "a.md": `## ${WORD_JOINER}1 ${WORD_JOINER}甲` },
		});
		const ed = new FakeEditor("## 甲");
		p.scheduleRenumber(ed, fileInfo("a.md"));

		await p.freezeVaultNumbering();
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0);
	});
});

describe("M12：「不编号」伪模板（testplan K15）与多文件批量重编号（K16）", () => {
	/** 根规则投「默认」+ `sub/` 文件夹规则投「不编号」伪模板。 */
	const noneRules = (): PathRule[] => [
		{ pattern: "/", template: "默认" },
		{ pattern: "sub/", template: NO_NUMBERING_TEMPLATE },
	];

	it("K15：解析命中「不编号」规则时无可用模板，且压过更泛的根规则", () => {
		const { p } = makePlugin({ pathRules: noneRules() });
		expect(p.getTemplateForFile("a.md")).not.toBeNull();
		expect(p.getTemplateForFile("sub/x.md")).toBeNull();
	});

	it("K15：自动路径对「不编号」路径静默跳过，已有编号冻结不动", () => {
		const { p } = makePlugin({ pathRules: noneRules() });
		const ed = new FakeEditor([`## ${WORD_JOINER}1 ${WORD_JOINER}旧章`, "## 新章"].join("\n"));
		p.scheduleRenumber(ed, fileInfo("sub/x.md"));
		vi.advanceTimersByTime(300);
		expect(ed.txnCount).toBe(0); // 不重排、也不剥除已有编号（与 frontmatter false 同语义）。
	});

	it("K15：手动「立即重新编号」弹专用 Notice，而非误导性的「未匹配任何规则」", () => {
		const { p } = makePlugin({ pathRules: noneRules() });
		const ed = new FakeEditor("## 章");
		p.runImmediateRenumber(ed, fileInfo("sub/x.md"));
		expect(ed.txnCount).toBe(0);
		expect(Notice.messages).toContain("当前文件所在路径已设为「不编号」");
		expect(Notice.messages).not.toContain("当前文件未匹配任何路径规则，无法编号");
	});

	it("K16：批量重编号改写规则命中的未打开文件（vault 通道），并汇总完成 Notice", async () => {
		const { p, vaultFiles } = makePlugin({
			vaultFiles: {
				"a.md": "## 甲",
				"b.md": `## ${WORD_JOINER}1 ${WORD_JOINER}乙`, // 已是正确编号 → 无变化。
			},
		});
		await p.batchRenumberRule({ pattern: "/", template: "默认" });
		expect(vaultFiles.get("a.md")).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`);
		expect(vaultFiles.get("b.md")).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}乙`);
		expect(Notice.messages).toContain("批量重编号完成：改写 1 个，无变化 1 个，跳过 0 个");
	});

	it("K16：每个文件用自己解析出的模板——「不编号」子规则接管的文件被跳过、内容冻结", async () => {
		const rules = noneRules();
		const { p, vaultFiles } = makePlugin({
			pathRules: rules,
			vaultFiles: { "a.md": "## 甲", "sub/x.md": "## 乙" },
		});
		await p.batchRenumberRule(rules[0]); // 点的是根规则的批量按钮，sub/x.md 也在其路径模式命中范围内。
		expect(vaultFiles.get("a.md")).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}甲`);
		expect(vaultFiles.get("sub/x.md")).toBe("## 乙"); // 不套用根模板，尊重更具体的「不编号」。
		expect(Notice.messages).toContain("批量重编号完成：改写 1 个，无变化 0 个，跳过 1 个");
	});

	it("K16：frontmatter false 与未接管外来编号的文件被跳过（J10 守卫同源）", async () => {
		const fmOff = ["---", "obsidian-auto-headings: false", "---", "## 甲"].join("\n");
		const foreign = "## 1 红米\n### 1.1 工艺";
		const { p, vaultFiles } = makePlugin({
			vaultFiles: { "off.md": fmOff, "foreign.md": foreign, "ok.md": "## 乙" },
		});
		await p.batchRenumberRule({ pattern: "/", template: "默认" });
		expect(vaultFiles.get("off.md")).toBe(fmOff);
		expect(vaultFiles.get("foreign.md")).toBe(foreign);
		expect(vaultFiles.get("ok.md")).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}乙`);
		expect(Notice.messages).toContain("批量重编号完成：改写 1 个，无变化 0 个，跳过 2 个");
	});

	it("K16：已打开的文件走编辑器单一事务，不经 vault 写回（无竞态覆盖）", async () => {
		const { p, vaultFiles, setLeaves } = makePlugin({
			vaultFiles: { "a.md": "## 落盘旧内容" },
		});
		const ed = new FakeEditor("## 编辑器新内容");
		setLeaves([{ editor: ed, file: { path: "a.md" } }]);
		await p.batchRenumberRule({ pattern: "/", template: "默认" });
		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}编辑器新内容`);
		expect(ed.txnCount).toBe(1);
		expect(vaultFiles.get("a.md")).toBe("## 落盘旧内容"); // vault 侧未被读盘-写回竞态覆盖。
	});

	it("K16：规则未命中任何文件时直接 Notice、不做任何写入", async () => {
		const { p, vaultFiles } = makePlugin({ vaultFiles: { "a.md": "## 甲" } });
		await p.batchRenumberRule({ pattern: "nope/", template: "默认" });
		expect(vaultFiles.get("a.md")).toBe("## 甲");
		expect(Notice.messages).toContain("该规则当前未命中任何 Markdown 文件");
	});
});

describe("清除即暂停 / 重新编号即恢复（1.0.15，testplan H13–H16、I8）", () => {
	const numbered = [
		`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
		"正文",
		`### ${WORD_JOINER}1.1 ${WORD_JOINER}节`,
	].join("\n");

	it("H13：文件仍会被自动重编号时，清除的同时写入 fm:false，且并入同一事务", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(numbered);
		p.runClearNumbering(ed, fileInfo("a.md"));

		const out = ed.getValue();
		expect(out).toBe(
			["---", "obsidian-auto-headings: false", "---", "## 章", "正文", "### 节"].join("\n"),
		);
		// 一次撤销即整体回退——暂停开关不能是第二条撤销记录。
		expect(ed.txnCount).toBe(1);
		expect(Notice.messages.some((m) => m.includes("暂停"))).toBe(true);
	});

	it("H13 回归：清除后再编辑，编号不会被编回去（此前本命令是摆设）", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(numbered);
		p.runClearNumbering(ed, fileInfo("a.md"));

		// 模拟用户继续敲字 → 走自动路径。
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		expect(ed.getValue()).toContain("## 章");
		expect(ed.getValue()).not.toContain(WORD_JOINER);
	});

	it("H14：文件本就不会被自动重编号（全局关）时只清除，不往文件里塞属性", () => {
		const { p } = makePlugin({ autoNumber: false });
		const ed = new FakeEditor(numbered);
		p.runClearNumbering(ed, fileInfo("a.md"));

		expect(ed.getValue()).toBe(["## 章", "正文", "### 节"].join("\n"));
		expect(ed.getValue()).not.toContain("obsidian-auto-headings");
	});

	it("H14：路径规则解析为「不编号」时同样不写属性", () => {
		const { p } = makePlugin({
			autoNumber: true,
			pathRules: [{ pattern: "/", template: NO_NUMBERING_TEMPLATE }],
		});
		const ed = new FakeEditor(numbered);
		p.runClearNumbering(ed, fileInfo("a.md"));
		expect(ed.getValue()).not.toContain("obsidian-auto-headings");
	});

	it("H15：「立即重新编号」移除 fm:false 并恢复接管；该键是唯一一项时整个块一并移除", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(
			["---", "obsidian-auto-headings: false", "---", "## 章"].join("\n"),
		);
		p.runImmediateRenumber(ed, fileInfo("a.md"));

		expect(ed.getValue()).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章`);
		expect(ed.txnCount).toBe(1);
		expect(Notice.messages.some((m) => m.includes("恢复"))).toBe(true);
	});

	it("H15：frontmatter 还有别的键时只删这一行，保留其余属性", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(
			["---", "tags: [a]", "obsidian-auto-headings: false", "---", "## 章"].join("\n"),
		);
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		expect(ed.getValue()).toBe(
			["---", "tags: [a]", "---", `## ${WORD_JOINER}1 ${WORD_JOINER}章`].join("\n"),
		);
	});

	it("H15：fm 为 true（用户的文件级强制 opt-in）不在本命令管辖范围，原样保留", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(
			["---", "obsidian-auto-headings: true", "---", "## 章"].join("\n"),
		);
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		expect(ed.getValue()).toContain("obsidian-auto-headings: true");
	});

	it("H16：已有 frontmatter 且含其他键 → 在闭合符前插入一行，原有键序不动", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(
			["---", "tags: [a]", "---", `## ${WORD_JOINER}1 ${WORD_JOINER}章`].join("\n"),
		);
		p.runClearNumbering(ed, fileInfo("a.md"));
		expect(ed.getValue()).toBe(
			["---", "tags: [a]", "obsidian-auto-headings: false", "---", "## 章"].join("\n"),
		);
	});

	it("H16：已经是 false 时不重复写（此时也不该走「已暂停」文案）", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(
			[
				"---",
				"obsidian-auto-headings: false",
				"---",
				`## ${WORD_JOINER}1 ${WORD_JOINER}章`,
			].join("\n"),
		);
		p.runClearNumbering(ed, fileInfo("a.md"));
		const occurrences = ed.getValue().split("obsidian-auto-headings").length - 1;
		expect(occurrences).toBe(1);
		expect(ed.getValue()).toContain("## 章");
	});

	it("H16：frontmatter 未闭合（畸形）时保守跳过，只清除不改属性", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(
			["---", "tags: [a]", `## ${WORD_JOINER}1 ${WORD_JOINER}章`].join("\n"),
		);
		p.runClearNumbering(ed, fileInfo("a.md"));
		expect(ed.getValue()).toBe(["---", "tags: [a]", "## 章"].join("\n"));
	});

	it("I8：fm:false 的文件改标题后，内链同步**仍然**进行（1.0.15 放宽）", async () => {
		const { p, vaultFiles } = makePlugin({
			autoNumber: true,
			updateBacklinks: true,
			vaultFiles: { "b.md": "见 [[a#旧标题]]" },
		});
		const ed = new FakeEditor(
			["---", "obsidian-auto-headings: false", "---", "## 旧标题"].join("\n"),
		);
		// 先播种快照基线，再模拟用户改标题文本。
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		await flushPromises();
		ed.setValue(["---", "obsidian-auto-headings: false", "---", "## 新标题"].join("\n"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		await flushPromises();

		expect(vaultFiles.get("b.md")).toBe("见 [[a#新标题]]");
		// 同时确认「不自动编号」这一半仍然成立：正文没有被写入编号。
		expect(ed.getValue()).toContain("## 新标题");
		expect(ed.getValue()).not.toContain(WORD_JOINER);
	});
});

describe("光标所在行行尾空白保护（1.0.23 换掉整行冻结，testplan J11）", () => {
	it("J11：光标停在刚敲了行尾空格的标题行上 → 空格保住，但编号照常写入", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一 ", "## 章二"].join("\n"));
		ed.setCursor(0, 5);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		const lines = ed.getValue().split("\n");
		// 行尾空格没被吞（J11 的原始诉求），编号也不再被一起冻掉（J19 的诉求）。
		expect(lines[0]).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章一 `);
		expect(lines[1]).toBe(`## ${WORD_JOINER}2 ${WORD_JOINER}章二`); // 其余行照常。
	});

	it("J11：光标移开后那一轮把行尾空格按既有归一化规则清掉", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一 ", "## 章二"].join("\n"));
		ed.setCursor(0, 5);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		ed.setCursor(1, 0);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		expect(ed.getValue().split("\n")[0]).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章一`);
	});

	it("J11：光标停着不动连跑两轮，第二轮无改动可写（补回空白后与落盘内容逐字节相同）", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一 ", "## 章二"].join("\n"));
		ed.setCursor(0, 5);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		const afterFirst = ed.getValue();
		const txnAfterFirst = ed.txnCount;

		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		expect(ed.getValue()).toBe(afterFirst);
		expect(ed.txnCount).toBe(txnAfterFirst); // 不发空事务，不刷撤销历史。
	});

	it("J11：手动「立即重新编号」不受保护，行尾空白照常归一化", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一 ", "## 章二"].join("\n"));
		ed.setCursor(0, 5);
		p.runImmediateRenumber(ed, fileInfo("a.md"));
		expect(ed.getValue().split("\n")[0]).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}章一`);
	});

	it("J11：快照按**实际落盘内容**记录——补回的行尾空白不产生幻影改名", async () => {
		const { p, vaultFiles } = makePlugin({
			autoNumber: true,
			updateBacklinks: true,
			vaultFiles: { "b.md": "见 [[a#章一]]" },
		});
		const ed = new FakeEditor(["## 章一 ", "## 章二"].join("\n"));
		ed.setCursor(0, 5);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		await flushPromises();
		// 标题文本真的变了（加了编号）⇒ 链接跟着改到带编号的锚点，这是正确的同步。
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}1 ${WORD_JOINER}章一]]`);

		// 光标移开、行尾空白被清掉的那一轮：标题文本（去尾空白后）没变 ⇒ 不该再改一次链接。
		ed.setCursor(1, 0);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		await flushPromises();
		expect(vaultFiles.get("b.md")).toBe(`见 [[a#${WORD_JOINER}1 ${WORD_JOINER}章一]]`);
	});
});

describe("新敲出的标题当轮即编号（1.0.23 真机反馈，testplan J19）", () => {
	it("J19：在空行上新敲一个标题、光标停在行尾 → 本轮就编号，不必再按 Enter", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一", ""].join("\n"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500); // 建立快照基线（此时只有一个标题）。

		// 用户在第 1 行敲出一个**新**标题，光标停在行尾——正是真机复现的操作。
		const typed = "## 新标题";
		ed.setValue([ed.getValue().split("\n")[0], typed].join("\n"));
		ed.setCursor(1, typed.length);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		// 新增标题会让标题数量相对快照变化——曾经的层级判据在这里走保守分支、整行冻结，
		// 于是「不按 Enter 就不编号」。现在不再依赖任何快照推断，本轮直接写入。
		expect(ed.getValue().split("\n")[1]).toBe(`## ${WORD_JOINER}2 ${WORD_JOINER}新标题`);
	});

	it("J19：新敲的标题末尾带空格 → 编号照写，空格同样保住", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一", ""].join("\n"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		const typed = "## 新标题 ";
		ed.setValue([ed.getValue().split("\n")[0], typed].join("\n"));
		ed.setCursor(1, typed.length);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		expect(ed.getValue().split("\n")[1]).toBe(`## ${WORD_JOINER}2 ${WORD_JOINER}新标题 `);
	});

	it("J19：写回只覆盖真正变化的那一段，不整行替换（光标不被甩走）", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor("## 章一");
		ed.setCursor(0, 5);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		// 前缀插在行首（`## ` 之后），变更范围不该延伸到用户光标所在的行尾。
		const change = ed.lastChanges[0];
		expect(change.from.ch).toBe(3);
		expect(change.to?.ch).toBe(3); // 纯插入：起止相同，一个字符都没被替换掉。
		expect(change.text).toBe(`${WORD_JOINER}1 ${WORD_JOINER}`);
	});
});

describe("光标所在行保护精确化（2026-08-09 用户体验反馈，testplan J16）", () => {
	it("J16：光标所在行标题层级变化时立即生效，不必等光标移开", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一", "## 章二"].join("\n"));
		// 先在光标不在该行时跑一轮，建立快照基线（「章一」在 H2 层级已编号）。
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);
		const numbered = ed.getValue().split("\n");

		// 模拟用户把「章一」从 H2 升级为 H3（多敲一个 #），光标仍停在该行。
		const staleLine0 = `#${numbered[0]}`;
		ed.setValue([staleLine0, numbered[1]].join("\n"));
		ed.setCursor(0, 4);

		// 用另一份相同内容的编辑器跑「立即重新编号」（不受任何保护）取期望的 ground truth——
		// 必须用**不同的路径**：同一个插件实例的 headingSnapshots 按路径存储，用 "a.md" 会把
		// 刚建立的基线快照覆盖成这次 ground truth 的结果，污染下面真正要测的那次自动路径判断。
		const expectedEd = new FakeEditor(ed.getValue());
		p.runImmediateRenumber(expectedEd, fileInfo("ground-truth.md"));

		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		// 层级相对基线已变 ⇒ 不再整行冻结：自动路径本轮应与「立即重新编号」结果一致。
		expect(ed.getValue()).toBe(expectedEd.getValue());
		expect(ed.getValue().split("\n")[0]).not.toBe(staleLine0);
		expect(ed.getValue().split("\n")[0].startsWith("### ")).toBe(true);
	});

	it("J16：已编号标题仅追加行尾空格（层级未变）时仍受保护，不吞空格", () => {
		const { p } = makePlugin({ autoNumber: true });
		const ed = new FakeEditor(["## 章一", "## 章二"].join("\n"));
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500); // 建立快照基线。
		const numbered = ed.getValue().split("\n");

		// 章一标题末尾追加一个空格，准备继续输入；层级不变，仍是 H2。
		ed.setValue([`${numbered[0]} `, numbered[1]].join("\n"));
		ed.setCursor(0, numbered[0].length + 1);
		p.scheduleRenumber(ed, fileInfo("a.md"));
		vi.advanceTimersByTime(500);

		expect(ed.getValue().split("\n")[0]).toBe(`${numbered[0]} `); // 行尾空格原样保留，未被吃掉。
	});
});
