local CAP = rawget(_G, 'WZM_CAP')
local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local seen = {}
local function dump(name, v, d, maxd)
  local ind = string.rep(' ', d * 2)
  if type(v) ~= 'table' then add(ind .. tostring(name) .. '=' .. tostring(v)); return end
  if seen[v] then add(ind .. tostring(name) .. '=<seen ' .. tostring(v) .. '>'); return end
  seen[v] = true
  add(ind .. tostring(name) .. ' {' .. tostring(v))
  if d < maxd then
    local n = 0
    for k, x in pairs(v) do n = n + 1; if n > 40 then add(ind .. ' ...'); break end; dump(k, x, d + 1, maxd) end
  end
  add(ind .. '}')
end
add('tabs ' .. #CAP.tabs .. ' entries ' .. #CAP.entries .. ' other ' .. #CAP.other)
for i, a in ipairs(CAP.tabs) do dump('TAB' .. i, a, 0, 4) end
for i = 1, math.min(#CAP.entries, 400) do
  local e = CAP.entries[i][1]
  local p = {}
  if type(e) == 'table' then for k, x in pairs(e) do p[#p + 1] = tostring(k):gsub('xhash: #x0', '') .. '=' .. tostring(x) end end
  add('E' .. i .. ' ' .. table.concat(p, ' '))
end
return table.concat(out, '\n')
