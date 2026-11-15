local out = {}
local function add(s) out[#out+1] = tostring(s) end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local function fieldsOf(n)
  local ks, seen = {}, {}
  pcall(function() for k,_ in pairs(n) do if seen[k] then break end; seen[k]=true; if k~='__pad' then ks[#ks+1]=k end; if #ks>80 then break end end end)
  return ks
end
local function g(n) local ok, v = pcall(function() return n:get() end); if ok then return v end end
local function walk(s, path, depth, budget)
  if depth > 5 or budget[1] <= 0 then return end
  local v = g(s)
  if v ~= nil then budget[1] = budget[1] - 1; if v ~= 0 and v ~= '' and v ~= false then add(path .. '=' .. tostring(v)) end return end
  local fs = fieldsOf(s)
  if #fs == 0 then
    for i = 0, 3 do local ok, c = pcall(function() return s[i] end); if ok and c then walk(c, path .. '[' .. i .. ']', depth + 1, budget) end end
  end
  for _, k in ipairs(fs) do local ok, c = pcall(function() return s[k] end); if ok and c ~= nil then walk(c, path .. '.' .. k, depth + 1, budget) end end
end
for _, gn in ipairs({'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}) do
  local ok, r = pcall(core, 0, CoD.StatsGroup[gn])
  local cs = r.customizationSetup
  add('== ' .. gn .. ' selIdx=' .. tostring(g(cs.selectedOperatorIndex)))
  walk(cs.operators, 'operators', 0, {40})
  walk(cs.operatorCustomization, 'opCust', 0, {80})
end
return table.concat(out, '\n')
