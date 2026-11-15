-- Experiment 3: one extra Graphics section with a row that owns its value (no link to real settings).
-- Everything logs to files/wzm_gui_log.txt so a UI reset can't hide the cause.
local LOGP = '/data/user/0/com.activision.callofduty.warzone/files/wzm_gui_log.txt'
local function FL(s)
  local f = io.open(LOGP, 'a')
  if f then f:write(os.date('%H:%M:%S') .. ' ' .. tostring(s) .. '\n'); f:close() end
end
local function hk(t, s) for k in pairs(t) do if tostring(k) == s then return k end end end
local function guard(name, fn)
  return function(...)
    local r = {xpcall(fn, function(e) return tostring(e) .. '\n' .. debug.traceback() end, ...)}
    if not r[1] then FL('ERR in ' .. name .. ': ' .. tostring(r[2])); return nil end
    return unpack(r, 2)
  end
end

local W = rawget(_G, 'WZM_GUI')
if W == nil then
  W = {ids = {}, names = {}, log = {}, menus = {}}
  W.origBuild = OPTIONS[hk(OPTIONS, 'xhash: #x090c28a7693e986d4')]
  W.origEntry = OPTIONS[hk(OPTIONS, 'xhash: #x0e7686f7a9907efd8')]
  W.origName = OPTIONS.GetOptionName
  W.origAdd = LUI.FlowManager.RequestAddMenu
  rawset(_G, 'WZM_GUI', W)
end
local kBuild = hk(OPTIONS, 'xhash: #x090c28a7693e986d4')
local kEntry = hk(OPTIONS, 'xhash: #x0e7686f7a9907efd8')
local oBuild, oEntry, oName, oAdd = W.origBuild, W.origEntry, W.origName, W.origAdd
local ODL = OPTIONS_DATA.optionsDataList
W.val = W.val or 2

-- remember menu names (xhash objects) so pages can be reopened from code
LUI.FlowManager.RequestAddMenu = function(name, ...)
  local s = tostring(name)
  if s:find('07d5608f97ebabbe4') then W.menus.graphics = name end
  if s:find('0401dbf6dbd8347b8') then W.menus.settings = name end
  FL('menu ' .. s)
  return oAdd(name, ...)
end

if W.free == nil then
  W.free = {}
  for id in pairs(ODL) do
    local ok, e = pcall(oEntry, id)
    if ok and e == nil and type(id) ~= 'string' then W.free[#W.free + 1] = id end
    if #W.free >= 24 then break end
  end
end

-- build the test entry once
local function makeRow()
  local fpsId = hk(ODL, 'xhash: #x42534bf9d3e214f83')
  local src = oEntry(fpsId)
  local id = W.free[1]
  local e = {}
  for k, v in pairs(src) do
    local ks = tostring(k)
    if ks == 'xhash: #x07228576e3216368b' then e[k] = id
    elseif ks == 'xhash: #x018830feef8226b2a' then -- parents: none
    elseif ks == 'xhash: #x08b72e07b55c3ac0' then e[k] = 'wzm_test'
    elseif ks == 'xhash: #x04d5b1e078d075d13' then e[k] = 'wzmTestSetting'
    elseif ks == 'xhash: #x01230e315819fab00' then e[k] = guard('e.value', function(...) FL('e.value'); return W.val end)
    elseif ks == 'xhash: #x07ce4fd9430e80cea' then e[k] = guard('e.default', function() return 1 end)
    elseif ks == 'xhash: #x050e0a072a8b67940' then e[k] = guard('e.set', function(...) local a = {...}; FL('e.set ' .. tostring(a[1]) .. ' ' .. tostring(a[2]) .. ' ' .. tostring(a[3])); for _, x in ipairs(a) do if type(x) == 'number' then W.val = x end end end)
    elseif ks == 'xhash: #x06568640b035a56df' then e[k] = guard('e.action', function(...) local a = {...}; FL('e.action ' .. tostring(a[1]) .. ' ' .. tostring(a[2]) .. ' ' .. tostring(a[3])); for _, x in ipairs(a) do if type(x) == 'number' then W.val = x end end end)
    elseif ks == 'xhash: #x0ecd04a2da4b210cf' then e[k] = guard('e.reset', function() FL('e.reset'); W.val = 1 end)
    elseif type(v) == 'function' then e[k] = guard('e.' .. ks, v)
    else e[k] = v end
  end
  W.ids[id] = e
  ODL[id] = {
    defaultOptionValue = guard('d.default', function() return 1 end),
    value = guard('d.value', function() return W.val end),
    action = guard('d.action', function(...) local a = {...}; FL('d.action ' .. tostring(a[1]) .. ' ' .. tostring(a[2])); for _, x in ipairs(a) do if type(x) == 'number' then W.val = x end end end),
    onReset = guard('d.reset', function() W.val = 1 end),
    onDependencyParentRefresh = guard('d.dep', function() end),
  }
  W.rowId = id
  FL('row made id=' .. tostring(id))
end

OPTIONS[kEntry] = function(id, ...)
  local mine = W.ids[id]
  if mine then return mine end
  return oEntry(id, ...)
end
OPTIONS.GetOptionName = oName

OPTIONS[kBuild] = function(list, ctrl, sections, ...)
  local args = {...}
  local ok, err = xpcall(function()
    local top = LUI.FlowManager.GetTopmostMenu()
    if top and top.name then W.menus.page = top.name; FL('page build ' .. tostring(top.name)) end
    if not tostring(top and top.name):find('07d5608f97ebabbe4') then return end
    if W.rowId == nil then makeRow() end
    local s1 = sections[1]
    local kItems, kLabel, kId
    for k, v in pairs(s1) do if type(v) == 'table' then kItems = k else kLabel = k end end
    kId = hk(s1[kItems][1], 'xhash: #x07228576e3216368b')
    local sec = {}
    sec[kLabel] = s1[kLabel]
    sec[kItems] = {{[kId] = W.rowId}}
    local copy = {}
    for i = 1, #sections do copy[i] = sections[i] end
    table.insert(copy, #copy, sec)
    sections = copy
    FL('injected section, sections=' .. #copy)
  end, function(e) return tostring(e) .. '\n' .. debug.traceback() end)
  if not ok then FL('prep err ' .. tostring(err)) end
  local ok2, r = xpcall(function() return oBuild(list, ctrl, sections, unpack(args)) end,
    function(e) return tostring(e) .. '\n' .. debug.traceback() end)
  if not ok2 then FL('build err ' .. tostring(r)); return end
  FL('build ok')
  return r
end
FL('armed v3')
return 'armed v3 free=' .. #W.free
