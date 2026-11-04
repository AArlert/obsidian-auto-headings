// 「清除全库编号」按置信度分级的真机走查（testplan H23）：会改整个库，**只在测试库里跑**。
// 库里原有笔记也会被清，跑之前先备份、跑完自己还原（本脚本只删自己建的临时文件夹）。
const DIR = "探针-AH清库";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ah = app.plugins.plugins["auto-headings"];
const results = [];
const fails = [];
const check = (label, actual, expect) => {
	const ok = JSON.stringify(actual) === JSON.stringify(expect);
	results.push({ label, ok, actual: ok ? undefined : actual, expect: ok ? undefined : expect });
	if (!ok) fails.push(label);
};
const W = "⁠";
const autoBefore = ah.settings.autoNumber;
try {
	{
		const f = app.vault.getAbstractFileByPath(DIR);
		if (f) await app.vault.delete(f, true);
	}
	await app.vault.createFolder(DIR);
	const files = {
		"plugin.md": [`## ${W}1 ${W}插件编号\n## 2024 总结\n`, "## 插件编号\n## 2024 总结\n"],
		"sure.md": ["## 1 概述\n## 2 方法\n", "## 概述\n## 方法\n"],
		"unsure.md": ["## 30 秒版\n## 背景\n", "## 30 秒版\n## 背景\n"],
		"latin.md": ["## vim 配置\n## Q：为什么\n", "## vim 配置\n## Q：为什么\n"],
	};
	for (const [name, [content]] of Object.entries(files)) {
		await app.vault.create(`${DIR}/${name}`, content);
	}
	document.querySelectorAll(".notice").forEach((n) => n.remove());
	await ah.clearAllVaultNumbering(false); // 不关全局自动编号，免得改动测试库设置
	await sleep(500);
	for (const [name, [, expected]] of Object.entries(files)) {
		const f = app.vault.getAbstractFileByPath(`${DIR}/${name}`);
		check(`清除全库后 ${name}`, await app.vault.read(f), expected);
	}
	const notice = [...document.querySelectorAll(".notice")].map((n) => n.textContent).join(" / ");
	check("结果提示带含存疑标题的篇数", /另有 \d+ 个文件含看不准的标题/.test(notice), true);
	check("全局自动编号开关没被改", ah.settings.autoNumber, autoBefore);
	results.push({ label: "结果提示原文", ok: true, info: notice });
} catch (e) {
	fails.push("exception: " + (e && e.stack ? e.stack : e));
} finally {
	const f = app.vault.getAbstractFileByPath(DIR);
	if (f) await app.vault.delete(f, true);
}
return { pass: fails.length === 0, fails, results: results.filter((r) => !r.ok || r.info) };
