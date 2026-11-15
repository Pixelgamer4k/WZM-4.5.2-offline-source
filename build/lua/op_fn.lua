local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup
local slot = cs.operators[1]; local keep = slot:get()
slot:set('#x420b2417c10010917'); local opX = slot:get(); slot:set(keep)
-- skip anything that looked like a setter/equip/refresh in the recording
local skip = {}
for _, h in ipairs({'05fac83fb93d7d828','0a441e949ce2518cf','0535dd88a222eac66','0c70eccfcad740792','06dd14ba6248f5d2b','0911c08f9b0d44504','027478c2fd998aef1','06b428f7bb69be1bf','076a7dbccfebec776','020f38d21020928ff','06dc5b50b8b2b375','0c945ba8bcccc2f34','0ed62d745a99dc5c0','026bc0eb456e6ff4f','032897e139ed0c565','0bdbea87b269f2ce2','06b8abd94356d55d1'}) do skip[h] = true end
local out = {}
local function hasX(v, d)
  if type(v) == 'xhash' then return tostring(v) ~= tostring(opX) and tostring(v) ~= 'xhash: #x40' end
  if type(v) ~= 'table' or d > 2 then return false end
  local n = 0
  for k, x in pairs(v) do n = n + 1; if n > 400 then break end; if hasX(x, d + 1) or (type(k) == 'xhash' and hasX(k, 9)) then return true end end
  return false
end
local function desc(v, d)
  if type(v) ~= 'table' or d > 1 then return tostring(v):sub(1, 50) end
  local p, n = {}, 0
  for k, x in pairs(v) do n = n + 1; if n <= 5 then p[#p+1] = tostring(k):sub(1,22) .. '=' .. desc(x, d + 1) end end
  return '{' .. n .. ': ' .. table.concat(p, ', ') .. '}'
end
for k, f in pairs(OPERATOR) do
  local ks = tostring(k):gsub('xhash: #x', '')
  if type(f) == 'function' and not skip[ks] then
    for _, args in ipairs({{opX}, {0, opX}}) do
      local r = {pcall(f, unpack(args))}
      if r[1] and hasX(r[2], 0) then out[#out+1] = ks .. '(' .. #args .. ') -> ' .. desc(r[2], 0):sub(1, 260) end
    end
  end
end
return #out .. '\n' .. table.concat(out, '\n')
