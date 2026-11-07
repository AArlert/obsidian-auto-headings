# 参与贡献 / Contributing

[中文](#中文) · [English](#english)

## 中文

谢谢你愿意改进 Auto Headings！提 PR 前请看这几条，能省下你我来回改的工夫。

1. **先说场景**：PR 描述写清改了什么行为、为什么需要（一个真实的笔记例子最好）、跑过哪些检查。
   大一些的功能建议先开 issue 聊方向。
2. **测试场景先行**：行为有变化时，在 `doc/testplan/` 对应场景组加一行（操作 + 预期），状态填 🔲，
   并在 `tests/dev_tests/` 补单测。规格变化同步改 `doc/spec/` 对应节。
3. **提交前跑**：`npm install` 后 `npm run check`（文档守卫 + 测试 + lint + 格式）必须全绿；
   改了编号引擎（`numbering.ts` / `parser.ts` 一带）再跑 `npm run test:fuzz`。
4. **这几处请不要改**，由维护者在合并时处理，否则每个分支都会冲突：
   `doc/log.md`、`doc/log-archive.md`、版本号（`manifest.json` / `package.json` / `versions.json`）、
   `doc/release-notes/`。`release/` 是本机实测产物，已不入库。
5. **风格**：注释、文档、commit message 用简体中文，Conventional Commits（`feat: …` / `fix: …`）；
   标识符用英文；界面文字中英都要有（其余语言可选，缺的会回退英文）。

## English

Thanks for helping improve Auto Headings! A few notes that save us both a round of revisions:

1. **Start with the use case.** In the PR description, say what behavior changes, why it is needed
   (a real note as an example is best), and which checks you ran. For larger features, please open
   an issue first to agree on the direction.
2. **Test scenarios first.** When behavior changes, add a row to the matching group in `doc/testplan/`
   (steps + expected result) with status 🔲, plus unit tests in `tests/dev_tests/`. Update the
   matching section in `doc/spec/` if the spec changes.
3. **Before committing**: after `npm install`, `npm run check` (doc guard + tests + lint + format)
   must pass; if you touched the numbering engine (around `numbering.ts` / `parser.ts`), also run
   `npm run test:fuzz`.
4. **Please leave these alone** — the maintainer updates them when merging, otherwise every branch
   conflicts: `doc/log.md`, `doc/log-archive.md`, version numbers (`manifest.json` / `package.json` /
   `versions.json`), and `doc/release-notes/`. `release/` is a local build output and is no longer
   tracked.
5. **Style**: comments, docs and commit messages are in Simplified Chinese (an English summary in the
   PR is fine), Conventional Commits (`feat: …` / `fix: …`), English identifiers; UI strings need both
   Chinese and English (other locales are optional and fall back to English).
