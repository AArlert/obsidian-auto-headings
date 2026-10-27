/**
 * 只读目录块 `ah-toc` 的单元测试（M17-B，见 src/virtual/tocBlock.ts 与 testplan V54–V62）。
 *
 * 纯函数（`parseTocLevels` / `buildTocTree`）直接测；渲染器用一个只记结构的假元素模拟 Obsidian 的
 * `createEl` / `createSpan` / `appendText` / `empty`，测「编号来自虚拟编号、写入模式不叠加、读不到内容退化、
 * 元数据变化原地重画、卸载注销」。真实观感、PDF、实时预览留真机手验。
 */
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPLATE, WORD_JOINER } from "../../src/numbering";
import { parseHeadings } from "../../src/parser";
import { computeVirtualNumbers } from "../../src/virtual/compute";
import {
	buildTocTree,
	parseTocLevels,
	TocBlockRenderer,
	type TocHeading,
	type TocNode,
} from "../../src/virtual/tocBlock";

const WJ = WORD_JOINER;

/** 按 metadataCache 的样子，从正文造标题（原文含 WJ 时原样保留）。 */
function headingsOf(content: string): TocHeading[] {
	const lines = content.split("\n");
	return lines.flatMap((line, i) => {
		const m = /^(#{1,6}) (.*)$/.exec(line);
		return m ? [{ level: m[1].length, heading: m[2], position: { start: { line: i } } }] : [];
	});
}

/** 压平成「缩进 + 编号 + 文字」便于断言。 */
function flat(nodes: TocNode[], depth = 0): string[] {
	return nodes.flatMap((n) => [
		`${"  ".repeat(depth)}${n.label ?? ""}${n.text}`,
		...flat(n.children, depth + 1),
	]);
}

describe("parseTocLevels：levels 参数（testplan V57）", () => {
	it("范围 / 单级 / 缺省", () => {
		expect(parseTocLevels("levels: 2-3")).toEqual({ min: 2, max: 3 });
		expect(parseTocLevels("levels: 3")).toEqual({ min: 3, max: 3 });
		expect(parseTocLevels("")).toEqual({ min: 1, max: 6 });
		expect(parseTocLevels("  LEVELS :  1 - 4  ")).toEqual({ min: 1, max: 4 });
	});

	it("非法值一律当作全部级别，不报错", () => {
		for (const bad of ["levels: abc", "levels: 5-2", "levels: 0-9", "levels: 7", "levels:"]) {
			expect(parseTocLevels(bad)).toEqual({ min: 1, max: 6 });
		}
	});
});

describe("buildTocTree：嵌套、编号与过滤（testplan V54 / V57 / V58）", () => {
	const doc = ["# 书名", "## 甲", "### 甲一", "## 乙"].join("\n");

	it("仅显示文件：按行号带虚拟编号；默认模板 H1 不编号仍列出", () => {
		const tree = buildTocTree(headingsOf(doc), computeVirtualNumbers(doc, DEFAULT_TEMPLATE));
		expect(flat(tree)).toEqual(["书名", "  1 甲", "    1.1 甲一", "  2 乙"]);
	});

	it("没有编号数据（写入模式 / 门控不过）→ 目录照出，只是不带虚拟编号", () => {
		expect(flat(buildTocTree(headingsOf(doc), null))).toEqual([
			"书名",
			"  甲",
			"    甲一",
			"  乙",
		]);
	});

	it("levels 范围外不收录；跳级与文首深标题", () => {
		const range = { min: 2, max: 3 };
		expect(flat(buildTocTree(headingsOf(doc), null, range))).toEqual(["甲", "  甲一", "乙"]);
		const skip = ["# 一", "### 三", "## 二"].join("\n");
		expect(flat(buildTocTree(headingsOf(skip), null))).toEqual(["一", "  三", "  二"]);
		const deepFirst = ["### 深", "## 浅", "# 根"].join("\n");
		expect(flat(buildTocTree(headingsOf(deepFirst), null))).toEqual(["深", "浅", "根"]);
	});

	it("残留旧编号标题不叠加虚拟编号；写入模式的 WJ 不显示、锚点保留 WJ（V55 / V58）", () => {
		const stale = ["## 甲", `## ${WJ}9 ${WJ}乙`].join("\n");
		const tree = buildTocTree(
			headingsOf(stale),
			computeVirtualNumbers(stale, DEFAULT_TEMPLATE),
		);
		expect(flat(tree)).toEqual(["1 甲", "9 乙"]);
		expect(tree[1].label).toBeNull();
		expect(tree[1].anchor).toBe(`${WJ}9 ${WJ}乙`);
	});

	it("级别与编号数据对不上（目录与内容未同步）→ 该项不带编号；空标题跳过", () => {
		const labels = computeVirtualNumbers(doc, DEFAULT_TEMPLATE);
		const heads = headingsOf(doc);
		heads[1] = { ...heads[1], level: 3 };
		expect(flat(buildTocTree(heads, labels))).toEqual(["书名", "  甲", "  1.1 甲一", "  2 乙"]);
		expect(
			buildTocTree(
				[{ level: 2, heading: ` ${WJ} `, position: { start: { line: 0 } } }],
				null,
			),
		).toEqual([]);
	});
});

/** 假元素：只记结构，模拟 Obsidian 在 HTMLElement 上扩展的建节点方法。 */
class FakeEl {
	children: FakeEl[] = [];
	text = "";
	listeners = new Map<string, (evt: unknown) => void>();
	constructor(
		public tag = "div",
		public cls = "",
	) {}
	createEl(tag: string, o: { cls?: string; text?: string } = {}): FakeEl {
		const el = new FakeEl(tag, o.cls ?? "");
		el.text = o.text ?? "";
		this.children.push(el);
		return el;
	}
	createSpan(o: { cls?: string; text?: string } = {}): FakeEl {
		return this.createEl("span", o);
	}
	appendText(t: string): void {
		this.text += t;
	}
	empty(): void {
		this.children = [];
		this.text = "";
	}
	addEventListener(type: string, fn: (evt: unknown) => void): void {
		this.listeners.set(type, fn);
	}
	/** 压平成可读文本：编号 span + 文字，嵌套按缩进。 */
	dump(depth = 0): string[] {
		return this.children.flatMap((c) => {
			if (c.tag === "ul") {
				return c.dump(depth);
			}
			if (c.tag === "li") {
				const a = c.children[0];
				const num = a.children.find((x) => x.cls === "ah-virtual-number")?.text ?? "";
				const nested = c.children.slice(1).flatMap((x) => x.dump(depth + 1));
				return [`${"  ".repeat(depth)}${num}${a.text}`, ...nested];
			}
			return [];
		});
	}
}

async function flush(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
}

function makeHost(files: Record<string, string>, virtual: Set<string>) {
	return {
		virtualNumberingFor: vi.fn((path: string, content: string) =>
			virtual.has(path) ? computeVirtualNumbers(content, DEFAULT_TEMPLATE) : null,
		),
		readFileContent: vi.fn(async (path: string) => files[path] ?? null),
		cachedHeadings: vi.fn((path: string) => (path in files ? headingsOf(files[path]) : null)),
		openHeadingLink: vi.fn(),
	};
}

/** 模拟 Obsidian 调用处理器：ctx.addChild 立刻 load。 */
function mount(renderer: TocBlockRenderer, source: string, path: string) {
	const el = new FakeEl();
	const children: Array<{ onload(): void; onunload(): void }> = [];
	renderer.processor(
		source,
		el as unknown as HTMLElement,
		{
			sourcePath: path,
			addChild: (c: { onload(): void; onunload(): void }) => {
				children.push(c);
				c.onload();
			},
		} as never,
	);
	return { el, children };
}

describe("TocBlockRenderer：渲染、更新与退化（testplan V54 / V56 / V60 / V62）", () => {
	const doc = ["## 甲", "### 甲一", "## 乙"].join("\n");

	it("仅显示文件渲染带编号的嵌套目录；点击走 openHeadingLink（Ctrl 新开）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		const { el } = mount(new TocBlockRenderer(host), "", "v.md");
		await flush();
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
		const a = el.children[0].children[0].children[0];
		const evt = { preventDefault: vi.fn(), ctrlKey: true, metaKey: false };
		a.listeners.get("click")?.(evt);
		expect(evt.preventDefault).toHaveBeenCalled();
		expect(host.openHeadingLink).toHaveBeenCalledWith("v.md#甲", "v.md", true);
	});

	it("元数据变化 / 设置变化 → 原地重画；其他文件的块不动", async () => {
		const files: Record<string, string> = { "v.md": doc, "w.md": doc };
		const virtual = new Set(["v.md", "w.md"]);
		const host = makeHost(files, virtual);
		const renderer = new TocBlockRenderer(host);
		const a = mount(renderer, "", "v.md");
		const b = mount(renderer, "", "w.md");
		await flush();
		files["v.md"] = ["## 新", doc].join("\n");
		renderer.refreshPath("v.md");
		await flush();
		expect(a.el.dump()).toEqual(["1 新", "2 甲", "  2.1 甲一", "3 乙"]);
		expect(b.el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
		virtual.clear(); // 规则改成写入：编号消失
		renderer.refreshAll();
		await flush();
		expect(a.el.dump()).toEqual(["新", "甲", "  甲一", "乙"]);
	});

	it("levels 参数生效；没有标题 → 块为空", async () => {
		const host = makeHost({ "v.md": doc, "e.md": "正文" }, new Set(["v.md"]));
		const r = new TocBlockRenderer(host);
		expect(mount(r, "levels: 3", "v.md").el.dump()).toEqual([]);
		await flush();
		const m = mount(r, "levels: 3", "v.md");
		const e = mount(r, "", "e.md");
		await flush();
		expect(m.el.dump()).toEqual(["1.1 甲一"]);
		expect(e.el.children).toEqual([]);
	});

	it("读不到文件内容 → 退化为不带编号的目录，不抛（V60）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		host.readFileContent.mockResolvedValue(null);
		const { el } = mount(new TocBlockRenderer(host), "", "v.md");
		await flush();
		expect(el.dump()).toEqual(["甲", "  甲一", "乙"]);
	});

	it("取标题抛错 → 保持原样、不抛；卸载后不再响应刷新（V60 / V62）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		const renderer = new TocBlockRenderer(host);
		const { el, children } = mount(renderer, "", "v.md");
		await flush();
		host.cachedHeadings.mockImplementation(() => {
			throw new Error("boom");
		});
		renderer.refreshAll();
		await flush();
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
		children[0].onunload();
		host.cachedHeadings.mockImplementation(() => []);
		renderer.refreshAll();
		await flush();
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
	});
});

// 防止 parseHeadings 导入被 tree-shake 误报未使用：与 parser 口径一致性的轻量核对。
describe("与解析器口径一致", () => {
	it("测试夹具的标题识别与 parseHeadings 行号一致", () => {
		const doc = ["# a", "正文", "## b"].join("\n");
		expect(headingsOf(doc).map((h) => h.position.start.line)).toEqual(
			parseHeadings(doc).map((h) => h.lineIndex),
		);
	});
});
