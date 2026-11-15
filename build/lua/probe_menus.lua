-- List LUI menu types whose names look like options/graphics/play/match menus.
local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local MB = LUI and LUI.MenuBuilder
add('LUI=' .. tostring(LUI) .. ' MenuBuilder=' .. tostring(MB))
local seen = 0
local function scan(tbl, label)
  if type(tbl) ~= 'table' then return end
  local n = 0
  for k, v in pairs(tbl) do
    n = n + 1
    local ks = tostring(k)
    local kl = ks:lower()
    if kl:find('option') or kl:find('graphic') or kl:find('setting') or kl:find('video')
      or kl:find('display') or kl:find('quality') or kl:find('private') or kl:find('custom')
      or kl:find('play') or kl:find('match') or kl:find('lobby') or kl:find('mode') then
      if seen < 400 then add(label .. '.' .. ks .. ' = ' .. type(v)); seen = seen + 1 end
    end
    if n > 20000 then break end
  end
  add(label .. ' total ' .. n)
end
if MB then
  for k, v in pairs(MB) do add('MB.' .. tostring(k) .. ' ' .. type(v)) end
  scan(MB.m_types, 'm_types')
  scan(MB.m_definitions, 'm_definitions')
end
scan(_G, '_G')
return table.concat(out, '\n')
