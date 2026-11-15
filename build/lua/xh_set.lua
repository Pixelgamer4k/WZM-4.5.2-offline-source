local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZPrivateLoadouts).customizationSetup
local n = cs.operators[1]
local orig = n:get()
local out = {'orig=' .. tostring(orig)}
for _, cand in ipairs({'#x4129e23b338521ff0', '4129e23b338521ff0', 'xhash: #x4129e23b338521ff0', 0x4129e23b338521ff0}) do
  local ok, e = pcall(function() n:set(cand) end)
  out[#out+1] = tostring(cand) .. ' -> ' .. tostring(ok) .. ' ' .. tostring(e) .. ' read=' .. tostring(n:get())
end
pcall(function() n:set(orig) end)
out[#out+1] = 'restored=' .. tostring(n:get())
-- any hash helpers?
for _, t in ipairs({_G, Engine or {}}) do
  for k, v in pairs(t) do local s = tostring(k):lower(); if type(v) == 'function' and (s:find('hash') or s:find('xh')) then out[#out+1] = 'fn ' .. tostring(k) end end
end
return table.concat(out, '\n')
