-- Session-only offline ownership override for cosmetic/weapon items.
-- Wraps the game's own PROGRESSION unlock query; the original function remains
-- restorable through _G.WZM_UNLOCK.restore(). Nothing on disk is patched.
local S=rawget(_G,'WZM_UNLOCK')
if not S then S={enabled=true,queries=0,byType={},originals={},last=''};rawset(_G,'WZM_UNLOCK',S) end
local P=rawget(_G,'PROGRESSION')
local L=rawget(_G,'LOOT')
if type(P)~='table' or type(L)~='table' or type(L.itemTypes)~='table' then return 'not ready: progression/loot missing' end
local key,orig
for k,v in pairs(P) do if tostring(k):find('13d8bd2b211db6cc',1,true) then key,orig=k,v end end
if type(orig)~='function' then return 'unlock query not found' end
local T=L.itemTypes
local allow={}
local names={'WEAPON','ATTACHMENT','CAMO','OPERATOR','OPERATOR_SKIN','OPERATOR_EXECUTION','OPERATOR_TAUNT',
 'RETICLE','CHARM','STICKER','GUN_SCREEN','EMBLEM','PLAYERCARD','SPRAYS','WATCH','GESTURES','EMOTE','QUIP',
 'PARACHUTE','CONTRAIL','VEHICLE_CAMO','VEHICLE_HORN','VEHICLE_TRACK','LOAD_SCREEN','LEVEL_ICON','PLEA','ROLE',
 'SPECIAL','UPGRADE','PERK','STREAK','LETHAL','TACTICAL','EQUIPMENT'}
for _,n in ipairs(names) do local v=T[n]; if v~=nil then allow[v]=n end end
if not S.originals[key] then
  S.originals[key]=orig
  P[key]=function(c,itemType,ref,...)
    if S.enabled and ref~=nil and ref~='' and ref~='none' and allow[itemType] then
      local n=allow[itemType]
      S.queries=S.queries+1
      S.byType[n]=(S.byType[n] or 0)+1
      if S.queries<=6 then S.last=S.last..n..'='..tostring(ref)..'; ' end
      return true
    end
    return orig(c,itemType,ref,...)
  end
end
S.restore=function()
  for k,f in pairs(S.originals) do P[k]=f end
  S.originals={}; S.enabled=false
end
local r={} for _,n in pairs(allow) do r[#r+1]=n end table.sort(r)
return 'installed on '..tostring(key)..' types='..table.concat(r,',')
