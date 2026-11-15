-- Find tables reachable from _G that contain the string 'MobileSettingsControls' or 'automation_mobile'.
local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local seen, hits = {}, 0
local targets = {MobileSettingsControls = true, automation_mobile = true, MobileSettingsGraphics = true}
local function walk(t, path, d)
  if seen[t] or d > 8 or hits > 60 then return end
  seen[t] = true
  local cnt = 0
  for k, v in pairs(t) do
    cnt = cnt + 1
    if cnt > 5000 then break end
    if type(v) == 'string' and (targets[v] or v:find('Graphic') or v:find('graphic')) then
      hits = hits + 1; add(path .. '[' .. tostring(k) .. '] = ' .. v)
    end
  end
  cnt = 0
  for k, v in pairs(t) do
    cnt = cnt + 1
    if cnt > 5000 then break end
    if type(v) == 'table' then walk(v, path .. '.' .. tostring(k), d + 1) end
  end
end
walk(_G, '_G', 0)
local reg = debug.getregistry and debug.getregistry()
if reg then walk(reg, 'REG', 0) end
add('done ' .. hits)
return table.concat(out, '\n')
