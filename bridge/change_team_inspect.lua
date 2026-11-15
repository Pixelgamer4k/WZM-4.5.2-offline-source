local t=LUI and LUI.Commands and LUI.Commands.InGame and LUI.Commands.InGame.OpenChangeTeamMenu
local o={'type='..type(t)}
if type(t)=='table' then for k,v in pairs(t) do o[#o+1]=tostring(k)..'='..tostring(v) end end
return table.concat(o,'\n')
