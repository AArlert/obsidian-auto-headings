/**
 * 标题建议框的按键（testplan Q58，issue #10）：回车不接受建议，只有 Tab / 点按接受；不选就记住（Q63）。
 * 真实按键传播留给真机（tests/probes），这里只验证内置的 Enter 处理器被摘掉、Tab 仍在，以及兜底分支。
 */
import { describe, expect, it, vi } from "vitest";
import { DismissMemory, HeadingLinkSuggest } from "../../src/headingsuggest";
import type { MockKeyHandler } from "./obsidian-mock";

const make = () => {
	const plugin = { app: {} } as never;
	return new HeadingLinkSuggest(plugin) as unknown as {
		scope: { keys: MockKeyHandler[] };
		context: unknown;
		close: () => void;
		selectSuggestion: (entry: unknown, evt: unknown) => void;
	};
};

describe("HeadingLinkSuggest 按键（Q58）", () => {
	it("内置的 Enter 接受被摘掉，换成「关框、不拦截」；Tab 接受还在", () => {
		const s = make();
		const enters = s.scope.keys.filter((k) => k.key === "Enter");
		expect(enters).toHaveLength(1);
		const close = vi.spyOn(s, "close");
		expect(enters[0].func({ isComposing: false })).toBeUndefined(); // 不拦截 → 编辑器照常换行
		expect(close).toHaveBeenCalledTimes(1);
		enters[0].func({ isComposing: true }); // 输入法组合中归输入法
		expect(close).toHaveBeenCalledTimes(1);
		expect(s.scope.keys.some((k) => k.key === "Tab" && k.modifiers === "")).toBe(true);
	});

	it("兜底：回车仍走到 selectSuggestion 时不插链接，关框后照常换行", () => {
		const s = make();
		const editor = { exec: vi.fn(), replaceRange: vi.fn(), setCursor: vi.fn() };
		s.context = {
			editor,
			file: { path: "a.md" },
			start: { line: 0, ch: 0 },
			end: { line: 0, ch: 2 },
		};
		const close = vi.spyOn(s, "close");
		s.selectSuggestion({ path: "b.md" }, { key: "Enter" });
		expect(close).toHaveBeenCalled();
		expect(editor.exec).toHaveBeenCalledWith("newlineAndIndent");
		expect(editor.replaceRange).not.toHaveBeenCalled();
	});
});

describe("DismissMemory：不选就记住（Q63）", () => {
	it("没选就关：这次出现过的查询在这一篇里都记住；别的笔记不受影响", () => {
		const m = new DismissMemory();
		m.shown("a.md", "参考模");
		m.shown("a.md", "参考模型");
		m.closed();
		expect(m.isDismissed("a.md", "参考模")).toBe(true);
		expect(m.isDismissed("a.md", "参考模型")).toBe(true);
		expect(m.isDismissed("b.md", "参考模型")).toBe(false);
		expect(m.isDismissed("a.md", "参考模型的接口")).toBe(false); // 更长、不同的查询不受影响
	});

	it("选中了就不记", () => {
		const m = new DismissMemory();
		m.shown("a.md", "axi");
		m.accept();
		m.closed();
		expect(m.isDismissed("a.md", "axi")).toBe(false);
		m.shown("a.md", "axi"); // 下一次没选：照常记
		m.closed();
		expect(m.isDismissed("a.md", "axi")).toBe(true);
	});

	it("离开即忘：打开别的笔记时只留那一篇的记录", () => {
		const m = new DismissMemory();
		m.shown("a.md", "axi");
		m.closed();
		m.shown("b.md", "sv");
		m.closed();
		m.keepOnly("b.md");
		expect(m.isDismissed("a.md", "axi")).toBe(false);
		expect(m.isDismissed("b.md", "sv")).toBe(true);
	});

	it("关框（Esc / 回车 / 打字到不再命中）经 HeadingLinkSuggest.close 记住", () => {
		const s = new HeadingLinkSuggest({ app: {} } as never);
		s.dismissed.shown("a.md", "axi");
		s.close();
		expect(s.dismissed.isDismissed("a.md", "axi")).toBe(true);
	});
});
