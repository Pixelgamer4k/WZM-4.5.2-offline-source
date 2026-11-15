local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local FM = LUI.FlowManager
local names = {}
for k, v in pairs(FM.FlowMenus or {}) do names[#names + 1] = tostring(k) end
table.sort(names)
add('FlowMenus ' .. #names)
local sel = {}
for _, n in ipairs(names) do
  local l = n:lower()
  if l:find('setting') or l:find('option') or l:find('graphic') or l:find('gamemode') or l:find('private')
    or l:find('play') or l:find('mode') or l:find('lobby') or l:find('custom') then sel[#sel + 1] = n end
end
add('match: ' .. table.concat(sel, ' '))
local top = FM.GetTopmostMenu and FM.GetTopmostMenu()
add('topmost ' .. tostring(top and (top.id or top.menuName or top._name or top)))
local st = FM.GetMenuStack and FM.GetMenuStack(0)
if type(st) == 'table' then
  local s = {}
  for i, m in ipairs(st) do s[#s + 1] = tostring(m.name or m.menuName or m.id or m) end
  add('stack: ' .. table.concat(s, ' > '))
end
local one = FM.FlowMenus and FM.FlowMenus[names[1]]
if type(one) == 'table' then for k, v in pairs(one) do add('  sample ' .. tostring(k) .. '=' .. tostring(v)) end end
return table.concat(out, '\n')
