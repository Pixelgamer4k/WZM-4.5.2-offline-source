-- Read-only: which Lua libs exist in the match state, and EngineExecute/SetSelectedLoadout shapes.
local o={}
o[#o+1]='debug='..type(debug)..' getinfo='..type(debug and debug.getinfo)..' dump='..type(string and string.dump)..' jit='..type(jit)
local function info(name,f)
 if type(f)~='function' then o[#o+1]=name..'='..type(f) return end
 if debug and debug.getinfo then local i=debug.getinfo(f,'Su'); o[#o+1]=name..' src='..tostring(i.source)..':'..tostring(i.linedefined)..' nparams='..tostring(i.nparams)..' vararg='..tostring(i.isvararg)
 else o[#o+1]=name..'=function' end
end
local C=LUI.Commands
info('EngineExecute',C.Dev.EngineExecute._execute)
info('ChangeTeam',C.InGame.OpenChangeTeamMenu._execute)
info('ChangeTeamPre',C.InGame.OpenChangeTeamMenu._preExecute)
info('SetSelectedLoadout',C.InGame.SetSelectedLoadout._execute)
info('CommandExecute',LUI.Command.Execute)
for _,t in ipairs({'Teams','TeamNumber','JoinHSM','LOADOUT'}) do
 local v=_G[t]; local ks={}
 if type(v)=='table' then for k,x in pairs(v) do if #ks<25 then ks[#ks+1]=tostring(k)..':'..(type(x)=='table' and 'T' or tostring(x)) end end end
 o[#o+1]=t..'{'..table.concat(ks,',')..'}'
end
return table.concat(o,' | ')
