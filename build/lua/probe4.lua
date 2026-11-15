local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local function one(v, d)
  if type(v) == 'table' then
    if d > 1 then return '{..}' end
    local p = {}
    for k, x in pairs(v) do p[#p + 1] = tostring(k) .. '=' .. one(x, d + 1); if #p > 25 then break end end
    return '{' .. table.concat(p, ', ') .. '}'
  elseif type(v) == 'function' then return 'fn'
  else return tostring(v) end
end
local l = OPTIONS_DATA.optionsDataList
local n = 0
for k, v in pairs(l) do
  n = n + 1
  add('[' .. tostring(k) .. '] ' .. one(v, 0))
end
add('count ' .. n)
return table.concat(out, '\n')
