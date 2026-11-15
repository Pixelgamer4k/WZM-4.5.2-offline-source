-- Read-only match state and available join/spawn API names.
local out={};local seen={}
local function walk(t,path,depth)
 if type(t)~='table' or seen[t] or depth>5 then return end
 seen[t]=true
 for k,v in pairs(t) do
  local n=tostring(k);local p=path..'.'..n
  local function relevant(s) s=s:lower();return s:match('team') or s:match('spectat') or s:match('spawn') or s:match('match') or s:match('round') or s:match('alive') or s:match('class') or s:match('join') end
  if type(v)=='table' then
   if type(v.GetValue)=='function' then
    if relevant(p) then local ok,x=pcall(v.GetValue,v,0);out[#out+1]=p..'='..(ok and tostring(x) or 'ERROR') end
   else walk(v,p,depth+1) end
  elseif type(v)=='function' and relevant(n) then out[#out+1]=p..'=function' end
 end
end
walk(DataSources and DataSources.inGame,'DataSources.inGame',0)
for _,name in ipairs({'Engine','Game','ACTIONS','Lobby','CONDITIONS'}) do walk(_G[name],name,0) end
local c=LUI and LUI.Commands and LUI.Commands.InGame and LUI.Commands.InGame.OpenChangeTeamMenu
out[#out+1]='ChangeTeamType='..type(c)
if type(c)=='table' then for k,v in pairs(c) do out[#out+1]='ChangeTeam.'..tostring(k)..'='..tostring(v) end end
table.sort(out);return table.concat(out,'\n')
