local u="cod://MainMenuMobile/MobilePrivateMatchSquadSelectionMenu"
local r={pcall(MenuNavigator.QueueURI,u,0,{})}
return "queue "..tostring(r[1]).." "..tostring(r[2])
