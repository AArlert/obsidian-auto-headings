--[[
strip-autoheadings.lua — Pandoc filter for files numbered by the Obsidian plugin
Auto Headings (AArlert/obsidian-auto-headings).

WHY YOU NEED THIS
-----------------
Auto Headings burns its numbering into the Markdown source and wraps the prefix in
two invisible U+2060 WORD JOINER sentinels:

    ## <WJ>1.2 <WJ>Module design

Two consequences for Pandoc:

  1. The WORD JOINERs travel into your output (PDF text layer, HTML, DOCX …).
  2. The numbers are already real text, so `--number-sections` numbers them a
     *second* time and you get "1 1 Introduction".

MODES
-----
  strip-prefix (default)  Remove the whole numbering prefix, then let Pandoc do the
                          numbering: `--number-sections` gives clean single numbers
                          (and real cross-references).

  strip-marker            Keep the plugin's numbers, remove only the invisible
                          markers. Do NOT pass `--number-sections` in this mode.

Both modes remove every U+2060 from ordinary text. **Code spans and code blocks are
left untouched** — they are literal content, and a document that *documents* this
format (like doc/marker-contract.md) must survive the filter intact. The plugin never
writes markers into code anyway, so anything found there did not come from it.

USAGE
-----
  pandoc in.md -o out.pdf -L strip-autoheadings.lua --number-sections
  pandoc in.md -o out.pdf -L strip-autoheadings.lua -M autoheadings=strip-marker

Unlike the earlier sketch published in doc/marker-contract.md, this filter walks the
inline list instead of calling pandoc.utils.stringify, so **inline formatting inside
headings survives** (`## 1.2 Module **design** with `code`` stays bold + code).
That matters because the WJ pair is split across several inlines: Pandoc parses
`## <WJ>1.2 <WJ>Module design` as Str"<WJ>1.2", Space, Str"<WJ>Module", Space,
Str"design" — the two sentinels land in *different* Str elements, so a naive
per-Str regex can never match the pair.

Legacy format: plugin versions 0.6.4–0.7.19 wrote a *single* sentinel at the end of
the prefix (`## 1.2 <WJ>Module design`). Handled — see pickTarget below.

See doc/marker-contract.md for the full byte-level contract.
--]]

local WJ = "\u{2060}"

--- 选中的模式："strip-prefix"（默认，删整个编号前缀）或 "strip-marker"（只删 WJ）。
local mode = "strip-prefix"

--- 统计一个 inline 列表里 WJ 的总个数（只有 Str 会携带 WJ）。
local function countWordJoiners(inlines)
	local total = 0
	for _, el in ipairs(inlines) do
		if el.t == "Str" then
			local pos = 1
			while true do
				local s, e = el.text:find(WJ, pos, true)
				if not s then
					break
				end
				total = total + 1
				pos = e + 1
			end
		end
	end
	return total
end

--- 该丢弃到第几个 WJ（含）为止：双哨兵取第 2 个，旧单哨兵取第 1 个，无 WJ 返回 0（不动）。
local function pickTarget(count)
	if count >= 2 then
		return 2
	elseif count == 1 then
		return 1 -- 0.6.4–0.7.19 旧格式：唯一的 WJ 在前缀末尾，其左侧全是编号。
	end
	return 0
end

--- 丢弃 inlines 中「截至第 target 个 WJ（含）」的全部内容，其余原样保留（含内联格式）。
local function dropThroughSentinel(inlines, target)
	local out = pandoc.Inlines({})
	local seen = 0
	for _, el in ipairs(inlines) do
		if seen >= target then
			-- 前缀已剥完，后面是用户的标题正文，逐字节原样保留。
			out:insert(el)
		elseif el.t == "Str" then
			local pos = 1
			while seen < target do
				local s, e = el.text:find(WJ, pos, true)
				if not s then
					break
				end
				seen = seen + 1
				pos = e + 1
			end
			if seen >= target then
				local rest = el.text:sub(pos)
				if #rest > 0 then
					out:insert(pandoc.Str(rest))
				end
			end
			-- seen < target：整个 Str 都还在前缀属地内，丢弃。
		end
		-- 前缀属地内的非 Str（Space 等）一并丢弃：契约保证编号前缀里没有富文本。
	end
	return out
end

--- 读取 `-M autoheadings=…`。**必须作为独立的一趟**跑在 Header 之前——
--- 单个 filter 表内 pandoc 是自底向上遍历（Meta 晚于 Header），会读不到模式。
local readMode = {
	Meta = function(meta)
		if meta.autoheadings then
			mode = pandoc.utils.stringify(meta.autoheadings)
		end
		if mode ~= "strip-prefix" and mode ~= "strip-marker" then
			error(
				"strip-autoheadings.lua: unknown mode '"
					.. mode
					.. "' (expected 'strip-prefix' or 'strip-marker')"
			)
		end
		return meta
	end,
}

--- 第二趟：strip-prefix 模式下剥掉标题的编号前缀。
local stripPrefix = {
	Header = function(h)
		if mode ~= "strip-prefix" then
			return nil
		end
		local target = pickTarget(countWordJoiners(h.content))
		if target == 0 then
			return nil -- 无 WJ ⇒ 插件从未碰过这个标题，不动。
		end
		h.content = dropThroughSentinel(h.content, target)
		return h
	end,
}

--- 第三趟：清掉全文残余的 WJ（strip-marker 模式的主体；strip-prefix 模式的兜底）。
--- 只碰 `Str`——`Code` / `CodeBlock` 是字面内容，刻意不动（见文件头说明）。
local stripMarker = {
	Str = function(el)
		if not el.text:find(WJ, 1, true) then
			return nil
		end
		local cleaned = el.text:gsub(WJ, "")
		if #cleaned == 0 then
			return {} -- 整个 Str 只有 WJ：删掉，别留空 Str。
		end
		return pandoc.Str(cleaned)
	end,
}

return { readMode, stripPrefix, stripMarker }
