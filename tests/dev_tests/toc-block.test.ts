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
	parseTocDepth,
	parseTocSlider,
	pickTocLevel,
	rewriteTocBlock,
	tocInsertText,
	selectableLevels,
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
		`${"  ".repeat(depth + n.gap)}${n.label ?? ""}${n.text}`,
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
		expect(flat(buildTocTree(headingsOf(skip), null))).toEqual(["一", "    三", "  二"]);
		const deepFirst = ["### 深", "## 浅", "# 根"].join("\n");
		expect(flat(buildTocTree(headingsOf(deepFirst), null))).toEqual(["    深", "  浅", "根"]);
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
		expect(flat(buildTocTree(heads, labels)).map((l) => l.trim())).toEqual([
			"书名",
			"甲",
			"1.1 甲一",
			"2 乙",
		]);
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
	addClass(_c: string): void {}
	setAttr(_k: string, _v: string): void {}
	setText(t: string): void {
		this.text = t;
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
			if (c.tag === "ul" || c.tag === "div") {
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
		processFile: vi.fn(async (path: string, transform: (c: string) => string | null) => {
			const r = transform(files[path]);
			if (r !== null) {
				files[path] = r;
			}
		}),
	};
}

/** 模拟 Obsidian 调用处理器：ctx.addChild 立刻 load。 */
function mount(
	renderer: TocBlockRenderer,
	source: string,
	path: string,
	section: { lineStart: number; lineEnd: number } | null = null,
) {
	const el = new FakeEl();
	const children: Array<{ onload(): void; onunload(): void }> = [];
	const done = renderer.processor(
		source,
		el as unknown as HTMLElement,
		{
			sourcePath: path,
			getSectionInfo: () => section,
			addChild: (c: { onload(): void; onunload(): void }) => {
				children.push(c);
				c.onload();
			},
		} as never,
	);
	return { el, children, done };
}

