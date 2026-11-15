local out = {}
local function add(s) out[#out+1] = tostring(s) end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local function fieldsOf(n)
  local ks, seen = {}, {}
  pcall(function() for k,_ in pairs(n) do if seen[k] then break end; seen[k]=true; if k~='__pad' then ks[#ks+1]=k end; if #ks>80 then break end end end)
  return ks
end
local oc = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup.operatorCustomization
local e = oc[1]
add('oc[1]=' .. tostring(e) .. ' fields: ' .. table.concat(fieldsOf(e), ','))
local nonEmpty = 0
for i = 0, 299 do
  local ok, x = pcall(function() return oc[i] end)
  if ok and x then
    local fs = fieldsOf(x)
    local parts = {}
    for _, k in ipairs(fs) do
      local ok2, v = pcall(function() return x[k]:get() end)
      if ok2 and v ~= nil and v ~= 0 and tostring(v) ~= 'xhash: #x0' and v ~= '' then parts[#parts+1] = k .. '=' .. tostring(v) end
    end
    if #parts > 0 then nonEmpty = nonEmpty + 1; if nonEmpty <= 6 then add(' [' .. i .. '] ' .. table.concat(parts, ' ')) end end
  end
end
add('nonEmpty=' .. nonEmpty)
return table.concat(out, '\n')
