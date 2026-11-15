local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local function keys(t,lim)
  local r={} for k in pairs(t or {}) do r[#r+1]=tostring(k) end table.sort(r)
  local s=table.concat(r,",") if lim and #s>lim then s=s:sub(1,lim) end return s
end
local LO=rawget(_G,'LOADOUT')
add('LOADOUT',type(LO))
if type(LO)=='table' then
  local cn=LO.ClassNames
  if type(cn)=='table' then
    local t={} for i=1,20 do if cn[i]~=nil then t[#t+1]=i..':'..tostring(cn[i]) end end
    add('ClassNames',table.concat(t,'|'):sub(1,300))
  else add('ClassNames',type(cn)) end
  add('DefaultClassCount',LO.DefaultClassCount)
  add('DefaultStarterCount',LO.DefaultStarterCount)
  add('MaxPlayerdataLoadouts',LO.MAX_PLAYERDATA_LOADOUT_COUNT)
  add('DefaultLoadoutIndex',LO.DEFAULT_LOADOUT_INDEX)
  add('MglLoadoutIndex',LO.DEFAULT_MGL_LOADOUT_INDEX)
  add('LoadoutStatsGroups',tostring(LO.LoadoutStatsGroups):sub(1,160))
  add('NumLoadoutExtraPerks',LO.NumLoadoutExtraPerks)
end
local LUI=rawget(_G,'LUI')
add('LUI',type(LUI))
if type(LUI)=='table' then
  local cmds=LUI.Commands
  add('LUI.Commands',type(cmds))
  if type(cmds)=='table' then
    local ing=cmds.InGame
    add('InGame',type(ing))
    if type(ing)=='table' then
      local r={} for k,v in pairs(ing) do if type(v)=='table' then r[#r+1]=tostring(k) end end
      table.sort(r)
      add('InGame_cmd_tables',table.concat(r,','):sub(1,600))
      local sel=ing.SetSelectedLoadout
      add('SetSelectedLoadout',type(sel))
      if type(sel)=='table' then
        local t={} for k,v in pairs(sel) do t[#t+1]=tostring(k)..'('..type(v)..')' end table.sort(t)
        add('SetSelectedLoadout_fields',table.concat(t,','):sub(1,400))
      end
    end
  end
end
local PD=rawget(_G,'PLAYER_DATA')
add('PLAYER_DATA',type(PD))
if type(PD)=='table' then add('PD_keys',keys(PD,300)) end
return table.concat(out,'\n')
