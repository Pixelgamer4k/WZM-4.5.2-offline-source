local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local out = {}
for i = 7, 11 do
  local f = fg._fences[i]
  local p = {}
  for k, v in pairs(f) do
    local s = tostring(v)
    if type(v) == 'function' then local ok, r = pcall(v, f, 0); s = s:sub(1,12) .. '()=' .. tostring(ok) .. ':' .. tostring(r):sub(1,60) end
    if type(v) == 'table' then local q = {} for a, b in pairs(v) do q[#q+1] = tostring(a) .. '=' .. tostring(b):sub(1,25) end s = '{' .. table.concat(q, ','):sub(1,200) .. '}' end
    p[#p+1] = tostring(k) .. '=' .. s
  end
  out[#out+1] = '#' .. i .. ': ' .. table.concat(p, ' | '):sub(1, 900)
end
return table.concat(out, '\n')
