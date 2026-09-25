/**
 * 内置大纲面板显示虚拟编号的单元测试（1.2.0，见 src/virtual/outlineView.ts 与 testplan V40–V45）。
 *
 * 大纲是 Obsidian 核心插件的内部视图：这里用假对象模拟它的最小结构（`file` + 条目数组
 * `cachedHeadingDom`，条目带 `heading` 与 `innerEl`），测「按行号 + 级别对编号」、刷新 / 设置 / 卸载
 * 时的增删，以及结构不认识时的静默。条目元素只需读写属性，不引入 jsdom。真实大纲的观感、搜索过滤、
 * 虚拟滚动留真机手验。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPLATE, WORD_JOINER } from "../../src/numbering";
import { parseHeadings } from "../../src/parser";
import { computeVirtualNumbers } from "../../src/virtual/compute";
import {
	OUTLINE_NUMBER_ATTR,
	pickOutlineLabels,
	setOutlineLabel,
	VirtualOutlineDecorator,
	type OutlineItemLike,
	type OutlineViewLike,
} from "../../src/virtual/outlineView";

const WJ = WORD_JOINER;

/** 假的 `.tree-item-inner`：只记属性，另外数一下写了几次。 */
class FakeInner {
	readonly attrs = new Map<string, string>();
	writes = 0;
	getAttribute(name: string): string | null {
		return this.attrs.get(name) ?? null;
	}
	setAttribute(name: string, value: string): void {
		this.writes++;
		this.attrs.set(name, value);
	}
	removeAttribute(name: string): void {
		this.writes++;
		this.attrs.delete(name);
	}
	get label(): string | null {
		return this.getAttribute(OUTLINE_NUMBER_ATTR);
	}
}

type FakeItem = OutlineItemLike & { innerEl: FakeInner };

/** 按 Obsidian 大纲的样子，从正文造条目（每个标题一个，带行号与级别）。 */
function itemsFor(content: string): FakeItem[] {
	return parseHeadings(content).map((h) => ({
		heading: { level: h.level, heading: h.text, position: { start: { line: h.lineIndex } } },
		innerEl: new FakeInner(),
	}));
}

function outlineView(path: string | null, content: string) {
	return {
		file: path === null ? null : { path },
		cachedHeadingDom: itemsFor(content),
		contentEl: {},
	} as OutlineViewLike & { cachedHeadingDom: FakeItem[]; file: { path: string } | null };
}

const labelsOf = (view: { cachedHeadingDom: FakeItem[] }) =>
	view.cachedHeadingDom.map((i) => i.innerEl.label);

/** 排空微任务（核对排在微任务里，读文件是异步的）。 */
async function flush(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
}

function makeHost(files: Record<string, string>, virtual: Set<string>) {
	return {
		enabled: true,
		virtualNumberingFor: vi.fn((path: string, content: string) =>
			virtual.has(path) ? computeVirtualNumbers(content, DEFAULT_TEMPLATE) : null,
		),
		readFileContent: vi.fn(async (path: string) => files[path] ?? null),
		outlineNumbersEnabled() {
			return this.enabled;
		},
	};
}

function makeWorkspace(views: unknown[]) {
	return {
		views,
		getLeavesOfType: (type: string) =>
			type === "outline" ? views.map((view) => ({ view })) : [],
	};
}

describe("pickOutlineLabels：条目按行号 + 级别对编号（testplan V40 / V42 / V45）", () => {
	const content = ["# 书名", "## 甲", "### 甲一", "## 乙"].join("\n");
	const labels = computeVirtualNumbers(content, DEFAULT_TEMPLATE);

	it("按行号取编号；默认模板 H1 不编号", () => {
		expect(pickOutlineLabels(itemsFor(content), labels)).toEqual([null, "1 ", "1.1 ", "2 "]);
	});

	it("不是仅显示文件（没有编号）→ 全不画", () => {
		expect(pickOutlineLabels(itemsFor(content), null)).toEqual([null, null, null, null]);
	});

	it("级别对不上（大纲还没跟上刚改的内容）→ 不画，宁缺勿错", () => {
		const items = itemsFor(content);
		(items[1].heading as { level: number }).level = 3;
		expect(pickOutlineLabels(items, labels)).toEqual([null, null, "1.1 ", "2 "]);
	});

	it("以 WJ 开头的残留旧编号标题不画：大纲只能显示原文，叠上去就是两层数字", () => {
		const stale = ["## 甲", `## ${WJ}9 ${WJ}乙`].join("\n");
		expect(
			pickOutlineLabels(itemsFor(stale), computeVirtualNumbers(stale, DEFAULT_TEMPLATE)),
		).toEqual(["1 ", null]);
	});

	it("条目结构不认识（缺行号 / 级别）→ 不画、不抛", () => {
		const items: OutlineItemLike[] = [
			{},
			{ heading: { level: 2 } },
			{ heading: { position: {} } },
		];
		expect(pickOutlineLabels(items, labels)).toEqual([null, null, null]);
	});
});

