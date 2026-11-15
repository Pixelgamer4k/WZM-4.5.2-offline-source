local FM = LUI.FlowManager
local out = {}
local top = FM.GetTopmostMenu()
for k, v in pairs(top) do out[#out + 1] = tostring(k) .. '=' .. tostring(v) end
local st = FM.GetMenuStack(0)
for i, m in ipairs(st or {}) do
  local p = {}
  for k, v in pairs(m) do p[#p + 1] = tostring(k) .. '=' .. tostring(v) end
  out[#out + 1] = 'STACK' .. i .. ': ' .. table.concat(p, ' ')
end
return table.concat(out, '\n')
