/**
 * UVM 框架的文档模型：文档行的内部表示 / 序列化，以及与 `World` 无关的纯数据结构
 * （单文件状态、frontmatter 结构化状态）与结构断言工具函数。
 */

/** 文档的一行：标题（级别 + 裸标题文本）或原样行（正文 / 代码块栅栏 / 块内行）。 */
export type Line =
	| { kind: "heading"; level: number; title: string }
	| { kind: "raw"; text: string };

/** 把一行序列化为 Markdown 文本（空标题 → `### `，带尾随空格，复现空行转标题场景）。 */
export function serializeLine(line: Line): string {
	return line.kind === "heading" ? `${"#".repeat(line.level)} ${line.title}` : line.text;
}

export function serialize(lines: Line[]): string {
	return lines.map(serializeLine).join("\n");
}

/** frontmatter 单文件开关的结构化状态（驱动两层触发门控，见 {@link World.checkGate}）。 */
export type FrontmatterState = "none" | "true" | "false" | "illegal";

/**
 * 单个「文件」的状态：裸文档真值 + 编辑器文本（锁步）+ 该文件的 frontmatter 开关。
 * 阶段 2（缺口③）：一个仓库有多个文件，各自独立编辑、各自按路径规则解析模板。
 */
export interface FileState {
	path: string;
	bare: Line[];
	/** 与 bare 行一一对应；含上一次触发写入的前缀（刚插入/改写的行暂为裸文本）。 */
	rendered: string[];
	/** 单文件开关的结构化真值（驱动真实 {@link readFileSwitch}）。 */
	frontmatterState: FrontmatterState;
}

/** 提取一段文本里（代码块外）各标题的级别序列。复用解析器口径以与 DUT 一致。 */
export function headingLevels(text: string): number[] {
	// 轻量解析：仅供结构断言，规则与 parser 一致（栅栏外、行首 1–6 个 #）。
	const lines = text.split("\n");
	const out: number[] = [];
	let inFence = false;
	let fenceChar = "";
	for (const line of lines) {
		const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
		if (f) {
			const c = f[1][0];
			if (!inFence) {
				inFence = true;
				fenceChar = c;
			} else if (c === fenceChar) {
				inFence = false;
				fenceChar = "";
			}
			continue;
		}
		if (inFence) continue;
		const m = line.match(/^(#{1,6})[ \t]+/);
		if (m) out.push(m[1].length);
	}
	return out;
}
