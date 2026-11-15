local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m and m.fenceGroup
local f = fg and fg._fences[fg._activeFenceIndex]
return 'fenced=' .. tostring(m and m.fenced) .. ' active=' .. tostring(fg and fg._activeFenceIndex) .. ' fence=' .. tostring(f and f._name) .. ' state=' .. tostring(fg and fg._state) .. ' wzm=' .. tostring(fg and fg._wzm) .. ' top=' .. tostring(LUI.FlowManager.GetTopmostMenu().menu)
