local o={}
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local l=core(0,CoD.StatsGroup.WZRankedLoadouts).loadouts[0]
local function keys(n,label,depth)
  local ks={}
  pcall(function() for k,_ in pairs(n) do ks[#ks+1]=tostring(k); if #ks>40 then break end end end)
  o[#o+1]=label..' {'..table.concat(ks,',')..'}'
  return ks
end
local top=keys(l,'loadout',0)
for _,k in ipairs(top) do
  local ok,c=pcall(function() return l[k] end)
  if ok and c~=nil and not pcall(function() return c:get() end) then
    local sub=keys(c,'  '..k,1)
    local ok2,c0=pcall(function() return c[0] end)
    if ok2 and c0~=nil and not pcall(function() return c0:get() end) then keys(c0,'    '..k..'[0]',2) end
  end
  collectgarbage('collect')
end
return table.concat(o,'\n')
