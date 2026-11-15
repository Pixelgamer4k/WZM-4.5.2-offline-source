local o={}
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local L=rawget(_G,'LOOT')
local function ref(id) local ok,r=pcall(function() for k,f in pairs(L) do if tostring(k):find('c82265f889a5eb28',1,true) then return f(id) end end end) return ok and tostring(r) or '?' end
for _,gn in ipairs({'PrivateLoadouts','RankedLoadouts','WZPrivateLoadouts','WZRankedLoadouts','LeaguePlayLoadouts'}) do
  local g=CoD.StatsGroup[gn]
  local ok,root=pcall(core,0,g)
  if ok and root then
    local s=gn..'('..tostring(g)..'):'
    for i=0,4 do
      local a,b=pcall(function() local l=root.loadouts[i]; return tostring(l.name:get())..' p='..ref(l.weaponSetups[0].weaponLootID:get())..' s='..ref(l.weaponSetups[1].weaponLootID:get()) end)
      s=s..' ['..i..'] '..(a and b or 'ERR')
    end
    o[#o+1]=s
  end
end
return table.concat(o,'\n')
