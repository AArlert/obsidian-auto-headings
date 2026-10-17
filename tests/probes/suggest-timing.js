// probe: wait=150
/**
 * 标题链接建议 × Various Complements 的时序 / 状态转移回归（testplan Q41、Q44）。
 *
 * 在真实 Obsidian 里跑：用系统级按键事件模拟英文直接键入，用 CDP `Input.imeSetComposition` /
 * `Input.insertText` 模拟输入法拼字与上屏，在 `editorSuggest.trigger` 与两边的 `showSuggestions`
 * 上挂日志，逐场景判定最终是谁的建议框在显示。用法见同目录 README.md。
 *
 * 前提：库里装着本插件的新构建、VC 的插件文件（可以停用，脚本会临时启用、结束时停用），
 * 本插件「建议显示在」为本插件的建议框（`vcIntegrationMode: "off"`）。
 */
const DIR = "探针-AH时序";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const remote = require("electron").remote;
const wc = remote.getCurrentWebContents();
const dbg = wc.debugger;
const results = [];
const fails = [];
let leaf;
let attached = false;
let vcWasEnabled = false;
const es = app.workspace.editorSuggest;
const origTrigger = es.trigger;
const patched = [];
let log = [];
const t0 = () => Math.round(performance.now());
try {
	wc.setBackgroundThrottling(false);
	remote.getCurrentWindow().focus();
	const ah = app.plugins.plugins["auto-headings"];
	if (typeof ah?.headingLinkCounts !== "object") throw new Error("本插件不是新构建");
	if (ah.settings.vcIntegrationMode !== "off")
		throw new Error("请先把「建议显示在」设为本插件的建议框");
	vcWasEnabled = !!app.plugins.plugins["various-complements"];
	if (!vcWasEnabled) await app.plugins.enablePlugin("various-complements");
	await sleep(1500);
	const vc = () => app.plugins.plugins["various-complements"];
	const name = (s) =>
		!s ? null : s.plugin === ah ? "AH" : s === vc()?.suggester ? "VC" : "other";
	es.trigger = function (editor, file, openIfClosed) {
		const before = name(es.currentSuggest);
		const r = origTrigger.call(this, editor, file, openIfClosed);
		log.push(
			`${t0()} trigger(open=${openIfClosed}) "${editor.getLine(editor.getCursor().line)}" ime=${ah.imeComposing} ${before}->${name(es.currentSuggest)}`,
		);
		return r;
	};
	const wrapShow = (s, who) => {
		const orig = s.showSuggestions;
		s.showSuggestions = function (items) {
			log.push(`${t0()} ${who}.show(${items?.length})`);
			return orig.call(this, items);
		};
		patched.push(() => (s.showSuggestions = orig));
	};
	wrapShow(
		es.suggests.find((x) => x.plugin === ah),
		"AH",
	);
	wrapShow(vc().suggester, "VC");

	if (!app.vault.getAbstractFileByPath(DIR)) await app.vault.createFolder(DIR);
	const target = await app.vault.create(
		`${DIR}/target.md`,
		"## axi\n## axi_xbar代码走查\n## 交叉矩阵乘法",
	);
	const note = await app.vault.create(`${DIR}/note.md`, "axis axiom axle\n");
	for (let i = 0; i < 40 && ah.headingIndex.entriesOf(target.path).length === 0; i++)
		await sleep(250);
	leaf = app.workspace.getLeaf(true);
	await leaf.openFile(note, { state: { mode: "source" } });
	app.workspace.setActiveLeaf(leaf, { focus: true });
	const editor = leaf.view.editor;
	await sleep(800);
	dbg.attach("1.3");
	attached = true;

	const type = (text) => async () => {
		for (const ch of text) {
			wc.sendInputEvent({ type: "char", keyCode: ch });
			await sleep(30);
		}
	};
	const compose = (text) => () =>
		dbg.sendCommand("Input.imeSetComposition", {
			text,
			selectionStart: text.length,
			selectionEnd: text.length,
		});
	const commit = (text) => () => dbg.sendCommand("Input.insertText", { text });
	const run = async (label, steps, expect) => {
		es.close();
		editor.setValue("axis axiom axle\n");
		editor.setCursor({ line: 1, ch: 0 });
		editor.focus();
		await sleep(400);
		log = [];
		for (const st of steps) {
			if (typeof st === "number") await sleep(st);
			else await st();
		}
		await sleep(700);
		const cur = es.currentSuggest;
		const actual = cur?.isOpen ? name(cur) : null;
		const ok = expect === "notAH" ? actual !== "AH" : actual === expect;
		results.push({
			label,
			line: editor.getLine(1),
			expect,
			actual,
			ok,
			log: ok ? undefined : log.slice(-10),
		});
		if (!ok) fails.push(label);
	};

	// —— 英文直接键入（Q41：本插件排在 VC 前面，任何节奏都是本插件赢）——
	await run("A 连打 axi", [type("axi")], "AH");
	await run("B ax 停1000 再 i", [type("ax"), 1000, type("i")], "AH");
	await run("C ax 停300 再 i", [type("ax"), 300, type("i")], "AH");
	await run("D ax 停100 再 i", [type("ax"), 100, type("i")], "AH");
	// —— 输入法拼字（Q44：上屏后补触发一轮）——
	await run(
		"G 拼 a→ax→axi 连续后上屏",
		[compose("a"), 30, compose("ax"), 30, compose("axi"), 30, commit("axi")],
		"AH",
	);
	await run(
		"H 拼 ax 停1000 再拼 axi 上屏",
		[compose("a"), 30, compose("ax"), 1000, compose("axi"), 30, commit("axi")],
		"AH",
	);
	await run(
		"I 拼 axi 停1000 再上屏",
		[compose("a"), 30, compose("ax"), 30, compose("axi"), 1000, commit("axi")],
		"AH",
	);
	await run(
		"J 拼音上屏成汉字「，交叉矩阵」",
		[
			type("，"),
			compose("jiao"),
			30,
			compose("jiaocha"),
			30,
			compose("jiaochajuzhen"),
			300,
			commit("交叉矩阵"),
		],
		"AH",
	);
	await run(
		"K 拼音字母像英文标题（拼 axi 上屏成「啊系」）不弹",
		[compose("a"), 30, compose("ax"), 30, compose("axi"), 300, commit("啊系")],
		"notAH",
	);
	// —— 加载顺序变化：VC 关了再开（重新注册到末尾）——
	await app.plugins.disablePlugin("various-complements");
	await app.plugins.enablePlugin("various-complements");
	await sleep(1500);
	wrapShow(vc().suggester, "VC");
	await run("E VC 重开后 ax 停1000 再 i", [type("ax"), 1000, type("i")], "AH");
	await run(
		"F VC 重开后拼 axi 停1000 再上屏",
		[compose("a"), 30, compose("ax"), 30, compose("axi"), 1000, commit("axi")],
		"AH",
	);
} catch (e) {
	fails.push("exception: " + String(e?.stack ?? e));
} finally {
	es.trigger = origTrigger;
	patched.forEach((f) => f());
	if (attached) {
		try {
			dbg.detach();
		} catch {}
	}
	try {
		leaf?.detach();
	} catch {}
	const dir = app.vault.getAbstractFileByPath(DIR);
	if (dir) await app.vault.delete(dir, true);
	if (!vcWasEnabled) await app.plugins.disablePlugin("various-complements");
}
return { pass: fails.length === 0, fails, results };
