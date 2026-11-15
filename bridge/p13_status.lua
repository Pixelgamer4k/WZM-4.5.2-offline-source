local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local W=rawget(_G,"_WZM"); t("marker",W~=nil); if W then t("pdnil",W.pdnil); t("groups",W.n) end
local s=MenuNavigator.GetStateCopy(0)
t("nav",MenuNavigator.IsNavigating()); t("safe",MenuNavigator.IsMenuCreationSafe()); if s then t("exec",s.executionState); t("cur",s.currentMenuId) end
local fm=LUI.primaryRoot.flowManager
pcall(function() for i,m in ipairs(fm.menuInfoStack) do t("stack"..i,tostring(m.name).." fenced="..tostring(m.fenced)) end end)
return table.concat(o,"\n")
