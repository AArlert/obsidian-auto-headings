/**
 * 极简「obsidian」模块替身，仅覆盖本仓库源码（main.ts / SettingsTab.ts / TemplateStore.ts）
 * **在模块加载与被测代码路径里实际用到的运行时值**，用于 Layer 2 集成测试。
 *
 * 经 `vitest.config.ts` 的 `resolve.alias` 把所有 `import … from "obsidian"` 重定向到此文件。
 * 仅类型用途的导入（`App` / `Editor` / `EditorChange` / `MarkdownFileInfo` / `DataAdapter` 等）
 * 在编译时被擦除、无需运行时实现；这里只提供**作为值被引用**的少数符号：
 * - `Plugin`（被 `class AutoHeadingsPlugin extends Plugin` 继承，必须可构造）
 * - `PluginSettingTab`（被设置面板继承）、`Setting`（设置面板方法内 `new Setting()`，仅需可构造）
 * - `Notice`（`new Notice(msg)`，这里记录消息供断言）
 * - `MarkdownView`（`getActiveViewOfType(MarkdownView)` 的实参 + `instanceof`）
 * - `normalizePath`（TemplateStore 路径归一）
 *
 * 真实构建（`esbuild.config.mjs`）把 obsidian 标记为 external，与此替身互不影响。
 */

/** 记录所有 `new Notice(msg)` 的消息，供测试断言用户提示。 */
export class Notice {
	static messages: string[] = [];
	constructor(message: string) {
		Notice.messages.push(message);
	}
}

/** Plugin 基类替身：提供 app / manifest 与 data 持久化、以及 onload 里调用的注册型空方法。 */
export class Plugin {
	app: unknown;
	manifest: unknown;
	private _data: unknown = undefined;

	constructor(app: unknown, manifest: unknown) {
		this.app = app;
		this.manifest = manifest;
	}

	addCommand(): void {}
	addSettingTab(): void {}
	registerEvent(): void {}
	registerDomEvent(): void {}
	async loadData(): Promise<unknown> {
		return this._data;
	}
	async saveData(data: unknown): Promise<void> {
		this._data = data;
	}
}

/** 设置面板基类替身（本测试不实例化设置面板，仅需它可作为父类被继承）。 */
export class PluginSettingTab {
	app: unknown;
	plugin: unknown;
	containerEl: unknown = {};
	constructor(app: unknown, plugin: unknown) {
		this.app = app;
		this.plugin = plugin;
	}
	display(): void {}
}

/** `new Setting(el)` 的链式替身（设置面板方法内引用；本测试不会真正调用到）。 */
export class Setting {
	constructor(_containerEl?: unknown) {}
	setName(): this {
		return this;
	}
	setDesc(): this {
		return this;
	}
	addText(): this {
		return this;
	}
	addToggle(): this {
		return this;
	}
	addDropdown(): this {
		return this;
	}
	addButton(): this {
		return this;
	}
}

/** 仅作为 `getActiveViewOfType(MarkdownView)` 的实参标识与 `instanceof` 目标。 */
export class MarkdownView {}

/**
 * 对话框基类替身：`SettingsTab.ts` 的 `DeleteTemplateModal extends Modal` 在**模块加载时**即需要
 * Modal 为可构造的类（即便本测试不实例化对话框）。仅提供构造与开关空方法。
 */
export class Modal {
	app: unknown;
	contentEl: unknown = {};
	constructor(app: unknown) {
		this.app = app;
	}
	open(): void {}
	close(): void {}
}

/** App 类型在源码里仅用作类型注解；提供一个空类以防个别打包路径未擦除该导入。 */
export class App {}

/** 路径归一：折叠反斜杠与重复斜杠，足够 TemplateStore 使用。 */
/** setIcon 替身：测试环境无 lucide 图标注册表，置空即可（DOM 结构由手验覆盖）。 */
export function setIcon(_el: unknown, _icon: string): void {}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}
