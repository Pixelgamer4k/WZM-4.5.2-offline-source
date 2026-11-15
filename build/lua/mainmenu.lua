local FM = LUI.FlowManager
local st = FM.GetMenuStack(0) or {}
local s = {}
for i, m in ipairs(st) do s[#s+1] = tostring(m.name) end
local before = 'stack: ' .. table.concat(s, ' > ')
local MN = rawget(_G, 'MenuNavigator')
local ok, err = pcall(function() MN.QueueURI('cod://MainMenuMobile', 0, {}) end)
return before .. ' | queue ' .. tostring(ok) .. ' ' .. tostring(err)
