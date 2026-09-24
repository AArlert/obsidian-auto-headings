/**
 * 虚拟编号渲染层的单元测试（M14，见 src/virtual/editorExtension.ts、readingView.ts 与 spec.md §3.22）。
 *
 * 编辑视图：直接用 @codemirror/state 测「编号 → DecorationSet」与 `map` 之后的位置（testplan V26），
 * 不起真实 EditorView。阅读视图：用极简假 DOM 测匹配、残留剥离与缓存（testplan V29 / V32 的逻辑面），
 * 不引入 jsdom；含真机实测回归「上面插入标题后，没重渲染的段落也要改成新编号」。视觉、光标、
 * 输入法、PDF 留真机手验。
 */
import { ChangeSet, Text } from "@codemirror/state";
import type { Decoration, DecorationSet } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPLATE, WORD_JOINER } from "../../src/numbering";
import { computeVirtualNumbers, type VirtualHeadingLabel } from "../../src/virtual/compute";
import { buildVirtualDecorations } from "../../src/virtual/editorExtension";
import {
	decorateHeading,
	locateSection,
	pickLabelByText,
	pickSectionLabels,
	setHeadingLabel,
	undecorateHeading,
	VirtualReadingRenderer,
} from "../../src/virtual/readingView";

const WJ = WORD_JOINER;

/** 把装饰集摊平成 `[from, to, 显示文本, 是否残留]`，便于断言。 */
function flatten(set: DecorationSet, doc: Text): Array<[number, number, string, boolean]> {
	const out: Array<[number, number, string, boolean]> = [];
	set.between(0, doc.length, (from, to, value: Decoration) => {
		const w = value.spec.widget as { label: string; stale: boolean };
		out.push([from, to, w.label, w.stale]);
	});
	return out;
}

function decorate(content: string): { doc: Text; set: DecorationSet } {
	const doc = Text.of(content.split("\n"));
	const labels = computeVirtualNumbers(content, DEFAULT_TEMPLATE);
	return { doc, set: buildVirtualDecorations(doc, labels, "提示") };
}

describe("buildVirtualDecorations：编辑视图装饰（testplan V26）", () => {
	it("每个要编号的标题在正文起点放一个 widget；不编号的标题不放", () => {
		const { doc, set } = decorate(["# 书名", "## 概述", "正文", "### 背景"].join("\n"));
		// 「## 概述」在第 2 行，正文起点 +3；「### 背景」在第 4 行，+4。
		const p2 = doc.line(2).from + 3;
		const p4 = doc.line(4).from + 4;
		expect(flatten(set, doc)).toEqual([
			[p2, p2, "1 ", false],
			[p4, p4, "1.1 ", false],
		]);
		expect(doc.sliceString(p2, p2 + 2)).toBe("概述");
		expect(doc.sliceString(p4, p4 + 2)).toBe("背景");
	});

	it("残留前缀被同一个 widget 替换（残留样式），只显示一层编号", () => {
		const line = `## ${WJ}7 ${WJ}概述`;
		const { doc, set } = decorate(line);
		const to = 3 + `${WJ}7 ${WJ}`.length;
		expect(flatten(set, doc)).toEqual([[3, to, "1 ", true]]);
		expect(doc.sliceString(to)).toBe("概述");
	});

	it("不编号的标题（白名单）上的残留不藏：旧前缀照原样露出来", () => {
		const t = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE));
		t.whitelist = [{ text: "附录", match: "exact" }];
		const content = `## ${WJ}3 ${WJ}附录`;
		const doc = Text.of([content]);
		const set = buildVirtualDecorations(doc, computeVirtualNumbers(content, t), "提示");
		expect(flatten(set, doc)).toEqual([]);
	});

	it("去抖重算之前：在标题上方插入 / 删除行，装饰经 map 跟随、不漂移", () => {
		const { doc, set } = decorate(["正文", "## 概述"].join("\n"));
		const p = doc.line(2).from + 3;
		expect(flatten(set, doc)).toEqual([[p, p, "1 ", false]]);

		const insert = ChangeSet.of({ from: 0, insert: "新的一行\n" }, doc.length);
		const doc2 = insert.apply(doc);
		const mapped = set.map(insert);
		const [[pos]] = flatten(mapped, doc2);
		expect(doc2.sliceString(pos, pos + 2)).toBe("概述");

		const del = ChangeSet.of({ from: 0, to: 5 }, doc2.length); // 删掉刚插入的那一行
		const doc3 = del.apply(doc2);
		const [[pos3]] = flatten(mapped.map(del), doc3);
		expect(doc3.sliceString(pos3, pos3 + 2)).toBe("概述");
	});

	it("行号越界的编号（文档已被改短）直接跳过，不抛错", () => {
		const doc = Text.of(["## 甲"]);
		const labels: VirtualHeadingLabel[] = [
			{ lineIndex: 5, level: 2, text: "乙", textStart: 3, label: "2 " },
		];
		expect(flatten(buildVirtualDecorations(doc, labels, ""), doc)).toEqual([]);
	});
});

