// 当前笔记四项维护操作（命令 / 本篇菜单入口）与「编号维护」TAB 布局的真机走查（testplan L43 / H1 / H13 / H15 / J14 / V14）。
// 全库两项不在这里跑（会改整个测试库）。
const DIR = "探针-AH维护";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};
const WJ = /⁠/g;
const rulesBefore = JSON.parse(JSON.stringify(ah.settings.pathRules));
const noticeCount = () => document.querySelectorAll(".notice").length;
let leaf;
try {
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	await app.vault.createFolder(`${DIR}/写入`);
	await app.vault.createFolder(`${DIR}/仅显示`);
	// 写入模式的专用规则（测试库根规则是仅显示）；结束时还原。
	ah.settings.pathRules.push({ pattern: `${DIR}/写入/`, template: "默认" }); // 文件夹规则须以 / 结尾
	await ah.saveSettings();
	const w = await app.vault.create(`${DIR}/写入/a.md`, "# 文档\n## 甲\n## 乙\n### 丙");
	const f = await app.vault.create(
		`${DIR}/写入/foreign.md`,
		"# 文档\n## 1.2 手写甲\n## 第三章 手写乙",
	);
	// 残留 = 早先写入模式留下的带 WJ 前缀；手写的 `1 ` 不算残留，不清。
	const v = await app.vault.create(`${DIR}/仅显示/v.md`, "# 文档\n## ⁠1 ⁠旧编号残留\n## 乙");
	leaf = app.workspace.getLeaf(true);
	const open = async (file) => {
		await leaf.openFile(file);
		app.workspace.setActiveLeaf(leaf, { focus: true });
		await sleep(600);
		return leaf.view.editor;
	};
	const heads = (ed) =>
		ed
			.getValue()
			.split("\n")
			.filter((l) => /^#{2,} /.test(l))
			.map((l) => l.replace(WJ, ""));

	// 立即重新编号
	let ed = await open(w);
	ah.renumberActiveNoteNow();
	await sleep(300);
	check("立即重新编号：写入笔记编上号", heads(ed), ["## 1 甲", "## 2 乙", "### 2.1 丙"]);

	// 清除当前文件编号：去掉编号 + 暂停（写 frontmatter false）
	app.commands.executeCommandById("auto-headings:clear-numbering"); // 编号维护 TAB 不再有当前笔记组，走同名命令
	await sleep(300);
	check("清除当前文件编号：编号没了", heads(ed), ["## 甲", "## 乙", "### 丙"]);
	check(
		"清除当前文件编号：顺带写了暂停属性",
		/obsidian-auto-headings:\s*false/.test(ed.getValue()),
		true,
	);
	ed.replaceRange("x", { line: ed.lineCount() - 1, ch: ed.getLine(ed.lineCount() - 1).length });
	await sleep(1200);
	check(
		"清除后打字不会被编回去",
		heads(ed).some((h) => /\d/.test(h)),
		false,
	);
	ah.renumberActiveNoteNow();
	await sleep(300);
	check("再点立即重新编号：恢复编号", heads(ed)[0], "## 1 甲");
	check(
		"再点立即重新编号：暂停属性去掉",
		/obsidian-auto-headings:\s*false/.test(ed.getValue()),
		false,
	);

	// 清理非本插件编号：先弹预览框
	ed = await open(f);
	const before = document.querySelectorAll(".modal-container").length;
	ah.reviewActiveFileForeignNumbering();
	await sleep(400);
	const modals = [...document.querySelectorAll(".modal-container")];
	check("清理非本插件编号：弹出预览框", modals.length, before + 1);
	const modalText = modals.at(-1)?.textContent ?? "";
	check("预览框列出两条手写编号", /1\.2/.test(modalText) && /第三章/.test(modalText), true);
	modals.at(-1)?.querySelector(".modal-close-button")?.click();
	await sleep(200);
	check("关掉预览框不改文件", heads(ed)[0].includes("1.2 手写甲"), true);

	// 清除残留编号：写入笔记给提示，仅显示笔记真清
	const n0 = noticeCount();
	ah.clearActiveFileStaleNumbering();
	await sleep(200);
	check("清除残留编号：写入笔记只弹提示", noticeCount() > n0, true);
	ed = await open(v);
	ah.clearActiveFileStaleNumbering();
	await sleep(300);
	check("清除残留编号：仅显示笔记里旧编号被清", heads(ed), ["## 旧编号残留", "## 乙"]);

	// TAB 布局：两组、四 + 二项
	await open(w);
	app.setting.open();
	app.setting.openTabById("auto-headings");
	await sleep(400);
	const tabBtn = [...app.setting.activeTab.containerEl.querySelectorAll("*")].find(
		(e) =>
			e.getAttribute?.("aria-label") === "编号维护" || e.textContent?.trim() === "编号维护",
	);
	tabBtn?.click();
	await sleep(400);
	const root = app.setting.activeTab.containerEl;
	const names = [...root.querySelectorAll(".setting-item-name")].map((e) => e.textContent.trim());
	check("TAB 只剩全库两项", names, ["整个仓库", "清除全库编号", "固化编号并交还所有权"]);
	results.push({ label: "TAB 条目", ok: true, actual: names });
	app.setting.close();
} catch (e) {
	fails.push("exception: " + (e && e.stack ? e.stack : e));
} finally {
	ah.settings.pathRules = rulesBefore;
	await ah.saveSettings();
	if (leaf) leaf.detach();
	const f = app.vault.getAbstractFileByPath(DIR);
	if (f) await app.vault.delete(f, true);
}
return {
	pass: fails.length === 0,
	fails,
	results: results.filter((r) => !r.ok || r.label === "TAB 条目"),
};
