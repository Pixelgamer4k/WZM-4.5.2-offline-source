local o={}
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
if not core then return 'no core' end
for name,g in pairs(CoD.StatsGroup or {}) do
  local ok,r=pcall(core,0,g)
  if ok and r then
    local ok2,pl=pcall(function() return r.progression.playerLevel end)
    if ok2 and pl then
      local f={}
      for _,k in ipairs({'xp','rank','prestige','level','paragonRank','paragonIcon'}) do local a,b=pcall(function() return pl[k]:get() end); if a then f[#f+1]=k..'='..tostring(b) end end
      o[#o+1]=tostring(name)..'('..tostring(g)..'): '..table.concat(f,' ')
    end
  end
end
return table.concat(o,'\n')
