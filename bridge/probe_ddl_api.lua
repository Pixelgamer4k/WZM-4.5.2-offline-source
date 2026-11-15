local o={}
local PD=rawget(_G,'PLAYER_DATA');local core
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local root=core(0,CoD.StatsGroup.WZRankedLoadouts)
local l=root.loadouts[0]
local mt=getmetatable(l); o[#o+1]='mt type '..type(mt)
if mt then for k,v in pairs(mt) do o[#o+1]='mt.'..tostring(k)..'='..type(v) end
  if type(mt.__index)=='table' then for k,v in pairs(mt.__index) do o[#o+1]='idx.'..tostring(k)..'='..type(v) end end end
local w=l.weaponSetups[0]
for _,f in ipairs({'weaponLootID','weaponVariantID','attachmentSetup','attachments','camo','reticle','sticker','charm','blueprintID','lootItemID','variantID','mods'}) do
  local a,b=pcall(function() local n=w[f]; local ok,v=pcall(function() return n:get() end); return tostring(n)..' get='..tostring(ok and v or 'noget') end)
  o[#o+1]='w.'..f..' -> '..tostring(a)..' '..tostring(b):sub(1,80)
end
for _,f in ipairs({'name','perks','equipment','killstreakSetups','fieldUpgrades','tactical','lethal','extraPerks','loadoutPerks','equipmentSetups'}) do
  local a,b=pcall(function() return tostring(l[f]) end); o[#o+1]='l.'..f..' -> '..tostring(a)..' '..tostring(b):sub(1,60)
end
return table.concat(o,'\n')
