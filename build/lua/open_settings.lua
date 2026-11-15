local FM = LUI.FlowManager
local name = FM.GetTopmostMenu().previousMenuName
local ok, err = pcall(FM.RequestAddMenu, name, true, 0, false, {})
return 'open ' .. tostring(name) .. ' ok=' .. tostring(ok) .. ' ' .. tostring(err)
