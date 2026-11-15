local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
-- 1. is the seeded loadout actually what the match is using?
local PD=rawget(_G,'PLAYER_DATA')
local pdo
for k,v in pairs(PD or {}) do if tostring(k):find('08b73907b55c4d71',1,true) then pdo=v end end
if type(pdo)=='function' then
  for _,g in ipairs({4,3}) do
    local ok,root=pcall(pdo,0,g)
    if ok and root~=nil then
      local o,lo=pcall(function() return root.loadouts end)
      if o and lo~=nil then
        for i=0,1 do
          local o2,l=pcall(function() return lo[i] end)
          if o2 and l~=nil then
            local n=l.name:get()
            local p=l.weaponSetups[0].weaponLootID:get()
            local s=l.weaponSetups[1].weaponLootID:get()
            local inuse=l.inUse:get()
            add('g'..g..'.i'..i,'name='..tostring(n)..' inUse='..tostring(inuse)..' p='..tostring(p)..' s='..tostring(s))
          end
        end
      end
    end
  end
end
-- 2. read-only probe of the native weapon-def predicate, for Gear Up
local FT=rawget(_G,'WZM_FT')
add('WZM_FT',type(FT))
-- 3. gear tile state again
local M=rawget(_G,'MobileMainMenuButtons')
local gear
for k,v in pairs(M or {}) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then gear=v end end
if type(gear)=='table' then
  local ok,dis=pcall(gear.disabled)
  add('gear_disabled',tostring(ok)..':'..tostring(dis))
  add('gear_fence',tostring(gear.fenceName))
end
return table.concat(out,'\n'):sub(1,900)
