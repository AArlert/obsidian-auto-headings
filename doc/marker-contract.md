# Auto Headings — Marker Character Contract

> **Audience**: developers of other Obsidian plugins, Dataview/Templater script authors, and
> external-tool users (ripgrep, Pandoc, sync pipelines) who need to interoperate with files
> numbered by the **Auto Headings** plugin (`AArlert/obsidian-auto-headings`, plugin id
> `auto-headings`).
>
> This document is a **stability contract**: the byte-level format described here will not
> change without a major-version migration path. It is written in English because its audience
> is downstream tooling, not this repository's (Chinese-language) internal docs. The Chinese
> summary lives in `doc/spec.md` §2.7; the design rationale lives in `doc/spec.md` Appendix A §A.8.

## 1. What the plugin writes

When Auto Headings numbers a heading, it rewrites the heading line **in the Markdown source**
(burn-in philosophy — the number is real text, not a render-layer overlay):

```
<#{1..6}><space><WJ><prefix><numbers-and-separators><suffix><title-separator><WJ><heading text>
```

where **WJ** is a single invisible **U+2060 WORD JOINER** character. Example (template
`1.1`-style, default): the visible text `## 1.2 Module design` is actually stored as

```
## ⁠ 1.2 ⁠ Module design      (WJ shown expanded; there are no real spaces around it)
```

i.e. `## ⁠1.2 ⁠Module design` — one WJ immediately after `## `, one WJ immediately before the
heading's own text. Everything between the two WJs (inclusive) is plugin-owned; everything
after the second WJ is the user's heading text, byte-for-byte untouched.

Properties you can rely on:

- **Exactly two WJs per numbered heading**, wrapping the whole numbering prefix
  ("double sentinel", since plugin v0.7.20).
- **Legacy format** (plugin v0.6.4–0.7.19): a single WJ at the *end* of the prefix
  (`## 1.2 ⁠Module design`). The plugin still recognizes and upgrades these on next
  renumber; third-party code should tolerate both.
- WJ never appears anywhere else as a result of this plugin: not in body text, not in
  frontmatter, not in non-heading lines (a heading demoted to body text by the user may
  transiently carry residue; the plugin cleans it on next trigger).
- **Unnumbered headings contain no WJ.** Absence of WJ ⇒ the plugin has never touched
  that heading, or its numbering was fully cleared, **or the user ran
  *Freeze numbering and release ownership*** (see §5) — that command deliberately leaves the
  numbers behind as ordinary text while removing every marker, so afterwards those numbers
  are indistinguishable from hand-written ones. That is the point of it: the user is taking
  the numbering back. Downstream code should treat such text as user content, which is
  exactly what it now is.

## 2. Stability guarantees

1. The marker character stays **U+2060**, and the double-sentinel positions stay as
   described, for all `1.x` releases. Any future change will ship with an automatic
   migration and a major version bump.
2. The frontmatter per-file switch key stays **`obsidian-auto-headings`**
   (values: checkbox `true`/`false`) — it is user data and will not be renamed, even
   though the plugin id itself is `auto-headings`.
3. The plugin's numbering is **always identifiable after the fact**: because identity
   lives in the file bytes, a vault can be cleaned of Auto Headings numbering at any
   time — even years after uninstalling — by reinstalling the plugin and running
   *"Clear numbering in entire vault"*, or with the one-liners below.

## 3. How to interoperate

### Normalize for matching (keep the numbers, drop the invisibles)

If you match heading text exactly (link anchors, tasks filters, your own scripts),
strip WJ first:

```js
const clean = heading.replace(/\u2060/g, "");
```

### Remove the whole numbering prefix (get the bare title)

```js
// Double-sentinel format (v0.7.20+): drop everything between the paired WJs.
const bare = heading.replace(/\u2060[^\u2060\n]*\u2060/g, "");
```

For mixed vaults that may still contain the legacy single-WJ format, prefer the plugin's
own commands (*Clear numbering in current file / entire vault*), whose stripper handles
both formats plus damaged edge cases.

### Dataview

**There is no `file.headers` field.** Dataview does not index headings at all — a page's
implicit fields are `name`, `folder`, `path`, `ext`, `link`, `size`, `ctime`, `cday`,
`mtime`, `mday`, `tags`, `etags`, `inlinks`, `outlinks`, `aliases`, `tasks`, `lists`,
`frontmatter`, `day`, `starred`, and nothing heading-shaped. Earlier revisions of this
document (and of the plugin README) suggested `WHERE file.headers = "1 My heading"` and
blamed the empty result on WJ; that was wrong on both counts — the query returns nothing
with or without the marker, because the field does not exist.

WJ reaches Dataview through three real surfaces:

| Surface | Where the WJ sits |
| ------- | ----------------- |
| `TASK` / `LIST` queries | `section` is a Link whose subpath is the heading text |
| `file.outlinks` | the subpath of any `[[note#heading]]` the plugin has written |
| DataviewJS | `app.metadataCache.getCache(path).headings[].heading` |

#### Preferred: don't match the marker at all

The numbering is always a *prefix*, so suffix and substring matching are unaffected by it.
Replace exact matches with `endswith()` / `contains()` and nothing needs escaping anywhere:

```
TASK WHERE endswith(section.subpath, "Module design")
```

#### When you must normalize (display, GROUP BY)

