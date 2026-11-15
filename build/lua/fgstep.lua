local FM = LUI.FlowManager
local m = (FM.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local before = 'active=' .. tostring(fg._activeFenceIndex) .. ' state=' .. tostring(fg._state) .. ' fenced=' .. tostring(m.fenced)
local ok, err = pcall(function() fg:Frame(0) end)
local ok2, err2 = pcall(function() FM.FenceGroupFrame(FM.GetFlowManager and FM.GetFlowManager() or FM, 0) end)
return before .. ' | frame ' .. tostring(ok) .. ' ' .. tostring(err) .. ' | fgf ' .. tostring(ok2) .. ' ' .. tostring(err2) ..
  ' | after active=' .. tostring(fg._activeFenceIndex) .. ' state=' .. tostring(fg._state) .. ' fenced=' .. tostring(m.fenced) .. ' top=' .. tostring(FM.GetTopmostMenu().menu)
