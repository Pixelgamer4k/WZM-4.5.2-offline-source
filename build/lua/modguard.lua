local LOGP = '/data/user/0/com.activision.callofduty.warzone/files/wzm_gui_log.txt'
local function FL(s) local f = io.open(LOGP, 'a'); if f then f:write(os.date('%H:%M:%S') .. ' ' .. tostring(s) .. '\n'); f:close() end end
local n = 0
local function wrapt(t, tname)
  if type(t) ~= 'table' then return end
  local keys = {}
  for k, v in pairs(t) do if type(v) == 'function' then keys[#keys+1] = k end end
  for _, k in ipairs(keys) do
    local f = t[k]
    local name = tname .. '.' .. tostring(k):gsub('xhash: ', '')
    rawset(t, k, function(...)
      local r = {xpcall(f, function(e) return tostring(e) .. '\n' .. debug.traceback() end, ...)}
      if not r[1] then FL('ERR ' .. name .. ': ' .. tostring(r[2]):sub(1, 2500)); error(r[2], 0) end
      return unpack(r, 2, table.maxn(r))
    end)
    n = n + 1
  end
end
for _, m in ipairs({'FrontEndScene', 'SCENE', 'ClientCharacter', 'CLIENTCHARACTER', 'Operator', 'CustomizationEditManager', 'Lobby', 'MainMenu', 'MAIN_MENU', 'PARTY', 'Party', 'FRONTEND', 'Frontend'}) do wrapt(rawget(_G, m), m) end
wrapt(LUI.FlowManager, 'FM')
FL('modguard armed ' .. n)
return 'modguard ' .. n
