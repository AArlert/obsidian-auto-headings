/**
 * 模板存储（Milestone 3）。
 *
 * 负责模板文件的增删改查：每个模板保存为插件文件夹 `templates/` 子目录下的独立
 * `.json` 文件。首次使用时自动创建该目录并写入内置默认模板 `default.json`。
 *
 * 内存中以「模板名 → 模板」的有序映射维护全部模板（默认模板恒为第一项）；
 * 所有写操作即时落盘（`app.vault.adapter`）。GUI 直接操作本存储。
 *
 * 注意：所有 `.json` 读写都经 {@link normalizeTemplate} 容错，单个损坏文件不会
 * 让整个插件无法加载（损坏者回退为可用模板）。
 */

import { normalizePath, type DataAdapter } from "obsidian";
import type { Template } from "../numbering";
import {
	createDefaultTemplate,
	DEFAULT_TEMPLATE_FILENAME,
	DEFAULT_TEMPLATE_NAME,
	normalizeTemplate,
	serializeTemplate,
	templateFileName,
} from "./schema";

export class TemplateStore {
	private readonly adapter: DataAdapter;
	/** 插件文件夹路径（如 `.obsidian/plugins/auto-headings`）。 */
	private readonly pluginDir: string;
	/** 模板目录路径（`<pluginDir>/templates`）。 */
	private readonly templatesDir: string;

	/** 模板名 → 模板的有序映射（插入序即面板显示序；默认模板恒在最前）。 */
	private templates = new Map<string, Template>();

	constructor(adapter: DataAdapter, pluginDir: string) {
		this.adapter = adapter;
		this.pluginDir = pluginDir;
		this.templatesDir = normalizePath(`${pluginDir}/templates`);
	}

	/** 模板文件的完整路径（由模板名安全化得来）。 */
	private filePath(name: string): string {
		return normalizePath(`${this.templatesDir}/${templateFileName(name)}`);
	}

	/**
	 * 初始化：确保 `templates/` 目录与 `default.json` 存在，然后载入全部模板到内存。
	 * 在插件 `onload` 时调用一次。
	 */
	async init(): Promise<void> {
		if (!(await this.adapter.exists(this.templatesDir))) {
			await this.adapter.mkdir(this.templatesDir);
		}
		const defaultPath = normalizePath(`${this.templatesDir}/${DEFAULT_TEMPLATE_FILENAME}`);
		if (!(await this.adapter.exists(defaultPath))) {
			await this.adapter.write(defaultPath, serializeTemplate(createDefaultTemplate()));
		}
		await this.reload();
	}

	/** 从磁盘重新载入全部模板，默认模板恒置于映射首位。 */
	async reload(): Promise<void> {
		const loaded = new Map<string, Template>();

		// 默认模板始终存在且置顶；缺失或损坏时回退为内置默认。
		loaded.set(DEFAULT_TEMPLATE_NAME, await this.readOrDefault());

		const listing = await this.adapter.list(this.templatesDir);
		for (const filePath of listing.files) {
			if (!filePath.toLowerCase().endsWith(".json")) {
				continue;
			}
			if (this.basename(filePath) === DEFAULT_TEMPLATE_FILENAME) {
				continue; // 默认模板已处理。
			}
			const tpl = await this.readFile(filePath);
			if (tpl && tpl.name !== DEFAULT_TEMPLATE_NAME) {
				loaded.set(tpl.name, tpl);
			}
		}

		this.templates = loaded;
	}

	/** 读取并规范化默认模板；不存在或损坏时回退为内置默认。 */
	private async readOrDefault(): Promise<Template> {
		const defaultPath = normalizePath(`${this.templatesDir}/${DEFAULT_TEMPLATE_FILENAME}`);
		if (await this.adapter.exists(defaultPath)) {
			const tpl = await this.readFile(defaultPath);
			if (tpl) {
				// 强制默认模板名固定为「默认」。
				tpl.name = DEFAULT_TEMPLATE_NAME;
				return tpl;
			}
		}
		return createDefaultTemplate();
	}

	/** 读取单个模板文件并规范化；解析失败返回 null（跳过该文件）。 */
	private async readFile(filePath: string): Promise<Template | null> {
		try {
			const raw = await this.adapter.read(filePath);
			const parsed = JSON.parse(raw);
			const fallbackName = this.basename(filePath).replace(/\.json$/i, "");
			return normalizeTemplate(parsed, fallbackName);
		} catch {
			return null;
		}
	}

