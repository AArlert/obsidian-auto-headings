// 阅读视图标题菜单改文件落盘 + 升降级范围 + 返回置底 + 菜单开关的真机回归（testplan S36–S40）。
// 与 note-menu.js 的区别：这里**读磁盘文件**（adapter.read）和阅读视图 DOM，不读 view.editor——
// 隐藏编辑器的缓冲与磁盘 / 重绘可以不一致（2026-10-27 用户实测「点了没用」，旧探针读编辑器所以一直是绿的）。
const DIR = "探针-AH标题菜单";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};
const menus = () => [...document.querySelectorAll(".menu")];
const closeMenus = () => {
	document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
	for (const m of menus()) m.remove();
};
const FM = "---\nobsidian-auto-headings: false\n---\n";
const settingsBefore = {
	headingMenuEnabled: ah.settings.headingMenuEnabled,
	statusBarMenuEnabled: ah.settings.statusBarMenuEnabled,
};
let leaf;
try {
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	leaf = app.workspace.getLeaf(true);
	const open = async (path) => {
		await leaf.setViewState({ type: "markdown", state: { file: path, mode: "preview" } });
		app.workspace.setActiveLeaf(leaf, { focus: true });
		await sleep(900);
		// 装了 view-mode-by-frontmatter 等插件时打开后可能被切回编辑模式，显式再切一次。
		if (leaf.view.getMode() !== "preview") {
			await leaf.view.setState(
				{ ...leaf.view.getState(), mode: "preview" },
				{ history: false },
			);
			await sleep(900);
		}
		// 阅读视图是懒渲染的（窗口在后台时更慢），等标题出来再动手。
		for (
			let i = 0;
			i < 20 && !leaf.view.containerEl.querySelector(".markdown-preview-view h2");
			i++
		) {
			await sleep(300);
		}
	};
	const disk = (path) => app.vault.adapter.read(path);
	const hs = () => [
		...leaf.view.containerEl.querySelectorAll(".markdown-preview-view :is(h1,h2,h3,h4)"),
	];
	const ind = (text) =>
		hs()
			.find((h) => h.textContent.trim() === text)
			?.querySelector(".heading-collapse-indicator");
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
	const clickItem = (m, text) => {
		const it = [...(m?.querySelectorAll(".menu-item") ?? [])].find((e) =>
			e.textContent.includes(text),
		);
		it?.click();
		return !!it;
	};
	const act = async (path, headingText, itemText) => {
		const el = ind(headingText);
		if (!el) return "no-indicator:" + headingText;
		const m = await rightClick(el);
		if (!clickItem(m, itemText)) return "no-item:" + itemText;
		await sleep(1200);
		return "ok";
	};
	// 「调整层级」子菜单：点父项展开，再点 H<n>。
	const lv = async (headingText, scope, level) => {
		const el = ind(headingText);
		if (!el) return "no-indicator:" + headingText;
		let m = await rightClick(el);
		if (!clickItem(m, scope === "self" ? "调整此标题的层级" : "调整整节的层级"))
			return "no-parent";
		await sleep(500);
		const sub = menus().at(-1);
		const it = [...(sub?.querySelectorAll(".menu-item") ?? [])].find(
			(e) => e.textContent.trim() === "H" + level,
		);
		if (!it) return "no-level";
		it.click();
		await sleep(1200);
		return "ok";
	};
	const tags = () => hs().map((h) => h.tagName + ":" + h.textContent.trim());

	// ── S37 / S36：阅读视图下改文件 ──
	const p1 = `${DIR}/a.md`;
	await app.vault.create(p1, `${FM}# 文档\n## 甲\n### 甲一\n## 乙\n## 丙\n`);
	await open(p1);
	check("阅读视图已打开", leaf.view.getMode(), "preview");
	check("S37 跳过此标题：菜单项可点", await act(p1, "乙", "跳过此标题"), "ok");
	check("S37 跳过此标题：落盘", (await disk(p1)).includes("## 乙 <!-- skip -->"), true);
	check("S37 升级本节：菜单项可点", await lv("甲", "tree", 1), "ok");
	let d = await disk(p1);
	check(
		"S37 升级本节：落盘（本节连子标题）",
		[d.includes("\n# 甲\n"), d.includes("\n## 甲一\n")],
		[true, true],
	);
	for (let i = 0; i < 10 && !tags().includes("H1:甲"); i++) await sleep(300);
	check(
		"S37 升级本节：阅读视图已重绘",
		tags().includes("H1:甲") && tags().includes("H2:甲一"),
		true,
	);
	results.push({ label: "记录：重绘后的标题", ok: false, actual: tags() });
	check(
		"S36 仅升级此标题：落盘",
		(await lv("丙", "self", 1)) === "ok" && (await disk(p1)).includes("\n# 丙\n"),
		true,
	);
	check(
		"S36 仅降级此标题：落盘还原",
		(await lv("丙", "self", 2)) === "ok" && (await disk(p1)).includes("\n## 丙\n"),
		true,
	);
	check("S37 仍在阅读视图", leaf.view.getMode(), "preview");

	// ── S36：用户的场景（四个 ##） ──
	const p2 = `${DIR}/b.md`;
	await app.vault.create(p2, `${FM}## A\n## B\n## C\n## D\n`);
	await open(p2);
	const heads2 = async () => (await disk(p2)).split("\n").filter((l) => /^#+ /.test(l));
	await lv("A", "self", 1);
	check("S36 仅升级第一个：只它变 #", await heads2(), ["# A", "## B", "## C", "## D"]);
	await lv("A", "self", 2);
	check("S36 仅降级回来：四个仍是 ##", await heads2(), ["## A", "## B", "## C", "## D"]);
	await lv("A", "tree", 1);
	check("S36 升级本节（只含自己）", await heads2(), ["# A", "## B", "## C", "## D"]);
	await lv("A", "tree", 2);
	check("S36 降级本节带着后三个（保持原行为）", await heads2(), [
		"## A",
		"### B",
		"### C",
		"### D",
	]);

	// ── S38：从标题菜单进本篇菜单，「返回」置底 ──
	await open(p1);
	results.push({ label: "记录：S38 前的标题", ok: false, actual: tags() });
	let m = await rightClick(ind("乙"));
	clickItem(m, "本篇编号设置");
	await sleep(700);
	m = menus().at(-1);
	const titles = [...(m?.querySelectorAll(".menu-item-title") ?? [])].map((e) => e.textContent);
	check("S38 本篇菜单最后一项是返回", titles.at(-1), "返回");
	clickItem(m, "返回");
	await sleep(500);
	check(
		"S38 点返回回到标题菜单",
		(menus().at(-1)?.textContent ?? "").includes("跳过此标题"),
		true,
	);
	closeMenus();

	// ── S39：开关 ──
	ah.settings.headingMenuEnabled = false;
	const el = ind("乙");
	const r = el.getBoundingClientRect();
	const ev = new MouseEvent("contextmenu", {
		bubbles: true,
		cancelable: true,
		clientX: r.x + 2,
		clientY: r.y + 2,
		button: 2,
	});
	el.dispatchEvent(ev);
	await sleep(400);
	check(
		"S39 关掉标题右键菜单：不弹插件菜单也不拦截",
		[menus().some((x) => x.textContent.includes("跳过此标题")), ev.defaultPrevented],
		[false, false],
	);
	closeMenus();
	ah.settings.headingMenuEnabled = true;
	const sb = document.querySelector(".auto-headings-status");
	ah.settings.statusBarMenuEnabled = false;
	ah.noteEntry.updateStatus();
	check("S39 关掉状态栏标签：隐藏", sb?.style.display, "none");
	ah.settings.statusBarMenuEnabled = true;
	ah.noteEntry.updateStatus();
	check("S39 重新打开：显示", sb?.style.display, "");
} catch (e) {
	fails.push("exception: " + (e && e.stack ? e.stack : e));
} finally {
	closeMenus();
	ah.settings.headingMenuEnabled = settingsBefore.headingMenuEnabled;
	ah.settings.statusBarMenuEnabled = settingsBefore.statusBarMenuEnabled;
	ah.noteEntry?.updateStatus();
	if (leaf) leaf.detach();
	const f = app.vault.getAbstractFileByPath(DIR);
	if (f) await app.vault.delete(f, true);
}
return { pass: fails.length === 0, fails, results: results.filter((r) => !r.ok) };
