local root = LUI.primaryRoot
local out = {}
local c = root:getFirstChild()
local i = 0
while c and i < 40 do
  i = i + 1
  local id = tostring(c.id)
  local a = select(2, pcall(function() return c:getAlpha() end))
  local n = 0
  pcall(function() local k = c:getFirstChild(); while k do n = n + 1; k = k:getNextSibling() end end)
  local mn = select(2, pcall(function() return c.menuName or c._menuName or c.name end))
  out[#out+1] = i .. ' ' .. id .. ' alpha=' .. tostring(a) .. ' kids=' .. n .. ' name=' .. tostring(mn)
  c = c:getNextSibling()
end
return table.concat(out, '\n')
