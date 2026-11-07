// 手写编号按置信度分级的真机走查（testplan J29–J35 / H23 / V80 / V81，spec §3.10「按置信度分级」）。
// A 段只读：打开库里几篇真实笔记，看仅显示编号与提示（只看不改，结束时核对修改时间没变）。
// B 段写临时文件夹 `探针-AH分级`：迁移守卫、清理预览框默认勾选与按钮、两个清理命令的「检查…」入口；结束时删掉、还原路径规则。
const DIR = "探针-AH分级";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};
const info = (label, actual) => results.push({ label, ok: true, info: actual });
const W = "⁠";
const rulesBefore = JSON.parse(JSON.stringify(ah.settings.pathRules));
const notices = () => [...document.querySelectorAll(".notice")].map((n) => n.textContent.trim());
const clearNotices = () => document.querySelectorAll(".notice").forEach((n) => n.remove());
const lastModal = () => [...document.querySelectorAll(".modal-container")].at(-1) ?? null;
// 关框点框里自己的「取消」（真机上 `.modal-close-button` 的 click 不触发关闭）。
const closeModals = () =>
	document
		.querySelectorAll(".modal-container .ah-foreign-guard-buttons button:first-child")
		.forEach((b) => b.click());
let leaf;
const open = async (file, ms = 900) => {
	await leaf.openFile(file, { state: { mode: "source", source: false } });
	app.workspace.setActiveLeaf(leaf, { focus: true });
	await sleep(ms);
	return leaf.view.editor;
};
const virtualCount = () => leaf.view.containerEl.querySelectorAll(".ah-virtual-number").length;
const heads = (ed) =>
	ed
		.getValue()
		.split("\n")
		.filter((l) => /^#{2,} /.test(l))
		// 编号样式随库里的模板而定（`1 ` / `一、`…），只看「带插件前缀 + 正文」。
		.map((l) => l.replace(new RegExp(`${W}[^${W}]*${W}`), "|#|"));
try {
	leaf = app.workspace.getLeaf(true);

	// —— A 段：真实笔记，只读 ——
	const real = [
		["自我评价.md", "30 秒版 / 60 秒自我介绍（数量短语，应照常显示编号）"],
		["开源-axi_xbar验证.md", "Q： / ID： 标签（不是编号）"],
	];
	for (const [name, note] of real) {
		const f = app.vault.getMarkdownFiles().find((x) => x.path.endsWith("/" + name));
		if (!f) {
			info(`真实笔记 ${name}`, "没找到");
			continue;
		}
		const mtime = f.stat.mtime;
		clearNotices();
		await open(f, 1500);
		const n = notices().filter((t) => /手写编号|本身就是编号/.test(t));
		check(`真实笔记 ${name}（${note}）：显示了虚拟编号`, virtualCount() > 0, true);
		check(`真实笔记 ${name}：没弹手写编号提示`, n, []);
		check(`真实笔记 ${name}：文件没被改`, f.stat.mtime, mtime);
	}

	// —— B 段：临时文件夹 ——
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	await app.vault.createFolder(`${DIR}/写入`);
	await app.vault.createFolder(`${DIR}/仅显示`);
	ah.settings.pathRules.push({ pattern: `${DIR}/写入/`, template: "默认" }); // 写入模式（库根规则是仅显示）
	await ah.saveSettings();
	const mk = (p, c) => app.vault.create(`${DIR}/${p}`, c);

	// J31 守卫：只有存疑不拦，照常编号
	clearNotices();
	let ed = await open(await mk("写入/unsure.md", "# 文档\n## 2024 总结\n## 计划\n"));
	check("J31 只有存疑：守卫不拦、照常编号", heads(ed), ["## |#|2024 总结", "## |#|计划"]);
	check(
		"J31 只有存疑：不弹提示",
		notices().filter((t) => /手写编号/.test(t)),
		[],
	);

	// J31 / J33 守卫：值 = 序位的 `1 红米` 是确定 → 拦；提示处数只数确定；预览框存疑默认不勾
	clearNotices();
	ed = await open(await mk("写入/sure.md", "# 文档\n## 1 红米\n## 2024 总结\n"));
	check("J31 `1 红米`：守卫拦下、文件不变", heads(ed), ["## 1 红米", "## 2024 总结"]);
	const guard = notices().find((t) => /手写编号/.test(t)) ?? "";
	check("J33 守卫提示处数只数确定（1 处）", /\b1\b/.test(guard) && !/\b2\b/.test(guard), true);
	info("守卫提示原文", guard);
	[...document.querySelectorAll(".notice .ah-foreign-guard-link")].at(-1)?.click();
	await sleep(500);
	let m = lastModal();
	const items = () => [...(lastModal()?.querySelectorAll(".ah-foreign-guard-item") ?? [])];
	const confirmBtn = () =>
		lastModal()?.querySelector(".ah-foreign-guard-buttons button:last-child");
	check("J33 预览框列出两条", items().length, 2);
	check(
		"J33 存疑（2024 总结）默认不勾、确定默认勾",
		items().map((li) => li.classList.contains("is-kept")),
		[false, true],
	);
	check("J33 确认按钮：确认清理 1 处", confirmBtn()?.textContent, "确认清理 1 处");
	info("预览框说明原文", m?.querySelector(".modal-content > p")?.textContent);
	items()[0].querySelector("input")?.click(); // 取消勾选唯一的确定 → 一条都没勾
	await sleep(300);
	check(
		"J33 一条都没勾：按钮变「不清理，直接编号」",
		confirmBtn()?.textContent,
		"不清理，直接编号",
	);
	check("J33 该按钮不是红色警告样式", confirmBtn()?.classList.contains("mod-cta"), true);
	confirmBtn()?.click();
	await sleep(500);
	check("J33 不清理，直接编号：原文保留、插件编号接管", heads(ed), [
		"## |#|1 红米",
		"## |#|2024 总结",
	]);

	// J34 清理命令（不弹框）：只剥确定，存疑跳过 + 「检查…」
	clearNotices();
	ed = await open(await mk("写入/mixed.md", "# 文档\n## 1 概述\n## 2 方法\n## 30 秒版\n"));
	check("J34 打开时守卫拦下（有确定）", heads(ed), ["## 1 概述", "## 2 方法", "## 30 秒版"]);
	clearNotices();
	app.commands.executeCommandById("auto-headings:clear-foreign-numbering");
	await sleep(250);
	check("J34 只剥确定", heads(ed).slice(0, 3), ["## 概述", "## 方法", "## 30 秒版"]);
	const j34 = notices().find((t) => /看不准/.test(t)) ?? "";
	check("J34 提示带「另有 1 处看不准」与「检查…」", /1/.test(j34) && /检查/.test(j34), true);
	info("J34 提示原文", j34);
	[...document.querySelectorAll(".notice a")].find((a) => /检查/.test(a.textContent))?.click();
	await sleep(500);
	check(
		"J34 点「检查…」打开预览框，存疑默认不勾",
		items().map((li) => li.classList.contains("is-kept")),
		[true],
	);
	closeModals();
	await sleep(1500); // 等防抖：只剩存疑，守卫不拦，照常编号
	check("J34 之后防抖照常编号", heads(ed), ["## |#|概述", "## |#|方法", "## |#|30 秒版"]);

	// H23 清除命令：存疑跳过，「检查…」打开的框只剥不套模板
	clearNotices();
	ed = await open(await mk("写入/clear.md", `# 文档\n## ${W}1 ${W}概述\n## 2024 总结\n`));
	clearNotices();
	app.commands.executeCommandById("auto-headings:clear-numbering");
	await sleep(300);
	check("H23 插件编号剥净、2024 总结 不动", heads(ed), ["## 概述", "## 2024 总结"]);
	const h23 = notices().find((t) => /看不准/.test(t)) ?? "";
	check("H23 提示带「看不准」", /看不准/.test(h23), true);
	check("H23 提示不出现「。；」重复标点", /。；/.test(h23), false);
	info("H23 提示原文", h23);
	[...document.querySelectorAll(".notice a")].find((a) => /检查/.test(a.textContent))?.click();
	await sleep(500);
	check(
		"H23 只剥模式：按钮是「确认清理 0 处」而不是「直接编号」",
		confirmBtn()?.textContent,
		"确认清理 0 处",
	);
	closeModals();

	// V80 仅显示：存疑不计入过半；确定过半才不显示
	clearNotices();
	// 不放 H1：过半判定按全部标题算分母。
	await open(await mk("仅显示/v1.md", "## 2023 总结\n## 2024 总结\n## 展望\n"), 1500);
	check("V80 全是存疑：照常显示虚拟编号", virtualCount(), 3);
	check(
		"V80 全是存疑：不弹提示",
		notices().filter((t) => /手写编号/.test(t)),
		[],
	);
	clearNotices();
	await open(await mk("仅显示/v2.md", "## 1. 引言\n## 2. 方法\n## 结论\n"), 1500);
	check("V80 确定过半：不显示虚拟编号", virtualCount(), 0);
	check(
		"V80 确定过半：弹提示",
		notices().some((t) => /手写编号/.test(t)),
		true,
	);

	// V81 仅显示：整级手写编号（按级别过半）不叠编号、弹提示；只有一处的照常显示
	const subs = (n) => Array.from({ length: n }, (_, i) => `### 小节${i}`).join("\n");
	clearNotices();
	await open(
		await mk(
			"仅显示/v81-whole.md",
			["## 一、背景", subs(4), "## 二、方法", subs(4), "## 三、结论", subs(4), ""].join("\n"),
		),
		1500,
	);
	check("V81 整级 一、二、三、：不显示虚拟编号", virtualCount(), 0);
	check(
		"V81 整级：弹提示",
		notices().some((t) => /手写编号/.test(t)),
		true,
	);
	clearNotices();
	await open(
		await mk(
			"仅显示/v81-single.md",
			["## 〇、一屏结论", subs(3), "## 背景", subs(3), "## 方法", subs(3), ""].join("\n"),
		),
		1500,
	);
	check("V81 只有一处 〇、：照常显示虚拟编号", virtualCount() > 0, true);
	check(
		"V81 只有一处：不弹提示",
		notices().filter((t) => /手写编号/.test(t)),
		[],
	);

	// J35 前导词与 第…部分：写入模式守卫拦下，清理命令连前导词一起剥
	for (const [name, content, stripped] of [
		["j35-part.md", "# 文档\n## 第一部分 引言\n## 第二部分 方法\n", ["## 引言", "## 方法"]],
		["j35-step.md", "# 文档\n## Step 1 安装\n## Step 2 配置\n", ["## 安装", "## 配置"]],
	]) {
		clearNotices();
		ed = await open(await mk(`写入/${name}`, content));
		const orig = content.split("\n").filter((l) => /^## /.test(l));
		check(`J35 ${name}：守卫拦下、文件不变`, heads(ed), orig);
		check(
			`J35 ${name}：弹提示`,
			notices().some((t) => /手写编号/.test(t)),
			true,
		);
		clearNotices();
		app.commands.executeCommandById("auto-headings:clear-foreign-numbering");
		await sleep(250);
		check(`J35 ${name}：清理命令剥成裸标题`, heads(ed), stripped);
	}

	// J30 / 标签：Q： / ID： / A 档 不当编号
	clearNotices();
	await open(
		await mk("仅显示/qa.md", "# 文档\n## Q：为什么\n## ID：顺序\n## A 档 — 甲\n## B 档 — 乙\n"),
		1500,
	);
	check("J30 标签与修饰语：照常显示 4 个虚拟编号", virtualCount(), 4);
	clearNotices();
	const before = document.querySelectorAll(".modal-container").length;
	ah.reviewActiveFileForeignNumbering();
	await sleep(400);
	check(
		"J30 本篇「清理手写编号…」不弹预览框",
		document.querySelectorAll(".modal-container").length,
		before,
	);
	info("J30 提示原文", notices().join(" / "));
} catch (e) {
	fails.push("exception: " + (e && e.stack ? e.stack : e));
} finally {
	closeModals();
	ah.settings.pathRules = rulesBefore;
	await ah.saveSettings();
	if (leaf) leaf.detach();
	const f = app.vault.getAbstractFileByPath(DIR);
	if (f) await app.vault.delete(f, true);
}
return { pass: fails.length === 0, fails, results: results.filter((r) => !r.ok || r.info) };