describe("阅读视图：按段落 / 按文本匹配（testplan V29）", () => {
	const labels = computeVirtualNumbers(
		["## 概述", "### 背景", "## 细节", "### 背景"].join("\n"),
		DEFAULT_TEMPLATE,
	);

	it("按段落行号区间取编号，并核对 DOM 元素的级别", () => {
		expect(pickSectionLabels(labels, 2, 2, [2]).map((l) => l?.label)).toEqual(["2 "]);
		expect(pickSectionLabels(labels, 2, 2, [3])).toEqual([null]); // 级别对不上（分屏时信息滞后）→ 不画
		expect(pickSectionLabels(labels, 9, 9, [2])).toEqual([null]);
		// 一个段落里有两个标题：按顺序对应。
		expect(pickSectionLabels(labels, 0, 1, [2, 3]).map((l) => l?.label)).toEqual([
			"1 ",
			"1.1 ",
		]);
	});

	it("按文本兜底：唯一命中才返回，同名标题有两个就不画（宁缺勿错）", () => {
		expect(pickLabelByText(labels, "细节", 2)?.label).toBe("2 ");
		expect(pickLabelByText(labels, "背景", 3)).toBeNull();
		expect(pickLabelByText(labels, "不存在", 2)).toBeNull();
	});
});

// ── 极简假 DOM：只实现阅读视图用到的那几个接口 ─────────────────────────────────────
class FakeText {
	readonly nodeType = 3;
	parentNode: FakeEl | null = null;
	constructor(public data: string) {}
	get nextSibling() {
		return siblingAfter(this);
	}
}
class FakeEl {
	readonly nodeType = 1;
	children: Array<FakeEl | FakeText> = [];
	parentNode: FakeEl | null = null;
	className = "";
	title = "";
	private attrs = new Map<string, string>();
	private ownText: string | null = null;
	constructor(public tagName: string) {}
	get ownerDocument() {
		return fakeDocument;
	}
	get firstChild() {
		return this.children[0] ?? null;
	}
	get nextSibling() {
		return siblingAfter(this);
	}
	append(...nodes: Array<FakeEl | FakeText>): this {
		for (const n of nodes) {
			n.parentNode = this;
			this.children.push(n);
		}
		return this;
	}
	insertBefore(node: FakeEl | FakeText, ref: FakeEl | FakeText | null): void {
		node.parentNode = this;
		const i = ref ? this.children.indexOf(ref) : 0;
		this.children.splice(i < 0 ? 0 : i, 0, node);
	}
	remove(): void {
		const parent = this.parentNode;
		if (parent) {
			parent.children = parent.children.filter((c) => c !== this);
			this.parentNode = null;
		}
	}
	getAttribute(name: string): string | null {
		return this.attrs.get(name) ?? null;
	}
	setAttribute(name: string, value: string): void {
		this.attrs.set(name, value);
	}
	get textContent(): string {
		return (
			this.ownText ??
			this.children.map((c) => (c instanceof FakeText ? c.data : c.textContent)).join("")
		);
	}
	set textContent(v: string) {
		this.ownText = v;
	}
	*walk(): Generator<FakeEl | FakeText> {
		for (const c of this.children) {
			yield c;
			if (c instanceof FakeEl) yield* c.walk();
		}
	}
	private matchesSelector(sel: string): boolean {
		if (sel.startsWith(".")) return this.className.split(" ").includes(sel.slice(1));
		return sel.split(",").some((s) => s.trim().toUpperCase() === this.tagName);
	}
	querySelectorAll(sel: string): FakeEl[] {
		return [...this.walk()].filter(
			(n): n is FakeEl => n instanceof FakeEl && n.matchesSelector(sel),
		);
	}
	querySelector(sel: string): FakeEl | null {
		return this.querySelectorAll(sel)[0] ?? null;
	}
	matches(sel: string): boolean {
		return this.matchesSelector(sel);
	}
}
function siblingAfter(node: FakeEl | FakeText): FakeEl | FakeText | null {
	const parent = node.parentNode;
	if (!parent) return null;
	return parent.children[parent.children.indexOf(node) + 1] ?? null;
}
const fakeDocument = {
	createElement: (tag: string) => new FakeEl(tag.toUpperCase()),
	createTreeWalker: (root: FakeEl) => {
		const texts = [...root.walk()].filter((n) => n instanceof FakeText);
		let i = 0;
		return { nextNode: () => texts[i++] ?? null };
	},
};
const heading = (tag: string, text: string) => new FakeEl(tag).append(new FakeText(text));
/** 阅读视图的一个段落：`<div>` 里包一个标题。 */
const section = (tag: string, text: string) => new FakeEl("DIV").append(heading(tag, text));
const asEl = (e: FakeEl) => e as unknown as HTMLElement;

