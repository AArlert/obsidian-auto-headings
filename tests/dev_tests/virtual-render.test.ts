/**
 * 虚拟编号渲染层的单元测试（M14，见 src/virtual/editorExtension.ts、readingView.ts 与 spec.md §3.22）。
 *
 * 编辑视图：直接用 @codemirror/state 测「编号 → DecorationSet」与 `map` 之后的位置（testplan V26），
 * 不起真实 EditorView。阅读视图：用极简假 DOM 测匹配、残留剥离与缓存（testplan V29 / V32 的逻辑面），
 * 不引入 jsdom。视觉、光标、输入法、PDF 留真机手验。
 */
import { ChangeSet, Text } from "@codemirror/state";
import type { Decoration, DecorationSet } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPLATE, WORD_JOINER } from "../../src/numbering";
import { computeVirtualNumbers, type VirtualHeadingLabel } from "../../src/virtual/compute";
import { buildVirtualDecorations } from "../../src/virtual/editorExtension";
import {
	createVirtualPostProcessor,
	decorateHeading,
	pickLabelByLine,
	pickLabelByText,
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

describe("阅读视图：按行号 / 按文本匹配（testplan V29）", () => {
	const labels = computeVirtualNumbers(
		["## 概述", "### 背景", "## 细节", "### 背景"].join("\n"),
		DEFAULT_TEMPLATE,
	);

	it("按行号取编号，并核对 DOM 元素的级别", () => {
		expect(pickLabelByLine(labels, 2, 2)?.label).toBe("2 ");
		expect(pickLabelByLine(labels, 2, 3)).toBeNull(); // 级别对不上（分屏时信息滞后）→ 不画
		expect(pickLabelByLine(labels, 9, 2)).toBeNull();
	});

	it("按文本兜底：唯一命中才返回，同名标题有两个就不画（宁缺勿错）", () => {
		expect(pickLabelByText(labels, "细节", 2)?.label).toBe("2 ");
		expect(pickLabelByText(labels, "背景", 3)).toBeNull();
		expect(pickLabelByText(labels, "不存在", 2)).toBeNull();
	});
});

// ── 极简假 DOM：只实现 decorateHeading / post-processor 用到的那几个接口 ──────────────────
class FakeText {
	parentNode: FakeEl | null = null;
	constructor(public data: string) {}
}
class FakeEl {
	children: Array<FakeEl | FakeText> = [];
	parentNode: FakeEl | null = null;
	className = "";
	title = "";
	private ownText: string | null = null;
	constructor(public tagName: string) {}
	get ownerDocument() {
		return fakeDocument;
	}
	get firstChild() {
		return this.children[0] ?? null;
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
	querySelector(sel: string): FakeEl | null {
		const cls = sel.replace(/^\./, "");
		for (const n of this.walk()) {
			if (n instanceof FakeEl && n.className.split(" ").includes(cls)) return n;
		}
		return null;
	}
	querySelectorAll(): FakeEl[] {
		return [...this.walk()].filter(
			(n): n is FakeEl => n instanceof FakeEl && /^H[1-6]$/.test(n.tagName),
		);
	}
	matches(): boolean {
		return /^H[1-6]$/.test(this.tagName);
	}
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
const asEl = (e: FakeEl) => e as unknown as Element;

describe("阅读视图：给标题加编号（testplan V13 / V29）", () => {
	it("编号 span 插在正文前；已加过的不重复加", () => {
		const [label] = computeVirtualNumbers("## 概述", DEFAULT_TEMPLATE);
		const h = heading("H2", "概述");
		decorateHeading(asEl(h), label, "提示");
		decorateHeading(asEl(h), label, "提示");
		expect(h.textContent).toBe("1 概述");
		expect(h.children.filter((c) => c instanceof FakeEl)).toHaveLength(1);
	});

	it("残留前缀从文本里去掉，编号用残留样式并带提示", () => {
		const [label] = computeVirtualNumbers(`## ${WJ}7 ${WJ}概述`, DEFAULT_TEMPLATE);
		const h = heading("H2", `${WJ}7 ${WJ}概述`);
		decorateHeading(asEl(h), label, "文件里还留着旧编号");
		expect(h.textContent).toBe("1 概述");
		const span = h.children[0] as FakeEl;
		expect(span.className).toBe("ah-virtual-number ah-virtual-number--stale");
		expect(span.title).toBe("文件里还留着旧编号");
	});

	it("尾哨兵被毁、剥不干净的残留：不画，避免两层数字", () => {
		const [label] = computeVirtualNumbers(`## ${WJ}7 概述`, DEFAULT_TEMPLATE);
		const h = heading("H2", `${WJ}7 概述`);
		decorateHeading(asEl(h), label, "");
		expect(h.textContent).toBe(`${WJ}7 概述`);
	});
});

describe("阅读视图 post-processor：缓存与兜底（testplan V29 / V32）", () => {
	const content = ["## 甲", "", "## 乙", "", "## 丙"].join("\n");
	const makeHost = (read: string | null = content) => ({
		virtualNumberingFor: vi.fn((_p: string, c: string) =>
			computeVirtualNumbers(c, DEFAULT_TEMPLATE),
		),
		staleTooltip: () => "",
		readFileContent: vi.fn(async () => read),
	});

	it("同一篇笔记按段调用多次，只算一次（字符串比较命中缓存）", async () => {
		const host = makeHost();
		const pp = createVirtualPostProcessor(host);
		const sections = [0, 2, 4].map((line, i) => {
			const h = heading("H2", ["甲", "乙", "丙"][i]);
			const ctx = {
				sourcePath: "a.md",
				getSectionInfo: () => ({ text: content, lineStart: line, lineEnd: line }),
			};
			return { h, ctx };
		});
		for (const { h, ctx } of sections) {
			await pp(h as unknown as HTMLElement, ctx as never);
		}
		expect(sections.map(({ h }) => h.textContent)).toEqual(["1 甲", "2 乙", "3 丙"]);
		expect(host.virtualNumberingFor).toHaveBeenCalledTimes(1);
	});

	it("拿不到段落信息（嵌入 / 悬浮预览）：读文件按文本匹配", async () => {
		const host = makeHost();
		const pp = createVirtualPostProcessor(host);
		const h = heading("H2", "乙");
		await pp(
			h as unknown as HTMLElement,
			{ sourcePath: "a.md", getSectionInfo: () => null } as never,
		);
		expect(h.textContent).toBe("2 乙");
		expect(host.readFileContent).toHaveBeenCalledWith("a.md");
	});

	it("门控不放行（virtualNumberingFor 返回 null）：什么都不画", async () => {
		const host = makeHost();
		host.virtualNumberingFor.mockReturnValue(null as never);
		const pp = createVirtualPostProcessor(host);
		const h = heading("H2", "甲");
		await pp(
			h as unknown as HTMLElement,
			{
				sourcePath: "a.md",
				getSectionInfo: () => ({ text: content, lineStart: 0, lineEnd: 0 }),
			} as never,
		);
		expect(h.textContent).toBe("甲");
	});
});
