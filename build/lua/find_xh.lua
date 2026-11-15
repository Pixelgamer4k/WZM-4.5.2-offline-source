local want = 'xhash: #x420bd95b7fd5b0516'
local out, seen, n = {}, {}, 0
local function scan(t, path, d)
  if d > 5 or seen[t] or n > 40 then return end
  seen[t] = true
  local ok = pcall(function()
    for k, v in pairs(t) do
      if tostring(k) == want then n = n + 1; out[#out+1] = 'KEY ' .. path .. ' -> ' .. tostring(v):sub(1,40) end
      if tostring(v) == want then n = n + 1; out[#out+1] = 'VAL ' .. path .. '.' .. tostring(k) end
      if type(v) == 'table' then scan(v, path .. '.' .. tostring(k):sub(1,28), d + 1) end
    end
  end)
end
scan(_G, '_G', 0)
return #out .. '\n' .. table.concat(out, '\n')
