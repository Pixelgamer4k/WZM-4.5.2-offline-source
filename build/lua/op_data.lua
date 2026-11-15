local out = {}
local function add(s) out[#out+1] = tostring(s) end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local sg = {}
for k in pairs(CoD.StatsGroup) do sg[#sg+1] = tostring(k) end
table.sort(sg); add('StatsGroups: ' .. table.concat(sg, ','))
local function fieldsOf(n)
  local ks, seen = {}, {}
  pcall(function() for k,_ in pairs(n) do if seen[k] then break end; seen[k]=true; if k~='__pad' then ks[#ks+1]=k end; if #ks>80 then break end end end)
  return ks
end
local cnt = 0
local function walk(s, path, depth)
  if depth > 6 or cnt > 400 then return end
  local okget, v = pcall(function() return s:get() end)
  if okget and v ~= nil then cnt = cnt + 1; add(path .. ' = ' .. tostring(v)); return end
  local okn, n = pcall(function() return #s end)
  if okn and type(n) == 'number' and n > 0 then
    for i = 0, math.min(n - 1, 2) do local ok, c = pcall(function() return s[i] end); if ok and c then walk(c, path .. '.' .. i, depth + 1) end end
    return
  end
  for _, k in ipairs(fieldsOf(s)) do
    local ok, c = pcall(function() return s[k] end)
    if ok and c ~= nil then walk(c, path .. '.' .. tostring(k), depth + 1) end
  end
end
for _, gn in ipairs({'WZRankedLoadouts', 'PrivateLoadouts'}) do
  local ok, r = pcall(core, 0, CoD.StatsGroup[gn])
  add('== ' .. gn .. ' ok=' .. tostring(ok) .. ' top: ' .. table.concat(fieldsOf(r), ','))
  for _, k in ipairs({'customizationSetup','operatorCustomization','operators','operator','selectedOperator','squadMembers','playerCustomization','customization'}) do
    local ok2, c = pcall(function() return r[k] end)
    add('  try ' .. k .. ' -> ' .. tostring(ok2) .. ' ' .. tostring(c))
    if ok2 and c then add('    fields: ' .. table.concat(fieldsOf(c), ',')); walk(c, gn .. '.' .. k, 0) end
  end
end
return table.concat(out, '\n')