describe("TocBlockRenderer：渲染、更新与退化（testplan V54 / V56 / V60 / V62）", () => {
	const doc = ["## 甲", "### 甲一", "## 乙"].join("\n");

	it("仅显示文件渲染带编号的嵌套目录；点击走 openHeadingLink（Ctrl 新开）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		const { el } = mount(new TocBlockRenderer(host), "", "v.md");
		await flush();
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
		const a = el.children[0].children[0].children[0].children[0];
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
		expect(e.el.dump()).toEqual([]);
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

describe("滑块（testplan V63–V67）", () => {
	const doc = ["## 甲", "### 甲一", "#### 甲一一", "## 乙"].join("\n");

	it("slider 参数的写法（V66）", () => {
		for (const ok of [
			"slider",
			"  SLIDER  ",
			"slider: on",
			"slider: true",
			"slider: yes",
			"slider: 1",
		]) {
			expect(parseTocSlider(ok)).toBe(true);
		}
		for (const no of [
			"",
			"slider: off",
			"slider: false",
			"slider: 0",
			"sliders",
			"levels: 2",
		]) {
			expect(parseTocSlider(no)).toBe(false);
		}
		expect(parseTocSlider("levels: 2-3\nslider")).toBe(true);
	});

	it("可选级别 = levels 范围内文件里实际存在的级别（V64）", () => {
		const heads = headingsOf(doc);
		expect(selectableLevels(heads, { min: 1, max: 6 })).toEqual([2, 3, 4]);
		expect(selectableLevels(heads, { min: 2, max: 3 })).toEqual([2, 3]);
		expect(selectableLevels(heads, { min: 4, max: 4 })).toEqual([4]);
		expect(selectableLevels([], { min: 1, max: 6 })).toEqual([]);
	});

	function sliderOf(el: FakeEl) {
		const bar = el.children.find((c) => c.cls === "ah-toc-bar");
		return {
			bar,
			input: bar?.children.find((c) => c.cls === "ah-toc-slider"),
			label: bar?.children.find((c) => c.cls === "ah-toc-slider-label"),
		};
	}

	it("默认最深一级；拖动只重画列表、不重建滑块；标签跟着变（V63）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		const { el } = mount(new TocBlockRenderer(host), "slider", "v.md");
		await flush();
		const { input, label } = sliderOf(el);
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一", "    1.1.1 甲一一", "2 乙"]);
		expect(label?.text).toBe("H4");
		input?.listeners.get("input")?.({ target: { value: "0" } });
		expect(el.dump()).toEqual(["1 甲", "2 乙"]);
		expect(sliderOf(el).input).toBe(input); // 同一个滑块元素，拖动不丢焦点
		expect(label?.text).toBe("H2");
		input?.listeners.get("input")?.({ target: { value: "1" } });
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
	});

	it("没写 slider / 范围内只剩一个级别 → 没有滑块（V64）", async () => {
		const host = makeHost({ "v.md": doc }, new Set(["v.md"]));
		const r = new TocBlockRenderer(host);
		const plain = mount(r, "", "v.md");
		const single = mount(r, "slider\nlevels: 3", "v.md");
		const ranged = mount(r, "slider\nlevels: 2-3", "v.md");
		await flush();
		expect(sliderOf(plain.el).bar).toBeUndefined();
		expect(sliderOf(single.el).bar).toBeUndefined();
		expect(single.el.dump()).toEqual(["1.1 甲一"]);
		expect(sliderOf(ranged.el).label?.text).toBe("H3");
		expect(ranged.el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
	});

	it("拖过之后文件变了：沿用选中级别；级别不存在了夹到现有范围；范围变了才重建滑块（V65）", async () => {
		const files: Record<string, string> = { "v.md": doc };
		const host = makeHost(files, new Set(["v.md"]));
		const renderer = new TocBlockRenderer(host);
		const { el } = mount(renderer, "slider", "v.md");
		await flush();
		const first = sliderOf(el).input;
		first?.listeners.get("input")?.({ target: { value: "1" } });
		files["v.md"] = ["## 新", doc].join("\n");
		renderer.refreshPath("v.md");
		await flush();
		expect(el.dump()).toEqual(["1 新", "2 甲", "  2.1 甲一", "3 乙"]);
		expect(sliderOf(el).input).toBe(first); // 范围没变，滑块还是原来的
		files["v.md"] = ["## 甲", "### 甲一", "## 乙"].join("\n"); // 最深一级（H4）没了
		renderer.refreshPath("v.md");
		await flush();
		expect(sliderOf(el).label?.text).toBe("H3");
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一", "2 乙"]);
		expect(sliderOf(el).input).not.toBe(first); // 范围变了，重建
	});
});

describe("边界：缩进相对、跳级、乱序（testplan V69 / V70）", () => {
	const tree = (doc: string, range?: { min: number; max: number }) =>
		buildTocTree(headingsOf(doc), null, range);

	it("只有 H3–H5：H3 是顶层不缩进，H4 / H5 依次下一层，不空出两层缩进（V69）", () => {
		const doc = ["### 甲", "#### 甲一", "##### 甲一一", "### 乙"].join("\n");
		const t = tree(doc);
		expect(flat(t)).toEqual(["甲", "  甲一", "    甲一一", "乙"]);
		expect(t.map((n) => n.level)).toEqual([3, 3]); // 两个根都是 H3
	});

	it("只有 H3–H5 且仅显示：模板顶层覆盖不到的级别照列出、只是没编号；滑块是 3 档（V69）", () => {
		const doc = ["### 甲", "#### 甲一", "##### 甲一一"].join("\n");
		const labels = computeVirtualNumbers(doc, DEFAULT_TEMPLATE);
		const t = buildTocTree(headingsOf(doc), labels);
		expect(flat(t).map((x) => x.trim())).toHaveLength(3);
		expect(selectableLevels(headingsOf(doc), { min: 1, max: 6 })).toEqual([3, 4, 5]);
	});

	it("跳级的标题按它自己的级别对齐：H3 下直接出现的 H5 与别处 H4 下的 H5 同一缩进（V70，用户实测反馈）", () => {
		const doc = [
			"### 只有三级起步",
			"#### 四级一",
			"##### 五级一",
			"### 又一个三级",
			"##### 跳过四级的五级",
		].join("\n");
		const lines = flat(tree(doc));
		expect(lines).toEqual([
			"只有三级起步",
			"  四级一",
			"    五级一",
			"又一个三级",
			"    跳过四级的五级",
		]);
		const indent = (t: string) => lines.find((l) => l.trim() === t)!.search(/\S/);
		expect(indent("跳过四级的五级")).toBe(indent("五级一"));
	});

	it("跳级与乱序：H3→H5→H4；文首 H4 后才有 H3（V70）", () => {
		expect(flat(tree(["### 甲", "##### 乙", "#### 丙"].join("\n")))).toEqual([
			"甲",
			"    乙",
			"  丙",
		]);
		expect(flat(tree(["#### 深", "### 浅", "#### 浅下"].join("\n")))).toEqual([
			"  深",
			"浅",
			"  浅下",
		]);
	});
});

describe("depth：解析、选级与落盘（testplan V65 / V67 / V71 / V72）", () => {
	it("parseTocDepth / pickTocLevel（V72）", () => {
		expect(parseTocDepth("slider\ndepth: 3")).toBe(3);
		for (const bad of ["", "depth: abc", "depth: 0", "depth: 9", "depth:"]) {
			expect(parseTocDepth(bad)).toBeNull();
		}
		expect(pickTocLevel([3, 5], null)).toBe(5); // 缺省最深
		expect(pickTocLevel([3, 5], 4)).toBe(3); // 不超过它的最大现存级别
		expect(pickTocLevel([3, 5], 5)).toBe(5);
		expect(pickTocLevel([3, 5], 1)).toBe(3); // 全比它深取最浅
	});

	const doc = ["# 书名", "", "```ah-toc", "slider", "```", "", "## 甲"].join("\n");

	it("rewriteTocBlock：追加 / 改写 / 多行只留一行 / 其余字节不变（V67 / V71）", () => {
		const r = rewriteTocBlock(doc, 2, 4, "slider", 3);
		expect(r?.content).toBe(
			["# 书名", "", "```ah-toc", "slider", "depth: 3", "```", "", "## 甲"].join("\n"),
		);
		expect(r?.source).toBe("slider\ndepth: 3");
		const again = rewriteTocBlock(r!.content, 2, 5, r!.source, 2);
		expect(again?.source).toBe("slider\ndepth: 2");
		const dup = ["```ah-toc", "depth: 1", "slider", "depth: 2", "```"].join("\n");
		expect(rewriteTocBlock(dup, 0, 4, "depth: 1\nslider\ndepth: 2", 4)?.source).toBe(
			"depth: 4\nslider",
		);
	});

	it("rewriteTocBlock：校验不过一律返回 null，绝不盲写（V71）", () => {
		expect(rewriteTocBlock(doc, 3, 4, "slider", 3)).toBeNull(); // 开头行不是围栏
		expect(rewriteTocBlock(doc, 2, 3, "slider", 3)).toBeNull(); // 结尾行不是配对围栏
		expect(rewriteTocBlock(doc, 2, 4, "slider\nlevels: 2", 3)).toBeNull(); // 内容与渲染时不一致（被编辑过）
		expect(rewriteTocBlock(doc, 2, 99, "slider", 3)).toBeNull(); // 区间越界
		expect(rewriteTocBlock(doc, -1, 4, "slider", 3)).toBeNull();
		expect(rewriteTocBlock(doc, 4, 2, "slider", 3)).toBeNull();
		const other = ["```js", "slider", "```"].join("\n");
		expect(rewriteTocBlock(other, 0, 2, "slider", 3)).toBeNull(); // 不是 ah-toc 块
	});

	it("rewriteTocBlock：CRLF 文件保持 CRLF；波浪线围栏；空块（V71）", () => {
		const crlf = ["a", "```ah-toc", "slider", "```", "b"].join("\r\n");
		const r = rewriteTocBlock(crlf, 1, 3, "slider", 2);
		expect(r?.content).toBe(["a", "```ah-toc", "slider", "depth: 2", "```", "b"].join("\r\n"));
		const tilde = ["~~~ah-toc", "~~~"].join("\n");
		expect(rewriteTocBlock(tilde, 0, 1, "", 2)?.content).toBe(
			["~~~ah-toc", "depth: 2", "~~~"].join("\n"),
		);
	});

	it("拖动不写文件，松手（change）才落盘，区间对不上就放弃（V67 / V71）", async () => {
		const files: Record<string, string> = { "v.md": doc };
		const host = makeHost(files, new Set(["v.md"]));
		const headings = ["## 甲", "### 甲一", "#### 甲一一"];
		files["v.md"] = [doc, ...headings.slice(1)].join("\n");
		const { el, done } = mount(new TocBlockRenderer(host), "slider", "v.md", {
			lineStart: 2,
			lineEnd: 4,
		});
		await done;
		const input = el.children.find((c) => c.cls === "ah-toc-bar")?.children[0];
		input?.listeners.get("input")?.({ target: { value: "0" } });
		expect(host.processFile).not.toHaveBeenCalled(); // 拖动中不写
		input?.listeners.get("change")?.({ target: { value: "0" } });
		await flush();
		expect(host.processFile).toHaveBeenCalledTimes(1);
		// 现存级别 [1,2,3,4]，序号 0 = H1
		expect(files["v.md"]).toContain("```ah-toc\nslider\ndepth: 1\n```");
		// 区间还停在旧的两行之间（模拟块被挪动 / 区间过期）：校验不过，不写、不抛，文件保持第一次落盘后的样子
		const afterFirst = files["v.md"];
		input?.listeners.get("change")?.({ target: { value: "1" } });
		await flush();
		expect(files["v.md"]).toBe(afterFirst);
	});

	it("取不到块区间 / 校验不过 → 不落盘、不抛，内存选择保留（V71）", async () => {
		const files: Record<string, string> = { "v.md": doc };
		const host = makeHost(files, new Set(["v.md"]));
		const noInfo = mount(new TocBlockRenderer(host), "slider", "v.md", null);
		await noInfo.done;
		const input = noInfo.el.children.find((c) => c.cls === "ah-toc-bar");
		void input; // doc 只有两级以下标题，可能没有滑块；改用多级文件
		files["v.md"] = [doc, "### 甲一"].join("\n");
		const m = mount(new TocBlockRenderer(host), "slider", "v.md", null);
		await m.done;
		const slider = m.el.children.find((c) => c.cls === "ah-toc-bar")?.children[0];
		slider?.listeners.get("change")?.({ target: { value: "0" } });
		await flush();
		expect(host.processFile).not.toHaveBeenCalled();
	});
});

describe("插入目录与导出（testplan V68 / V73）", () => {
	it("tocInsertText：空行 / 行内文字前后补空行（V68）", () => {
		const block = "```ah-toc\nslider\n```";
		expect(tocInsertText("", "")).toBe(block);
		expect(tocInsertText("   ", "")).toBe(block);
		expect(tocInsertText("abc", "")).toBe(`\n\n${block}`);
		expect(tocInsertText("", "def")).toBe(`${block}\n\n`);
		expect(tocInsertText("abc", "def")).toBe(`\n\n${block}\n\n`);
	});

	it("处理器等首次渲染完才返回：导出 PDF 截 DOM 时目录已经在（V73）", async () => {
		const host = makeHost({ "v.md": ["## 甲", "### 甲一"].join("\n") }, new Set(["v.md"]));
		const { el, done } = mount(new TocBlockRenderer(host), "slider", "v.md");
		await done; // 不再 flush：处理器返回时 DOM 就该就绪
		expect(el.dump()).toEqual(["1 甲", "  1.1 甲一"]);
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