describe("阅读视图：给标题加 / 去编号（testplan V13 / V29）", () => {
	it("编号 span 插在正文前；已加过的不重复加", () => {
		const [label] = computeVirtualNumbers("## 概述", DEFAULT_TEMPLATE);
		const h = heading("H2", "概述");
		decorateHeading(asEl(h), label, "提示");
		decorateHeading(asEl(h), label, "提示");
		expect(h.textContent).toBe("1 概述");
		expect(h.children.filter((c) => c instanceof FakeEl)).toHaveLength(1);
	});

	it("残留前缀从文本里去掉，编号用残留样式并带提示；去掉编号时残留原样还回", () => {
		const raw = `${WJ}7 ${WJ}概述`;
		const [label] = computeVirtualNumbers(`## ${raw}`, DEFAULT_TEMPLATE);
		const h = heading("H2", raw);
		decorateHeading(asEl(h), label, "文件里还留着旧编号");
		expect(h.textContent).toBe("1 概述");
		const span = h.children[0] as FakeEl;
		expect(span.className).toBe("ah-virtual-number ah-virtual-number--stale");
		expect(span.title).toBe("文件里还留着旧编号");

		undecorateHeading(asEl(h));
		expect(h.textContent).toBe(raw);
	});

	it("尾哨兵被毁、剥不干净的残留：不画，避免两层数字", () => {
		const [label] = computeVirtualNumbers(`## ${WJ}7 概述`, DEFAULT_TEMPLATE);
		const h = heading("H2", `${WJ}7 概述`);
		decorateHeading(asEl(h), label, "");
		expect(h.textContent).toBe(`${WJ}7 概述`);
	});

	it("setHeadingLabel：改编号、去编号都是原地改；目标相同则不动 DOM", () => {
		const two = computeVirtualNumbers("## 甲\n## 乙", DEFAULT_TEMPLATE)[1];
		const h = heading("H2", "乙");
		setHeadingLabel(asEl(h), two, "");
		const span = h.children[0];
		setHeadingLabel(asEl(h), two, "");
		expect(h.children[0]).toBe(span); // 未重建
		const one = computeVirtualNumbers("## 乙", DEFAULT_TEMPLATE)[0];
		setHeadingLabel(asEl(h), one, "");
		expect(h.textContent).toBe("1 乙");
		setHeadingLabel(asEl(h), null, "");
		expect(h.textContent).toBe("乙");
	});
});

