-- Seed two empty offline classes using verified native ref->loot-ID lookup.
local function fn(t,h)for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return v end end end
local pdo=fn(PLAYER_DATA,'08b73907b55c4d71');local getid=fn(LOOT,'c36548909cff94cd');local getref=fn(LOOT,'3d5d69ba555e016d')
if not pdo or not getid or not getref then return 'missing profile/catalog API' end
local refs={'iw9_ar_akilo','iw9_ar_mike4'};local ids={}
for i,ref in ipairs(refs) do
 ids[i]=getid(ref)
 if type(ids[i])~='number' or ids[i]<=0 or getref(ids[i])~=ref then return 'unverified weapon '..ref end
end
local S=rawget(_G,'WZM_OFFLINE_PROFILE') or {originals={}};rawset(_G,'WZM_OFFLINE_PROFILE',S)
local o={}
local function write(node,value,key)
 if S.originals[key]==nil then S.originals[key]=node:get() end
 local ok=node:set(value);if not ok then error('DDL write failed '..key) end
 if node:get()~=value then error('DDL read-back differs '..key) end
end
for _,group in ipairs({3,4,6}) do
 local root=pdo(0,group)
 for i=0,1 do
  local class=root.loadouts[i];local prefix=group..'.'..i..'.'
  local current=class.weaponSetups[0].weaponLootID:get()
  if current~=0 and current~=ids[i+1] then return 'existing class preserved '..prefix..current end
  write(class.weaponSetups[0].weaponLootID,ids[i+1],prefix..'primary')
  write(class.weaponSetups[0].weaponVariantID,0,prefix..'variant')
  write(class.inUse,1,prefix..'inUse')
  write(class.name,i==0 and 'Offline AK' or 'Offline M4',prefix..'name')
  o[#o+1]='g'..group..' class'..i..'='..getref(class.weaponSetups[0].weaponLootID:get())..' inUse='..class.inUse:get()
 end
end
return table.concat(o,'\n')
