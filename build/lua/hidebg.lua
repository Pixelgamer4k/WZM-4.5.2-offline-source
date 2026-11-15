local c = LUI.primaryRoot:getFirstChild()
local r = {}
while c do
  if tostring(c.id) == 'persistent_bg_container' then
    local k = c:getFirstChild()
    r[#r+1] = 'child=' .. tostring(k and k.id)
    for _, m in ipairs({'setAlpha', 'SetAlpha'}) do
      local ok, e = pcall(function() c[m](c, 0) end)
      r[#r+1] = m .. '=' .. tostring(ok) .. (ok and '' or (' ' .. tostring(e):sub(1, 60)))
      if ok then break end
    end
  end
  c = c:getNextSibling()
end
return table.concat(r, ' | ')
