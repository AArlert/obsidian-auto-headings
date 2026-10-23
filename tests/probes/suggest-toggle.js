// 打字时建议标题链接：回车不误选的真机回归（testplan Q58）。
const DIR = "探针-AH建议开关";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};
const prevOn = ah.settings.headingLinkSuggestEnabled;
let leaf;
try {
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	await app.vault.create(`${DIR}/目标.md`, "# 目标\n## 项目进度\n");
	const body = await app.vault.create(`${DIR}/正文.md`, "\n- 列表\n");
	await ah.setHeadingLinkSuggestEnabled(true);
	await sleep(2500); // 索引补建
	leaf = app.workspace.getLeaf(true);
	await leaf.openFile(body);
	app.workspace.setActiveLeaf(leaf, { focus: true });
	await sleep(500);
	const ed = leaf.view.editor;
	const cm = leaf.view.editor.cm;

	// 正文打「项目」→ 框弹出 → 回车：换行、不插链接、框关掉
	const typeAndEnter = async (line, text) => {
		ed.setLine(line, text);
		ed.setCursor({ line, ch: ed.getLine(line).length });
		ed.focus();
		app.workspace.editorSuggest.trigger(ed, body, true);
		await sleep(400);
		const opened = ah.headingSuggest.isOpen === true;
		cm.contentDOM.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				code: "Enter",
				bubbles: true,
				cancelable: true,
			}),
		);
		await sleep(300);
		return opened;
	};
	check("Q58 框弹出", await typeAndEnter(0, "项目进度"), true);
	check("Q58 回车不插链接", ed.getLine(0), "项目进度");
	check("Q58 回车换行、光标到下一行", ed.getCursor().line, 1);
	check("Q58 框关掉", ah.headingSuggest.isOpen === true, false);
	{
		const ln = ed.getValue().split("\n").indexOf("- 列表");
		await typeAndEnter(ln, "- 列表项目进度");
		check("Q58 列表里回车照常续项", ed.getLine(ln + 1).startsWith("- "), true);
		check("Q58 列表里不插链接", ed.getLine(ln), "- 列表项目进度");
	}
} catch (e) {
	fails.push("exception: " + (e && e.stack ? e.stack : e));
} finally {
	await ah.setHeadingLinkSuggestEnabled(prevOn);
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
