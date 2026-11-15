local out = {}
local function add(s) out[#out+1] = tostring(s) end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup
add('operators: ' .. tostring(cs.operators[0]:get()) .. ' sel=' .. tostring(cs.selectedOperatorIndex:get()))
local oc = cs.operatorCustomization
local mt = getmetatable(oc)
add('oc type=' .. type(oc) .. ' mt=' .. tostring(mt))
if mt then for k, v in pairs(mt) do add('  mt.' .. tostring(k) .. '=' .. tostring(v)) end
  local idx = mt.__index; if type(idx) == 'table' then for k, v in pairs(idx) do add('  idx.' .. tostring(k) .. '=' .. tostring(v)) end end end
for _, key in ipairs({0, 1, '0', cs.operators[0]:get()}) do
  local ok, v = pcall(function() return oc[key] end)
  add('oc[' .. tostring(key) .. '] -> ' .. tostring(ok) .. ' ' .. tostring(v))
end
local ok, it = pcall(function() local r = {} for k, v in pairs(oc) do r[#r+1] = tostring(k) .. '=' .. tostring(v); if #r > 5 then break end end return table.concat(r, ' | ') end)
add('pairs(oc): ' .. tostring(ok) .. ' ' .. tostring(it))
return table.concat(out, '\n')
