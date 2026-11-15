-- Opens the game's own Change Team menu in the match (no dumps, so it runs fast).
local ok,err=pcall(function() return LUI.Command.Execute(LUI.Commands.InGame.OpenChangeTeamMenu,0) end)
return 'open='..tostring(ok)..':'..tostring(err)