describe("阅读视图渲染器：段落登记、整篇重新核对、缓存与兜底（testplan V29 / V32）", () => {
	beforeEach(() => {
		(globalThis as unknown as { window: unknown }).window = globalThis;
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	/** 假的阅读视图：记录每个段落当前的段落信息（Obsidian 会在别的段落改动后更新未改段落的行号）。 */
	function makeView(content: string) {
		const infos = new Map<FakeEl, { text: string; lineStart: number; lineEnd: number }>();
		const children: Array<{ load(): void; unload(): void }> = [];
		const ctx = {
			sourcePath: "a.md",
			getSectionInfo: (el: FakeEl) => infos.get(el) ?? null,
			addChild: (c: { load(): void; unload(): void }) => {
				children.push(c);
				c.load();
			},
		};
		return { ctx: ctx as never, infos, children, content };
	}
	const makeHost = (read: string | null = null) => ({
		virtualNumberingFor: vi.fn((_p: string, c: string) =>
			computeVirtualNumbers(c, DEFAULT_TEMPLATE),
		),
		staleTooltip: () => "",
		readFileContent: vi.fn(async () => read),
	});

	it("同一篇笔记按段调用多次，只算一次（字符串比较命中缓存）", async () => {
		const content = ["## 甲", "", "## 乙", "", "## 丙"].join("\n");
		const host = makeHost();
		const r = new VirtualReadingRenderer(host);
		const { ctx, infos } = makeView(content);
		const secs = [0, 2, 4].map((line, i) => {
			const s = section("H2", ["甲", "乙", "丙"][i]);
			infos.set(s, { text: content, lineStart: line, lineEnd: line });
			return s;
		});
		for (const s of secs) await r.postProcessor(asEl(s), ctx);
		expect(secs.map((s) => s.textContent)).toEqual(["1 甲", "2 乙", "3 丙"]);
		expect(host.virtualNumberingFor).toHaveBeenCalledTimes(1);
		expect(r.sectionCount).toBe(3);
	});

	it("回归（真机实测）：在最前面插入标题后，没重渲染的段落也改成新编号", async () => {
		const v1 = ["## 甲", "", "## 乙"].join("\n");
		const host = makeHost();
		const r = new VirtualReadingRenderer(host);
		const { ctx, infos } = makeView(v1);
		const a = section("H2", "甲");
		const b = section("H2", "乙");
		infos.set(a, { text: v1, lineStart: 0, lineEnd: 0 });
		infos.set(b, { text: v1, lineStart: 2, lineEnd: 2 });
		await r.postProcessor(asEl(a), ctx);
		await r.postProcessor(asEl(b), ctx);
		expect([a, b].map((s) => s.textContent)).toEqual(["1 甲", "2 乙"]);

		// 用户在最前面插了「## 新」：Obsidian 只渲染新段落，旧段落只是行号后移。
		const v2 = ["## 新", "", "## 甲", "", "## 乙"].join("\n");
		infos.set(a, { text: v2, lineStart: 2, lineEnd: 2 });
		infos.set(b, { text: v2, lineStart: 4, lineEnd: 4 });
		const n = section("H2", "新");
		infos.set(n, { text: v2, lineStart: 0, lineEnd: 0 });
		await r.postProcessor(asEl(n), ctx);
		expect(n.textContent).toBe("1 新");
		await vi.runAllTimersAsync();
		expect([a, b].map((s) => s.textContent)).toEqual(["2 甲", "3 乙"]);
	});

	it("没有段落重渲染（如删掉一个标题）：元数据更新后的重新核对也会改好", async () => {
		const v1 = ["## 甲", "", "## 乙", "", "## 丙"].join("\n");
		const r = new VirtualReadingRenderer(makeHost());
		const { ctx, infos } = makeView(v1);
		const b = section("H2", "乙");
		const c = section("H2", "丙");
		infos.set(b, { text: v1, lineStart: 2, lineEnd: 2 });
		infos.set(c, { text: v1, lineStart: 4, lineEnd: 4 });
		await r.postProcessor(asEl(b), ctx);
		await r.postProcessor(asEl(c), ctx);
		expect([b, c].map((s) => s.textContent)).toEqual(["2 乙", "3 丙"]);

		const v2 = ["", "", "## 乙", "", "## 丙"].join("\n"); // 「甲」那一行被删成空行
		infos.set(b, { text: v2, lineStart: 2, lineEnd: 2 });
		infos.set(c, { text: v2, lineStart: 4, lineEnd: 4 });
		r.scheduleSweep("a.md");
		await vi.runAllTimersAsync();
		expect([b, c].map((s) => s.textContent)).toEqual(["1 乙", "2 丙"]);
	});

	it("设置变了（refreshAll）：缓存作废；门控关闭时编号去掉、残留原样还回", async () => {
		const raw = `${WJ}9 ${WJ}甲`;
		const content = `## ${raw}`;
		const host = makeHost();
		const r = new VirtualReadingRenderer(host);
		const { ctx, infos } = makeView(content);
		const s = section("H2", raw);
		infos.set(s, { text: content, lineStart: 0, lineEnd: 0 });
		await r.postProcessor(asEl(s), ctx);
		expect(s.textContent).toBe("1 甲");

		host.virtualNumberingFor.mockReturnValue(null as never); // 比如规则切回了写入模式
		r.refreshAll();
		await vi.runAllTimersAsync();
		expect(s.textContent).toBe(raw);
	});

	it("段落卸载后注销，不再参与重新核对", async () => {
		const content = "## 甲";
		const r = new VirtualReadingRenderer(makeHost());
		const { ctx, infos, children } = makeView(content);
		const s = section("H2", "甲");
		infos.set(s, { text: content, lineStart: 0, lineEnd: 0 });
		await r.postProcessor(asEl(s), ctx);
		expect(r.sectionCount).toBe(1);
		children[0].unload();
		expect(r.sectionCount).toBe(0);
	});

	it("回归（真机实测）：小节嵌入 ![[笔记#标题]] 按全文编号，不从「一」重新数", async () => {
		const full = ["## 甲", "", "## 乙", "正文", "", "## 丙"].join("\n");
		const snippet = ["## 乙", "正文"].join("\n");
		const r = new VirtualReadingRenderer(makeHost(full));
		const { ctx, infos } = makeView(snippet);
		const s = section("H2", "乙");
		infos.set(s, { text: snippet, lineStart: 0, lineEnd: 0 }); // 嵌入给的是片段内的行号
		await r.postProcessor(asEl(s), ctx);
		expect(s.textContent).toBe("2 乙");
	});

	it("拿不到段落信息（嵌入 / 悬浮预览）：读文件按文本匹配；再次核对不会把编号当成标题文字", async () => {
		const content = ["## 甲", "", "## 乙"].join("\n");
		const host = makeHost(content);
		const r = new VirtualReadingRenderer(host);
		const { ctx } = makeView(content);
		const s = section("H2", "乙");
		await r.postProcessor(asEl(s), ctx);
		expect(s.textContent).toBe("2 乙");
		expect(host.readFileContent).toHaveBeenCalledWith("a.md");
		r.refreshAll();
		await vi.runAllTimersAsync();
		expect(s.textContent).toBe("2 乙");
	});
});

describe("locateSection：段落原文与文件全文的关系", () => {
	const full = ["# 题", "", "## 甲", "", "## 乙", "正文"].join("\n");

	it("相同或拿不到全文：原样用，偏移 0", () => {
		expect(locateSection(full, full)).toEqual({ content: full, offset: 0 });
		expect(locateSection("## 乙", null)).toEqual({ content: "## 乙", offset: 0 });
	});

	it("是全文里的一段：用全文，偏移为前面的行数", () => {
		expect(locateSection("## 乙\n正文", full)).toEqual({ content: full, offset: 4 });
	});

	it("找不到但差不多一样长（正在编辑、磁盘还没跟上）：按段落原文；短片段找不到：交给兜底", () => {
		const edited = full.replace("## 甲", "## 甲改");
		expect(locateSection(edited, full)).toEqual({ content: edited, offset: 0 });
		expect(locateSection("## 不存在", full)).toBeNull();
	});
});
