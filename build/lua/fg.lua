local FM = LUI.FlowManager
local out = {}
local ok, f = pcall(FM.AreMainMenuFencedOut, 0); out[#out+1] = 'AreMainMenuFencedOut=' .. tostring(ok) .. ' ' .. tostring(f)
local m = (FM.GetMenuStack(0) or {})[1]
local fg = m and m.fenceGroup
if fg then
  for k, v in pairs(fg) do
    local s = tostring(v)
    if type(v) == 'table' then local p = {} for a, b in pairs(v) do p[#p+1] = tostring(a) .. '=' .. tostring(b):sub(1,30) end s = '{' .. table.concat(p, ', '):sub(1,600) .. '}' end
    out[#out+1] = '  fg.' .. tostring(k) .. ' = ' .. s:sub(1,700)
  end
  local mt = getmetatable(fg)
  if mt and mt.__index then for k, v in pairs(type(mt.__index)=='table' and mt.__index or {}) do if type(k)=='string' then out[#out+1] = '  mt.' .. k end end end
  local okp, p = pcall(function() return fg:Passes(0) end); out[#out+1] = 'Passes=' .. tostring(okp) .. ' ' .. tostring(p)
end
return table.concat(out, '\n')
