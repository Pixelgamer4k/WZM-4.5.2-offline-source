local LOGP = '/data/user/0/com.activision.callofduty.warzone/files/wzm_gui_log.txt'
local function FL(s) local f = io.open(LOGP, 'a'); if f then f:write(os.date('%H:%M:%S') .. ' ' .. tostring(s) .. '\n'); f:close() end end
local M = rawget(_G, 'MainMenuMobileUtils')
local n = 0
local keys = {}
for k, v in pairs(M) do if type(v) == 'function' then keys[#keys+1] = k end end
for _, k in ipairs(keys) do
  local f = M[k]
  local name = tostring(k):gsub('xhash: ', '')
  rawset(M, k, function(...)
    local r = {pcall(f, ...)}
    if not r[1] then FL('SAFE MainMenuMobileUtils.' .. name .. ': ' .. tostring(r[2]):sub(1, 300)); return nil end
    return unpack(r, 2, table.maxn(r))
  end)
  n = n + 1
end
FL('mmsafe ' .. n)
return 'mmsafe ' .. n
