local o={}
local P=rawget(_G,'PROGRESSION')
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local r=core(0,CoD.StatsGroup.Ranked)
pcall(function() r.progression.playerLevel.xp:set(99999999) end)
o[#o+1]='xp now '..tostring(r.progression.playerLevel.xp:get())
local keys={}
for k,v in pairs(P) do keys[#keys+1]=k end
table.sort(keys,function(a,b) return tostring(a)<tostring(b) end)
for _,k in ipairs(keys) do
  local v=P[k]
  if type(v)=='function' then
    local ok,a,b=pcall(v,0)
    if ok and (type(a)=='number' or type(a)=='boolean') then o[#o+1]=tostring(k)..'(0)='..tostring(a)..(b~=nil and (','..tostring(b)) or '') end
  elseif type(v)=='number' then o[#o+1]=tostring(k)..'='..tostring(v) end
end
return table.concat(o,'\n')
