local out = {}
for k, v in pairs(LUI.FlowManager) do if type(k) == 'string' then out[#out+1] = k end end
table.sort(out)
local st = LUI.FlowManager.GetMenuStack(0) or {}
local info = {}
for i, m in ipairs(st) do local p = {} for k, v in pairs(m) do p[#p+1] = tostring(k) .. '=' .. tostring(v):sub(1,30) end; info[#info+1] = table.concat(p, ' ') end
return table.concat(out, ' ') .. '\nSTACK: ' .. table.concat(info, ' || ')
