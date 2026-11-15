local want = {['xhash: #x44e11a9d78f102246'] = true}
local found, seen = {}, {}
local left = 1
local function scan(t, d)
  if d > 6 or seen[t] or left <= 0 then return end
  seen[t] = true
  pcall(function()
    for k, v in pairs(t) do
      if type(v) == 'xhash' then local s = tostring(v); if want[s] and not found[s] then found[s] = v; left = left - 1 end end
      if type(k) == 'xhash' then local s = tostring(k); if want[s] and not found[s] then found[s] = k; left = left - 1 end end
      if type(v) == 'table' then scan(v, d + 1) end
      if left <= 0 then return end
    end
  end)
end
local t0 = os.clock()
scan(rawget(_G, 'PROJECT') or {}, 0)
if left > 0 then scan(_G, 0) end
local v = found['xhash: #x44e11a9d78f102246']
if not v then return 'not found' end
local PD = rawget(_G,'PLAYER_DATA'); local core
for k,f in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=f end end
local res = {}
for _, gn in ipairs({'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}) do
  local r = core(0, CoD.StatsGroup[gn])
  local ok = pcall(function() r.customizationSetup.operators[0]:set(v); r.customizationSetup.operators[1]:set(v) end)
  res[#res+1] = gn .. '=' .. tostring(ok) .. ':' .. tostring(r.customizationSetup.operators[0]:get())
end
return string.format('scan %.2fs ', os.clock() - t0) .. table.concat(res, ' ')
