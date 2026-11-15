if rawget(_G, 'WZM_CAP') ~= nil then return 'armed' end
-- Undo spy_options wrappers, then capture the tab builder / entry builder arguments by reference.
local ORIG = rawget(_G, 'WZM_SPY_ORIG') or {}
local restored = 0
for _, t in ipairs({OPTIONS.Menu, MobileSettingsHubUtils, MOBILE_SETTINGS, OPTIONS, VIDEO, SystemSettings}) do
  for k, f in pairs(t) do
    if ORIG[f] then t[k] = ORIG[f]; restored = restored + 1 end
  end
end
local CAP = {tabs = {}, entries = {}, other = {}}
rawset(_G, 'WZM_CAP', CAP)
local function hk(s) for k, v in pairs(OPTIONS) do if tostring(k) == s then return k end end end
local kTab = hk('xhash: #x07bf7f57679e8d050')
local kEntry = hk('xhash: #x0d75600f66e451e5c')
local kEntry2 = hk('xhash: #x029273e0c13b86b6b')
local o1, o2, o3 = OPTIONS[kTab], OPTIONS[kEntry], OPTIONS[kEntry2]
OPTIONS[kTab] = function(...)
  local a = {...}
  if #CAP.tabs < 30 then
    local st, s = LUI.FlowManager.GetMenuStack(0), {}
    for i, m in ipairs(st or {}) do s[#s + 1] = tostring(m.name or m.menuName or m.id or m) end
    a.stack = table.concat(s, ' > ')
    CAP.tabs[#CAP.tabs + 1] = a
  end
  return o1(...)
end
OPTIONS[kEntry] = function(...) local a = {...}; if #CAP.entries < 300 then CAP.entries[#CAP.entries + 1] = a end; return o2(...) end
OPTIONS[kEntry2] = function(...) local a = {...}; if #CAP.other < 100 then CAP.other[#CAP.other + 1] = a end; return o3(...) end
rawset(_G, 'WZM_CAP_ORIG', {kTab, o1, kEntry, o2, kEntry2, o3})
return 'restored ' .. restored .. ' keys ' .. tostring(kTab) .. ' ' .. tostring(kEntry) .. ' ' .. tostring(kEntry2)
