local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local cap = {}
local oldprint = print
local ok, r = pcall(function()
  local C = getmetatable(fg).__index
  local DBG = rawget(_G, 'DebugPrint')
  return C.DumpFenceState(fg)
end)
local f = fg._fences[9]
local s1 = {pcall(function() return f:State(0) end)}
local s2 = {pcall(function() return getmetatable(f).__index.State(f, 0) end)}
return 'dump ' .. tostring(ok) .. ' ' .. tostring(r) .. ' | f9:State=' .. tostring(s1[1]) .. ',' .. tostring(s1[2]) .. ' raw=' .. tostring(s2[2]) ..
  ' | own State? ' .. tostring(rawget(f, 'State') ~= nil) .. ' passes=' .. tostring(select(2, pcall(function() return fg:Passes(0) end)))
