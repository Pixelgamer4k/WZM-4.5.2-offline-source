local FM = LUI.FlowManager
local m = (FM.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local r = {}
r[#r+1] = 'onpass ' .. tostring(pcall(function() fg.OnPass(fg, 0) end))
r[#r+1] = 'fenced=' .. tostring(m.fenced) .. ' top=' .. tostring(FM.GetTopmostMenu().menu)
if m.fenced then r[#r+1] = 'refresh ' .. tostring(pcall(function() FM.RefreshStack(0) end)) end
r[#r+1] = 'after fenced=' .. tostring(m.fenced) .. ' top=' .. tostring(FM.GetTopmostMenu().menu)
return table.concat(r, ' | ')