	/** 取路径的最后一段（文件名）。 */
	private basename(p: string): string {
		const idx = p.lastIndexOf("/");
		return idx === -1 ? p : p.slice(idx + 1);
	}

	/** 全部模板，按显示序（默认模板在最前）。 */
	all(): Template[] {
		return Array.from(this.templates.values());
	}

	/** 按名称取模板；不存在返回 undefined。 */
	get(name: string): Template | undefined {
		return this.templates.get(name);
	}

	/** 全局默认模板（即「默认」），始终存在。 */
	getDefault(): Template {
		return this.templates.get(DEFAULT_TEMPLATE_NAME) ?? createDefaultTemplate();
	}

	/** 某名称是否已被占用。 */
	has(name: string): boolean {
		return this.templates.has(name);
	}

	/**
	 * 生成一个未占用的新模板名（「新模板」「新模板 2」…）。
	 */
	private nextUntitledName(): string {
		const base = "新模板";
		if (!this.has(base)) {
			return base;
		}
		for (let i = 2; ; i++) {
			const candidate = `${base} ${i}`;
			if (!this.has(candidate)) {
				return candidate;
			}
		}
	}

	/**
	 * 新增一个模板（以默认模板为初始内容），**同步**加入内存并返回，落盘在后台进行。
	 *
	 * 同步返回是为了让设置面板**立即**重绘出新模板行（此前 `await` 磁盘写入再 `display()`，慢盘 / 同步
	 * 库下会卡顿、GUI 不第一时间显示——实测 bug）。落盘失败仅退化为「重启后丢失该模板」，无数据破坏风险。
	 * @returns 新模板对象。
	 */
	create(): Template {
		const tpl = createDefaultTemplate();
		tpl.name = this.nextUntitledName();
		this.templates.set(tpl.name, tpl);
		void this.adapter.write(this.filePath(tpl.name), serializeTemplate(tpl)).catch(() => {});
		return tpl;
	}

	/**
	 * 保存对某模板的编辑（内容变更，名称不变）。直接覆写其文件。
	 */
	async save(template: Template): Promise<void> {
		this.templates.set(template.name, template);
		await this.adapter.write(this.filePath(template.name), serializeTemplate(template));
	}

	/**
	 * 删除模板（默认模板不可删除）。
	 * @returns 是否实际删除。
	 */
	async delete(name: string): Promise<boolean> {
		if (name === DEFAULT_TEMPLATE_NAME || !this.templates.has(name)) {
			return false;
		}
		const path = this.filePath(name);
		if (await this.adapter.exists(path)) {
			await this.adapter.remove(path);
		}
		this.templates.delete(name);
		return true;
	}

	/**
	 * 重命名模板：删除旧文件、以新名写入新文件，并更新内存映射（保持原有顺序）。
	 *
	 * 默认模板不可改名；新名为空、与原名相同或与现有模板冲突时拒绝。`data.json`
	 * 中路径规则对模板名的引用由调用方（main.ts）在本方法成功后同步更新（路径规则见
	 * Milestone 5）。
	 *
	 * @returns 重命名是否成功。
	 */
	async rename(oldName: string, newName: string): Promise<boolean> {
		const trimmed = newName.trim();
		if (oldName === DEFAULT_TEMPLATE_NAME) {
			return false; // 默认模板名固定。
		}
		if (trimmed === "" || trimmed === DEFAULT_TEMPLATE_NAME) {
			return false; // 不可为空，也不可与默认模板重名。
		}
		if (trimmed === oldName) {
			return false; // 未改变。
		}
		if (this.templates.has(trimmed)) {
			return false; // 名称冲突。
		}
		const tpl = this.templates.get(oldName);
		if (!tpl) {
			return false;
		}

		const oldPath = this.filePath(oldName);
		tpl.name = trimmed;
		// 以新名重建有序映射，保持原插入顺序。
		const rebuilt = new Map<string, Template>();
		for (const [key, value] of this.templates) {
			rebuilt.set(key === oldName ? trimmed : key, value);
		}
		this.templates = rebuilt;

		// 先写新文件，再删旧文件（即便文件名因安全化后相同，也以覆写为准）。
		await this.adapter.write(this.filePath(trimmed), serializeTemplate(tpl));
		const newPath = this.filePath(trimmed);
		if (oldPath !== newPath && (await this.adapter.exists(oldPath))) {
			await this.adapter.remove(oldPath);
		}
		return true;
	}
}
