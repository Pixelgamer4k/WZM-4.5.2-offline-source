-- Experiment 2: extra section on the game's Graphics page, ids borrowed from options that mobile never shows.
local function hk(t, s) for k in pairs(t) do if tostring(k) == s then return k end end end
local kBuild = hk(OPTIONS, 'xhash: #x090c28a7693e986d4')
local kEntry = hk(OPTIONS, 'xhash: #x0e7686f7a9907efd8')
local W = rawget(_G, 'WZM_GUI')
if W == nil then
  W = {origBuild = OPTIONS[kBuild], origEntry = OPTIONS[kEntry], origName = OPTIONS.GetOptionName, ids = {}, names = {}, log = {}}
  rawset(_G, 'WZM_GUI', W)
end
local oBuild, oEntry, oName = W.origBuild, W.origEntry, W.origName
local ODL = OPTIONS_DATA.optionsDataList
local function L(s) if #W.log < 60 then W.log[#W.log + 1] = tostring(s) end end
local function shallow(t) local c = {} for k, v in pairs(t) do c[k] = v end return c end

-- free ids: optionsDataList keys that have no mobile layout entry
if W.free == nil then
  W.free = {}
  for id in pairs(ODL) do
    local ok, e = pcall(oEntry, id)
    if ok and e == nil and type(id) ~= 'string' then W.free[#W.free + 1] = id end
    if #W.free >= 24 then break end
  end
  L('free ids ' .. #W.free)
end

OPTIONS[kEntry] = function(id, ...)
  local mine = W.ids[id]
  if mine then return mine end
  return oEntry(id, ...)
end
OPTIONS.GetOptionName = function(e, ...)
  local n = e and W.names[e]
  if n then return n end
  return oName(e, ...)
end

OPTIONS[kBuild] = function(list, ctrl, sections, ...)
  local args = {...}
  local ok, err = pcall(function()
    local top = LUI.FlowManager.GetTopmostMenu()
    if top and top.name then W.pageName = top.name end
    local s1 = sections[1]
    local kItems, kLabel, kId
    for k, v in pairs(s1) do if type(v) == 'table' then kItems = k else kLabel = k end end
    local exp = s1[kItems][1]
    for k in pairs(exp) do if tostring(k) == 'xhash: #x07228576e3216368b' then kId = k end end
    if not (kItems and kLabel and kId) then error('keys not found') end
    local fpsId = exp[kItems][2][kId]
    local fpsEntry = oEntry(fpsId)
    local id = W.free[1]
    local e = shallow(fpsEntry)
    for k in pairs(e) do
      local ks = tostring(k)
      if ks == 'xhash: #x07228576e3216368b' then e[k] = id end
      if ks == 'xhash: #x0c4bcadba8e631b86' then e[k] = 'Offline graphics test row' end
    end
    W.ids[id] = e
    W.names[e] = 'WZM TEST'
    W.val = W.val or 2
    ODL[id] = {
      defaultOptionValue = 1, alreadyLocalizedLabels = true,
      labels = function() return {'One', 'Two', 'Three'} end,
      value = function() return W.val end,
      action = function(a, b, c) L('action ' .. tostring(a) .. ' ' .. tostring(b) .. ' ' .. tostring(c)); if type(b) == 'number' then W.val = b elseif type(a) == 'number' then W.val = a end end,
      analyticsValue = function() return 0 end,
    }
    local sec = {}
    sec[kLabel] = s1[kLabel]           -- reuse a real section label for now
    sec[kItems] = {{[kId] = id}}
    local copy = {}
    for i = 1, #sections do copy[i] = sections[i] end
    table.insert(copy, #copy, sec)
    sections = copy
    L('injected id ' .. tostring(id))
  end)
  if not ok then L('prep err ' .. tostring(err)) end
  local ok2, r = pcall(oBuild, list, ctrl, sections, unpack(args))
  if not ok2 then L('build err ' .. tostring(r)); return end
  return r
end
return 'armed; log=' .. table.concat(W.log, ' / ')
