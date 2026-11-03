import { describe, expect, it, vi } from "vitest";
import { TemplateStore } from "../../src/templates/TemplateStore";
import { createDefaultTemplate, serializeTemplate } from "../../src/templates/schema";
import { FakeDisk, PLUGIN_DIR } from "./fake-disk";

const TEMPLATES = `${PLUGIN_DIR}/templates`;

/** 等后台落盘（`create()` 同步返回、写入在后台）跑完。 */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("TemplateStore：templates/ 懒建（testplan V5 / V79）", () => {
	it("V5：新装 init 不建目录、不写文件，默认模板取内置默认", async () => {
		const disk = new FakeDisk();
		const store = new TemplateStore(disk.asAdapter(), PLUGIN_DIR);
		await store.init();
		expect(disk.paths()).toEqual([]);
		expect(store.getDefault()).toEqual(createDefaultTemplate());
		expect(store.all()).toHaveLength(1);
	});

	it("V5：老用户已有的 templates/ 照常载入（含自定义模板）", async () => {
		const disk = new FakeDisk();
		await disk.mkdir(TEMPLATES);
		const custom = { ...createDefaultTemplate(), name: "论文" };
		await disk.write(`${TEMPLATES}/论文.json`, serializeTemplate(custom));
		const before = new Set(disk.paths());
		const store = new TemplateStore(disk.asAdapter(), PLUGIN_DIR);
		await store.init();
		expect(store.all().map((t) => t.name)).toEqual(["默认", "论文"]);
		expect(new Set(disk.paths())).toEqual(before); // 老用户缺 default.json 也不补写。
	});

	it("V79：新建模板后直接关弹窗（后台落盘）→ 回调先于建目录，只调一次", async () => {
		const disk = new FakeDisk();
		const order: string[] = [];
		const before = vi.fn(async () => {
			order.push(`callback@${disk.log.length}`);
		});
		const store = new TemplateStore(disk.asAdapter(), PLUGIN_DIR, before);
		await store.init();
		const created = store.create();
		await flush();
		expect(before).toHaveBeenCalledTimes(1);
		expect(order).toEqual(["callback@0"]); // 建目录之前。
		expect(disk.log).toEqual([`mkdir ${TEMPLATES}`, `write ${TEMPLATES}/${created.name}.json`]);
		await store.save(created);
		expect(before).toHaveBeenCalledTimes(1); // 目录已在，不再回调。
	});

	it("V79：目录已存在（老用户）时写模板、改名都不回调", async () => {
		const disk = new FakeDisk();
		await disk.mkdir(TEMPLATES);
		const before = vi.fn(async () => {});
		const store = new TemplateStore(disk.asAdapter(), PLUGIN_DIR, before);
		await store.init();
		const created = store.create();
		await flush();
		expect(await store.rename(created.name, "论文")).toBe(true);
		await store.save(store.getDefault());
		expect(before).not.toHaveBeenCalled();
		expect(await disk.exists(`${TEMPLATES}/论文.json`)).toBe(true);
	});

	it("V79：新装后第一次落盘走改名路径也先回调", async () => {
		const disk = new FakeDisk();
		const before = vi.fn(async () => {});
		const store = new TemplateStore(disk.asAdapter(), PLUGIN_DIR, before);
		await store.init();
		// create() 的后台写入失败也不该让改名漏掉回调：先让第一次 mkdir 前的回调抛错。
		before.mockRejectedValueOnce(new Error("io"));
		const created = store.create();
		await flush();
		expect(await disk.exists(TEMPLATES)).toBe(false); // 回调失败 → 不建目录（宁可这次没落盘）。
		expect(await store.rename(created.name, "论文")).toBe(true);
		expect(before).toHaveBeenCalledTimes(2);
		expect(await disk.exists(`${TEMPLATES}/论文.json`)).toBe(true);
	});
});
