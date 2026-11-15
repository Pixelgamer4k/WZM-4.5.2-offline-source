local out = {}
local function add(s) out[#out+1] = tostring(s) end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup
local oc = cs.operatorCustomization
local function fieldsOf(n)
  local ks, seen = {}, {}
  pcall(function() for k,_ in pairs(n) do if seen[k] then break end; seen[k]=true; if k~='__pad' then ks[#ks+1]=k end; if #ks>40 then break end end end)
  return ks
end
local e = oc[cs.operators[0]:get()]
add('entry fields: ' .. table.concat(fieldsOf(e), ','))
local mt = getmetatable(e); if mt then for k in pairs(mt) do add(' emt.' .. tostring(k)) end end
-- enumerate via ipairs
local n, shown = 0, 0
local ok, err = pcall(function()
  for k, v in ipairs(oc) do
    n = n + 1
    local parts = {}
    for _, f in ipairs(fieldsOf(v)) do
      local okg, g = pcall(function() return v[f]:get() end)
      if okg and g ~= nil then parts[#parts+1] = f .. '=' .. tostring(g) else
        local sub = fieldsOf(v[f]); if #sub > 0 then parts[#parts+1] = f .. '{' .. table.concat(sub, ',') .. '}' end end
    end
    local s = table.concat(parts, ' ')
    local sv = s
    local t = s:gsub('xhash: #x40','')
    if (t:find('#x') or t:find('=[1-9]')) and shown < 20 then shown = shown + 1; add('[' .. tostring(k) .. '] ' .. s) end
  end
end)
add('ipairs n=' .. n .. ' ok=' .. tostring(ok) .. ' ' .. tostring(err))
return table.concat(out, '\n')
