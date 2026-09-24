/**
 * 虚拟编号模式纯逻辑的单元测试（M14，见 src/virtual/compute.ts 与 spec.md §3.22）。
 *
 * 覆盖：显示编号与写入模式逐行一致、白名单 / skip / 层级范围、残留前缀区间、标题中间的 WJ
 * 不算残留、自动路径门控（resolveNumberingAction）。对应 testplan V8–V13。
 */
import { describe, expect, it } from "vitest";
import {
	DEFAULT_TEMPLATE,
	numberHeadings,
	stripWordJoiners,
	WORD_JOINER,
	type Template,
} from "../../src/numbering";
import { parseHeadings } from "../../src/parser";
import {
	computeVirtualNumbers,
	resolveNumberingAction,
	type NumberingGateInput,
} from "../../src/virtual/compute";

const WJ = WORD_JOINER;

/** 深拷贝默认模板并按需改写（不污染共享常量）。 */
function tpl(mutate: (t: Template) => void = () => {}): Template {
	const t = JSON.parse(JSON.stringify(DEFAULT_TEMPLATE)) as Template;
	mutate(t);
	return t;
}

describe("computeVirtualNumbers：显示的编号（testplan V8 / V9）", () => {
	it("编号与写入模式逐行一致，只是去掉了 WJ", () => {
		const content = ["# 书名", "## 概述", "### 背景", "## 细节", "正文"].join("\n");
		const labels = computeVirtualNumbers(content, DEFAULT_TEMPLATE);
		const expected = numberHeadings(parseHeadings(content), DEFAULT_TEMPLATE).map((n) =>
			n.prefix === null ? null : stripWordJoiners(n.prefix),
		);
		expect(labels.map((l) => l.label)).toEqual(expected);
		expect(labels.map((l) => l.label)).toEqual([null, "1 ", "1.1 ", "2 "]);
		expect(labels.every((l) => l.label === null || !l.label.includes(WJ))).toBe(true);
	});

	it("widget 位置在 `#` 与空白之后", () => {
		const labels = computeVirtualNumbers("##   多个空格\n###\t制表符", DEFAULT_TEMPLATE);
		expect(labels.map((l) => [l.lineIndex, l.textStart])).toEqual([
			[0, 5],
			[1, 4],
		]);
	});

	it("V9：`<!-- skip -->` 与白名单标题不编号、不推进计数器", () => {
		const t = tpl((x) => {
			x.whitelist = [{ text: "参考文献", match: "exact" }];
		});
		const content = ["## 甲", "## 临时 <!-- skip -->", "## 参考文献", "## 乙"].join("\n");
		expect(computeVirtualNumbers(content, t).map((l) => l.label)).toEqual([
			"1 ",
			null,
			null,
			"2 ",
		]);
	});

	it("V9：超出层级范围的标题不编号", () => {
		const t = tpl((x) => {
			x.bottomLevel = 3;
		});
		const content = ["## 甲", "### 乙", "#### 丙"].join("\n");
		expect(computeVirtualNumbers(content, t).map((l) => l.label)).toEqual(["1 ", "1.1 ", null]);
	});

	it("围栏里的 `#` 行不算标题", () => {
		const content = ["## 甲", "```", "## 不是标题", "```", "## 乙"].join("\n");
		expect(computeVirtualNumbers(content, DEFAULT_TEMPLATE).map((l) => l.label)).toEqual([
			"1 ",
			"2 ",
		]);
	});

	it("手写编号没有 WJ，不算残留，也不影响显示编号（外来编号由调用方另行拦截）", () => {
		const labels = computeVirtualNumbers("## 1.1 手写", DEFAULT_TEMPLATE);
		expect(labels[0].label).toBe("1 ");
		expect(labels[0].staleRange).toBeUndefined();
	});
});

describe("computeVirtualNumbers：残留前缀（testplan V13）", () => {
	it("以 WJ 打头的旧前缀给出残留区间，显示编号按当前结构重算", () => {
		const line = `## ${WJ}7 ${WJ}概述`;
		const [label] = computeVirtualNumbers(line, DEFAULT_TEMPLATE);
		expect(label.label).toBe("1 ");
		expect(label.staleRange).toEqual({ from: 3, to: 3 + `${WJ}7 ${WJ}`.length });
		expect(line.slice(label.staleRange!.to)).toBe("概述");
	});

	it("尾哨兵被毁的残缺前缀也能算出区间", () => {
		const line = `### ${WJ}1.2 细节`;
		const [label] = computeVirtualNumbers(line, DEFAULT_TEMPLATE);
		expect(label.staleRange).toBeDefined();
		expect(line.slice(label.staleRange!.to)).toBe("细节");
	});

	it("标题中间的 WJ（指向写入文件标题的链接）不算残留", () => {
		const [label] = computeVirtualNumbers(`## 参见 [[a#${WJ}1 ${WJ}概述]]`, DEFAULT_TEMPLATE);
		expect(label.label).toBe("1 ");
		expect(label.staleRange).toBeUndefined();
	});

	it("白名单标题上的残留也给出区间（不显示编号，但旧前缀要盖住）", () => {
		const t = tpl((x) => {
			x.whitelist = [{ text: "附录", match: "exact" }];
		});
		const [label] = computeVirtualNumbers(`## ${WJ}3 ${WJ}附录`, t);
		expect(label.label).toBeNull();
		expect(label.staleRange).toBeDefined();
	});
});

describe("resolveNumberingAction：自动路径门控（testplan V10 / V11）", () => {
	const base: NumberingGateInput = {
		retired: false,
		clearing: false,
		fileSwitch: null,
		autoNumber: true,
		mode: "virtual",
		hasTemplate: true,
	};

	it("常态：按规则模式返回", () => {
		expect(resolveNumberingAction(base)).toBe("virtual");
		expect(resolveNumberingAction({ ...base, mode: "write" })).toBe("write");
	});

	it("V10：retired / 清库中 / frontmatter false / 全局关 / 不编号 / 无模板 → 什么都不做", () => {
		expect(resolveNumberingAction({ ...base, retired: true })).toBeNull();
		expect(resolveNumberingAction({ ...base, clearing: true })).toBeNull();
		expect(resolveNumberingAction({ ...base, fileSwitch: false })).toBeNull();
		expect(resolveNumberingAction({ ...base, autoNumber: false })).toBeNull();
		expect(resolveNumberingAction({ ...base, mode: null })).toBeNull();
		expect(resolveNumberingAction({ ...base, hasTemplate: false })).toBeNull();
	});

	it("frontmatter true 压过全局关，但压不过 retired 与「不编号」", () => {
		const forced = { ...base, fileSwitch: true, autoNumber: false };
		expect(resolveNumberingAction(forced)).toBe("virtual");
		expect(resolveNumberingAction({ ...forced, retired: true })).toBeNull();
		expect(resolveNumberingAction({ ...forced, mode: null, hasTemplate: false })).toBeNull();
	});
});
