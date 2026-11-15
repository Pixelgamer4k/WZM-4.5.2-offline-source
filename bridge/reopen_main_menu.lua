-- Bring the main menu back after a UI error left a black screen (session-only).
local o={}
local r={pcall(MenuNavigator.QueueURI,"cod://MainMenuMobile",0,{})}
o[#o+1]="queueURI "..tostring(r[1]).." "..tostring(r[2])
return table.concat(o,'; ')
