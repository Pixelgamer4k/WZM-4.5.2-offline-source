-- Dump the widget tree of the topmost menu (ids, element types, texts), depth-limited.
local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local FM = LUI.FlowManager
local top = FM.GetTopmostMenu().menu
local count = 0
local function txt(e)
  local ok, t = pcall(function() return e.getText and e:getText() end)
  if ok and t and t ~= '' then return ' "' .. tostring(t):sub(1, 50) .. '"' end
  return ''
end
local function walk(e, d)
  if e == nil or count > 1500 or d > 22 then return end
  count = count + 1
  local okid, id = pcall(function() return e.id end)
  local mt = getmetatable(e)
  local okt, ty = pcall(function() return e._type or e.type or '' end)
  local vis = ''
  add(string.rep(' ', d) .. tostring(id) .. ' [' .. tostring(ty) .. ']' .. txt(e))
  local ok, c = pcall(function() return e:getFirstChild() end)
  while ok and c do
    walk(c, d + 1)
    ok, c = pcall(function() return c:getNextSibling() end)
  end
end
add('top=' .. tostring(top))
walk(top, 0)
add('count ' .. count)
return table.concat(out, '\n')
