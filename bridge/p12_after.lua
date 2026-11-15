local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
t("WZM",tostring(rawget(_G,"_WZM")))
local s=MenuNavigator.GetStateCopy(0)
if s then t("exec",s.executionState); t("cur",s.currentMenuId); t("actionsExecuted",s.actionsExecuted); if s.request then t("reqpath1",s.request.path and s.request.path[1]) end end
t("nav",MenuNavigator.IsNavigating()); t("safe",MenuNavigator.IsMenuCreationSafe())
local fm=LUI.primaryRoot.flowManager
pcall(function() t("stackN",#fm.menuInfoStack); for i,m in ipairs(fm.menuInfoStack) do t("stack"..i,tostring(m.name).." fenced="..tostring(m.fenced)) end end)
return table.concat(o,"\n")
