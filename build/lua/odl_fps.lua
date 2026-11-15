local out = {}
local function add(s) out[#out+1] = tostring(s) end
local ODL = OPTIONS_DATA.optionsDataList
local kEntry
for k in pairs(OPTIONS) do if tostring(k) == 'xhash: #x0e7686f7a9907efd8' then kEntry = k end end
local n = 0
for id, d in pairs(ODL) do
  local ok, e = pcall(OPTIONS[kEntry], id)
  if ok and e then
    local nm = OPTIONS.GetOptionName(e)
    if nm == 'mobile_frame_rate_cap' or nm == 'mobile_graphics_preset' or (n < 1 and type(d) == 'table') then
      n = n + 1
      add('== ' .. tostring(nm) .. ' id=' .. tostring(id) .. ' type(d)=' .. type(d))
      if type(d) == 'table' then
        for k, v in pairs(d) do
          local s = type(v)
          if type(v) == 'function' then local ok2, r = pcall(v); s = s .. ' -> ' .. tostring(ok2) .. ' ' .. type(r) .. ' ' .. tostring(r) end
          if type(v) == 'table' then local c = {} for a, b in pairs(v) do c[#c+1] = tostring(a) .. '=' .. tostring(b) end s = s .. ' {' .. table.concat(c, ','):sub(1,200) .. '}' end
          add('  ' .. tostring(k) .. ' : ' .. s)
        end
      end
      add('  entry:')
      for k, v in pairs(e) do add('   ' .. tostring(k) .. ' = ' .. tostring(v):sub(1,60)) end
    end
  end
end
return table.concat(out, '\n')
