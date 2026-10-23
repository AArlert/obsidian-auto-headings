// 本篇菜单收纳维护操作 +「这篇不编号」顺手清编号 + 阅读视图标题菜单的真机回归（testplan S29–S35）。
const DIR = "探针-AH本篇";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const { MarkdownView } = require("obsidian");
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
let leaf;
try {
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	await app.vault.createFolder(`${DIR}/写入`);
	await app.vault.createFolder(`${DIR}/仅显示`);
	ah.settings.pathRules.push({ pattern: `${DIR}/写入/`, template: "默认" });
	await ah.saveSettings();
	const w = await app.vault.create(
		`${DIR}/写入/a.md`,
		`---\ntags: x\nobsidian-auto-headings: true\n---\n# 文档\n## ${WJ}1 ${WJ}甲\n## 第三章 手写乙\n## 重名\n## 重名`,
	);
	const v = await app.vault.create(`${DIR}/仅显示/v.md`, "# 文档\n## 乙");
	leaf = app.workspace.getLeaf(true);
	const open = async (file, mode = "source", source = false) => {
		await leaf.setViewState({ type: "markdown", state: { file: file.path, mode, source } });
		app.workspace.setActiveLeaf(leaf, { focus: true });
		await sleep(700);
		return leaf.view;
	};
	const heads = () =>
		leaf.view.editor
			.getValue()
			.split("\n")
			.filter((l) => /^#{2,} /.test(l))
			.map((l) => l.replace(/⁠/g, ""));

	// S29：状态栏菜单（点状态栏标签）
	await open(w);
	const status = document.querySelector(".auto-headings-status");
	const menuText = async () => {
		closeMenus();
		status.click();
		await sleep(400);
		const t = menus().at(-1)?.textContent ?? "";
		closeMenus();
		return t;
	};
	let t = await menuText();
	check("S29 写入笔记：有清理手写编号", t.includes("清理手写编号"), true);
	check("S29 写入笔记：没有清除残留", t.includes("清除残留编号"), false);
	check("S29 没有单列清除本篇编号", /清除本篇|清除当前文件/.test(t), false);
	await open(v);
	t = await menuText();
	check(
		"S29 仅显示笔记：清理手写 + 清除残留",
		t.includes("清理手写编号") && t.includes("清除残留编号"),
		true,
	);

	// S30：实时预览里「这篇不编号」（已有 true 键 → 改写那一行）
	await open(w);
	closeMenus();
	status.click();
	await sleep(400);
	const off = [...(menus().at(-1)?.querySelectorAll(".menu-item") ?? [])].find((e) =>
		e.textContent.includes("这篇不编号"),
	);
	off?.click();
	await sleep(1500);
	const txt = leaf.view.editor.getValue();
	check("S30 写入 false", /obsidian-auto-headings:\s*false/.test(txt), true);
	check("S30 本插件编号剥掉、手写不动", heads(), [
		"## 甲",
		"## 第三章 手写乙",
		"## 重名",
		"## 重名",
	]);
	check("S30 其余属性保留", /tags: x/.test(txt), true);

	// S30：撤销剥离后编号回来、属性仍是 false
	leaf.view.editor.undo();
	await sleep(500);
	const afterUndo = leaf.view.editor.getValue();
	results.push({ label: "S30 撤销后（记录）", ok: true, actual: afterUndo });

	// S33：阅读视图右键折叠箭头 → 标题菜单
	// 经编辑器改：对有未存改动的缓冲区做 vault.modify 会被 Obsidian 合并出重复前缀（探针自身问题，非插件 bug）。
	leaf.view.editor.setValue(
		"---\ntags: x\n---\n# 文档\n## 甲\n## 第三章 手写乙\n## 重名\n## 重名",
	);
	await sleep(1200);
	await open(w, "preview");
	await sleep(500);
	const hs = [...leaf.view.containerEl.querySelectorAll(".markdown-preview-view h2")];
	const ind = (h) => h.querySelector(".heading-collapse-indicator");
	check("S33 阅读视图标题有折叠箭头", hs.length >= 4 && !!ind(hs[0]), true);
	const rightClick = async (el) => {
		closeMenus();
		const r = el.getBoundingClientRect();
		el.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: r.x + 2,
				clientY: r.y + 2,
				button: 2,
			}),
		);
		await sleep(400);
		return menus().at(-1) ?? null;
	};
	let m = await rightClick(ind(hs[0]));
	const mt = m?.textContent ?? "";
	check("S33 右键弹出标题菜单", mt.includes("跳过此标题") && mt.includes("本篇编号设置"), true);
	check("S33 菜单标签行是右键的那个标题", mt.includes("甲"), true);
	closeMenus();
	ind(hs[0]).dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
	check("S33 悬停提示只写右键", ind(hs[0]).title, "右键打开菜单");

	// S34：阅读视图里拖动不移动
	const before = leaf.view.editor.getValue();
	const r0 = ind(hs[1]).getBoundingClientRect();
	ind(hs[1]).dispatchEvent(
		new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: r0.x, clientY: r0.y }),
	);
	document.dispatchEvent(
		new MouseEvent("mousemove", { bubbles: true, clientX: r0.x, clientY: r0.y + 80 }),
	);
	document.dispatchEvent(
		new MouseEvent("mouseup", { bubbles: true, clientX: r0.x, clientY: r0.y + 80 }),
	);
	await sleep(300);
	check("S34 拖动不改内容", leaf.view.editor.getValue(), before);

	// S35：阅读视图里点「跳过此标题」改的是右键的那个（第二个「重名」）
	const dup = [...leaf.view.containerEl.querySelectorAll(".markdown-preview-view h2")].filter(
		(h) => h.textContent.includes("重名"),
	);
	m = await rightClick(ind(dup[1]));
	const skip = [...(m?.querySelectorAll(".menu-item") ?? [])].find((e) =>
		e.textContent.includes("跳过此标题"),
	);
	skip?.click();
	await sleep(800);
	const lines = leaf.view.editor.getValue().split("\n");
	check(
		"S35 跳过标记加在第二个重名上",
		[lines.at(-2).endsWith("<!-- skip -->"), lines.at(-1).endsWith("<!-- skip -->")],
		[false, true],
	);
	const rendered = [...leaf.view.containerEl.querySelectorAll(".markdown-preview-view h2")].map(
		(h) => h.textContent,
	);
	results.push({ label: "S35 阅读视图刷新后（记录）", ok: true, actual: rendered });
	check("S35 仍在阅读视图", leaf.view.getMode(), "preview");
} catch (e) {
	fails.push("exception: " + (e && e.stack ? e.stack : e));
} finally {
	closeMenus();
	ah.settings.pathRules = rulesBefore;
	await ah.saveSettings();
	if (leaf) leaf.detach();
	const f = app.vault.getAbstractFileByPath(DIR);
	if (f) await app.vault.delete(f, true);
}
return {
	pass: fails.length === 0,
	fails,
	results: results.filter((r) => !r.ok || r.label.includes("记录")),
};
