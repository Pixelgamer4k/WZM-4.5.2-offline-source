local out = {}
local function add(s) out[#out+1] = tostring(s) end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
for gn in pairs(CoD.StatsGroup) do
  local ok, r = pcall(core, 0, CoD.StatsGroup[gn])
  local ok2, cs = pcall(function() return r.customizationSetup end)
  if ok and ok2 and cs then
    local ops = {}
    pcall(function() for i = 0, 1 do ops[#ops+1] = tostring(cs.operators[i]:get()) end end)
    local set = 0
    local okc = pcall(function()
      for k, v in ipairs(cs.operatorCustomization) do
        local sk = tostring(v.skin:get()); local ch = tostring(v.chroma:get())
        local ex = v.execution:get()
        if sk ~= 'xhash: #x40' or ch ~= 'xhash: #x40' or ex ~= 0 then set = set + 1; if set <= 4 then add('  ' .. gn .. '[' .. k .. '] skin=' .. sk .. ' chroma=' .. ch .. ' exec=' .. tostring(ex)) end end
      end
    end)
    add(gn .. ' ops=' .. table.concat(ops, ',') .. ' setEntries=' .. set .. ' ok=' .. tostring(okc))
  end
end
return table.concat(out, '\n')
