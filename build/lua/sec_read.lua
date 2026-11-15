local S = rawget(_G, 'WZM_SECTIONS')
local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local seen = {}
local function dump(name, v, d)
  local ind = string.rep(' ', d)
  if type(v) ~= 'table' then add(ind .. tostring(name) .. '=' .. tostring(v)); return end
  if seen[v] then add(ind .. tostring(name) .. '=<seen>'); return end
  seen[v] = true
  add(ind .. tostring(name) .. ' {')
  if d < 7 then for k, x in pairs(v) do dump(k, x, d + 1) end end
  add(ind .. '}')
end
dump('SECTIONS', S, 0)
return table.concat(out, '\n')
