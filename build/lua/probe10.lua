local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local g = {}
for k, v in pairs(_G) do local s = tostring(k); if s:find('Builder') or s:find('Build') or s:find('Widget') then g[#g + 1] = s .. '(' .. type(v):sub(1, 3) .. ')' end end
table.sort(g); add('_G: ' .. table.concat(g, ' '))
local MB = rawget(_G, 'MenuBuilder')
if type(MB) == 'table' then
  local l = {}
  for k, v in pairs(MB) do l[#l + 1] = tostring(k) .. '(' .. type(v):sub(1, 3) .. ')' end
  table.sort(l); add('MenuBuilder: ' .. table.concat(l, ' '))
end
local top = LUI.FlowManager.GetTopmostMenu().menu
local mt = getmetatable(top)
local function methods(o, label)
  local m = getmetatable(o); local l = {}
  local seen = {}
  while m and #l < 400 do
    local idx = m.__index
    if type(idx) == 'table' and not seen[idx] then
      seen[idx] = true
      for k, v in pairs(idx) do l[#l + 1] = tostring(k) end
      m = getmetatable(idx)
    else break end
  end
  table.sort(l); add(label .. ' methods ' .. #l .. ': ' .. table.concat(l, ' '))
end
methods(top, 'menu')
return table.concat(out, '\n')
