local o={};local function add(s)o[#o+1]=s end
local function fn(t,h)for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return v end end end
local getref=fn(LOOT,'3d5d69ba555e016d');local getid=fn(LOOT,'88a02b7599f5b517')
for _,id in ipairs({WEAPON.M4LootID,WEAPON.KnifeLootID,WEAPON.DaemonPistolLootID,WEAPON.MXGuardianLootID}) do
 local ok,r=pcall(getref,id);add('id '..id..' ref='..tostring(ok)..':'..tostring(r))
end
for _,ref in ipairs({'iw9_ar_mike4','iw9_ar_mike4_mp',WEAPON.GunsmithTestIndexWeapon}) do
 local ok,r=pcall(getid,ref);add('ref '..ref..' id='..tostring(ok)..':'..tostring(r))
end
for _,group in ipairs({3,4}) do
 local f=fn(PLAYER_DATA,'08b73907b55c4d71');local root=f(0,group)
 for _,field in ipairs({'lastSelectedLoadoutIndex','selectedLoadoutIndex','customizationSetup','loadouts'}) do
  local ok,r=pcall(function() local n=root[field];return n and n:get() end);add('group'..group..'.'..field..'='..tostring(ok)..':'..tostring(r))
 end
end
return table.concat(o,'\n')
