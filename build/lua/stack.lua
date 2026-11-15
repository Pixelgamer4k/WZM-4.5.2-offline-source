local FM = LUI.FlowManager
local st = FM.GetMenuStack(0) or {}
local s = {}
for i, m in ipairs(st) do s[#s+1] = tostring(m.name) end
local top = FM.GetTopmostMenu()
return 'stack: ' .. table.concat(s, ' > ') .. ' | top=' .. tostring(top and top.name)
