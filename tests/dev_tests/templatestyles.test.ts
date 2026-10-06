/** 模板样式快照 / 历史 / 预设纯函数单测（testplan S20–S21，见 src/templates/styles.ts）。 */
import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, renumberContent, WORD_JOINER } from "../../src/numbering";
import {
	applyPreset,
	applyStyle,
	MAX_SNAPSHOTS,
	pushSnapshot,
	sanitizeHistory,
	STYLE_PRESETS,
	styleOf,
	stylesEqual,
	summarizeStyle,
	type TemplateSnapshot,
} from "../../src/templates/styles";

const tpl = () => structuredClone(DEFAULT_TEMPLATE);
const bare = (s: string) => s.split(WORD_JOINER).join("");

describe("样式快照（S21）", () => {
	it("styleOf 深拷贝：改快照不影响模板", () => {
		const t = tpl();
		const s = styleOf(t);
		s.levels.h2.suffix = "X";
		expect(t.levels.h2.suffix).toBe("");
	});

	it("applyStyle 只覆盖样式字段，不动名称与白名单", () => {
		const t = tpl();
		t.name = "我的";
		t.whitelist = [{ text: "后记", match: "exact" }];
		const other = tpl();
		other.levels.h2.numeral = "cjk";
		other.topLevel = 3;
		applyStyle(t, styleOf(other));
		expect(t.levels.h2.numeral).toBe("cjk");
		expect(t.topLevel).toBe(3);
		expect(t.name).toBe("我的");
		expect(t.whitelist).toEqual([{ text: "后记", match: "exact" }]);
	});

	it("pushSnapshot：最新在前、相同样式提前不重复、超限丢最旧", () => {
		const a = styleOf(tpl());
		const b = styleOf(tpl());
		b.levels.h2.numeral = "cjk";
		let list: TemplateSnapshot[] = [];
		list = pushSnapshot(list, a, 1);
		list = pushSnapshot(list, b, 2);
		list = pushSnapshot(list, a, 3);
		expect(list.map((s) => s.at)).toEqual([3, 2]);
		for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
			const s = styleOf(tpl());
			s.startIndex = 10 + i;
			list = pushSnapshot(list, s, 10 + i);
		}
		expect(list).toHaveLength(MAX_SNAPSHOTS);
		expect(stylesEqual(list[0].style, list[1].style)).toBe(false);
	});

	it("sanitizeHistory 丢弃坏数据，缺省为空表", () => {
		expect(sanitizeHistory(undefined)).toEqual({});
		const good = { at: 1, style: { levels: {} } };
		expect(sanitizeHistory({ a: "x", b: [{ at: "t" }], c: [good] })).toEqual({ c: [good] });
	});

	it("summarizeStyle 给出一行摘要", () => {
		expect(summarizeStyle(styleOf(tpl()))).toBe("1 / 1.1 / 1.1.1");
	});
});

describe("快速套用预设（S20）", () => {
	const doc = ["# 甲", "## 乙", "### 丙", "#### 丁"].join("\n");
	const run = (id: string): string[] => {
		const t = tpl();
		applyPreset(t, STYLE_PRESETS.find((p) => p.id === id)!);
		return bare(renumberContent(doc, t)).split("\n");
	};

	it("公文体：一、（一）1. （1）", () => {
		expect(run("official")).toEqual(["# 一、甲", "## （一）乙", "### 1.丙", "#### （1）丁"]);
	});
	it("章节体：第一章 第一节 一、", () => {
		expect(run("chapter").slice(0, 3)).toEqual(["# 第一章 甲", "## 第一节 乙", "### 一、丙"]);
	});
	it("还原默认体", () => {
		const t = tpl();
		applyPreset(t, STYLE_PRESETS.find((p) => p.id === "official")!);
		applyPreset(t, STYLE_PRESETS.find((p) => p.id === "decimal")!);
		expect(bare(renumberContent(doc, t))).toBe(bare(renumberContent(doc, tpl())));
	});
	it("预设套用不动白名单", () => {
		const t = tpl();
		const wl = structuredClone(t.whitelist);
		applyPreset(t, STYLE_PRESETS[2]);
		expect(t.whitelist).toEqual(wl);
	});
});
