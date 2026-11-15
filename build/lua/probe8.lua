local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local FM = LUI.FlowManager
local l = {}
for k, v in pairs(FM or {}) do l[#l + 1] = tostring(k) .. '(' .. type(v):sub(1, 3) .. ')' end
table.sort(l)
add('FlowManager: ' .. table.concat(l, ' '))
-- menu names known to the menu registry
local reg = {}
for _, name in ipairs({'MobileSettingsHub', 'MobileSettings', 'MobileSettingsMenu', 'MobileSettingsGraphics',
  'MobileSettingsControls', 'OptionsMenu', 'SettingsMenu', 'MobileOptions'}) do
  local ok = rawget(_G, name) ~= nil or (LUI.MenuBuilder and LUI.MenuBuilder.m_types and LUI.MenuBuilder.m_types[name])
  reg[#reg + 1] = name .. '=' .. tostring(ok)
end
add('names: ' .. table.concat(reg, ' '))
local g = {}
for k, v in pairs(_G) do local s = tostring(k); if s:find('MobileSettings') or s:find('Settings') then g[#g + 1] = s .. '(' .. type(v):sub(1, 3) .. ')' end end
table.sort(g)
add('_G settings-ish: ' .. table.concat(g, ' '))
local lk = {}
for k, v in pairs(LUI) do lk[#lk + 1] = tostring(k) end
table.sort(lk)
add('LUI: ' .. table.concat(lk, ' '))
return table.concat(out, '\n')
