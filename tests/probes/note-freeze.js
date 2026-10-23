// 「这篇不编号」的另外几条入口与边界的真机回归（testplan S31 ①③④、S35 ②）。
const DIR = "探针-AH冻结";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};
const WJ = "⁠";
const rulesBefore = JSON.parse(JSON.stringify(ah.settings.pathRules));
const menus = () => [...document.querySelectorAll(".menu")];
const closeMenus = () => {
	document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
	for (const m of menus()) m.remove();
};
const heads = (text) =>
	text
		.split("\n")
		.filter((l) => /^#{2,} /.test(l))
		.map((l) => l.replace(new RegExp(WJ, "g"), "|"));
let leaf;
let leafB;
try {
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	await app.vault.createFolder(`${DIR}/写入`);
	await app.vault.createFolder(`${DIR}/仅显示`);
	ah.settings.pathRules.push({ pattern: `${DIR}/写入/`, template: "默认", mode: "write" });
	ah.settings.pathRules.push({ pattern: `${DIR}/仅显示/`, template: "默认", mode: "virtual" });
	await ah.saveSettings();
	const numbered = `---\nobsidian-auto-headings: true\n---\n# 文档\n## ${WJ}1 ${WJ}甲\n## 第三章 手写乙\n`;
	const c1 = await app.vault.create(`${DIR}/写入/命令.md`, numbered);
	const c4 = await app.vault.create(`${DIR}/写入/手改.md`, numbered);
	const c3 = await app.vault.create(
		`${DIR}/仅显示/残留.md`,
		`# 文档\n## ${WJ}1 ${WJ}乙\n## 丙\n`,
	);
	const c5 = await app.vault.create(
		`${DIR}/写入/双开.md`,
		`# 文档\n## ${WJ}1 ${WJ}甲\n## ${WJ}2 ${WJ}乙\n`,
	);
	leaf = app.workspace.getLeaf(true);
	const open = async (l, file, mode = "source") => {
		await l.setViewState({ type: "markdown", state: { file: file.path, mode, source: false } });
		app.workspace.setActiveLeaf(l, { focus: true });
		await sleep(700);
		return l.view;
	};
	const statusMenuClick = async (label) => {
		closeMenus();
		document.querySelector(".auto-headings-status")?.click();
		await sleep(400);
		const item = [...(menus().at(-1)?.querySelectorAll(".menu-item") ?? [])].find((e) =>
			e.textContent.includes(label),
		);
		item?.click();
		closeMenus();
		return !!item;
	};

	// S31 ①：命令「开关当前笔记的自动编号」从开切到关 → 与菜单一致：写 false + 剥本插件编号
	await open(leaf, c1);
	app.commands.executeCommandById("auto-headings:toggle-note-auto");
	await sleep(1500);
	let txt = leaf.view.editor.getValue();
	check("S31① 命令写 false", /obsidian-auto-headings:\s*false/.test(txt), true);
	check("S31① 命令剥本插件编号、手写不动", heads(txt), ["## 甲", "## 第三章 手写乙"]);

	// S31 ③：仅显示笔记里有残留（带 WJ）时选「这篇不编号」→ 残留一并清掉
	await open(leaf, c3);
	check("S31③ 菜单里有「这篇不编号」", await statusMenuClick("这篇不编号"), true);
	await sleep(1500);
	txt = leaf.view.editor.getValue();
	check("S31③ 写 false", /obsidian-auto-headings:\s*false/.test(txt), true);
	check("S31③ 残留清掉", heads(txt), ["## 乙", "## 丙"]);

	// S31 ④：自己手改属性为 false → 只冻结、不剥编号
	await open(leaf, c4);
	{
		const ed = leaf.view.editor;
		// 写入笔记打开即被编号（手写的「第三章」不认作编号，会再补一个 2），冻结是对**改属性那一刻**的样子而言。
		const frozen = heads(ed.getValue());
		const ln = ed.getValue().split("\n").indexOf("obsidian-auto-headings: true");
		ed.setLine(ln, "obsidian-auto-headings: false");
		await sleep(2500); // 越过防抖
		txt = ed.getValue();
		check("S31④ 手改后属性是 false", /obsidian-auto-headings:\s*false/.test(txt), true);
		check("S31④ 编号原样保留", heads(txt), frozen);
		ed.replaceRange("## 新加\n", { line: ed.lineCount(), ch: 0 });
		await sleep(2500);
		check("S31④ 冻结后新标题不编号", heads(ed.getValue()).at(-1), "## 新加");
	}

	// S35 ②：同一篇在另一叶子的编辑视图里有未落盘的编辑，在阅读视图里用标题菜单「跳过此标题」
	await open(leaf, c5, "preview");
	leafB = app.workspace.getLeaf("split");
	await open(leafB, c5, "source");
	const edB = leafB.view.editor;
	edB.replaceRange("未落盘的一行\n", { line: edB.lineCount(), ch: 0 });
	app.workspace.setActiveLeaf(leaf, { focus: true });
	await sleep(300);
	const h2 = [...leaf.view.containerEl.querySelectorAll(".markdown-preview-view h2")].find((h) =>
		h.textContent.includes("乙"),
	);
	const ind = h2?.querySelector(".heading-collapse-indicator");
	check("S35② 阅读视图找到标题折叠箭头", !!ind, true);
	if (ind) {
		const r = ind.getBoundingClientRect();
		ind.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: r.x + 2,
				clientY: r.y + 2,
				button: 2,
			}),
		);
		await sleep(400);
		const skip = [...(menus().at(-1)?.querySelectorAll(".menu-item") ?? [])].find((e) =>
			e.textContent.includes("跳过此标题"),
		);
		skip?.click();
		closeMenus();
		await sleep(1500);
		const b = edB.getValue();
		check("S35② 另一叶子未落盘的编辑还在", b.includes("未落盘的一行"), true);
		check(
			"S35② 跳过标记加上",
			b.split("\n").some((l) => l.includes("乙") && l.endsWith("<!-- skip -->")),
			true,
		);
		await sleep(2500); // 等落盘
		const disk = await app.vault.read(c5);
		check(
			"S35② 落盘两处都在",
			disk.includes("未落盘的一行") && disk.includes("<!-- skip -->"),
			true,
		);
		check("S35② 阅读视图仍在", leaf.view.getMode(), "preview");
	}
} catch (e) {
	fails.push("exception: " + (e && e.stack ? e.stack : e));
} finally {
	closeMenus();
	ah.settings.pathRules = rulesBefore;
	await ah.saveSettings();
	if (leafB) leafB.detach();
	if (leaf) leaf.detach();
	const f = app.vault.getAbstractFileByPath(DIR);
	if (f) await app.vault.delete(f, true);
}
return {
	pass: fails.length === 0,
	fails,
	results: results.filter((r) => !r.ok),
	total: results.length,
};
