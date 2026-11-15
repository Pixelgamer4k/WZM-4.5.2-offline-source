local W=rawget(_G,"_WZM"); local g=W.fg
local s=MenuNavigator.GetStateCopy(0)
local fm=LUI.primaryRoot.flowManager
local top="?" pcall(function() local m=fm:GetTopmostMenu(); top=tostring(m and (m.id or m.name or m)) end)
return "exec="..tostring(s and s.executionState).." cur="..tostring(s and s.currentMenuId).." active="..tostring(g._activeFenceIndex).." gstate="..tostring(g._state).." nav="..tostring(MenuNavigator.IsNavigating()).." top="..top
