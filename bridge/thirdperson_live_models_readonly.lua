-- In-match only, read-only third-person UI model and camera-related Lua globals.
local o={}
local function add(k,v) if #o<160 then o[#o+1]=k..'='..tostring(v) end end
local function child(p,k)
 if not p then return nil end
 local ok,v=pcall(function() return p[k] end)
 return ok and v or nil
end
local function readmodel(p,label)
 if p==nil then return add(label,'absent') end
 for _,mn in ipairs({'GetValue','get','GetModel'}) do
  local ok,v=pcall(function() return p[mn] end)
  if ok and type(v)=='function' then
   local valid,result=pcall(v,p,0)
   if valid then add(label..'.'..mn,result) else add(label..'.'..mn,'ERROR '..tostring(result):sub(1,160)) end
  end
 end
end
local ds=rawget(_G,'DataSources');local g=child(ds,'inGame');local pl=child(g,'player')
add('DataSources.inGame.player',type(pl))
for _,key in ipairs({'isInThirdPersonMode','isNotADSInThirdPerson','canThirdPersonSwitchShoulder','isSpectatingThirdPerson','isInVehicle','isSpectating'}) do
 readmodel(child(pl,key),'inGame.player.'..key)
end
local game=child(ds,'alwaysLoaded');local hud=child(game,'HUD')
for _,key in ipairs({'isSpectatingThirdPerson','isInThirdPersonMode'}) do
 readmodel(child(hud,key),'alwaysLoaded.HUD.'..key)
end
for _,key in ipairs({'CAMERA','CAM','CAMERAS','ThirdPerson','PLAYERSTATE','CLIENTCHARACTER','SCENE','Dvar','Dvars','Engine'}) do
 local t=rawget(_G,key)
 add('global.'..key,type(t))
 if type(t)=='table' then
  local hits={}
  for k,v in pairs(t) do
   local s=tostring(k):lower()
   if s:find('third',1,true) or s:find('camera',1,true) or s:find('shoulder',1,true) then
    hits[#hits+1]=tostring(k)..'('..type(v)..')'
   end
  end
  table.sort(hits);add('global.'..key..'.matches',table.concat(hits,','):sub(1,1000))
 end
end
return table.concat(o,'\n')
