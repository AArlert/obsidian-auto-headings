# Auto Headings

**English** | [简体中文](README.zh.md)

Automatic heading numbering for [Obsidian](https://obsidian.md) — the kind that survives editing, renaming, and reorganizing your notes.

<!-- TODO: hero screenshot / GIF: assets/hero.gif -->

## The problems this plugin solves

**You insert a section in the middle of a long document, and now every number after it is wrong.** Manually renumbering `2.3` → `2.4` → `2.5` … across a 40-heading spec or a semester's worth of lecture notes is tedious and error-prone. Auto Headings recomputes the whole file automatically, every time you stop typing.

**You rename a numbered heading, and every `[[note#heading]]` link pointing at it breaks.** Most numbering plugins only touch the number and leave the link text stale. Auto Headings' backlink sync rewrites every reference across your vault in the same edit — rename the text, not just the number, and links still resolve.

**One numbering style never fits your whole vault.** Meeting notes want `1 / 1.1 / 1.1.1`. A book manuscript wants `第一章` / `一、`. An academic paper wants to skip "Contents" and "References" from the count entirely. Auto Headings lets every folder — even every file — use its own template, with a whitelist for the headings that shouldn't be numbered at all.

Install it and you get `1` / `1.1` / `1.1.1` numbering the moment you edit a note — zero configuration. Then customize as much or as little as you need.

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

## Features

### Numbering that just works, and stays out of your way

-   **Automatic, debounced renumbering** — edit a note, stop typing, and the whole file is recomputed and rewritten in one editor transaction (undo-friendly). The delay is adjustable (50–2000 ms).
-   **Numbering is written into the Markdown source**, not a rendering overlay — it survives export, sync, Pandoc, and any other tool that reads your files as plain text.
-   **Your heading levels are sacred.** The plugin only adds or removes number prefixes; it **never** rewrites `#`/`##`/`###`. Multiple top-level `# H1`s in one file are left alone and treated as section boundaries (numbering under each one restarts).
-   **Only the file you're editing is touched** — there's no vault-wide background scanning during normal use.
-   **Configurable numbering range per template** — start at H2 (skip the H1 title) and stop at H4, or number every level from H1 to H6; you choose the top and bottom level.
-   **Skipped heading levels (e.g. H2 → H4, no H3)** are handled per your preference: fill the gap with a placeholder digit (`1.1.0.1`), omit it (`1.1.1`), or leave that heading unnumbered entirely.
-   **Zero-based numbering** — set a template's start index to `0` if you want `0.1.1`-style numbering instead of `1.1.1`.

### Fully customizable templates

Every heading level (H1–H6) has independent control over:

-   **Prefix** and **suffix** (e.g. "第" + "章" → `第1章`)
-   **Numeral style** — seven of them: Arabic (`1`), Chinese (`一二三`), circled (`①②③`), lowercase/uppercase letters, lowercase/uppercase Roman numerals
-   **Number separator** (the `.` in `1.1`) and **title separator** (the space between the number and your heading text)
-   **Inherit-parent toggle** — on by default (`1.1.1`); turn it off for a level to show only that level's own numeral (e.g. `a)` instead of `1.a)`)
-   **Ancestor numeral rendering** — outline style (`1.a.①`) or Chinese-book style (leading `一` combined with `1.1`)

All of it previews live as you type, so you see the exact heading format before it's ever written to a file. Create as many named templates as you like (rename, edit, or delete them from the settings panel).

### One template per folder — or per file

A path-rule table maps folders and individual files to a named template, most-specific match wins (a file-level rule beats its parent folder's rule). Use academic numbering in `/papers`, chapter-style numbering in `/book`, and the default `1 / 1.1` everywhere else — all in the same vault, no manual switching. The rule table supports drag-to-reorder, path autocompletion from your actual vault structure, and warns you if you haven't set a root (`/`) fallback rule while global auto-numbering is on.

### Whitelist — keep structural headings out of the count

Headings like "Contents", "Appendix", or "References" shouldn't get a number and shouldn't consume a slot in the counter. The whitelist (configured per template) handles this with three match modes:

-   **Exact** — the heading text matches the entry exactly
-   **Partial** — the heading text contains the entry
-   **Subtree** — the matched heading _and everything nested under it_ are exempted as a block; numbering resumes fresh afterward (handy for an appendix that shouldn't disturb the chapter count that follows it)

The default template ships pre-populated with common structural terms in both English and Chinese (Contents, Appendix, Figures, Tables, References, Acknowledgments, Abstract, Index, and their Chinese equivalents).

The editor itself is built for quick tweaking, not just a flat list:

-   **Click any existing entry's text to edit it in place** — no delete-and-re-add round trip
-   Match mode is a **segmented toggle** (`=` exact / `≈` partial / `▸` subtree) right on the row — one click to switch, with a bilingual tooltip explaining each icon
-   A **hit-count badge** on each entry shows how many headings in the currently open file it exempts, and hovering it lists them
-   A **⚠ warning icon** appears when an exact/partial entry matches a heading that has child headings — a nudge to switch it to subtree mode if that's what you meant
-   A **search box and sort dropdown** (by insertion order / A–Z / match mode) keep long whitelists manageable
-   A live preview at the bottom of the panel shows exactly which headings in your current file are being exempted, right now

### Backlink sync — link-safe by default

On by default (with a one-time explanatory notice the first time it actually rewrites a link): whenever numbering changes a heading's text — including a plain rename between two numbering runs, not just the number shifting — every `[[note#heading]]` reference to it elsewhere in your vault is rewritten in the same operation. Can be turned off in **Settings → General** if you'd rather manage links yourself.

### Cleanup commands, for when you need a clean slate

-   **Renumber now** — force an immediate renumber of the current file, bypassing every switch (global toggle, per-file frontmatter, everything)
-   **Clear numbering in current file** — strip every number prefix this plugin ever wrote (or could have written), returning the file to bare headings
-   **Clean foreign numbering** — strip only numbering _not_ written by this plugin (hand-typed `1.` prefixes, imported document numbering, etc.) while leaving the plugin's own numbering untouched — the tool for taking over a document you didn't originate
-   **Clear numbering across the entire vault** — a settings-panel button, deliberately _not_ a command (so it can't be hotkey- or command-palette-triggered by accident), gated behind a confirmation dialog and tucked in a collapsed "danger zone" section

### Per-file override

Add `obsidian-auto-headings: true` or `false` to a note's frontmatter to force-enable or force-disable automatic numbering for that one file, independent of the global switch. The **Renumber now** command bypasses all of this if you just want it done right now.

### Bilingual, and it follows you

The entire UI — settings panel, command names, notices — is available in English and 简体中文, and automatically follows Obsidian's own language setting (or can be locked to one language manually). Fully usable on mobile (`isDesktopOnly: false`).

## How it works — and one thing you should know

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
