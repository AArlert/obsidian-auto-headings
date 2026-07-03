import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		environment: "node",
	},
	resolve: {
		alias: {
			// Layer 2 集成测试：把 `import … from "obsidian"` 重定向到极简替身，
			// 使 main.ts / SettingsTab.ts / TemplateStore.ts 可在无 Obsidian 运行时下被加载与测试。
			obsidian: fileURLToPath(new URL("./tests/dev_tests/obsidian-mock.ts", import.meta.url)),
		},
	},
});
