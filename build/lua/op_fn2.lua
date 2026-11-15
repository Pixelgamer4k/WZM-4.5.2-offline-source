local PD = rawget(_G,'PLAYER_DATA'); local core
for k,v in pairs(PD) do if tostring(k):find('08b73907b55c4d71',1,true) then core=v end end
local cs = core(0, CoD.StatsGroup.WZRankedLoadouts).customizationSetup
local slot = cs.operators[1]; local keep = slot:get()
slot:set('#x420b2417c10010917'); local opX = slot:get(); slot:set(keep)
local function fk(t, h) for k, v in pairs(t) do if tostring(k) == 'xhash: #x' .. h then return v end end end
local out = {'opX=' .. tostring(opX)}
local function desc(v, d)
  if type(v) ~= 'table' or d > 1 then return type(v) .. ':' .. tostring(v):sub(1, 50) end
  local p, n = {}, 0
  for k, x in pairs(v) do n = n + 1; if n <= 6 then p[#p+1] = tostring(k):sub(1,22) .. '=' .. desc(x, d + 1) end end
  return '{' .. n .. ': ' .. table.concat(p, ', ') .. '}'
end
local calls = {
  {'03e7bc6fe46c7c689', {opX}}, {'072145c734039267f', {opX}}, {'08155bd07932c396b', {opX}}, {'020f2c2c6c1e5c931', {opX}},
  {'09ae1e225e2dd2df4', {opX}}, {'0b921894f90835216', {opX}}, {'08d7dd2b232d20157', {0, opX}}, {'045c02fc691cf35d6', {0, opX, 8}},
  {'0e82d938853e2b789', {opX}}, {'059bcc8eba85c9677', {opX}}, {'082da4e255c0b9eda', {opX}}, {'0a171d7df41fa6166', {opX}},
  {'03ef1ec1021f0e511', {opX}}, {'0bfb1f7262c235186', {opX}}, {'0f06e6070f68f0b0d', {opX}}, {'0de3bd6e0feaf33b6', {opX}}, {'0963f718b747682c6', {opX}},
}
for _, c in ipairs(calls) do
  local f = fk(OPERATOR, c[1])
  if f then local r = {pcall(f, unpack(c[2]))}; out[#out+1] = c[1] .. ' -> ' .. tostring(r[1]) .. ' ' .. desc(r[2], 0):sub(1, 300) .. (r[3] ~= nil and (' | ' .. desc(r[3], 0):sub(1,100)) or '') end
end
return table.concat(out, '\n')
