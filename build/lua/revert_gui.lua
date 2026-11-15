local W = rawget(_G, 'WZM_GUI')
if W == nil then return 'nothing to revert (already clean)' end
local function hk(t, s) for k in pairs(t) do if tostring(k) == s then return k end end end
OPTIONS[hk(OPTIONS, 'xhash: #x090c28a7693e986d4')] = W.origBuild
OPTIONS[hk(OPTIONS, 'xhash: #x0e7686f7a9907efd8')] = W.origEntry
OPTIONS.GetOptionName = W.origName
if W.origAdd then LUI.FlowManager.RequestAddMenu = W.origAdd end
if W.rowId then OPTIONS_DATA.optionsDataList[W.rowId] = nil end
rawset(_G, 'WZM_GUI', nil)
return 'reverted'
