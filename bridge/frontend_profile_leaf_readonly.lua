-- Read-only offline frontend DDL leaf probe. Never calls :set / SetValue.
-- Run only in an existing controller-owned session, not while another agent uses the phone.
-- Unlike frontend_ddl_probe.lua, do not call :get() on a whole DDL structure.
local out={}
local function log(s)
 if #out<200 then out[#out+1]=tostring(s):sub(1,300) end
end
local function child(parent,key)
 if parent==nil then return nil end
 local ok,val=pcall(function() return parent[key] end)
 return ok and val or nil
end
local function leaf(node,label)
 if node==nil then log(label..'=absent');return end
 local ok,v=pcall(function() return node:get() end)
 log(label..' '..(ok and ('value='..tostring(v)) or ('type='..type(node)..' (not a scalar leaf)')))
end
local core
for k,fn in pairs((_WZM and _WZM.pdo) or {}) do
 if tostring(k):find('08b73907b55',1,true) and type(fn)=='function' then core=fn;break end
end
if not core then return 'no retained original PLAYER_DATA getter' end
local groupList={'RankedLoadouts','PrivateLoadouts','WZRankedLoadouts','WZPrivateLoadouts','LeaguePlayLoadouts'}
local groups=(CoD and CoD.StatsGroup) or {}
local unlock=rawget(_G,'WZM_OFFLINE_FRONTEND')
if type(unlock)=='table' then
 log('offlineUnlock.enabled='..tostring(unlock.enabled)..' queries='..tostring(unlock.queries))
end
local primary=WEAPON and WEAPON.PrimarySlot
local secondary=WEAPON and WEAPON.SecondarySlot
log('weaponSlots primary='..tostring(primary)..' secondary='..tostring(secondary))
for _,name in ipairs(groupList) do
 local group=groups[name]
 if type(group)=='number' then
  local ok,root=pcall(core,0,group)
  log('group '..name..'/'..group..' root='..tostring(ok and root~=nil))
  if ok and root~=nil then
   local loadouts=child(root,'loadouts') or child(child(root,'squadMembers'),'loadouts')
   log('group '..name..' loadouts='..tostring(loadouts~=nil))
   local settings=child(root,'loadoutSettings') or child(child(root,'squadMembers'),'loadoutSettings')
   leaf(child(settings,'lastSelectedLoadoutIndex'),name..'.selected')
   if loadouts then
    for _,idx in ipairs({0,1,2}) do
     local setup=child(loadouts,idx)
     if setup~=nil then
      leaf(child(setup,'name'),name..'['..idx..'].name')
      leaf(child(setup,'inUse'),name..'['..idx..'].inUse')
      local weapons=child(setup,'weaponSetups')
      for _,slot in ipairs({primary,secondary}) do
       if slot~=nil then
        local weapon=child(weapons,slot)
        leaf(child(weapon,'weaponLootID'),name..'['..idx..'].slot'..tostring(slot)..'.weaponLootID')
        leaf(child(weapon,'weapon'),name..'['..idx..'].slot'..tostring(slot)..'.legacyWeapon')
        leaf(child(weapon,'weaponVariantID'),name..'['..idx..'].slot'..tostring(slot)..'.variant')
       end
      end
     end
    end
   end
  end
 end
end
local F=FrontEndScene
if type(F)=='table' then
 log('scene.current='..tostring(F.CurrentScene))
 log('scene.stack='..tostring(type(F.RequestedSceneStack)=='table' and #F.RequestedSceneStack or 'unavailable'))
end
local function modelValue(node,label)
 if node then
  local ok,v=pcall(function() return node:GetValue(0) end)
  log(label..'='..(ok and tostring(v) or 'not available'))
 else log(label..'=absent') end
end
local ds=rawget(_G,'DataSources')
modelValue(child(child(ds,'frontEnd'),'isUIFadingOut'),'frontend.isUIFadingOut')
modelValue(child(child(child(ds,'alwaysLoaded'),'cdni'),'areAllMapsInstalled'),'cdni.areAllMapsInstalled')
return table.concat(out,'\n')
