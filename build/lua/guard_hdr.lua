local LOGP = '/data/user/0/com.activision.callofduty.warzone/files/wzm_gui_log.txt'
local function FL(s) local f = io.open(LOGP, 'a'); if f then f:write(os.date('%H:%M:%S') .. ' ' .. tostring(s) .. '\n'); f:close() end end
local function wrap(t, k, name)
  local f = t[k]
  if type(f) ~= 'function' then return end
  t[k] = function(...)
    local r = {xpcall(f, function(e) return tostring(e) .. '\n' .. debug.traceback() end, ...)}
    if not r[1] then FL('ERR ' .. name .. ': ' .. tostring(r[2]):sub(1, 1500)); error(r[2], 0) end
    return unpack(r, 2)
  end
end
local MB = rawget(_G, 'MenuBuilder')
wrap(MB, 'BuildRegisteredType', 'BuildRegisteredType')
wrap(MB, 'BuildAddChild', 'BuildAddChild')
local FM = LUI.FlowManager
for _, k in ipairs({'addMenu', 'addMenuHandler', 'restoreMenu', 'restoreMenuHandler', 'Frame', 'FenceGroupFrame', 'PushMenuInfo'}) do wrap(FM, k, 'FM.' .. k) end
wrap(LUI.FenceGroup, 'OnPass', 'FG.OnPass')
FL('guard armed')
rawset(_G, '_WZM', nil)
