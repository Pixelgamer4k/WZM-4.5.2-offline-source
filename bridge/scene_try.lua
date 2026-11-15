-- Ask the lobby for a 3D scene the way a menu push does (frontend_3d_ftue_route_20261102.md):
-- insert the name into FrontEndScene.RequestedSceneStack, then run the scene-change handler
-- FrontEndScene[#xd436b6c16bcd588c]. Scene names shipped in global.ff:
-- character_faction_select_l, loadout_showcase_l, loadout_showcase_o.
-- Edit SCENE below between runs.
local SCENE="character_faction_select_l"
local F=FrontEndScene
local handler
for k,v in pairs(F) do if tostring(k):find("d436b6c16bcd588c",1,true) then handler=v end end
local before=tostring(F.CurrentScene)
if not handler then return "no scene handler" end
table.insert(F.RequestedSceneStack,SCENE)
local ok,err=pcall(handler)
local n=0 for _ in pairs(F.SocialCharacters or {}) do n=n+1 end
return "scene "..SCENE.." before="..before.." now="..tostring(F.CurrentScene).." ok="..tostring(ok).." "..tostring(err).." stack="..#F.RequestedSceneStack.." social="..n
