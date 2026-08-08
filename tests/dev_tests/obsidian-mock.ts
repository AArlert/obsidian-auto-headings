/**
 * 极简「obsidian」模块替身，仅覆盖本仓库源码（main.ts / SettingsTab.ts / TemplateStore.ts）
 * **在模块加载与被测代码路径里实际用到的运行时值**，用于 Layer 2 集成测试。
 *
 * 经 `vitest.config.ts` 的 `resolve.alias` 把所有 `import … from "obsidian"` 重定向到此文件。
 * 仅类型用途的导入（`App` / `Editor` / `EditorChange` / `MarkdownFileInfo` / `DataAdapter` 等）
 * 在编译时被擦除、无需运行时实现；这里只提供**作为值被引用**的少数符号：
 * - `Plugin`（被 `class AutoHeadingsPlugin extends Plugin` 继承，必须可构造）
 * - `PluginSettingTab`（被设置面板继承）、`Setting`（设置面板方法内 `new Setting()`，仅需可构造）
 * - `Notice`（`new Notice(msg)`，这里记录消息供断言；1.0.17 起也接受 `FakeFragment`，见下）
 * - `Modal`（迁移守卫清理预览确认框等，仅需可构造 + 记录实例，见下）
 * - `MarkdownView`（`getActiveViewOfType(MarkdownView)` 的实参 + `instanceof`）
 * - `normalizePath`（TemplateStore 路径归一）
 * - `createFragment`（迁移守卫可点击 Notice，testplan J14）：真实 Obsidian 里它是运行时注入的
 *   **全局函数**（`obsidian.d.ts` 声明在 `declare global` 里，不是模块具名导出），main.ts 因此
 *   按裸标识符调用、不出现在其 `from "obsidian"` 导入列表里。此替身模块加载时把同名实现挂到
 *   `globalThis`，补足单测环境（无真实 Obsidian/DOM 运行时）缺失的这个全局。
 *
 * 真实构建（`esbuild.config.mjs`）把 obsidian 标记为 external，与此替身互不影响。
 */

/**
 * 极简 `DocumentFragment` 替身（`createFragment` 回调拿到的对象）：仅支持 main.ts 实际用到的
 * `appendText` 与 `createEl("a", { text, href })`——够拼一段「说明文字 + 一个可点击链接」，
 * 并让测试断言拼出的可读文本、找到链接元素模拟点击。
 */
export class FakeFragment {
	private readonly parts: string[] = [];
	/** 按 `createEl` 调用顺序记录的子元素，供测试按索引取用（如 `children[0]` 即链接）。 */
	readonly children: FakeFragmentEl[] = [];

	appendText(text: string): void {
		this.parts.push(text);
	}

	createEl(tag: string, opts?: { text?: string; href?: string; cls?: string }): FakeFragmentEl {
		const el = new FakeFragmentEl(tag, opts?.text ?? "", opts?.href);
		this.children.push(el);
		this.parts.push(el.text);
		return el;
	}

	/** 按 `appendText`/`createEl` 的调用顺序拼出可读文本，供 {@link Notice} 记录到 `messages`。 */
	toText(): string {
		return this.parts.join("");
	}
}

/** {@link FakeFragment.createEl} 返回的元素替身：仅支持 `addEventListener("click", …)` + 测试专用 `click()`。 */
export class FakeFragmentEl {
	private readonly listeners = new Map<
		string,
		Array<(evt: { preventDefault(): void }) => void>
	>();

	constructor(
		readonly tagName: string,
		public text: string,
		public href?: string,
	) {}

	addEventListener(type: string, fn: (evt: { preventDefault(): void }) => void): void {
		const arr = this.listeners.get(type) ?? [];
		arr.push(fn);
		this.listeners.set(type, arr);
	}

	/** 测试专用：模拟一次点击，依次调用所有已注册的 `click` 监听器。 */
	click(): void {
		for (const fn of this.listeners.get("click") ?? []) {
			fn({ preventDefault: () => {} });
		}
	}
}

