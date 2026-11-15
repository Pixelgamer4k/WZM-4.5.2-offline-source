local out = {}
local function add(s) out[#out+1] = tostring(s) end
local kEntry
for k in pairs(OPTIONS) do if tostring(k) == 'xhash: #x0e7686f7a9907efd8' then kEntry = k end end
local id
for k in pairs(OPTIONS_DATA.optionsDataList) do if tostring(k) == 'xhash: #x42534bf9d3e214f83' then id = k end end
local e = OPTIONS[kEntry](id)
local function dump(t, ind, d)
  for k, v in pairs(t) do
    local s = tostring(v):sub(1, 70)
    if type(v) == 'function' then local ok, r = pcall(v); s = s .. ' () -> ' .. tostring(ok) .. ' ' .. tostring(r):sub(1,80) end
    add(ind .. tostring(k) .. ' = ' .. s)
    if type(v) == 'table' and d < 3 then dump(v, ind .. '  ', d + 1) end
  end
end
dump(e, '', 0)
return table.concat(out, '\n')
