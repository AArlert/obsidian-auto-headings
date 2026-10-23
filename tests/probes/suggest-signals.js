// 收紧后的触发规则（Q30 Q31 Q62）与「不选就记住」（Q63）的真机回归，2026-10-24 未发版。
// 触发规则那段用真编辑器打字（与 suggest-rules.js 同一套做法）；「不选就记住」那段改用假编辑器，
// 免得 Obsidian 自己的 onTrigger / close 在我两次取样之间插进来改写记忆，把断言变成掷骰子。
const DIR = "探针-AH信号";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};

// 笔记.md 就是「当前笔记」：它自己链过【时序】【跨域】，同文件夹里有【同夹】与【缓存】。
// 其余候选都在 外/：中断与 AXI 各被两个文件链过（信号①），事务只被链过 1 次、使用从没被链过、
// UART 只在其所在文件夹里才算有信号（信号②）——正好把三条信号拆开测。
// **笔记.md 必须最后建**：链接计数在建文件时按当时的解析结果算一次，目标还不存在的链接会被漏掉，
// 要等源文件下次变动才补上（headinglinks.ts 已知取舍）。见下方 create 循环末尾的单建。
const files = {
	"当前/同夹.md": "# 同夹\n",
	"当前/正文.md": "\n\n\n",
	"外/正文.md": "\n\n\n",
	"外/中断.md": "# 中断\n",
	"外/事务.md": "# 事务\n",
	"外/时序.md": "# 时序\n",
	"外/使用.md": "# 使用\n",
	"外/跨域.md": "# 跨域\n",
	"外/AXI.md": "# AXI\n",
	"外/UART.md": "# UART\n",
	"外/scoreboard.md": "# scoreboard 设计\n",
	"外/引用甲.md": "[[外/中断#中断]] [[外/AXI#AXI]]\n",
	"外/引用乙.md": "[[外/中断#中断]] [[外/AXI#AXI]]\n",
};

