local want = 'xhash: #x03c7c5ded69116401'
local out, seen = {}, {}
local function scan(t, path, d)
  if d > 3 or seen[t] then return end
  seen[t] = true
  for k, v in pairs(t) do
    if tostring(k) == want then out[#out+1] = path .. ' -> ' .. tostring(v) end
    if type(v) == 'table' and type(k) == 'string' then scan(v, path .. '.' .. k, d + 1) end
  end
end
scan(_G, '_G', 0)
return table.concat(out, '\n')
