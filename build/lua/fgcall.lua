local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local ok, err = pcall(LUI.FenceGroup.Frame, fg, 0)
local ok2, p = pcall(LUI.FenceGroup.Passes, fg, 0)
local W = rawget(_G, '_WZM')
return 'frame ' .. tostring(ok) .. ' ' .. tostring(err) .. ' | passes ' .. tostring(ok2) .. ' ' .. tostring(p) .. ' | wzm=' .. tostring(fg._wzm) .. ' _WZM.n=' .. tostring(W and W.n) .. ' active=' .. tostring(fg._activeFenceIndex) .. ' state=' .. tostring(fg._state)
