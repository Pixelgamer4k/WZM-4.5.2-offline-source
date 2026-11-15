local out = {}
local function add(s) out[#out+1] = tostring(s) end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local function fieldsOf(n)
  local ks, seen = {}, {}
  pcall(function() for k,_ in pairs(n) do if seen[k] then break end; seen[k]=true; if k~='__pad' then ks[#ks+1]=k end; if #ks>80 then break end end end)
  return ks
end
local r = core(0, CoD.StatsGroup.WZRankedLoadouts)
local cs = r.customizationSetup
local ops = cs.operators
add('#operators=' .. tostring(select(2, pcall(function() return #ops end))) .. ' type(v)=' .. type(ops[0]:get()))
for i = 0, 3 do local ok, c = pcall(function() return ops[i]:get() end); add(' op' .. i .. ' ' .. tostring(ok) .. ' ' .. tostring(c)) end
local oc = cs.operatorCustomization
add('opCust fields: ' .. table.concat(fieldsOf(oc), ','))
add('#opCust=' .. tostring(select(2, pcall(function() return #oc end))))
local e0 = select(2, pcall(function() return oc[0] end))
add('opCust[0] ' .. tostring(e0) .. ' fields: ' .. table.concat(fieldsOf(e0), ','))
for _, k in ipairs(fieldsOf(e0)) do local ok, v = pcall(function() return e0[k]:get() end); add('   ' .. k .. ' = ' .. tostring(ok) .. ' ' .. tostring(v)) end
for _, k in ipairs({'radial','selectedOperatorIndex'}) do add(k .. ' fields: ' .. table.concat(fieldsOf(cs[k]), ',')) end
return table.concat(out, '\n')
