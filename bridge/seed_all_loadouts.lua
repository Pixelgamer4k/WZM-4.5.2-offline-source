-- Re-seed every private/ranked loadout class in the running process, then report.
-- Ids come from the local WEAPON.*LootID constants (no server catalog needed).
-- Session-only: the DDL nodes are the game's own, written through :set().
local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local PD=rawget(_G,'PLAYER_DATA')
local pdo
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then pdo=v end end
if type(pdo)~='function' then return 'no pdo' end
local W=rawget(_G,'WEAPON')
-- loadout kit: primary, secondary, melee-ish tertiary slots 0/1/2
local kits={
  {'WZM-1', W.M4LootID, W.DaemonPistolLootID, W.KnifeLootID},
  {'WZM-2', W.M4LootID, W.MXGuardianLootID, W.PickaxeLootID},
  {'WZM-3', W.M4LootID, W.DaemonPistolLootID, W.ChainsawLootID},
  {'WZM-4', W.M4LootID, W.LachmannShrouadLootID, W.KnifeLootID},
  {'WZM-5', W.M4LootID, W.DaemonPistolLootID, W.SpearBaseLootID},
}
local function gv(n)
  local a,b=pcall(function() return n:get() end)
  if not a then return 'ERR' end
  return b
end
local function setn(n,val)
  local a,b=pcall(function() return n:set(val) end)
  return tostring(a)..':'..tostring(b):sub(1,30)
end
local groups={3,4,6}
local report={}
for _,g in ipairs(groups) do
  local ok,root=pcall(pdo,0,g)
  if ok and root~=nil then
    local o,lo=pcall(function() return root.loadouts end)
    if o and lo~=nil then
      local done=0
      for i=0,4 do
        local o2,l=pcall(function() return lo[i] end)
        if o2 and l~=nil then
          local kit=kits[i+1]
          if kit then
            local r1=setn(l.name,kit[1])
            local r2=setn(l.weaponSetups[0].weaponLootID,kit[2])
            local r3=setn(l.weaponSetups[1].weaponLootID,kit[3])
            local r4=setn(l.weaponSetups[2].weaponLootID,kit[4])
            -- perks (7 Nov): empty perk slots render as magenta squares. Fill empty ones only.
            -- loot IDs read back after equipping in the UI: Survivor, Quartermaster, Ghost
            local perks={30626,30605,30637}
            for j=0,2 do
              local cur=gv(l.perkLootIDs[j])
              if cur==0 or cur=='ERR' then setn(l.perkLootIDs[j],perks[j+1]) end
            end
            local chk=gv(l.weaponSetups[0].weaponLootID)
            report[#report+1]='g'..g..'i'..i..' name='..tostring(gv(l.name))..' p='..tostring(chk)..' s='..tostring(gv(l.weaponSetups[1].weaponLootID))..' t='..tostring(gv(l.weaponSetups[2].weaponLootID))..' w='..r2..' perks='..tostring(gv(l.perkLootIDs[0]))..'/'..tostring(gv(l.perkLootIDs[1]))..'/'..tostring(gv(l.perkLootIDs[2]))
            done=done+1
          end
        end
      end
      add('g'..g..'_classes',done)
    end
  end
end
add('report',table.concat(report,' | '):sub(1,900))
return table.concat(out,'\n'):sub(1,1300)
