local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup
local out = {}
local function toX(txt)
  local slot = cs.operators[1]; local keep = slot:get()
  slot:set(txt); local v = slot:get(); slot:set(keep)
  return v
end
local ok, err = pcall(function()
  local c = cs.operatorCustomization['#x420b2417c10010917']
  local x = toX('#x44a18e3fdb12682e3')
  out[#out+1] = 'converted=' .. tostring(x) .. ' type=' .. type(x) .. ' op1 back=' .. tostring(cs.operators[1]:get())
  c.skin:set(x)
  out[#out+1] = 'after skin=' .. tostring(c.skin:get())
  c.chroma:set(toX('#x40')); out[#out+1] = 'chroma=' .. tostring(c.chroma:get())
  c.execution:set(5068); out[#out+1] = 'exec=' .. tostring(c.execution:get())
end)
out[#out+1] = 'ok=' .. tostring(ok) .. ' ' .. tostring(err)
return table.concat(out, '\n')
