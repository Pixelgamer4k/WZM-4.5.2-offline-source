-- Seed one offline loadout class from the local WEAPON.*LootID constants and report
-- before/after through the game's own DDL nodes. Session-only; nothing is forced.
local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local PD=rawget(_G,'PLAYER_DATA')
local pdo
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then pdo=v end end
if type(pdo)~='function' then return 'no pdo' end
local ok,root=pcall(pdo,0,4)
if not ok or root==nil then return 'no PrivateLoadouts root' end
local lo=root.loadouts
local o,l=pcall(function() return lo[0] end)
if not o or l==nil then return 'no loadout 0' end
local function gv(n)
  local a,b=pcall(function() return n:get() end)
  if not a then return 'ERR' end
  return b
end
local W=rawget(_G,'WEAPON')
local m4=W.M4LootID
local pistol=W.DaemonPistolLootID
add('consts','m4='..tostring(m4)..' pistol='..tostring(pistol))
add('before','name='..tostring(gv(l.name))..' p0='..tostring(gv(l.weaponSetups[0].weaponLootID))..' p1='..tostring(gv(l.weaponSetups[1].weaponLootID)))
local writes={}
local function setnode(n,val,label)
  local a,b=pcall(function() return n:set(val) end)
  writes[#writes+1]=label..'='..tostring(a)..':'..tostring(b):sub(1,40)
end
setnode(l.weaponSetups[0].weaponLootID,m4,'p0')
setnode(l.weaponSetups[1].weaponLootID,pistol,'p1')
local nametest=pcall(function() return l.name:set('WZM') end)
writes[#writes+1]='name='..tostring(nametest)
add('writes',table.concat(writes,' '))
add('after','name='..tostring(gv(l.name))..' p0='..tostring(gv(l.weaponSetups[0].weaponLootID))..' p1='..tostring(gv(l.weaponSetups[1].weaponLootID)))
return table.concat(out,'\n'):sub(1,1200)
