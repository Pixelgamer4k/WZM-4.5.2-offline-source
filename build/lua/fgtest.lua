local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local r = {}
local ok, e = pcall(function() fg._probe = 1 end)
r[#r+1] = 'setfield ' .. tostring(ok) .. ' ' .. tostring(e) .. ' read=' .. tostring(rawget(fg, '_probe')) .. '/' .. tostring(fg._probe)
local W = rawget(_G, '_WZM')
r[#r+1] = '_WZM.n=' .. tostring(W and W.n)
local ok2, e2 = pcall(LUI.FenceGroup.Frame, fg, 0)
r[#r+1] = 'frame ' .. tostring(ok2) .. ' ' .. tostring(e2) .. ' wzm=' .. tostring(fg._wzm) .. ' n=' .. tostring(W and W.n)
local info = debug.traceback and 'tb ok' or ''
return table.concat(r, ' | ')
