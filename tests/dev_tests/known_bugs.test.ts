/**
 * **已修复 bug 的回归测试**。
 *
 * U1/U2/U3 原是「容差正则把正文当编号吃掉」的同源问题（0.6.3 部分缓解）。**方案A（0.6.6）从根上根治**：
 * `stripPrefix` 只认带 Word Joiner 的（插件自己写的）前缀，**无 WJ 的正文一律不剥**，故：
 * - U1：低于 topLevel 的 `1 2024 总结` 不再被逐次蚕食（无 WJ → 不剥，原样保留）。
 * - U2：标点 titleSeparator 下 `2024` 不再被吞（整段是正文）。
 * - U3：upper/lower-alpha 下 `API 设计` 的 `API` 不再被当字母序号吞（整段是正文）。
 *
 * 本文件断言「方案A 后三者均不丢正文且幂等」。
 */
import { describe, expect, it } from "vitest";
import {
	DEFAULT_TEMPLATE,
	WORD_JOINER,
	renumberContent,
	type NumeralStyle,
	type Template,
} from "../../src/numbering";
import { clearNumberingContent } from "../../src/cleanup";

function tpl(over: Partial<Template> = {}): Template {
	const t = structuredClone(DEFAULT_TEMPLATE);
	Object.assign(t, over);
	return t;
}
function setAll(
	t: Template,
	p: Partial<{ titleSeparator: string; prefix: string; suffix: string; numeral: NumeralStyle }>,
): Template {
	for (const k of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) Object.assign(t.levels[k], p);
	return t;
}

describe("bug 回归（方案A 0.6.6 根治 U1/U2/U3：无 WJ 正文一律不剥）", () => {
	it("U1 根治：低于 topLevel 含「数字+空格」的标题原样保留（不再被蚕食）", () => {
		const t = tpl({ topLevel: 3 });
		// H2 低于 topLevel=3 → 不编号；`1 2024 总结` 无 WJ → 不剥 → 原样保留、幂等。
		const one = renumberContent("## 1 2024 总结", t);
		expect(one).toBe("## 1 2024 总结");
		expect(renumberContent(one, t)).toBe(one);
	});

	it("U2 根治：标点 titleSeparator 下 2024 不被吞（整段是正文）", () => {
		const t = setAll(tpl(), { titleSeparator: "。" });
		// `1。2024 总结` 无 WJ → 整段正文 → 仅左侧加前缀 `1。⁠`，2024 完整保留、幂等。
		const one = renumberContent("## 1。2024 总结", t);
		expect(one).toBe(`## ${WORD_JOINER}1。${WORD_JOINER}1。2024 总结`);
		expect(one).toContain("2024");
		expect(renumberContent(one, t)).toBe(one);
	});

	it("U3 根治：upper/lower-alpha 下 API 不被当字母序号吞", () => {
		const t = setAll(tpl(), { numeral: "upper-alpha" });
		// `API 设计` 无 WJ → 不剥 → `A ⁠API 设计`（API 完整保留），幂等。
		const one = renumberContent("## API 设计", t);
		expect(one).toBe(`## ${WORD_JOINER}A ${WORD_JOINER}API 设计`);
		expect(renumberContent(one, t)).toBe(one);
	});
});

describe("bug 回归（0.7.20 双哨兵自愈 E14–E18：删后缀致序号重复 / 降级残留清理）", () => {
	// 用户报告：`## 一、⁠标题2` 从 `、` 开始删（连同不可见的尾哨兵 WJ 一起删掉），下轮编号叠成
	// `## 一、⁠一标题2`（孤儿序号 `一` 落入正文）。根因：旧单哨兵被删后无边界证据，方案 A 把 `一`
	// 当正文。修复：前缀首尾各带一个 WJ 哨兵，尾哨兵被删时首哨兵作证据触发有界剥离愈合。
	const cjk = setAll(tpl(), { numeral: "cjk", suffix: "、", titleSeparator: "" });

	it("E14 报告场景：删后缀 + 尾哨兵（首哨兵幸存）→ 下轮愈合，不重复序号", () => {
		const base = renumberContent("## 标题2", cjk);
		expect(base).toBe(`## ${WORD_JOINER}一、${WORD_JOINER}标题2`);
		// 模拟「从 、 开始删」：删掉 `、` 与紧随的尾哨兵 WJ，首哨兵仍在。
		const damaged = base.replace(`、${WORD_JOINER}`, "");
		expect(damaged).toBe(`## ${WORD_JOINER}一标题2`);
		const healed = renumberContent(damaged, cjk);
		expect(healed).toBe(base); // 愈合回定点，不再是 `一、⁠一标题2`
		expect(renumberContent(healed, cjk)).toBe(healed); // 幂等
	});

	it("E15 仅删尾哨兵（后缀尚在）→ 愈合，不叠成 `一、一、标题`", () => {
		const base = renumberContent("## 标题2", cjk);
		const damaged = base.replace(`、${WORD_JOINER}`, "、"); // 去掉尾哨兵、留后缀
		expect(damaged).toBe(`## ${WORD_JOINER}一、标题2`);
		expect(renumberContent(damaged, cjk)).toBe(base);
	});

	it("E16 降级为正文（删光 `#`）：残留的 WJ 哨兵 + 编号被 ③ 清净", () => {
		const base = renumberContent("## 标题2", cjk);
		const demoted = base.replace("## ", ""); // 用户删光 `#` → 正文行 `⁠一、⁠标题2`
		expect(demoted).toBe(`${WORD_JOINER}一、${WORD_JOINER}标题2`);
		expect(renumberContent(demoted, cjk)).toBe("标题2"); // ③ 残留清净
	});

	it("E16b 降级残留清理不误伤：非 WJ 起头的正文行、代码块内容原样保留", () => {
		const src = "## 标题\n正文一行\n```\n代码 ⁠伪装\n```\n结尾";
		const once = renumberContent(src, cjk);
		expect(once).toContain("\n正文一行\n");
		expect(once).toContain("\n代码 ⁠伪装\n"); // 围栏内含 WJ 也不被清理
		expect(once.endsWith("结尾")).toBe(true);
	});

	it("E17 「清除编号」命令也清降级残留（与 ③ 一致，不留 `⁠一、⁠乙` 垃圾）", () => {
		// 第一行编号标题 + 第二行降级残留正文。
		const doc = `${renumberContent("## 甲", cjk)}\n${WORD_JOINER}一、${WORD_JOINER}乙`;
		expect(clearNumberingContent(doc)).toBe("## 甲\n乙");
	});

	it("E18 方案A 不被自愈破坏：正文起头数字仍完整保留（回归 E5）", () => {
		// 双哨兵不改变「无 WJ 一律正文」：`2024 总结` 首次编号 2024 完整保留。
		const one = renumberContent("## 2024 总结", DEFAULT_TEMPLATE);
		expect(one).toBe(`## ${WORD_JOINER}1 ${WORD_JOINER}2024 总结`);
		expect(renumberContent(one, DEFAULT_TEMPLATE)).toBe(one);
	});
});
