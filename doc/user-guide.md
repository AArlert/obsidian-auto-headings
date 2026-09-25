# Auto Headings — User guide

**English** | [简体中文](user-guide.zh.md)

The full reference behind the [README](../README.md): every setting, every edge case, and exactly what the plugin writes into your files.

## Out of the box

Everything below is what you get the moment the plugin is enabled, before you open the settings panel once.

-   **Zero configuration.** Install it, open a note, and headings from H2 down show `1` / `1.1` / `1.1.1` numbering the moment you edit — no setup needed. New installs start in display-only mode, so the file itself is never changed (see [Two modes](#two-modes-display-only-and-write-to-file)).
-   **Your heading levels are sacred.** The plugin only adds or removes number prefixes — it **never** rewrites `#`/`##`/`###`. Multiple top-level `# H1`s in one file are left alone and treated as section boundaries (numbering under each one restarts).
-   **Doesn't fight you while you type.** Renumbering runs on a debounce (50–2000 ms, adjustable) after you stop typing, and rewrites the whole file in a single editor transaction — one `Ctrl/Cmd+Z` undoes it, and your cursor position is preserved.
-   **Numbering has no background cost.** Numbering only ever processes the file you're actively editing — triggered by an edit, a manual command, or a settings change reapplied to the active file. It never scans your vault for "every file using template X." Files you haven't opened are only touched by bulk actions **you explicitly confirm** (batch renumber on a path rule, removing or writing numbers when switching modes, vault-wide clear). The one feature that reads the whole vault is heading link suggestions: on startup it reads your vault's headings once, locally, to build an index (capped at 50,000), then updates it incrementally; you can turn it off under General settings. The plugin makes no network requests and collects no data.
-   **Two independent switches, plus a manual override.** Enabling the plugin isn't the same as turning it loose on your whole vault: a global auto-numbering toggle decides whether editing a note triggers renumbering at all. Add `obsidian-auto-headings: true` or `false` to a note's frontmatter to override that toggle for one file — force it on while everything else stays untouched, or force it off for a file you don't want the plugin near. The **Renumber now** command ignores both: typing a command is explicit enough intent to skip every switch and renumber immediately.
-   **Configuration lives in Settings, not in your notes.** Templates, path rules, and the whitelist are all managed from the settings panel — nothing gets written to frontmatter except that one optional override key above. Open a note and there's no sign the plugin is even installed.
-   **Bilingual out of the box.** The entire UI follows Obsidian's own language setting (English / 简体中文), or can be locked to one manually. Fully usable on mobile (`isDesktopOnly: false`).
-   **Type it, link it.** While typing in any note, Auto Headings suggests vault headings that match what you've written — press `Tab` (or tap on mobile) and your text is expanded to the heading's full name as a clickable link to that heading. Also on by default, and it works for already-numbered headings too.

### Quick start

1. Install and enable the plugin (see the [README](../README.md#install)).
2. Open any note and edit it — headings from H2 down get numbered automatically.
3. Open **Settings → Auto Headings** if you want to go further:
    - **General**: language, global auto-numbering toggle, backlink sync, heading link suggestions, debounce delay.
    - **Paths & templates**: the path-rule table (each rule picks a template and a mode: write to file / display only) and the template editor (live preview, whitelist).
    - **Sensitive actions**: the three cleanup entries.
4. Per-file override: add `obsidian-auto-headings: true/false` in frontmatter to force-enable/disable a single file. The command **Renumber now** bypasses all switches.

## Two modes: display only and write to file

Every path rule has a mode (the "Mode" column under **Settings → Paths & templates → Path rules**). Both modes use the same templates, whitelist and skip rules and produce exactly the same numbers; they only differ in where the numbers live:

|                                                 | Display only                  | Write to file                          |
| ----------------------------------------------- | ----------------------------- | -------------------------------------- |
| Note file                                       | Never changed                 | Numbers written into headings as text  |
| Live Preview, Reading view, embeds, hover preview | Numbers shown                 | Numbers shown                          |
| Obsidian's built-in "Export to PDF"             | Numbers included              | Numbers included                       |
| Source mode                                     | Shows your text as written    | Numbers are part of the text           |
| Outline pane, in-file search                    | No numbers                    | Numbers visible                        |
| GitHub, Obsidian Publish, other editors         | No numbers                    | Numbers visible                        |
| Links follow renamed headings                   | Yes                           | Yes                                    |

-   **Defaults**: on a new install the root rule `/` is display-only, and rules you add later follow the root rule's mode. Vaults upgrading from an earlier version keep "Write to file" and behave exactly as before.
-   **Mix by folder**: e.g. `/` display-only and `Papers/` write-to-file. The most specific rule wins, the same way templates are resolved.
-   **Switching**: whenever changing a rule's mode, deleting a rule, editing its path, or setting its template to "No numbering" would move notes to a different mode, the plugin first shows a confirmation with the number of affected notes:
    -   Write → display only: choose "Remove the numbers this plugin wrote" (on by default). Only the plugin's own numbers are removed — hand-written numbers stay — and links to those headings are updated. Leave it off to keep the existing numbers.
    -   Display only → write: choose "Write numbers into these files now", or leave it off to write on the next edit (open notes update right away).
    -   Cancel leaves the rule unchanged.
-   **Leftover numbers**: if a display-only note still contains numbers the plugin wrote earlier (you kept them when switching, or moved the note in from a write-mode folder), the plugin hides the old number, shows a single new one, and underlines it with a dotted line; hover for an explanation. The old number is still in the file and will show up elsewhere. The command "Clear leftover plugin numbering in this file" removes it; it only appears in display-only notes.
-   **Hand-written numbers**: if more than half of the headings in a display-only note already carry hand-written or imported numbers (say, after migrating from another numbering plugin), the plugin shows no numbers there, to avoid two sets, and offers a notice when you open the note so you can preview and clean them up. The occasional heading that happens to start with a number (like "2024 review") is unaffected and gets numbered as usual.
-   **Renumber now** in a display-only note only refreshes the display; it never writes to the file.
-   **Freeze numbering and release ownership**: display-only numbers were never in the files, so they disappear once you freeze. To keep them as text, switch the rule to "Write to file" with "write now" first, then freeze.

## Customize it

Once the defaults aren't enough, this is what you reach for.

### Rename freely — links follow

Most heading-numbering plugins update the number but leave stale link text behind. This one keeps them in sync.

```
<!-- note.md, before -->
## 1 Foo

<!-- other.md -->
See [[note#Foo]] for details.
See [the same section](note.md#Foo) in Markdown-link style.
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
See [the same section](note.md#Foobar) in Markdown-link style.
```

No broken anchors, no manual find-and-replace across your vault. The approach builds on Header Enhancer, the only other plugin that tackles this problem, with several targeted improvements layered on top — atomic writes so an interrupted update can't half-corrupt a file, safer handling of duplicate headings, and more. (A few edge cases — duplicate heading names, block references, multi-level anchors — are left untouched on purpose; see [Notes](#notes).)

On by default, with a one-time explanatory notice the first time it actually rewrites a link. Can be turned off in **Settings → General** if you'd rather manage links yourself.

### Fully customizable templates

Every heading level (H1–H6) has independent control over:

-   **Prefix** and **suffix** (e.g. "第" + "章" → `第1章`)
-   **Numeral style** — seven of them: Arabic (`1`), Chinese (`一二三`), circled (`①②③`), lowercase/uppercase letters, lowercase/uppercase Roman numerals
-   **Number separator** (the `.` in `1.1`) and **title separator** (the space between the number and your heading text)
-   **Inherit-parent toggle** — on by default (`1.1.1`); turn it off for a level to show only that level's own numeral (e.g. `a)` instead of `1.a)`)
-   **Inherit depth** — inheriting is no longer all-or-nothing. It reaches up to the start level by default, but you can cap how many ancestors come along: H1 stands alone as `一、二、`, H2 starts its own `1`, and H3 picks up only its H2 parent for `2.1` — without dragging H1 into the prefix. Getting that middle ground used to mean pushing the start level deeper, which cancelled H1's numbering along with it
-   **Ancestor numeral rendering** — solves a real conflict between two layout conventions. Outline style wants every ancestor segment to keep its own numeral shape as it's embedded in a deeper prefix (`1.a.①`). Chinese-book style wants the opposite: the chapter heading itself reads `一`, but drops to Arabic the moment it becomes an ancestor inside a section number (`一` at H2, `1.1` at H3). A single numeral setting can't satisfy both directions at once, so `ancestorNumeral` controls just the ancestor segments, independent of how a level renders on its own.

All of it previews live as you type, so you see the exact heading format before it's ever written to a file. Create as many named templates as you like (rename, edit, or delete them from the settings panel).

### One template per folder — or per file

A path-rule table maps folders and individual files to a named template, most-specific match wins (a file-level rule beats its parent folder's rule). Use academic numbering in `/papers`, chapter-style numbering in `/book`, and the default `1 / 1.1` everywhere else — all in the same vault, no manual switching. The rule table supports drag-to-reorder, path autocompletion from your actual vault structure (browse folders level by level, or type to fuzzy-search), and warns you if you haven't set a root (`/`) fallback rule while global auto-numbering is on.

Two rule-level tools round this out: pick the pseudo-template **"No numbering"** to switch numbering off for a whole folder (no more per-file frontmatter flags — existing numbers are left frozen, not stripped), and use the per-rule **batch renumber** button to renumber every file the rule matches in one confirmed action (each file uses its own effective template; files opted out via frontmatter or containing foreign numbering are skipped).

### Whitelist — keep structural headings out of the count

Headings like "Contents", "Appendix", or "References" shouldn't get a number and shouldn't consume a slot in the counter. The whitelist (configured per template) handles this with three match modes:

-   **Exact** — the heading text matches the entry exactly
-   **Partial** — the heading text contains the entry
-   **Subtree** — the matched heading _and everything nested under it_ are exempted as a block; numbering resumes fresh afterward (handy for an appendix that shouldn't disturb the chapter count that follows it)

Resetting the counter after a subtree block, rather than continuing where it left off, is the default behavior, not a setting you have to find — a survey of academic and technical citation conventions (APA, Chicago, IEEE, RFC, GB/T 7714) found that roughly 85% of them break numbering after an appendix-like block and restart afterward.

The default template ships pre-populated with common structural terms in both English and Chinese (Contents, Appendix, Figures, Tables, References, Acknowledgments, Abstract, Index, and their Chinese equivalents).

The editor itself is built for quick tweaking, not just a flat list:

-   **Click any existing entry's text to edit it in place** — no delete-and-re-add round trip
-   Match mode is a **segmented toggle** (`=` exact / `≈` partial / `▸` subtree) right on the row — one click to switch, with a bilingual tooltip explaining each icon
-   A **hit-count badge** on each entry shows how many headings in the currently open file it exempts, and hovering it lists them
-   A **⚠ warning icon** appears when an exact/partial entry matches a heading that has child headings — a nudge to switch it to subtree mode if that's what you meant
-   A **search box and sort dropdown** (by insertion order / A–Z / match mode) keep long whitelists manageable
-   A live preview at the bottom of the panel shows exactly which headings in your current file are being exempted, right now

The whitelist matches on **heading text**, so it handles "this kind of word". When what you need is "**this
one line, in this one note**" — say a "Scratch notes" heading that shouldn't be numbered here, while the same
word is a real chapter elsewhere — append `<!-- skip -->` to the end of that heading line:

```
## Scratch notes <!-- skip -->
```

It's invisible in reading view. A skipped heading **doesn't consume a counter slot**, so the headings after it
stay consecutive. Add the marker to a heading that already has a number and the next renumber removes that
number. For now it affects only the line it's on, not the headings nested under it.

> This is a fallback for the occasional one-off line, not the everyday path — use the whitelist to exclude a
> whole class of words. A one-click toggle next to the heading is planned, so you won't have to type it.

### Cleanup commands, for when you need a clean slate

-   **Renumber now** — force an immediate renumber of the current file (see [Out of the box](#out-of-the-box) — this bypasses every switch)
-   **Clear numbering in current file** — strip every number prefix this plugin ever wrote (or could have written), returning the file to bare headings. It also **pauses that one file** (by writing `obsidian-auto-headings: false` into its frontmatter) — otherwise your very next keystroke would put the numbers straight back. To hand the file back to the plugin, run **Renumber now**; it removes that property for you
-   **Clear non-plugin heading numbering** — strip only numbering _not_ written by this plugin (hand-typed `1.` prefixes, imported document numbering, etc.) while leaving the plugin's own numbering untouched — the tool for taking over a document you didn't originate
-   **Clear numbering across the entire vault** — a settings-panel button, deliberately _not_ a command (so it can't be hotkey- or command-palette-triggered by accident), gated behind a confirmation dialog and tucked in a collapsed "danger zone" section

## How it works — and one thing you should know

> This section only applies to **write-to-file** mode. Display-only mode never writes any character into your files.

To tell its own numbering apart from your text, the plugin ends every prefix with an invisible **Word Joiner** character (U+2060): `## 1 ⁠My heading`. This is what makes it safe — headings that merely _look_ numbered (`2024 Review`, `API design`) are never mistaken for old numbering and eaten.

The idea of marking prefixes with an invisible Unicode character traces back to gurjar1/auto-heading-obsidian. This plugin adds a second safeguard on top of it: since 0.7.20 the marker sits at **both ends** of the prefix, not just the end. If you delete the trailing one while editing — say, trimming a suffix — the leading one survives as proof a plugin prefix was there, so the next renumber heals the line instead of either duplicating the number or guessing wrong.

What this means for you:

-   The character is invisible and does not affect layout, export, or reading.
-   It travels with copied/exported text; if you `grep` your files for exact heading text, be aware it sits between the number and the title — searching for `"1 My heading"` as one contiguous string will not match.
-   **Dataview**: it reaches heading text through `section` (on `TASK`/`LIST` queries), through link subpaths, and through the metadata cache in DataviewJS — all of which carry this character. The simplest fix is to stop matching exactly: the numbering is always a _prefix_, so `endswith(section.subpath, "My heading")` just works with no escaping. Recipes for normalizing (and a correction: Dataview has **no** `file.headers` field, contrary to what an earlier README claimed) are in the [marker character contract](marker-contract.md#dataview).
-   **Pasting into other apps** (WeChat, Zhihu, Notion, email clients, etc.): **copy sanitization** is always on, with nothing to configure — when you copy or cut, the plugin strips this character from the clipboard so external apps receive clean text; pasting the same text back into your vault within the same session restores the original, so numbering re-flows without double numbers. (Added in 1.0.10 as a default-on switch; the switch was removed in 1.0.16 — never putting invisible characters in your clipboard is a promise this plugin keeps, not an option.) Sanitization only covers interactive copy/cut; if you obtain such text through some other route, strip it manually with `.replace(/\u2060/g, "")` in the destination app.
-   If you remove numbering by hand and leave stray characters behind, the commands **Clear numbering in current file** / **Clear non-plugin heading numbering** will tidy things up.
-   **Coexistence with similar plugins**: gurjar1/auto-heading-obsidian also tags its numbering with U+2060. Running it alongside this plugin is **not supported** — each would claim the other's prefixes as its own.
-   **For downstream developers**: the marker's exact byte format, stability guarantees, and interop snippets live in the [marker character contract](marker-contract.md).

## Exporting & sharing

The numbering is real text, so it travels with your documents. Where each egress path stands:

-   **Copying into other apps**: eliminated — **copy sanitization** is always on (the switch was removed in 1.0.16), so interactive copy/cut no longer carries the invisible character (see the clipboard note above).
-   **Pandoc**: the numbers are already baked into the text, so don't let Pandoc number them again — exporting with `--number-sections` yields double numbering like `1.1 1.1 Introduction`. Drop the ready-made filter [`assets/pandoc/strip-autoheadings.lua`](../assets/pandoc/strip-autoheadings.lua) into your pipeline: by default it removes the plugin's prefixes so `--number-sections` produces clean single numbering, and `-M autoheadings=strip-marker` instead keeps the plugin's numbers and removes only the invisible character. Either way inline formatting inside headings (**bold**, `code`, links) survives. Verified against pandoc 3.10.
-   **PDF via Pandoc**: exporting with `--pdf-engine=typst` produced **no U+2060 anywhere in the PDF text layer** — even without the filter, the marker is dropped before it reaches the page. Copy and search in the resulting PDF behave normally. Other PDF engines are untested.
-   **Obsidian's built-in "Export to PDF"**: in display-only mode the exported PDF includes the numbers (verified in 1.2.0). In write mode the numbers are in the PDF too, but how the invisible marker behaves in the PDF text layer is still unverified — the Pandoc result above does **not** carry over.
-   **Obsidian Publish**: still unverified. Display-only numbers don't appear on Publish (Publish doesn't run this plugin).
-   Want numbers visible only inside Obsidian, with zero file changes? Use [display-only mode](#two-modes-display-only-and-write-to-file).

## Migrating from Number Headings

Number Headings has been unmaintained for roughly 2.5 years. Migrating takes three steps:

1. Disable Number Headings;
2. Enable this plugin and pick a template (the out-of-the-box default `1.1.1` is close to its style; path rules can assign different templates per folder);
3. Run **Clear non-plugin heading numbering** on your old files — it strips only numbering _not_ written by this plugin (Number Headings' prefixes, hand-written ones, and imported documents all qualify), after which normal editing renumbers everything with your template.

Its two longest-standing open requests are both **implemented here**: excluding folders from numbering (pick the "No numbering" pseudo-template on a path rule) and skipping headings inside comment blocks (`%%…%%` and `<!-- -->` are ignored — not numbered, and they don't consume a counter slot either).

## Commands

| Command                         | What it does                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Toggle global auto-numbering | Turn automatic numbering on or off for the whole vault |
| Renumber now                    | Renumber the current file immediately, bypassing all switches                                |
| Clear numbering in current file | Strip all numbering prefixes (including hand-written ones)                                   |
| Clear non-plugin heading numbering | Strip only numbering **not** written by this plugin — use it to take over imported documents |
| Clear leftover plugin numbering in this file | In a display-only note, strip only numbers this plugin wrote earlier (hand-written numbers stay) |

## Notes

-   **Language**: the plugin UI follows your Obsidian language automatically (English / 简体中文), or can be locked in settings. This guide has a [Chinese version](user-guide.zh.md).
-   **Backlink sync limits**: Wikilinks and inline Markdown links/images are supported (Markdown fragments are URL-encoded on write). To avoid ambiguous or accidental edits, sync skips duplicate heading names, block references (`^id`), multi-level anchors (`#A#B`), external URLs, and Markdown-looking text inside inline/fenced code. Turning the sync on doesn't retroactively fix links that were already broken before it was enabled. It can also be turned off in **Settings → General**.
-   **Undo**: single-file rewrites are one editor transaction — a single `Ctrl/Cmd+Z` undoes them. Backlink updates to _other_ files are not part of that transaction. The vault-wide clear is **not** in the undo history; back up first.
-   **Mobile**: supported (`isDesktopOnly: false`).

## Uninstalling cleanly

If you only ever used display-only mode, the plugin never changed your files — just uninstall it.

In write mode, the only things this plugin ever writes into your files are numbering prefixes and two invisible marker characters — all fully removable. Two ways out, depending on whether you want to keep the numbers:

**Drop the numbering** — Settings → Sensitive actions → **Clear numbering in the whole vault** (it first switches global auto-numbering off, so nothing gets renumbered mid-clear). Headings go back to bare text.

**Keep the numbering** — Settings → Sensitive actions → **Freeze numbering and release ownership (entire vault)**. Every number stays exactly as it is, as ordinary text; only the invisible markers go, and the plugin stops numbering anything from then on. This is the one to use if you like your current numbering but no longer want a plugin managing it, or you're uninstalling and want to keep the result. Markers are removed vault-wide **including inside link anchors**, so your `[[note#heading]]` links keep resolving. Once frozen, the plugin can no longer tell those numbers were its own — that's the point, but it does mean the step is one-way: to hand control back, re-enable it and run **Clear non-plugin heading numbering** first, or the existing numbers get a second prefix stacked on top.

Then:

1. Disable / uninstall the plugin;
2. (Optional) remove `obsidian-auto-headings` keys from frontmatter — they're inert without the plugin.

Because the marker lives in the file bytes themselves, even years after uninstalling you can reinstall the plugin and run the vault-wide clear to strip its old numbering precisely; for external batch cleanup without reinstalling (a one-liner), see the [marker character contract](marker-contract.md).

## License

[MIT](LICENSE)
