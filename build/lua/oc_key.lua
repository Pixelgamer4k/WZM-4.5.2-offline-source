local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local out = {}
for _, gn in ipairs({'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}) do
  local cs = core(0, CoD.StatsGroup[gn]).customizationSetup
  local op = cs.operators[0]:get()
  local ok, e = pcall(function() return cs.operatorCustomization[op] end)
  local s = 'nil'
  if ok and e then s = 'skin=' .. tostring(e.skin:get()) .. ' chroma=' .. tostring(e.chroma:get()) .. ' exec=' .. tostring(e.execution:get()) end
  out[#out+1] = gn .. ' op=' .. tostring(op) .. ' ' .. s
  local ok2, e2 = pcall(function() return cs.operatorCustomization['#x4129e23b338521ff0'] end)
  if ok2 and e2 then out[#out+1] = '   soap entry skin=' .. tostring(e2.skin:get()) end
end
return table.concat(out, '\n')
