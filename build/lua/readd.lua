local FM = LUI.FlowManager
local st = FM.GetMenuStack(0)
local name = st[1].name
local ok, err = pcall(function() FM.RequestAddMenu(name, true, 0, false, {}) end)
local fmEl
local c = LUI.primaryRoot:getFirstChild()
while c do if tostring(c.id) == 'flowManager' then fmEl = c end; c = c:getNextSibling() end
local n = 0
pcall(function() local k = fmEl:getFirstChild(); while k do n = n + 1; k = k:getNextSibling() end end)
return 'add ' .. tostring(ok) .. ' ' .. tostring(err) .. ' | flowManager kids=' .. n .. ' stack=' .. #FM.GetMenuStack(0)
