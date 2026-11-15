local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local f = fg._fences[9]
local out = {}
local pc = f._perController[0]
local p = {} for k, v in pairs(pc) do p[#p+1] = tostring(k) .. '=' .. tostring(v):sub(1,30) end
out[#out+1] = 'perController[0]: ' .. table.concat(p, ' ')
local mt = getmetatable(f)
local seen, lvl = {}, 0
while mt and lvl < 4 do
  local idx = mt.__index
  if type(idx) ~= 'table' or seen[idx] then break end
  seen[idx] = true
  local ks = {} for k, v in pairs(idx) do if type(k) == 'string' then ks[#ks+1] = k end end
  table.sort(ks)
  out[#out+1] = 'L' .. lvl .. ': ' .. table.concat(ks, ' ')
  mt = getmetatable(idx); lvl = lvl + 1
end
local fgmt = getmetatable(fg).__index
out[#out+1] = 'fg._state=' .. tostring(fg._state) .. ' STATE=' .. (function() local s = {} for k, v in pairs(fgmt.STATE or {}) do s[#s+1] = tostring(k) .. '=' .. tostring(v) end return table.concat(s, ',') end)()
return table.concat(out, '\n')
