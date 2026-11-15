-- Read the player's edited loadouts (5 slots) as "path<TAB>type<TAB>value" lines for saving to disk.
-- Source: WZM_SYNC_SRC or the first set that differs from the seeded starters. Read-only.
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local L=rawget(_G,'LOOT');local refOf
for k,f in pairs(L) do if tostring(k):find('c82265f889a5eb28',1,true) then refOf=f end end
local groups={'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts'}
local function primary(r,i) local ok,v=pcall(function() return refOf(r.loadouts[i].weaponSetups[0].weaponLootID:get()) end); return ok and tostring(v) or '' end
local src=rawget(_G,'WZM_SYNC_SRC');local root
for _,gn in ipairs(groups) do
  local ok,r=pcall(core,0,CoD.StatsGroup[gn])
  if ok and r and (src==gn or (not src and (function() for i=0,4 do local p=primary(r,i); if p~='' and p~='nil' and p~='iw9_ar_mike4' then return true end end end)())) then src=gn root=r break end
end
if not root then return 'NOTHING_EDITED' end
local out={'#source\t'..src}
local function fieldsOf(n)
  local ks,seen={},{}
  pcall(function() for k,_ in pairs(n) do if seen[k] then break end; seen[k]=true; if k~='__pad' then ks[#ks+1]=k end; if #ks>64 then break end end end)
  return ks
end
local function walk(s,path,depth)
  if depth>8 then return end
  local okget,v=pcall(function() return s:get() end)
  if okget then out[#out+1]=path..'\t'..type(v)..'\t'..tostring(v) return end
  local ks=fieldsOf(s)
  if #ks>0 then for _,k in ipairs(ks) do local a,c=pcall(function() return s[k] end); if a and c~=nil then walk(c,path..'.'..k,depth+1) end end
  else local okn,n=pcall(function() return #s end)
    if okn and type(n)=='number' and n>0 and n<=64 then for i=0,n-1 do local a,c=pcall(function() return s[i] end); if a and c~=nil then walk(c,path..'.'..i,depth+1) end end end
  end
end
for i=0,4 do walk(root.loadouts[i],tostring(i),0); collectgarbage('collect') end
return table.concat(out,'\n')
