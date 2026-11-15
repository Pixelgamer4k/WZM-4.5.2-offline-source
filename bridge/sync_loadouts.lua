-- Copy the loadouts the player edited in Gear Up into every other loadout set, so a match uses them
-- whichever set it reads. Gear Up's Warzone tab edits WZRankedLoadouts.
-- Source: WZM_SYNC_SRC if set, else the first set whose loadouts differ from the seeded starters
-- (all starters have primary iw9_ar_mike4). Destinations: WZM_SYNC_DEST if set, else all other sets.
-- NOTE: pairs() on these player-data structs never ends (it cycles through the field names), so the
-- copier stops at the first repeated key, skips __pad, and walks arrays by length (#node).
-- Session-only (in-memory player data). Returns a summary.
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
if not core then return 'no player data' end
local L=rawget(_G,'LOOT');local refOf
for k,f in pairs(L) do if tostring(k):find('c82265f889a5eb28',1,true) then refOf=f end end
local groups={'WZRankedLoadouts','RankedLoadouts','PrivateLoadouts','WZPrivateLoadouts','LeaguePlayLoadouts'}
local roots={}
for _,gn in ipairs(groups) do local ok,r=pcall(core,0,CoD.StatsGroup[gn]); if ok and r then roots[gn]=r end end
local function primary(r,i) local ok,v=pcall(function() return refOf(r.loadouts[i].weaponSetups[0].weaponLootID:get()) end); return ok and tostring(v) or '' end
local function edited(r) for i=0,4 do local p=primary(r,i); if p~='' and p~='nil' and p~='iw9_ar_mike4' then return true end end return false end
local src=rawget(_G,'WZM_SYNC_SRC')
if not src then for _,gn in ipairs(groups) do if gn~='LeaguePlayLoadouts' and roots[gn] and edited(roots[gn]) then src=gn break end end end
if not src then return 'nothing edited yet (all sets still have the starter loadouts)' end
local copied,failed=0,0
local function fieldsOf(n)
  local ks,seen={},{}
  pcall(function() for k,_ in pairs(n) do if seen[k] then break end; seen[k]=true; if k~='__pad' then ks[#ks+1]=k end; if #ks>64 then break end end end)
  return ks
end
local function copy(s,d,depth)
  if depth>8 then return end
  local okget,v=pcall(function() return s:get() end)
  if okget then
    if v=='' then return end
    if pcall(function() d:set(v) end) then copied=copied+1 else failed=failed+1 end
    return
  end
  local ks=fieldsOf(s)
  if #ks>0 then
    for _,k in ipairs(ks) do local a,sc=pcall(function() return s[k] end); local b,dc=pcall(function() return d[k] end)
      if a and b and sc~=nil and dc~=nil then copy(sc,dc,depth+1) end end
  else
    local okn,n=pcall(function() return #s end)
    if okn and type(n)=='number' and n>0 and n<=64 then
      for i=0,n-1 do local a,sc=pcall(function() return s[i] end); local b,dc=pcall(function() return d[i] end)
        if a and b and sc~=nil and dc~=nil then copy(sc,dc,depth+1) end end
    end
  end
end
local out={}
local only=rawget(_G,'WZM_SYNC_DEST')
for _,gn in ipairs(groups) do
  local r=roots[gn]
  if r and gn~=src and ((only==nil and gn~='LeaguePlayLoadouts') or only==gn) then
    local c0,f0=copied,failed
    for i=0,4 do
      local ok,sl=pcall(function() return roots[src].loadouts[i] end)
      local ok2,dl=pcall(function() return r.loadouts[i] end)
      if ok and ok2 and sl~=nil and dl~=nil then copy(sl,dl,0) end
      collectgarbage('collect')
    end
    out[#out+1]=gn..': '..(copied-c0)..' fields'..(failed>f0 and (' ('..(failed-f0)..' failed)') or '')..', loadout 1 primary now '..primary(r,0)
  end
end
return 'source '..src..' (loadout 1 primary '..primary(roots[src],0)..') -> '..table.concat(out,'; ')
