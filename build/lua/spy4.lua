local function hk(t, s) for k in pairs(t) do if tostring(k) == s then return k end end end
local kBuild = hk(OPTIONS, 'xhash: #x090c28a7693e986d4')
local orig = OPTIONS[kBuild]
-- undo spy3 wrappers is not possible (no originals saved); just capture
OPTIONS[kBuild] = function(list, ctrl, sections, ...)
  rawset(_G, 'WZM_SECTIONS', sections)
  return orig(list, ctrl, sections, ...)
end
local FM = LUI.FlowManager
local info = FM.GetTopmostMenu()
pcall(FM.RequestLeaveMenu, info.menu)
pcall(FM.RequestAddMenu, info.name, false, 0, false, {})
local l = OPTIONS_DATA.optionsDataList
return 'kBuild=' .. tostring(kBuild) .. ' strkey=' .. tostring(l['mobile_frame_rate_cap']) .. ' strkey2=' .. tostring(l.mobile_bloom)
