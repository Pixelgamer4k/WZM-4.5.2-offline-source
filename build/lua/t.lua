local out = {}
local function scan(t, name)
  if type(t) ~= 'table' then return end
  for k, v in pairs(t) do
    local s = tostring(k)
    if type(v) == 'function' and (s:lower():find('hash')) then out[#out + 1] = name .. '.' .. s end
  end
end
scan(_G, '_G'); scan(rawget(_G, 'Engine'), 'Engine'); scan(rawget(_G, 'LUI'), 'LUI'); scan(rawget(_G, 'CoD'), 'CoD'); scan(rawget(_G, 'Dvar'), 'Dvar'); scan(rawget(_G, 'string'), 'string')
local e = rawget(_G, 'Engine'); local n = 0
for k, v in pairs(e or {}) do n = n + 1 end
out[#out + 1] = 'Engine entries ' .. n
return table.concat(out, '\n')
