local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup
local slot = cs.operators[1]; local keep = slot:get()
slot:set('#x420b2417c10010917'); local opX = slot:get(); slot:set(keep)
local skip = {['0da7ec20ecb65748a']=1, ['05fac83fb93d7d828']=1, ['0a441e949ce2518cf']=1, ['08b040c165fbdb02d']=1, ['0535dd88a222eac66']=1, ['0d2acc19bf380a71d']=1, ['0b3bcad80fb9ac7c1']=1}
local out = {'opX=' .. tostring(opX)}
local function desc(v, d)
  if type(v) ~= 'table' or d > 2 then return tostring(v):sub(1, 60) end
  local p, n = {}, 0
  for k, x in pairs(v) do n = n + 1; if n <= 6 then p[#p+1] = tostring(k):sub(1,24) .. '=' .. desc(x, d + 1) end end
  return '{' .. n .. ': ' .. table.concat(p, ', ') .. '}'
end
for k, f in pairs(OPERATOR_SKIN) do
  local ks = tostring(k):gsub('xhash: #x', '')
  if type(f) == 'function' and not skip[ks] then
    for _, args in ipairs({{opX}, {0, opX}}) do
      local r = {pcall(f, unpack(args))}
      if r[1] and r[2] ~= nil then out[#out+1] = ks .. '(' .. #args .. ') -> ' .. desc(r[2], 0):sub(1, 300) end
    end
  end
end
return table.concat(out, '\n')
