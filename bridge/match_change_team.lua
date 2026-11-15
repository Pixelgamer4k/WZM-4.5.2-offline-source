-- Opens the game's own Change Team menu in the match, and dumps the command functions' bytecode.
local o={}
local function hex(f) local ok,s=pcall(string.dump,f); if not ok then return 'ERR:'..tostring(s) end
 return (s:gsub('.',function(c) return string.format('%02x',c:byte()) end)) end
local C=LUI.Commands.InGame.OpenChangeTeamMenu
o[#o+1]='EXEC='..hex(C._execute)
o[#o+1]='PRE='..hex(C._preExecute)
o[#o+1]='LOADOUT='..hex(LUI.Commands.InGame.SetSelectedLoadout._execute)
o[#o+1]='ENGEXEC='..hex(LUI.Commands.Dev.EngineExecute._execute)
o[#o+1]='CMDEXEC='..hex(LUI.Command.Execute)
local ok,err=pcall(function() return LUI.Command.Execute(C,0) end)
o[#o+1]='open1='..tostring(ok)..':'..tostring(err)
if not ok then ok,err=pcall(C._execute,C,0); o[#o+1]='open2='..tostring(ok)..':'..tostring(err) end
return table.concat(o,' | ')