const NOTE = `${DIR}/当前/笔记.md`;
let leaf;
let wasOn = true;
try {
	wasOn = ah.headingSuggestOn();
	if (!wasOn) {
		await ah.setHeadingLinkSuggestEnabled(true); // 测试库平时关着：临时打开，结束时还原
		await sleep(2000); // 建索引
	}
	const sg = app.workspace.editorSuggest.suggests.find((x) => x.plugin === ah);
	if (!sg) throw new Error("没找到本插件的 EditorSuggest 实例");

	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	await app.vault.createFolder(`${DIR}/当前`);
	await app.vault.createFolder(`${DIR}/外`);
	for (const [p, c] of Object.entries(files)) await app.vault.create(`${DIR}/${p}`, c);
	// 最后建「当前笔记」：它的两个出链这时才解析得到目标（见文件清单上方的注释）。
	await sleep(600);
	await app.vault.create(
		NOTE,
		["# 缓存", "链过 [[外/时序#时序]] 与 [[外/跨域#跨域]]", ""].join("\n"),
	);
	await sleep(4000); // metadataCache 解析 + 索引防抖 + 链接计数

	// —— 一、触发规则（真编辑器打字）——
	leaf = app.workspace.getLeaf(true);
	const openNote = async (path) => {
		const file = app.vault.getAbstractFileByPath(path);
		if (leaf.view?.file !== file) {
			await leaf.openFile(file);
			await sleep(450);
		}
		return { file, ed: leaf.view.editor };
	};
	// 在 path 的第 line 行末尾打字，返回本插件给出的候选（null = 不弹）。
	const probe = async (text, path = NOTE, line = 2) => {
		const { file, ed } = await openNote(path);
		if (text !== null) ed.setLine(line, text);
		const cursor = { line, ch: ed.getLine(line).length };
		ed.setCursor(cursor);
		const info = sg.onTrigger(cursor, ed, file);
		if (!info) return null;
		return sg.getSuggestions({ ...info, editor: ed, file }).map((e) => e.displayText);
	};

	check("Q31 「，中断」被链过 2 次 → 弹", await probe("，中断"), ["中断"]);
	check("Q31 「，事务」只被链过 1 次 → 不弹", await probe("，事务"), null);
	check("Q31 「，时序」当前笔记链过 → 弹", await probe("，时序"), ["时序"]);
	check("Q31 「，缓存」就在当前笔记 → 弹", await probe("，缓存"), ["缓存"]);
	check("Q31 「，同夹」同一文件夹 → 弹", await probe("，同夹"), ["同夹"]);
	check("Q31 「，使用」从未被链接 → 不弹", await probe("，使用"), null);
	check("Q30 「用 axi」被链过 2 次 → 弹", await probe("用 axi"), ["AXI"]);
	check("Q30 「用uart」别处从未链过 → 不弹", await probe("用uart"), null);
	check("Q30 在【UART】同文件夹里打 → 弹", await probe("用uart", `${DIR}/外/正文.md`, 2), [
		"UART",
	]);
	check("Q62 「 scoreb」6 个字母 → 不弹", await probe(" scoreb"), null);
	check("Q62 「 scoreboa」8 个字母 → 弹", await probe(" scoreboa"), ["scoreboard 设计"]);

	// —— 二、不选就记住（假编辑器）——
	// onTrigger 只用到 editor.getLine()；replaceRange / setCursor 被 selectSuggestion 用到。
	const fakeEditor = (text) => {
		const calls = [];
		return {
			calls,
			getLine: () => text,
			replaceRange: (t) => calls.push(t),
			setCursor: () => {},
		};
	};
	const trigger = (text, path = NOTE) => {
		const file = app.vault.getAbstractFileByPath(path);
		const ed = fakeEditor(text);
		// 行号取 2：笔记.md 第 0 行是【缓存】这个标题本身，行号 0 会被 Q7「排除正在写的那条」挡掉。
		const info = sg.onTrigger({ line: 2, ch: text.length }, ed, file);
		if (!info) return { info: null };
		return { info, sugg: sg.getSuggestions({ ...info, editor: ed, file }), ed, file };
	};
	const shown = (r) => (r.sugg ?? []).map((e) => e.displayText);
	// 清空全部记忆：keepOnly 是 main 在 file-open 时调的那个方法，这里借它把上一段的残留清掉。
	const resetMemory = () => sg.dismissed.keepOnly("__none__");
	const closeBox = () => {
		try {
			sg.close();
		} catch {
			/* 没开框时 Obsidian 自己的 close 可能不喜欢空 context：记忆已在 close 开头记过，忽略。 */
		}
	};

	resetMemory();
	check("Q63 ①弹出（，中断）", shown(trigger("，中断")), ["中断"]);
	closeBox(); // Esc / 回车都走这里
	check("Q63 ②没选就关，同篇不再弹", trigger("，中断").info, null);

	// 切走：main 的 file-open 会 keepOnly(新笔记)，把笔记.md 的记忆丢掉；切回来重新算。
	await openNote(`${DIR}/外/正文.md`);
	check("Q63 ③别的笔记照常弹", trigger("，中断", `${DIR}/外/正文.md`).info !== null, true);
	await openNote(NOTE);
	check("Q63 ④切回原笔记重新算", trigger("，中断").info !== null, true);

	resetMemory();
	const acc = trigger("，跨域");
	check("Q63 ⑤选中前能弹", shown(acc), ["跨域"]);
	sg.context = { ...acc.info, editor: acc.ed, file: acc.file };
	sg.selectSuggestion(acc.sugg[0], new MouseEvent("click"));
	closeBox();
	check("Q63 ⑥选中了就不记，再打还弹", trigger("，跨域").info !== null, true);
	check("Q63 ⑥选中插入的链接", /\[\[.+?#跨域\|跨域\]\]/.test(acc.ed.calls[0] ?? ""), true);

	resetMemory();
	check("Q63 ⑦接着打字：先弹", shown(trigger("见时序")), ["时序"]);
	check("Q63 ⑦打到不再命中 → 让路", trigger("见时序x").info, null);
	closeBox(); // Obsidian 在 onTrigger 返回 null 时关框
	check("Q63 ⑧同篇不再弹", trigger("见时序").info, null);
} catch (e) {
	fails.push("EXC " + (e && e.stack));
} finally {
	try {
		leaf?.detach();
	} catch {}
	try {
		await app.vault.delete(app.vault.getAbstractFileByPath(DIR), true);
	} catch {}
	try {
		if (!wasOn) await ah.setHeadingLinkSuggestEnabled(false);
	} catch {}
}
return { pass: fails.length === 0, fails, results };
