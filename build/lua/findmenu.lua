local out = {}
local function add(s) out[#out+1] = tostring(s) end
add('io=' .. tostring(rawget(_G,'io')) .. ' os=' .. tostring(rawget(_G,'os')) .. ' xpcall=' .. tostring(rawget(_G,'xpcall')) .. ' dbg=' .. tostring(rawget(_G,'debug')))
local want = {['xhash: #x0401dbf6dbd8347b8']='settings', ['xhash: #x07d5608f97ebabbe4']='graphics', ['xhash: #x040a9dff2cbd1b621']='root'}
local seen = {}
local function scan(t, path, d)
  if d > 3 or seen[t] then return end
  seen[t] = true
  for k, v in pairs(t) do
    local ks = tostring(k)
    if want[ks] then add(want[ks] .. ' key in ' .. path .. ' -> ' .. tostring(v)) end
    if type(v) == 'table' and type(k) ~= 'number' then scan(v, path .. '.' .. ks:sub(1,30), d + 1) end
  end
end
scan(LUI, 'LUI', 0)
scan(rawget(_G,'MenuBuilder') or {}, 'MenuBuilder', 0)
local dbg = rawget(_G,'debug')
if dbg then local ks = {} for k in pairs(dbg) do ks[#ks+1]=tostring(k) end add('debug: '..table.concat(ks,',')) end
return table.concat(out, '\n')
