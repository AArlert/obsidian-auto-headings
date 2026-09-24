/**
 * 模式切换差异计算的单元测试（M14，见 src/virtual/modeSwitch.ts 与 spec.md §3.22「切换模式」）。
 * 对应 testplan V15 / V17 / V18 / V19 的「命中文件筛选」逻辑面；确认框交互留真机。
 */
import { describe, expect, it } from "vitest";
import { NO_NUMBERING_TEMPLATE, type PathRule } from "../../src/pathrules";
import { cloneRules, diffNumberingModes, isQuietTransition } from "../../src/virtual/modeSwitch";

const paths = ["a.md", "v/x.md", "v/keep/y.md", "n/z.md"];
const base = (): PathRule[] => [
	{ pattern: "/", template: "默认" },
	{ pattern: "v/", template: "默认" },
	{ pattern: "v/keep/", template: "默认", mode: "write" },
];

describe("diffNumberingModes", () => {
	it("V15：写入 → 仅显示只算有效规则确实变了的文件，被更具体规则覆盖的不算", () => {
		const before = base();
		const after = cloneRules(before);
		after[1].mode = "virtual";
		expect(diffNumberingModes(before, after, paths)).toEqual({
			toVirtual: ["v/x.md"],
			toNone: [],
			toWrite: [],
		});
	});

	it("V18：仅显示 → 写入", () => {
		const before = base();
		before[1].mode = "virtual";
		const after = cloneRules(before);
		after[1].mode = "write";
		expect(diffNumberingModes(before, after, paths).toWrite).toEqual(["v/x.md"]);
	});

	it("V19：删规则、改路径、改成「不编号」都按有效模式的变化算", () => {
		const before: PathRule[] = [{ pattern: "v/", template: "默认" }];
		expect(diffNumberingModes(before, [], paths).toNone).toEqual(["v/x.md", "v/keep/y.md"]);

		const moved = cloneRules(before);
		moved[0].pattern = "n/";
		expect(diffNumberingModes(before, moved, paths).toNone).toEqual(["v/x.md", "v/keep/y.md"]);

		const none = cloneRules(before);
		none[0].template = NO_NUMBERING_TEMPLATE;
		expect(diffNumberingModes(before, none, paths).toNone).toEqual(["v/x.md", "v/keep/y.md"]);
	});

	it("删掉更具体的写入规则，文件落回仅显示的根规则 → 写入 → 仅显示", () => {
		const before: PathRule[] = [
			{ pattern: "/", template: "默认", mode: "virtual" },
			{ pattern: "v/", template: "默认" },
		];
		const after = cloneRules(before).slice(0, 1);
		expect(diffNumberingModes(before, after, paths).toVirtual).toEqual([
			"v/x.md",
			"v/keep/y.md",
		]);
	});

	it("V17 / 无关改动：只换模板、改不影响任何文件的规则 → 安静生效，不弹确认框", () => {
		const before = base();
		const after = cloneRules(before);
		after[0].template = "别的模板";
		expect(isQuietTransition(diffNumberingModes(before, after, paths))).toBe(true);
	});

	it("cloneRules 是深拷贝：改副本不影响原规则", () => {
		const before = base();
		const after = cloneRules(before);
		after[0].mode = "virtual";
		expect(before[0].mode).toBeUndefined();
	});
});
