import { Modal, type App } from "obsidian";
import type { ForeignNumberingPreviewItem } from "../cleanup";
import type { Messages } from "../i18n";

/** 清理预览确认框的候选行：只需要定位信息 + 现状文本，勾选状态由 modal 自己维护。 */
export interface ForeignNumberingCandidate {
	/** 该标题所在行号（0-based），用于关联勾选状态与重算后的预览。 */
	lineIndex: number;
	/** 清理前的完整标题行。 */
	before: string;
}

/**
 * 「疑似外来编号」清理预览确认框（迁移守卫 Notice 点击入口，testplan J14/J17，见 spec.md §2.8
 * 「残余已知限制」相邻讨论）。
 *
 * 与 `MaintenanceTab.ts` 的 VaultConfirmModal 同款二次确认样式（构造器注入依赖
 * + `onConfirm` 回调，`close()` 后再执行），但多两层：
 * 1. **逐条现状→清理后对照预览**——「清理非本插件的标题编号」命令与迁移守卫共享同一误伤面
 *    （`## API 设计`、`## TODO 清单` 这类完全正常的标题也会被判成疑似外来编号），无预览的一键
 *    执行等于本插件一直在批评竞品的「吃用户内容」缺陷本身，故必须先亮出每一条会被改写的标题。
 * 2. **逐条可勾选**（J17）：默认全部勾选=清理；取消勾选的标题保留原文，插件仍会在前面按模板
 *    插入自己的编号（双重编号观感，与「未接管标题」的既有语义一致）——用户对哪些是自己手写的、
 *    哪些是插件误判的，比插件自己判断得准，理应由用户逐条拍板而非只能整体接受/拒绝。
 * 3. **顶部搜索定位**（J17 追加）：候选多时逐条翻找累，搜索框按标题现状文本实时匹配，点结果
 *    （或直接回车取第一条）把主列表滚动到对应条目并短暂高亮——纯定位辅助，不改变任何勾选状态。
 *
 * 4. **版式**（1.2.2，testplan J22 / J23）：保留 git 风格红绿两行对照；顶部一行「全选」三态勾选框
 *    （与每条勾选框同一列）+「已选 X / N」+ 右侧搜索框；条目不套卡片框、只用间距分开；未勾选的
 *    条目整体变淡；列表滚动条占独立槽位，红绿行右缘与搜索框对齐；底部分隔线 + 撤销提示 + 写明
 *    数量的红底确认按钮。
 *
 * 预览随勾选状态**实时重算**（{@link computePreview}，由 main.ts 的 `computeForeignCleanupPreview`
 * 提供）而非提前算好两个静态变体——白名单 `subtree` 匹配依据标题文本判豁免，某条外来编号是否被
 * 清理会联动影响它自身乃至子孙标题是否被套用编号，只有整份重算才保证预览与确认执行逐条一致。
 */
export class ForeignNumberingCleanupModal extends Modal {
	/** 取消勾选（=保留原文，不清理）的行号集合；默认空集＝全部勾选清理。 */
	private readonly keepLines = new Set<number>();
	/** 搜索框当前查询词；跨 {@link render} 重绘保留，避免勾选联动重算时把用户正输入的内容擦掉。 */
	private searchQuery = "";

	constructor(
		app: App,
		private readonly t: Messages,
		private readonly candidates: readonly ForeignNumberingCandidate[],
		private readonly computePreview: (
			keepLines: ReadonlySet<number>,
		) => readonly ForeignNumberingPreviewItem[],
		private readonly onConfirm: (keepLines: ReadonlySet<number>) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("ah-foreign-guard-modal");
		this.render();
	}

