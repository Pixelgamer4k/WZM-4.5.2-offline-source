local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup
local slot = cs.operators[1]; local keep = slot:get()
slot:set('#x420b2417c10010917'); local opX = slot:get(); slot:set(keep)
local function fk(t, h) for k, v in pairs(t) do if tostring(k) == 'xhash: #x' .. h then return v end end end
local T = fk(OPERATOR, '072145c734039267f')(opX)
local out = {}
for k, v in pairs(T) do
  local s = type(v) .. ':' .. tostring(v):sub(1, 60)
  if type(v) == 'table' then
    local p, n = {}, 0
    for a, b in pairs(v) do n = n + 1; if n <= 4 then local bs = tostring(b); if type(b) == 'table' then local q = {} for c, d in pairs(b) do q[#q+1] = tostring(c):gsub('xhash: ',''):sub(1,20) .. '=' .. tostring(d):sub(1,40) end; bs = '{' .. table.concat(q, ' '):sub(1,250) .. '}' end; p[#p+1] = tostring(a) .. '=' .. bs end end
    s = 'table n=' .. n .. ' ' .. table.concat(p, ' ; ')
  end
  out[#out+1] = tostring(k):gsub('xhash: ', '') .. ' = ' .. s:sub(1, 600)
end
table.sort(out)
return table.concat(out, '\n')
