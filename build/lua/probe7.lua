-- Search tables and function upvalues reachable from OPTIONS / MobileSettingsHubUtils / MOBILE_SETTINGS / LUI
-- for the string 'MobileSettingsControls' / 'automation_mobile'.
local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local seen, hits, nodes = {}, 0, 0
local targets = {MobileSettingsControls = true, automation_mobile = true, auto_grab_weapons_mobile = true}
local walk
local function visit(v, path, d)
  if type(v) == 'table' then walk(v, path, d)
  elseif type(v) == 'function' and not seen[v] and d < 10 then
    seen[v] = true
    for i = 1, 60 do
      local n, u = debug.getupvalue(v, i)
      if n == nil then break end
      if type(u) == 'string' and targets[u] then hits = hits + 1; add(path .. '^' .. n .. ' = ' .. u) end
      if type(u) == 'table' or type(u) == 'function' then visit(u, path .. '^' .. tostring(n), d + 1) end
    end
  end
end
function walk(t, path, d)
  if seen[t] or d > 10 or hits > 40 or nodes > 300000 then return end
  seen[t] = true
  nodes = nodes + 1
  local cnt = 0
  for k, v in pairs(t) do
    cnt = cnt + 1
    if cnt > 4000 then break end
    if type(v) == 'string' and targets[v] then hits = hits + 1; add(path .. '[' .. tostring(k) .. '] = ' .. v) end
  end
  cnt = 0
  for k, v in pairs(t) do
    cnt = cnt + 1
    if cnt > 4000 then break end
    if type(v) == 'table' or type(v) == 'function' then visit(v, path .. '.' .. tostring(k), d + 1) end
  end
end
for _, n in ipairs({'OPTIONS', 'MobileSettingsHubUtils', 'MOBILE_SETTINGS', 'OPTIONS_DATA', 'SystemSettings', 'LUI'}) do
  walk(rawget(_G, n), n, 0)
end
add('done hits=' .. hits .. ' nodes=' .. nodes)
return table.concat(out, '\n')