	/**
	 * 整份重绘（含重算预览）。勾选变化时的成本换正确性是刻意取舍：文档量级下重算一次编号引擎
	 * 的开销可忽略，但白名单 subtree 联动没有更便宜、同样正确的增量更新方式（见类注释）。
	 *
	 * 重绘会重建列表 DOM，故先记住、再还原滚动位置——否则每次勾选都会把长列表弹回顶部。
	 */
	private render(): void {
		const { contentEl } = this;
		const prevList = contentEl.querySelector?.(".ah-foreign-guard-list");
		const scrollTop = prevList?.scrollTop ?? 0;

		contentEl.empty();
		this.setTitle(this.t.foreignGuardModalTitle);
		contentEl.createEl("p", { text: this.t.foreignGuardModalBody(this.candidates.length) });

		const items = this.computePreview(this.keepLines);
		const rows = new Map<number, HTMLElement>();
		const total = this.candidates.length;
		const selected = total - this.keepLines.size;

		// —— 顶部一行：全选（三态）+ 已选 X / N … 搜索框 ——
		const toolbar = contentEl.createDiv({ cls: "ah-foreign-guard-toolbar" });
		const allLabel = toolbar.createEl("label", { cls: "ah-foreign-guard-all" });
		const allBox = allLabel.createEl("input", {
			type: "checkbox",
			cls: "ah-foreign-guard-checkbox",
		});
		allBox.checked = selected === total;
		allBox.indeterminate = selected > 0 && selected < total;
		allBox.setAttr("aria-label", this.t.foreignGuardSelectAll);
		allBox.addEventListener("change", () => {
			// 全勾时点它 = 全不勾；其余（部分 / 全不勾）点它 = 全勾。
			if (selected === total) {
				for (const c of this.candidates) {
					this.keepLines.add(c.lineIndex);
				}
			} else {
				this.keepLines.clear();
			}
			this.render();
		});
		allLabel.createSpan({ text: this.t.foreignGuardSelectAll });
		allLabel.createSpan({
			cls: "ah-foreign-guard-count",
			text: this.t.foreignGuardSelected(selected, total),
		});

		const searchInput = toolbar.createEl("input", {
			type: "text",
			cls: "ah-foreign-guard-search-input",
			placeholder: this.t.foreignGuardSearchPlaceholder,
		});
		searchInput.value = this.searchQuery;
		const searchResults = contentEl.createEl("ul", { cls: "ah-foreign-guard-search-results" });

		const jumpTo = (lineIndex: number): void => {
			const row = rows.get(lineIndex);
			if (!row) {
				return;
			}
			row.scrollIntoView({ block: "center", behavior: "smooth" });
			row.addClass("ah-foreign-guard-item-flash");
			window.setTimeout(() => row.removeClass("ah-foreign-guard-item-flash"), 1200);
			this.searchQuery = "";
			searchInput.value = "";
			searchResults.empty();
		};

		const renderSearchResults = (): void => {
			searchResults.empty();
			const query = this.searchQuery.trim().toLowerCase();
			if (!query) {
				return;
			}
			const matches = items.filter((i) => i.before.toLowerCase().includes(query));
			if (matches.length === 0) {
				searchResults.createEl("li", {
					cls: "ah-foreign-guard-search-empty",
					text: this.t.foreignGuardSearchEmpty,
				});
				return;
			}
			for (const m of matches) {
				const row = searchResults.createEl("li", { cls: "ah-foreign-guard-search-result" });
				row.setText(m.before);
				row.addEventListener("click", () => jumpTo(m.lineIndex));
			}
		};
		searchInput.addEventListener("input", () => {
			this.searchQuery = searchInput.value;
			renderSearchResults();
		});
		searchInput.addEventListener("keydown", (evt) => {
			if (evt.key !== "Enter") {
				return;
			}
			const query = this.searchQuery.trim().toLowerCase();
			const first = items.find((i) => i.before.toLowerCase().includes(query));
			if (query && first) {
				evt.preventDefault();
				jumpTo(first.lineIndex);
			}
		});
		renderSearchResults();

		// —— 条目列表：勾选框 | 红绿两行对照 ——
		const list = contentEl.createEl("ul", { cls: "ah-foreign-guard-list" });
		for (const item of items) {
			const kept = this.keepLines.has(item.lineIndex);
			const li = list.createEl("li", {
				cls: kept ? "ah-foreign-guard-item is-kept" : "ah-foreign-guard-item",
			});
			rows.set(item.lineIndex, li);

			const checkbox = li.createEl("input", {
				type: "checkbox",
				cls: "ah-foreign-guard-checkbox",
			});
			checkbox.checked = !kept;
			checkbox.setAttr("aria-label", this.t.foreignGuardItemToggle(item.before));
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.keepLines.delete(item.lineIndex);
				} else {
					this.keepLines.add(item.lineIndex);
				}
				this.render();
			});

			const diff = li.createEl("div", { cls: "ah-foreign-guard-diff" });
			const before = diff.createEl("div", {
				cls: "ah-foreign-guard-line ah-foreign-guard-before",
			});
			before.createSpan({ cls: "ah-foreign-guard-marker", text: "−" });
			before.createSpan({ cls: "ah-foreign-guard-text", text: item.before });
			const after = diff.createEl("div", {
				cls: "ah-foreign-guard-line ah-foreign-guard-after",
			});
			after.createSpan({ cls: "ah-foreign-guard-marker", text: "+" });
			after.createSpan({ cls: "ah-foreign-guard-text", text: item.after });
		}
		list.scrollTop = scrollTop;

		// —— 底部：分隔线 + 撤销提示 … 取消 / 确认清理 N 处 ——
		const footer = contentEl.createDiv({ cls: "ah-foreign-guard-footer" });
		footer.createSpan({ cls: "ah-foreign-guard-undo", text: this.t.foreignGuardUndoHint });
		const buttons = footer.createDiv({ cls: "ah-foreign-guard-buttons" });
		buttons
			.createEl("button", { text: this.t.cancel })
			.addEventListener("click", () => this.close());
		const confirm = buttons.createEl("button", {
			cls: "mod-warning",
			text: this.t.foreignGuardConfirmCount(selected),
		});
		confirm.addEventListener("click", () => {
			this.close();
			this.onConfirm(this.keepLines);
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