`regexreplace` works, and `"\u2060"` is the portable way to spell the character. Dataview's
string parser passes `\u` through untouched (only `\"` and `\\` are special), so all six
characters reach `new RegExp()`, which compiles them as the Unicode escape:

```
TABLE regexreplace(section.subpath, "\u2060", "") AS Section FROM "notes"
```

#### DataviewJS: list a file's headings

Since Dataview has no heading index, read Obsidian's metadata cache directly:

```js
const MARKER = /\u2060/g;
const PREFIX = /\u2060[^\u2060\n]*\u2060/g;
const headings = app.metadataCache.getCache(dv.current().file.path)?.headings ?? [];
dv.table(
    ["Level", "Numbered", "Bare title"],
    headings.map((h) => [h.level, h.heading.replace(MARKER, ""), h.heading.replace(PREFIX, "")]),
);
```

### Shell / CI

```sh
# Strip WJ characters from all Markdown files (GNU sed with perl fallback shown):
perl -CSD -i -pe 's/\x{2060}//g' **/*.md
```

### Pandoc

Burn-in numbering plus `--number-sections` double-numbers your headings — that is inherent
to baked-in numbers, not to WJ. A ready-made filter ships with the plugin repository:
**[`assets/pandoc/strip-autoheadings.lua`](../assets/pandoc/strip-autoheadings.lua)**.

```sh
# Let Pandoc do the numbering (default mode: removes the whole plugin prefix)
pandoc in.md -o out.pdf -L strip-autoheadings.lua --number-sections

# Keep the plugin's numbers, drop only the invisible markers
pandoc in.md -o out.pdf -L strip-autoheadings.lua -M autoheadings=strip-marker
```

It walks the inline list rather than calling `pandoc.utils.stringify`, so **inline formatting
inside headings survives**. That distinction matters more than it looks: Pandoc parses
`## <WJ>1.2 <WJ>Module design` into `Str"<WJ>1.2"`, `Space`, `Str"<WJ>Module"`, `Space`,
`Str"design"` — the two sentinels land in *different* `Str` elements, so neither a per-`Str`
regex nor a stringify-and-rebuild approach handles rich headings correctly. Legacy
single-sentinel headings are handled too.

Verified 2026-07-19 with pandoc 3.10 and `--pdf-engine=typst` (typst 0.15.1):

| Invocation | Result |
| ---------- | ------ |
| plain conversion | plugin numbers kept; WJ present in HTML/AST output |
| `--number-sections`, no filter | **double numbering** — `1.1 1.1 Introduction` |
| `--number-sections` + filter | single clean numbering; `<strong>`/`<code>`/links inside headings intact; zero WJ |
| filter, `strip-marker` mode | plugin numbers kept; zero WJ; formatting intact |

Two further findings from that run:

- **Documents that start at `##`** (the plugin's default top level) are numbered by Pandoc
  according to nesting depth, not absolute heading level — the first `##` becomes `1`, its
  `###` children `1.1`, `1.2`. So Pandoc's native numbering *coincides* with the plugin's
  default scheme rather than producing an off-by-one level.
- **The PDF text layer contained no U+2060 in any of the four runs**, including the
  unfiltered one: the `ToUnicode` CMaps of the generated PDFs map no glyph to `2060`, while
  a positive control (a CJK character from the same headings) is present as expected. On this
  path the marker is dropped before it reaches the PDF. Other PDF engines and Obsidian's own
  built-in "Export to PDF" (a different pipeline entirely — Electron print-to-PDF over the
  reading view) have **not** been verified and may behave differently.

## 4. Known collision notice

U+2060 is not namespaced. At least one other plugin
([gurjar1/auto-heading-obsidian](https://github.com/gurjar1/auto-heading-obsidian)) also
tags its numbering with U+2060. Running both plugins on the same vault is **unsupported**:
each may claim the other's prefixes as its own. If you maintain a plugin that also needs an
invisible ownership marker, please pick a different character (or contact us via the issue
tracker to coordinate).

## 5. Uninstalling cleanly

Two exits, depending on whether you want to keep the numbers. Both live in
Settings → Auto Headings → sensitive-operations tab, and both are deliberately **not**
command-palette commands (a vault-wide irreversible rewrite should not sit on a hotkey).

**A — drop the numbering.** Run **Clear numbering in entire vault**: strips every
plugin-written prefix, both sentinel formats included, leaving bare headings.

**B — keep the numbering.** Run **Freeze numbering and release ownership**: keeps every
number as ordinary text and removes only the markers, then stops all automatic numbering.
Use this when you like the numbering but no longer want it managed — or you are uninstalling
and want to keep the result.

Note that B strips WJ **vault-wide, including inside link anchors**. That is required, not
incidental: the plugin writes WJ into `[[note#⁠1 ⁠heading]]` anchors on purpose, because
Obsidian resolves anchors by byte comparison and does not strip WJ. Removing the marker from
headings only would leave every internal link pointing at a byte sequence that no longer
exists. Both sides go to zero together, so links keep resolving.

B is irreversible *from the plugin's side* — per §1 it can no longer tell those numbers were
its own. To hand control back, re-enable it in settings and run **Clean foreign numbering**
on the affected files first; otherwise the existing numbers count as foreign numbering and a
fresh prefix gets stacked on top.

Then disable/uninstall the plugin, and optionally remove `obsidian-auto-headings` keys from
frontmatter (they are inert without the plugin).

Files numbered while the plugin was installed contain no other trace than the prefixes and
the two WJs described above.
