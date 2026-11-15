local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local function keys(name, t, lim)
  if type(t) ~= 'table' then add(name .. ' : ' .. type(t)); return end
  local l = {}
  for k, v in pairs(t) do l[#l + 1] = tostring(k) .. '(' .. type(v):sub(1, 3) .. ')'; if #l > (lim or 120) then break end end
  table.sort(l)
  add('## ' .. name .. ' [' .. #l .. ']: ' .. table.concat(l, ' '))
end
for _, n in ipairs({'MOBILE_SETTINGS', 'MobileSettingsHubUtils', 'OPTIONS_DATA', 'OPTIONS', 'VIDEO', 'SystemSettings',
  'MobileGameModeSelection', 'MobileGameModeSelectionActions', 'MobileGameModeSelectionPlayerData', 'PLAY_MENU',
  'PRIVATE_MATCH', 'GameModesUtils', 'OPTIONS_TRANSFORMS'}) do keys(n, rawget(_G, n)) end
keys('LUI', LUI, 400)
local fl = {}
for k, v in pairs(_G) do
  local ks = tostring(k):lower()
  if type(v) == 'function' and (ks:find('graphic') or ks:find('setting') or ks:find('option') or ks:find('gamemode')
    or ks:find('playmenu') or ks:find('privatematch')) then fl[#fl + 1] = tostring(k) end
end
table.sort(fl)
add('## _G functions: ' .. table.concat(fl, ' '))
return table.concat(out, '\n')
