local LOGP = '/data/user/0/com.activision.callofduty.warzone/files/wzm_gui_log.txt'
local function FL(s) local f = io.open(LOGP, 'a'); if f then f:write(os.date('%H:%M:%S') .. ' ' .. tostring(s) .. '\n'); f:close() end end
local n = 0
local function wrapc(t, k, name)
  local f = rawget(t, k)
  if type(f) ~= 'function' then return end
  rawset(t, k, function(...)
    local r = {xpcall(f, function(e) return tostring(e) .. '\n' .. debug.traceback() end, ...)}
    if not r[1] then FL('ERR ' .. name .. ': ' .. tostring(r[2]):sub(1, 2500)); error(r[2], 0) end
    return unpack(r, 2, table.maxn(r))
  end)
  n = n + 1
end
for _, cname in ipairs({'UIElement', 'UIRoot'}) do
  local C = LUI[cname]
  if type(C) == 'table' then
    for k, v in pairs(C) do if type(v) == 'function' and type(k) == 'string' and (k:lower():find('event') or k:lower():find('process')) then wrapc(C, k, cname .. '.' .. k) end end
  end
end
FL('evguard armed ' .. n)
return 'evguard ' .. n
