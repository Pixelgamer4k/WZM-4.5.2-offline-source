-- Find tables (reachable from _G) that reference option ids or the GRAPHICS tab id.
local out = {}
local function add(s) out[#out + 1] = tostring(s) end
local ids = {}
local n = 0
for k in pairs(OPTIONS_DATA.optionsDataList) do ids[k] = true; n = n + 1 end
local G = OPTIONS.TabIds.GRAPHICS
local seen = {}
local hits = 0
local function walk(t, path, d)
  if seen[t] or d > 6 or hits > 120 then return end
  seen[t] = true
  local idc, gfx, cnt = 0, false, 0
  for k, v in pairs(t) do
    cnt = cnt + 1
    if cnt > 3000 then break end
    if ids[v] then idc = idc + 1 end
    if v == G or k == G then gfx = true end
  end
  if (idc >= 2 or gfx) and t ~= OPTIONS.TabIds then
    hits = hits + 1
    add(path .. ' ids=' .. idc .. ' gfx=' .. tostring(gfx) .. ' size=' .. cnt)
  end
  cnt = 0
  for k, v in pairs(t) do
    cnt = cnt + 1
    if cnt > 3000 then break end
    if type(v) == 'table' and v ~= OPTIONS_DATA.optionsDataList then walk(v, path .. '.' .. tostring(k), d + 1) end
  end
end
walk(_G, '_G', 0)
add('done hits=' .. hits .. ' ids=' .. n)
return table.concat(out, '\n')
