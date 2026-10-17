// 触发规则 / 排序 / 重名链接 / VC 词条过滤的真机回归（Q7 Q27 Q28 Q30–Q34 Q46–Q48）。
const DIR = "探针-AH规则";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const sg = app.workspace.editorSuggest.suggests.find((x) => x.plugin === ah);
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};
const files = {
	"A.md": [
		"# 项目级（影响当前项目）",
		"# json 配置",
		"# 交叉矩阵",
		"# 事务",
		"# 总结",
		"# AXI",
		"# UART",
		"# 中断",
		"# 使用",
		"## haha",
		"# axi 互联",
	].join("\n"),
	"B.md": "引用 [[A#事务]] 与 [[A#中断]] 与 [[A#AXI]] [[A#AXI]]\n## haha\n## 本篇另一节",
	"G1.md": "# 边界\n# 边界条件分析",
	"G2.md": "# 边界",
	"G3.md": "# 边界",
	"x.excalidraw.md": "# Text Elements\n# Excalidraw Data",
	"d1/同名.md": "# 重名标题甲",
	"d2/同名.md": "# 重名标题乙",
	"正文.md": "\n\n\n",
};
let leaf;
try {
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	await app.vault.createFolder(`${DIR}/d1`);
	await app.vault.createFolder(`${DIR}/d2`);
	for (const [p, c] of Object.entries(files)) await app.vault.create(`${DIR}/${p}`, c);
	await sleep(3000); // metadataCache 解析 + 索引防抖
	const body = app.vault.getAbstractFileByPath(`${DIR}/正文.md`);
	leaf = app.workspace.getLeaf(true);
	await leaf.openFile(body);
	await sleep(500);
	const editor = leaf.view.editor;

	// 在 path 文件第 line 行写 text，光标放行尾，返回本插件给出的候选（null = 不弹）。
	const probe = async (text, path = `${DIR}/正文.md`, line = 0) => {
		const file = app.vault.getAbstractFileByPath(path);
		if (leaf.view.file !== file) {
			await leaf.openFile(file);
			await sleep(400);
		}
		const ed = leaf.view.editor;
		if (text !== null) ed.setLine(line, text);
		const cursor = { line, ch: ed.getLine(line).length };
		ed.setCursor(cursor);
		const info = sg.onTrigger(cursor, ed, file);
		if (!info) return null;
		const ctx = { ...info, editor: ed, file };
		return sg
			.getSuggestions(ctx)
			.map(
				(e) =>
					e.displayText + (e.path.endsWith("/A.md") ? "" : "@" + e.path.split("/").pop()),
			);
	};
	const titles = async (t) => (await probe(t)) ?? null;

	check("Q27 「，项目」不弹", await titles("，项目"), null);
	check("Q27 「 json」不弹", await titles("说 json"), null);
	check("Q27 「，项目级」弹", await titles("，项目级"), ["项目级（影响当前项目）"]);
	check("Q28 后缀只是前缀「即表示当前项目级」不弹", await titles("即表示当前项目级"), null);
	check("Q28 「一个交叉矩」不弹", await titles("一个交叉矩"), null);
	check("Q28 「一个交叉矩阵」弹", await titles("一个交叉矩阵"), ["交叉矩阵"]);
	check("Q28 「一笔事务」（被链接）弹", await titles("一笔事务"), ["事务"]);
	check("Q28 「这是总结」（没被链接）不弹", await titles("这是总结"), null);
	check("Q30 「用 uart」弹", await titles("用 uart"), ["UART"]);
	check("Q30 「用uart」弹", await titles("用uart"), ["UART"]);
	check("Q30 「 ua」不弹（短英文前缀）", await titles("说 ua"), null);
	check("Q31 「，中断」（被链接）弹", await titles("，中断"), ["中断"]);
	check("Q31 「，使用」（没被链接）不弹", await titles("，使用"), null);
	check("Q32 套话「，边界」不弹", await titles("，边界"), null);
	const g = await titles("，边界条件");
	check("Q32 长词前缀只出非套话", g, ["边界条件分析@G1.md"]);
	check("Q33 Excalidraw 标题不进索引", await titles("Text Elements"), null);
	// Q34：axi 完整命中在前；被链接多的在前
	check("Q34 完整命中在前", await titles(" axi"), ["AXI", "axi 互联"]);
	// Q7：在 A.md 的 `## haha` 行里打字，只排除自己
	const hahaLine = files["A.md"].split("\n").indexOf("## haha");
	check("Q7 标题行只排除正在写的那条", await probe(null, `${DIR}/A.md`, hahaLine), ["haha@B.md"]);
	// 同一篇的其他标题照常（在 B.md 正文行打「本篇另一节」）
	check("Q7 同篇其他标题照常", await probe("见本篇另一节", `${DIR}/B.md`, 0), [
		"本篇另一节@B.md",
	]);
	// Q47：重名笔记写路径
	await leaf.openFile(body);
	await sleep(400);
	const ed = leaf.view.editor;
	ed.setLine(1, "看重名标题甲");
	const cur = { line: 1, ch: ed.getLine(1).length };
	ed.setCursor(cur);
	const info = sg.onTrigger(cur, ed, body);
	const sugg = info ? sg.getSuggestions({ ...info, editor: ed, file: body }) : [];
	if (info && sugg[0]) {
		sg.context = { ...info, editor: ed, file: body };
		sg.selectSuggestion(sugg[0], new KeyboardEvent("keydown"));
	}
	const inserted = ed.getLine(1);
	check(
		"Q47 重名写路径",
		/\[\[探针-AH规则\/d1\/同名#重名标题甲\|重名标题甲\]\]/.test(inserted),
		true,
	);
	const dest = app.metadataCache.getFirstLinkpathDest(`${DIR}/d1/同名`, body.path);
	check("Q47 链接解析到 d1", dest?.path, `${DIR}/d1/同名.md`);

	// Q46/Q48：VC 词条过滤（对照实时索引）
	const dictPath = ah.vcDictionaryFilePath();
	const w = (anchor, path = `${DIR}/A.md`) => ({
		value: anchor,
		description: path,
		insertedText: `[[A#${anchor}|${anchor}]]`,
		createdPath: dictPath,
	});
	const A = app.vault.getAbstractFileByPath(`${DIR}/A.md`);
	const fakeCtx = (file, line, text) => ({
		editor: { getLine: () => text },
		file,
		start: { line, ch: Math.max(0, text.length - 4) },
		end: { line, ch: text.length },
	});
	check(
		"Q48 正文里有效标题保留",
		ah.shouldDropVcWord(w("haha"), fakeCtx(body, 0, "写 haha")),
		false,
	);
	check(
		"Q46 正在写的那条去掉",
		ah.shouldDropVcWord(w("haha"), fakeCtx(A, hahaLine, "## haha")),
		true,
	);
	check("Q46 [[ 上下文去掉", ah.shouldDropVcWord(w("haha"), fakeCtx(body, 0, "[[haha")), true);
	check(
		"Q32 套话词去掉",
		ah.shouldDropVcWord(w("边界", `${DIR}/G2.md`), fakeCtx(body, 0, "，边界")),
		true,
	);
	// 改名后旧标题立刻去掉
	await app.vault.process(A, (s) => s.replace("## haha", "## hahb"));
	await sleep(2500);
	check(
		"Q48 改名后旧标题去掉",
		ah.shouldDropVcWord(w("haha"), fakeCtx(body, 0, "写 haha")),
		true,
	);
	check("Q48 新标题保留", ah.shouldDropVcWord(w("hahb"), fakeCtx(body, 0, "写 hahb")), false);
} catch (e) {
	fails.push("EXC " + (e && e.stack));
} finally {
	try {
		leaf?.detach();
	} catch {}
	try {
		await app.vault.delete(app.vault.getAbstractFileByPath(DIR), true);
	} catch {}
}
return { pass: fails.length === 0, fails, results };
