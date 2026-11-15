-- Inspect existing bindings and scene state; invoke no matchmaking/host action.
local out={}
local targets={Lobby={'be6e03a0292da533','b8c257a4adf34792','c98faf05e7dbe274'},Playlist={'5276715c8f8a5887'},PlaylistUtils={'c053947a9fbef608'},Engine={'5685ae31deda30a4'}}
for name,hashes in pairs(targets) do
 local t=rawget(_G,name)
 for _,h in ipairs(hashes) do
  local value=nil
  if type(t)=='table' then
   for k,v in pairs(t) do
    local s=tostring(k):match('#x0?(%x+)')
    if s and s:lower():gsub('^0+','')==h:gsub('^0+','') then value=v break end
   end
  end
  out[#out+1]=name..' '..h..' '..tostring(value)
 end
end
local f=rawget(_G,'FrontEndScene')
if type(f)=='table' then
 out[#out+1]='CurrentScene '..tostring(f.CurrentScene)
 if type(f.RequestedSceneStack)=='table' then out[#out+1]='SceneStackCount '..tostring(#f.RequestedSceneStack) end
end
table.sort(out)
return table.concat(out,'\n')
