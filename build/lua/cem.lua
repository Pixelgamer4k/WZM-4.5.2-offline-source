local out = {}
local function add(s) out[#out+1] = tostring(s) end
for _, n in ipairs({'CustomizationEditManager','OPERATOR_SKIN','CustomizationData','UICustomization','Operator','ClientCharacter'}) do
  local t = rawget(_G, n)
  local ks = {}
  for k, v in pairs(t or {}) do ks[#ks+1] = tostring(k):gsub('xhash: ', '') .. ':' .. type(v):sub(1,3) end
  add(n .. ' (' .. #ks .. '): ' .. table.concat(ks, ' '))
end
return table.concat(out, '\n')
