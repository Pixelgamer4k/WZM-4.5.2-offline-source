local out = {}
local function add(s) out[#out+1] = tostring(s) end
for k, v in pairs(_G) do
  local ks = tostring(k):lower()
  if ks:find('operator') or ks:find('customiz') or ks:find('player_data') or ks:find('playerdata') or ks:find('frontend') or ks:find('scene') or ks:find('character') then
    local n = 0
    if type(v) == 'table' then for _ in pairs(v) do n = n + 1 end end
    add(tostring(k) .. ' ' .. type(v) .. ' n=' .. n)
  end
end
local O = rawget(_G, 'OPERATOR') or rawget(_G, 'OPERATORS')
if type(O) == 'table' then
  for k, v in pairs(O) do add('  OP.' .. tostring(k) .. '=' .. tostring(v):sub(1,40)) end
end
return table.concat(out, '\n')