describe("setOutlineLabel：原地改属性", () => {
	it("写入、改写、去掉；与现值相同不动 DOM", () => {
		const el = new FakeInner();
		setOutlineLabel(el, "1 ");
		setOutlineLabel(el, "1 ");
		expect(el.label).toBe("1 ");
		expect(el.writes).toBe(1);
		setOutlineLabel(el, "2 ");
		expect(el.label).toBe("2 ");
		setOutlineLabel(el, null);
		setOutlineLabel(el, null);
		expect(el.label).toBeNull();
		expect(el.writes).toBe(3);
	});
});

describe("VirtualOutlineDecorator：挂载、刷新、设置开关与卸载（testplan V40 / V41 / V43–V45）", () => {
	const doc = ["## 甲", "### 甲一", "## 乙"].join("\n");

	it("只认大纲视图；仅显示文件画上与编辑器一致的编号，写入模式文件不画（V40）", async () => {
		const files = { "v.md": doc, "w.md": doc };
		const host = makeHost(files, new Set(["v.md"]));
		const virtualView = outlineView("v.md", doc);
		const writeView = outlineView("w.md", doc);
		const ws = makeWorkspace([virtualView, writeView, { deferred: true }, null]);
		const d = new VirtualOutlineDecorator(host, ws);
		d.attachAll();
		await flush();
		expect(d.trackedCount).toBe(2);
		expect(labelsOf(virtualView)).toEqual(["1 ", "1.1 ", "2 "]);
		expect(labelsOf(writeView)).toEqual([null, null, null]);
	});

	it("大纲按自己所示的文件算编号，与活动文件无关（V44）", async () => {
		const host = makeHost(
			{ "a.md": "## 甲", "b.md": "## 甲\n## 乙" },
			new Set(["a.md", "b.md"]),
		);
		const pinned = outlineView("b.md", "## 甲\n## 乙");
		const d = new VirtualOutlineDecorator(host, makeWorkspace([pinned]));
		d.attachAll();
		await flush();
		expect(labelsOf(pinned)).toEqual(["1 ", "2 "]);
		expect(host.readFileContent).toHaveBeenCalledWith("b.md");
	});

	it("大纲刷新（观察器看到条目文字被重写）→ 按新内容重新核对全部条目，含屏幕外的（V41）", async () => {
		const callbacks: Array<() => void> = [];
		class FakeObserver {
			constructor(cb: () => void) {
				callbacks.push(cb);
			}
			observe = vi.fn();
			disconnect = vi.fn();
		}
		vi.stubGlobal("MutationObserver", FakeObserver);
		try {
			const files: Record<string, string> = { "v.md": doc };
			const host = makeHost(files, new Set(["v.md"]));
			const view = outlineView("v.md", doc);
			const d = new VirtualOutlineDecorator(host, makeWorkspace([view]));
			d.attachAll();
			await flush();
			expect(labelsOf(view)).toEqual(["1 ", "1.1 ", "2 "]);

			// 在最前面插入一个标题：大纲重建条目（行号全部后移），编号跟着变。
			const next = ["## 新", "## 甲", "### 甲一", "## 乙"].join("\n");
			files["v.md"] = next;
			view.cachedHeadingDom = itemsFor(next);
			callbacks[0]();
			callbacks[0](); // 同一轮的多次变化只核对一次
			await flush();
			expect(labelsOf(view)).toEqual(["1 ", "2 ", "2.1 ", "3 "]);
			expect(host.readFileContent).toHaveBeenCalledTimes(2);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("设置关掉 → 编号立即去掉、观察器摘掉；再打开立即恢复；卸载后不留属性（V43）", async () => {
		const disconnect = vi.fn();
		vi.stubGlobal(
			"MutationObserver",
			class {
				observe = vi.fn();
				disconnect = disconnect;
			},
		);
		try {
			const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
			const view = outlineView("v.md", doc);
			const d = new VirtualOutlineDecorator(host, makeWorkspace([view]));
			d.attachAll();
			await flush();
			expect(labelsOf(view)).toEqual(["1 ", "1.1 ", "2 "]);

			host.enabled = false;
			d.refreshAll();
			await flush();
			expect(labelsOf(view)).toEqual([null, null, null]);
			expect(d.trackedCount).toBe(0);
			expect(disconnect).toHaveBeenCalledTimes(1);

			host.enabled = true;
			d.refreshAll();
			await flush();
			expect(labelsOf(view)).toEqual(["1 ", "1.1 ", "2 "]);

			d.dispose();
			expect(labelsOf(view)).toEqual([null, null, null]);
			d.attachAll(); // 卸载后不再挂任何东西
			await flush();
			expect(labelsOf(view)).toEqual([null, null, null]);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("规则 / 模板变了（refreshAll 作废缓存）→ 写入 ↔ 仅显示切换后编号随之出现 / 消失", async () => {
		const virtual = new Set<string>();
		const host = makeHost({ "v.md": doc }, virtual);
		const view = outlineView("v.md", doc);
		const d = new VirtualOutlineDecorator(host, makeWorkspace([view]));
		d.attachAll();
		await flush();
		expect(labelsOf(view)).toEqual([null, null, null]);
		virtual.add("v.md");
		d.refreshAll();
		await flush();
		expect(labelsOf(view)).toEqual(["1 ", "1.1 ", "2 "]);
		virtual.delete("v.md");
		d.refreshAll();
		await flush();
		expect(labelsOf(view)).toEqual([null, null, null]);
	});

	it("同一内容反复核对只算一次（字符串比较命中缓存）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		const view = outlineView("v.md", doc);
		const d = new VirtualOutlineDecorator(host, makeWorkspace([view]));
		d.attachAll();
		await flush();
		await d.sync(view);
		await d.sync(view);
		expect(host.virtualNumberingFor).toHaveBeenCalledTimes(1);
	});

	it("读文件期间大纲换了文件 → 这一轮作废，按新文件再核对一次（V44）", async () => {
		let release: (v: string) => void = () => {};
		const files: Record<string, string> = { "b.md": "## 乙\n## 丙" };
		const host = makeHost(files, new Set(["a.md", "b.md"]));
		host.readFileContent.mockImplementationOnce(
			() => new Promise<string>((resolve) => (release = resolve)),
		);
		const view = outlineView("a.md", "## 甲");
		const d = new VirtualOutlineDecorator(host, makeWorkspace([view]));
		d.attachAll();
		await flush();
		view.file = { path: "b.md" };
		view.cachedHeadingDom = itemsFor(files["b.md"]);
		release("## 甲");
		await flush();
		expect(labelsOf(view)).toEqual(["1 ", "2 "]);
	});

	it("取不到大纲内部结构 → 什么都不做、不抛（V45）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		const broken = {
			file: { path: "v.md" },
			cachedHeadingDom: [{ heading: null, innerEl: 42 }],
		};
		const throwing = {
			getLeavesOfType: () => {
				throw new Error("internal API changed");
			},
		};
		const d1 = new VirtualOutlineDecorator(host, makeWorkspace([broken]));
		d1.attachAll();
		await flush();
		expect(d1.trackedCount).toBe(1);
		const d2 = new VirtualOutlineDecorator(host, throwing);
		expect(() => d2.attachAll()).not.toThrow();
		expect(d2.trackedCount).toBe(0);
	});
});

describe("防御：环境里没有 MutationObserver（node）时照样能挂载与核对", () => {
	beforeEach(() => {
		vi.stubGlobal("MutationObserver", undefined);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("挂载即核对一次", async () => {
		const host = makeHost({ "v.md": "## 甲" }, new Set(["v.md"]));
		const view = outlineView("v.md", "## 甲");
		const d = new VirtualOutlineDecorator(host, makeWorkspace([view]));
		d.attachAll();
		await flush();
		expect(labelsOf(view)).toEqual(["1 "]);
	});
});
