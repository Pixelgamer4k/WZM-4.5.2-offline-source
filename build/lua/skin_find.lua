local want = {['xhash: #x44a18e3fdb12682e3'] = 'valeria skin', ['xhash: #x4140ed949169d546b'] = 'soap skin', ['xhash: #x420b2417c10010917'] = 'valeria op'}
local found, seen, paths = {}, {}, {}
local function scan(t, path, d)
  if d > 7 or seen[t] then return end
  seen[t] = true
  pcall(function() for k, v in pairs(t) do
    if type(v) == 'xhash' and want[tostring(v)] and not found[tostring(v)] then found[tostring(v)] = v; paths[#paths+1] = want[tostring(v)] .. ' VAL ' .. path end
    if type(k) == 'xhash' and want[tostring(k)] and not found[tostring(k)] then found[tostring(k)] = k; paths[#paths+1] = want[tostring(k)] .. ' KEY ' .. path end
    if type(v) == 'table' then scan(v, path .. '.' .. tostring(k):gsub('xhash: ', ''):sub(1, 20), d + 1) end
  end end)
end
local t0 = os.clock()
scan(_G, '_G', 0)
return string.format('%.2fs ', os.clock() - t0) .. '\n' .. table.concat(paths, '\n')
