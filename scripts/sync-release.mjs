/**
 * 把构建产物同步到 release/ 文件夹，得到可直接安装到 Obsidian 的插件文件集。
 *
 * 由 `npm run release` 调用（其前置 `npm run build` 已生成根目录 main.js）。
 * 产出两类交付物：
 * 1. **三个独立文件**（main.js + manifest.json + styles.css）直接平铺在 release/，
 *    方便往 `<Vault>/.obsidian/plugins/obsidian-auto-headings/` 里逐个拖放实测。
 * 2. **打包 zip**（release/obsidian-auto-headings.zip）：内含一个 `obsidian-auto-headings/`
 *    文件夹，文件夹里就是上面三个文件。解压即得标准插件目录，供发布 GitHub Release 时上传。
 *    **zip 不入 git**（.gitignore 已排除）——它是三个平铺文件的打包副本，需要时现跑本脚本生成。
 *
 * 每个开发周期结束都应运行，以保证 release/ 始终是「可供 Obsidian 实测的最新产物」。
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import AdmZip from "adm-zip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "release");
mkdirSync(outDir, { recursive: true });

/** 插件 id，同时用作 zip 内的文件夹名与 zip 文件名。 */
const pluginId = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")).id;

/** 随插件分发的三个文件（zip 与平铺产物一致）。 */
const files = ["main.js", "manifest.json", "styles.css"];

// 1) 平铺三个独立文件到 release/。
for (const f of files) {
	copyFileSync(join(root, f), join(outDir, f));
	console.log(`synced release/${f}`);
}

// 2) 打 zip：内含 `<pluginId>/` 文件夹，里面是这三个文件。
//    固定每个条目的时间戳，使文件内容不变时 zip 字节也稳定（避免无意义的 git 改动）。
const FIXED_MTIME = new Date("2020-01-01T00:00:00Z");
const zip = new AdmZip();
for (const f of files) {
	zip.addFile(`${pluginId}/${f}`, readFileSync(join(root, f)));
}
for (const entry of zip.getEntries()) {
	entry.header.time = FIXED_MTIME;
}
const zipName = `${pluginId}.zip`;
writeFileSync(join(outDir, zipName), zip.toBuffer());
console.log(`packed  release/${zipName}（内含 ${pluginId}/ 文件夹）`);

console.log("release/ 已更新——可直接复制三个文件，或下载/解压 zip 得到标准插件目录。");
