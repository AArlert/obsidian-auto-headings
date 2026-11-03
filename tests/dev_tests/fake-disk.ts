/**
 * 内存假磁盘：实现 `TemplateStore` / 插件设置读写用到的那几个 `DataAdapter` 方法（testplan V5 / V78 / V79）。
 *
 * 按最严格的平台行为模拟：`write` 要求父目录已存在、`list` 对不存在的目录抛错——不赌某个平台
 * 会自动建目录。`log` 记下每次写盘 / 建目录的顺序，供断言「先 data.json 后 templates/」。
 */

import type { DataAdapter } from "obsidian";

/** 测试用插件目录（与 manifest.dir 一致）。 */
export const PLUGIN_DIR = "plugins/auto-headings";

export class FakeDisk {
	private readonly files = new Map<string, string>();
	/** 插件目录本身视为已存在（Obsidian 装插件时就建好了）。 */
	private readonly dirs = new Set<string>([PLUGIN_DIR]);
	readonly log: string[] = [];

	async exists(path: string): Promise<boolean> {
		return this.files.has(path) || this.dirs.has(path);
	}

	async mkdir(path: string): Promise<void> {
		this.dirs.add(path);
		this.log.push(`mkdir ${path}`);
	}

	async write(path: string, data: string): Promise<void> {
		const parent = path.slice(0, path.lastIndexOf("/"));
		if (!this.dirs.has(parent)) {
			throw new Error(`ENOENT: ${parent}`);
		}
		this.files.set(path, data);
		this.log.push(`write ${path}`);
	}

	async read(path: string): Promise<string> {
		const data = this.files.get(path);
		if (data === undefined) {
			throw new Error(`ENOENT: ${path}`);
		}
		return data;
	}

	async remove(path: string): Promise<void> {
		this.files.delete(path);
	}

	async list(path: string): Promise<{ files: string[]; folders: string[] }> {
		if (!this.dirs.has(path)) {
			throw new Error(`ENOENT: ${path}`);
		}
		const files = [...this.files.keys()].filter((p) => p.startsWith(`${path}/`));
		return { files, folders: [] };
	}

	/** 插件目录之外新增的全部路径（文件 + 目录），排好序。 */
	paths(): string[] {
		return [...this.files.keys(), ...[...this.dirs].filter((d) => d !== PLUGIN_DIR)].sort();
	}

	/** 当作 `DataAdapter` 传给被测代码（只用到上面这几个方法）。 */
	asAdapter(): DataAdapter {
		return this as unknown as DataAdapter;
	}
}
