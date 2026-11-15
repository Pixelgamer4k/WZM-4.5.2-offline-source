local out = {}
local function add(s) out[#out+1] = tostring(s) end
local p = '/data/user/0/com.activision.callofduty.warzone/files/wzm_gui_log.txt'
local f, e = io.open(p, 'a')
add('open ' .. tostring(f) .. ' ' .. tostring(e))
if f then f:write('iotest ok\n'); f:close() end
local function scan(t, path)
  for k, v in pairs(t) do
    local ks = tostring(k)
    if ks:lower():find('error') or ks:lower():find('crash') then add(path .. '.' .. ks .. '=' .. tostring(v)) end
  end
end
scan(_G, '_G'); scan(LUI, 'LUI')
for _, n in ipairs({'Engine','LUI.FlowManager'}) do end
local E = rawget(_G, 'Engine'); if type(E) == 'table' then scan(E, 'Engine') end
return table.concat(out, '\n')
