local c = LUI.primaryRoot:getFirstChild()
local r = {}
while c do
  local id = tostring(c.id)
  if id ~= 'flowManager' then local ok = pcall(function() c:SetAlpha(0) end); r[#r+1] = id:sub(1, 20) .. '=' .. tostring(ok) end
  c = c:getNextSibling()
end
return table.concat(r, ' ')
