-- Step 1: log any Engine/Game call that carries a team/assign/spectate string, then open the team menu.
rawset(_G,"WZM_LOG",{})
local n=0
local tabs={{'Engine',Engine},{'Game',Game},{'G',_G}}
for _,pair in ipairs(tabs) do
 local tn,t=pair[1],pair[2]
 if type(t)=='table' then
  for k,f in pairs(t) do
   if type(f)=='function' and (tn~='G' or type(k)~='string') then
    local key=tn..'['..tostring(k)..']'
    local w=function(...)
     local a={...}
     for i=1,#a do local v=a[i]
      if type(v)=='string' then local l=v:lower()
       if l:find('team') or l:find('assign') or l:find('spectat') or l:find('select') or l:find('allies') or l:find('axis') then
        local parts={}; for j=1,#a do parts[j]=tostring(a[j]) end
        local L=rawget(_G,'WZM_LOG'); L[#L+1]=key..'('..table.concat(parts,',')..')'; break end end end
     return f(...)
    end
    if pcall(rawset,t,k,w) then n=n+1 end
   end
  end
 end
end
local ok,err=pcall(function() return LUI.Command.Execute(LUI.Commands.InGame.OpenChangeTeamMenu,0) end)
return 'wrapped='..n..' open='..tostring(ok)..':'..tostring(err)
