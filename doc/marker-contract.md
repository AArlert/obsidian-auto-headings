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
  that heading (or its numbering was fully cleared).

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

If you match heading text exactly (Dataview `file.headers`, link anchors, tasks filters),
strip WJ first:

```js
const clean = heading.replace(/⁠/g, "");
```

### Remove the whole numbering prefix (get the bare title)

```js
// Double-sentinel format (v0.7.20+): drop everything between the paired WJs.
const bare = heading.replace(/⁠[^⁠\n]*⁠/g, "");
```

For mixed vaults that may still contain the legacy single-WJ format, prefer the plugin's
own commands (*Clear numbering in current file / entire vault*), whose stripper handles
both formats plus damaged edge cases.

### Shell / CI

```sh
# Strip WJ characters from all Markdown files (GNU sed with perl fallback shown):
perl -CSD -i -pe 's/\x{2060}//g' **/*.md
```

### Pandoc

Burn-in numbering plus `--number-sections` double-numbers your headings — that is inherent
to baked-in numbers, not to WJ. Either export without `--number-sections`, or clear the
plugin's numbering before export, or strip prefixes in a Lua filter:

```lua
-- strip-autoheadings.lua : remove Auto Headings prefixes (double-sentinel format)
function Header(h)
  local s = pandoc.utils.stringify(h.content)
  local bare = s:gsub("\u{2060}[^\u{2060}]*\u{2060}", "")
  if bare ~= s then h.content = pandoc.Inlines(pandoc.Str(bare)) end
  return h
end
```

(Adapt as needed — this collapses inline formatting inside headings; for rich headings walk
the inline list instead.)

## 4. Known collision notice

U+2060 is not namespaced. At least one other plugin
([gurjar1/auto-heading-obsidian](https://github.com/gurjar1/auto-heading-obsidian)) also
tags its numbering with U+2060. Running both plugins on the same vault is **unsupported**:
each may claim the other's prefixes as its own. If you maintain a plugin that also needs an
invisible ownership marker, please pick a different character (or contact us via the issue
tracker to coordinate).

## 5. Uninstalling cleanly

1. Run **Clear numbering in entire vault** (Settings → Auto Headings → sensitive-operations
   tab) — this strips every plugin-written prefix, both sentinel formats included.
2. Disable/uninstall the plugin.
3. Optionally remove `obsidian-auto-headings` keys from frontmatter (they are inert
   without the plugin).

Files numbered while the plugin was installed contain no other trace than the prefixes and
the two WJs described above.
