# Auto Headings

**English** | [简体中文](README.zh.md)

Automatic heading numbering for [Obsidian](https://obsidian.md) that keeps your internal links intact — rename or renumber a heading, and every `[[note#heading]]` reference to it updates with it.

Install it and your headings become `1` / `1.1` / `1.1.1` — zero configuration. Then customize everything: numeral styles, per-folder templates, whitelists, level ranges, and more. The UI is fully bilingual (English / 简体中文), following your Obsidian language automatically.

<!-- TODO: hero screenshot / GIF: assets/hero.gif -->

## Rename freely — links follow

Most heading-numbering plugins update the number but leave stale link text behind. This one keeps them in sync.

```
<!-- note.md, before -->
## 1 Foo

<!-- other.md -->
See [[note#Foo]] for details.
```

You edit the heading — text, not just the number:

```
<!-- note.md, after -->
## 2 Foobar
```

The reference updates itself, automatically, in the same edit:

```
<!-- other.md -->
See [[note#Foobar]] for details.
```

No broken anchors, no manual find-and-replace across your vault. (A few edge cases — duplicate heading names, block references, multi-level anchors — are left untouched on purpose; see [Notes](#notes).)

## Highlights

-   **Works out of the box** — a built-in default template numbers H2–H6 as `1 / 1.1 / 1.1.1` the moment you edit a note. Numbering is re-computed and rewritten automatically after you stop typing (debounce delay is adjustable).
-   **Link-safe by default** — backlink sync (on by default) updates `[[note#heading]]` links elsewhere in your vault whenever numbering rewrites a heading's text, including plain renames between numbering runs — not just the number changing.
-   **Fully customizable templates** — per level (H1–H6): prefix, numeral style, number separator, suffix, title separator, inherit-parent toggle. Seven numeral styles: Arabic, Chinese (一二三), circled (①②③), upper/lower letters, upper/lower Roman. Live preview as you type. Per template: numbering level range (e.g. only H2–H4), start number (0-based numbering like `0.1.1`), skipped-level policy, and ancestor numeral rendering (`1.a.①` outline style or Chinese-book style `一` + `1.1`).
-   **Per-folder templates** — a path-rule table maps folders/files to named templates, most-specific wins. Academic numbering in `/papers`, chapter style in `/book`, all at once.
-   **Whitelist** — structural headings (Contents, Appendix, References…) stay unnumbered and take no number slot. Three match modes (exact / partial / subtree); subtree blocks act as independent structures — numbering restarts after them, like chapters after an appendix.
-   **Cleanup commands** — clear numbering in the current file, strip foreign/hand-written numbering (to take over imported documents), or clear the whole vault (with confirmation).
-   **Respects your structure** — the plugin only adds/removes numbering prefixes. It **never** changes your `#` heading levels, and it only parses the file you are editing (no vault-wide scanning).

## How it works — and one thing you should know

Numbering is **written into the Markdown source** (not a visual overlay), so it survives export, sync, and other tools.

To tell its own numbering apart from your text, the plugin ends every prefix with an invisible **Word Joiner** character (U+2060): `## 1 ⁠My heading`. This is what makes it safe — headings that merely _look_ numbered (`2024 Review`, `API design`) are never mistaken for old numbering and eaten.

What this means for you:

-   The character is invisible and does not affect layout, export, or reading.
-   It travels with copied/exported text; if you `grep` your files for exact heading text, be aware it sits between the number and the title.
-   If you remove numbering by hand and leave stray characters behind, the commands **Clear numbering in current file** / **Clean foreign numbering** will tidy things up.

## Quick start

1. Install and enable the plugin (see below).
2. Open any note and edit it — headings from H2 down get numbered automatically.
3. Open **Settings → Auto Headings** to make it yours:
    - **General**: language, global auto-numbering toggle, backlink sync, debounce delay.
    - **Paths & templates**: the path-rule table and the template editor (live preview, whitelist).
    - **Sensitive actions**: the three cleanup entries.
4. Per-file override: add `obsidian-auto-headings: true/false` in frontmatter to force-enable/disable a single file. The command **Renumber now** bypasses all switches.

## Install

**From the community plugin store** (once accepted): Settings → Community plugins → Browse → search "Auto Headings".

**Manually**: download `main.js`, `manifest.json`, `styles.css` from the [latest release](../../releases/latest) into `<vault>/.obsidian/plugins/auto-headings/`, then reload Obsidian and enable the plugin.

## Commands

| Command                         | What it does                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Renumber now                    | Renumber the current file immediately, bypassing all switches                                |
| Clear numbering in current file | Strip all numbering prefixes (including hand-written ones)                                   |
| Clean foreign numbering         | Strip only numbering **not** written by this plugin — use it to take over imported documents |

## Notes

-   **Language**: the plugin UI follows your Obsidian language automatically (English / 简体中文), or can be locked in settings. This README has a [Chinese version](README.zh.md).
-   **Backlink sync limits**: to avoid ambiguous edits, sync skips duplicate heading names (same title in multiple places), block references (`^id`), and multi-level anchors (`#A#B`). Turning the sync on doesn't retroactively fix links that were already broken before it was enabled. It can also be turned off in **Settings → General**.
-   **Undo**: single-file rewrites are one editor transaction — a single `Ctrl/Cmd+Z` undoes them. Backlink updates to _other_ files are not part of that transaction. The vault-wide clear is **not** in the undo history; back up first.
-   **Mobile**: supported (`isDesktopOnly: false`).

## License

[MIT](LICENSE)
