local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local seen = {}
local function dump(name, v, depth, maxd)
  local ind = string.rep('  ', depth)
  if type(v) ~= 'table' then
    local s = tostring(v)
    if type(v) == 'function' then
      local ok, info = pcall(debug.getinfo, v, 'S')
      if ok and info then s = s .. ' @' .. tostring(info.short_src) .. ':' .. tostring(info.linedefined) end
    end
    add(ind .. tostring(name) .. ' = ' .. s); return
  end
  if seen[v] then add(ind .. tostring(name) .. ' = <seen>'); return end
  seen[v] = true
  add(ind .. tostring(name) .. ' {')
  if depth < maxd then
    local n = 0
    for k, x in pairs(v) do n = n + 1; if n > 60 then add(ind .. '  ...'); break end; dump(k, x, depth + 1, maxd) end
  end
  add(ind .. '}')
end
dump('ANTI_ALIASING_MOBILE', OPTIONS_DATA.ANTI_ALIASING_MOBILE, 0, 4)
dump('ECO_MODE_PC', OPTIONS_DATA.ECO_MODE_PC, 0, 3)
local l = OPTIONS_DATA.optionsDataList
add('optionsDataList #' .. tostring(l and #l))
local n = 0
for k, v in pairs(l or {}) do n = n + 1; if n <= 40 then add('  [' .. tostring(k) .. '] ' .. tostring(v)) end end
dump('MobileGraphicsPreset', OPTIONS.MobileGraphicsPreset, 0, 2)
dump('OptionType', OPTIONS.OptionType, 0, 2)
dump('TabIds', OPTIONS.TabIds, 0, 2)
dump('SubTabIndex', OPTIONS.SubTabIndex, 0, 2)
dump('Menu', OPTIONS.Menu, 0, 2)
dump('VIDEO', VIDEO, 0, 2)
return table.concat(out, '\n')
