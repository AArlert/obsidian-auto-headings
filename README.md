# Auto Headings

**English** | [简体中文](https://github.com/AArlert/obsidian-auto-headings/blob/master/README.zh.md)

Automatic heading numbering for Obsidian that keeps up with you. Add, delete or move a section and the numbers fix themselves. Rename a heading and the links to it keep working.

## Why Auto Headings

-   **Can leave your files untouched.** By default the numbers are only displayed inside Obsidian and your notes are never changed. When you need the numbers to travel with the file (GitHub, Publish, other editors), switch that folder to "Write to file".
-   **Numbers that fix themselves.** Insert a section in the middle of a long note and everything after it renumbers.
-   **Links that don't break.** Rename a heading and the `[[note#heading]]` links pointing to it are updated too.
-   **Any style you like.** `1.1.1`, `第一章`, `一、`, `①`, `I.`, `a)`, and more. You can give each folder its own style.
-   **Skips what shouldn't count.** "Contents", "Appendix" and "References" stay unnumbered and don't use up a number.
-   **Works everywhere.** Desktop and mobile, with the interface in English or 中文.

## Quick start

1. Install **Auto Headings** from **Settings → Community plugins** and enable it.
2. Open a note and start typing. Headings from `##` down show `1`, `1.1`, `1.1.1`… in front of them, and the file itself stays unchanged.
3. That's it. Open **Settings → Auto Headings** to change the style, or to write the numbers into your notes.

## Features

### Display only, or write to file

Each path rule picks its own mode:

-   **Display only** (the default for new installs): numbers appear in Live Preview, Reading view, the Outline pane and PDF export, and the note file is never changed. Source mode shows your text exactly as written.
-   **Write to file**: numbers are written into the note as real text, so they also show up on GitHub, in Obsidian Publish and in other editors.

Both modes use the same templates and produce the same numbers. You can switch at any time; the plugin first tells you how many notes are affected, then removes or writes the numbers as you choose. Vaults upgrading from an earlier version keep "Write to file".

### Hands-free numbering

In display-only mode the numbers update live as you type. In write mode, numbering runs quietly after you pause typing, and one `Ctrl/Cmd+Z` undoes it. Either way only the note you're editing is processed, and your heading levels (`#`, `##`, `###`) are never changed.

### Links follow your headings

```
## 2 Getting started      →   ## 2 First steps
[[guide#Getting started]]  →   [[guide#First steps]]
```

Change a heading's text and the links to it across your vault update at the same time. This covers both wiki links and Markdown links, and you can turn it off at any time.

### A template for every kind of note

Pick a numeral style, prefix and suffix for each heading level and watch a live preview as you go. Then pick a template for each folder: academic numbering in `Papers/`, chapter numbering in `Book/`, none at all in `Journal/`.

### Leave headings out

A built-in list keeps headings like "Contents", "Appendix" and "References" unnumbered, in both English and Chinese. You can add your own entries, or exclude a whole section together with everything under it.

### Link to any heading as you type

Start typing the name of a heading anywhere in your vault and a suggestion pops up. Press `Tab` to turn it into a link.

### Take over existing notes

Notes with hand-typed or imported numbering can be cleaned up with one command, then renumbered automatically from there on.

## Commands

| Command                                      | What it does                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Renumber now                                 | Renumber the current note right away                                                   |
| Clear numbering in current file              | Remove all numbering from the current note                                             |
| Clear non-plugin heading numbering           | Remove hand-typed or imported numbering only                                           |
| Clear leftover plugin numbering in this file | In display-only mode, remove numbers the plugin wrote earlier                          |
| Toggle global auto-numbering                 | Turn automatic numbering on or off for the vault                                       |
| Copy numbered outline                        | Copy the note's headings as an indented, numbered outline (write or display-only mode) |
| Copy current section link                    | Copy a link to the section under the cursor (write or display-only mode)               |

## FAQ

**Will it edit notes I'm not working on?**
Only in two cases: when you rename a heading that other notes link to (link sync, which you can switch off), or when you confirm a bulk action in settings, such as removing or writing numbers while switching modes.

**Does it add anything hidden to my notes?**
Not in display-only mode. In write mode, one thing: each number carries an invisible marker character, which is how the plugin tells its own numbers apart from your text. It doesn't show up anywhere, and it's removed automatically when you copy text out of Obsidian. The [user guide](https://github.com/AArlert/obsidian-auto-headings/blob/master/doc/user-guide.md#how-it-works--and-one-thing-you-should-know) explains what this means for search, Dataview and Pandoc.

**Is it heavy on resources?**
No. The plugin makes no network requests and collects no data. When it starts, it reads the headings in your vault once, locally, for "link to any heading as you type" (you can turn that off in settings); after that, numbering only touches the note you're editing. Memory use is capped: at most 50,000 indexed headings and about 2 MB of clipboard cache.

**Can I stop using it later?**
Yes. Display-only mode never changed your files, so you can simply uninstall. If you used write mode, **Settings → Sensitive actions** lets you either remove all numbering or keep the numbers as plain text. Both work across the whole vault.

**I'm coming from Number Headings.**
Disable it, enable Auto Headings, then run **Clear non-plugin heading numbering** on your old notes. Folder exclusion and skipping headings inside comments both work out of the box.

**Can I use it together with another auto-numbering plugin?**
No. Two numbering plugins will fight over the same headings, so enable only one.

## Install

-   **Community plugins (recommended):** **Settings → Community plugins → Browse**, search for "Auto Headings", then install and enable it.
-   **Manual:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/AArlert/obsidian-auto-headings/releases/latest) into `<vault>/.obsidian/plugins/auto-headings/`, then reload Obsidian.

## Learn more

-   [User guide](https://github.com/AArlert/obsidian-auto-headings/blob/master/doc/user-guide.md): every setting and edge case, export and Pandoc tips, and a clean-uninstall walkthrough.
-   [Issues](https://github.com/AArlert/obsidian-auto-headings/issues): bug reports and feature requests are welcome.

## License

[MIT](https://github.com/AArlert/obsidian-auto-headings/blob/master/LICENSE)
