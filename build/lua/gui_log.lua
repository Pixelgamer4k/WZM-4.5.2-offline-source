local W = rawget(_G, 'WZM_GUI')
if W == nil then return 'no WZM_GUI (LUI reset?)' end
local top = LUI.FlowManager.GetTopmostMenu()
return 'top=' .. tostring(top and top.name) .. ' page=' .. tostring(W.pageName) .. ' log: ' .. table.concat(W.log, ' / ')