/**
 * `createFragment` 替身：构造一个 {@link FakeFragment}，回调内同步执行（与真实 Obsidian API
 * 行为一致——回调不是延迟执行的）。main.ts 按裸全局标识符调用，故本模块加载时把它挂到
 * `globalThis`（见文件末尾），而非依赖调用方 `import`。
 */
export function createFragment(callback?: (el: FakeFragment) => void): FakeFragment {
	const frag = new FakeFragment();
	callback?.(frag);
	return frag;
}

(globalThis as unknown as { createFragment: typeof createFragment }).createFragment =
	createFragment;

/** 记录所有 `new Notice(msg)` 的消息，供测试断言用户提示。 */
export class Notice {
	static messages: string[] = [];
	/** 最近一次以 {@link FakeFragment} 构造的 Notice（迁移守卫可点击 Notice，testplan J14），
	 * 供测试取出其中的链接元素并 `.click()` 模拟用户点击；纯字符串 Notice 时置 `null`。 */
	static lastFragment: FakeFragment | null = null;
	/** 全部已构造的 Notice 实例，供测试取出并断言 `hide()` 是否被调用过（如「点链接后原 Notice 收起」）。 */
	static instances: Notice[] = [];
	/** `hide()` 是否被调用过。 */
	hidden = false;
	constructor(message: string | FakeFragment, _duration?: number) {
		if (message instanceof FakeFragment) {
			Notice.messages.push(message.toText());
			Notice.lastFragment = message;
		} else {
			Notice.messages.push(message);
			Notice.lastFragment = null;
		}
		Notice.instances.push(this);
	}
	hide(): void {
		this.hidden = true;
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
 * `TFile` 替身：main.ts 的 Backlink 同步改用 `file instanceof TFile` 收窄（商店审核要求）后，
 * 假 vault 的 `getAbstractFileByPath` 必须返回本类实例才能进入 `vault.process` 分支。
 */
export class TFile {
	path = "";
	basename = "";
}

/**
 * 对话框基类替身：`SettingsTab.ts` 的 `DeleteTemplateModal extends Modal` 在**模块加载时**即需要
 * Modal 为可构造的类（即便本测试不实例化对话框）。仅提供构造与开关空方法——`open()` 刻意保持
 * 空实现、不像真实 Obsidian 那样调用 `onOpen()`：本仓库约定 Modal 的 DOM 渲染细节（`onOpen` 里
 * 的 `contentEl.createEl(...)`）留给手验，单测只覆盖「构造时传入的数据是否正确」与「确认/取消
 * 回调是否正确触发底层动作」（见 main.test.ts 对 `BatchRenumberModal`/`ForeignNumberingCleanupModal`
 * 的测试方式：不调用 `.open()`，改为直接检查 {@link Modal.instances} 上构造参数）。
 */
export class Modal {
	/** 全部已构造的 Modal 实例（含子类），供测试断言「某操作确实打开了确认框」及取出构造参数。 */
	static instances: Modal[] = [];
	app: unknown;
	contentEl: unknown = {};
	constructor(app: unknown) {
		this.app = app;
		Modal.instances.push(this);
	}
	open(): void {}
	close(): void {}
}

/** App 类型在源码里仅用作类型注解；提供一个空类以防个别打包路径未擦除该导入。 */
export class App {}

/**
 * `getLanguage` 替身：i18n.ts 的语言探测改走官方 API（1.8.0+）后，测试经此设定「Obsidian 界面语言」。
 * 默认 `en`（与 Obsidian 默认界面一致）；置为抛错函数可模拟受限环境。
 */
let mockLanguage: () => string = () => "en";

/** 测试专用：设定 {@link getLanguage} 的返回（传入函数以便模拟抛错场景）。 */
export function __setMockLanguage(fn: () => string): void {
	mockLanguage = fn;
}

export function getLanguage(): string {
	return mockLanguage();
}

/** 路径归一：折叠反斜杠与重复斜杠，足够 TemplateStore 使用。 */
/** setIcon 替身：测试环境无 lucide 图标注册表，置空即可（DOM 结构由手验覆盖）。 */
export function setIcon(_el: unknown, _icon: string): void {}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}
