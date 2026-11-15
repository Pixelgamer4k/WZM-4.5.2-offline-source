local out = {}
local function add(s) out[#out+1] = tostring(s) end
local S = rawget(_G, 'WZM_CLIENT_FENCE')
local q = S and S.orig
add('fences table:')
for k, v in pairs(Fences) do add('  ' .. tostring(k) .. '=' .. tostring(v):sub(1,50)) end
if q then
  for _, n in ipairs({'CLIENT_CONNECT','WEAPON_DEF','LOADOUT','OPERATOR','FRONTEND','MAINMENU','PLAYER_DATA','STATS','INVENTORY','CHARACTER','SCENE','LOBBY','PARTY','MAP_LOAD','FRONTEND_SCENE','CLIENT_WORLD'}) do
    local ok, v = pcall(q, 0, n); add('  ' .. n .. ' -> ' .. tostring(ok) .. ' ' .. tostring(v))
  end
end
local fs = rawget(_G, 'FrontEndScene')
local ks = {}
for k, v in pairs(fs or {}) do if type(k) == 'string' then ks[#ks+1] = k .. '=' .. tostring(v):sub(1,30) end end
add('FrontEndScene strings: ' .. table.concat(ks, ', '))
return table.concat(out, '\n')
