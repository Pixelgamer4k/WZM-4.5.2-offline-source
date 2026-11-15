-- Read-only: list in-match Lua functions that could put the local player on a team or spawn it.
local out={}
local seen={}
local function rel(s) s=tostring(s):lower()
 return s:find('team') or s:find('spawn') or s:find('class') or s:find('menuresponse') or s:find('response')
  or s:find('join') or s:find('notify') or s:find('exec') or s:find('cmd') or s:find('loadout') end
local function walk(t,path,depth)
 if type(t)~='table' or seen[t] or depth>3 or #out>220 then return end
 seen[t]=true
 for k,v in pairs(t) do
  if type(k)=='string' then
   local p=path..'.'..k
   if type(v)=='function' and rel(k) then out[#out+1]=p
   elseif type(v)=='table' then
    if rel(k) then out[#out+1]=p..'=table' end
    walk(v,p,depth+1)
   end
  end
 end
end
local c=LUI and LUI.Commands and LUI.Commands.InGame and LUI.Commands.InGame.OpenChangeTeamMenu
if type(c)=='table' then
 for k,v in pairs(c) do
  local d=''
  if type(v)=='function' and debug and debug.getinfo then local i=debug.getinfo(v,'S'); d=' src='..tostring(i.source)..':'..tostring(i.linedefined) end
  out[#out+1]='ChangeTeam.'..tostring(k)..'='..tostring(v)..d
 end
end
for _,n in ipairs({'Engine','Game','LUI','ACTIONS','MenuBuilder','Lobby','CoD','Dvar','Cac','PlayerData'}) do walk(_G[n],n,0) end
local g={}
for k,v in pairs(_G) do if type(k)=='string' and rel(k) then g[#g+1]=k..':'..type(v) end end
out[#out+1]='G: '..table.concat(g,',')
out[#out+1]='EngineType='..type(Engine)..' nEngineStr='..(function() local n=0 if type(Engine)=='table' then for k in pairs(Engine) do if type(k)=='string' then n=n+1 end end end return n end)()
table.sort(out)
return table.concat(out,' | ')
