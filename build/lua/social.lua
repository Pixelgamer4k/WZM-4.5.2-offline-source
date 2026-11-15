local S = rawget(_G, 'SOCIAL')
local function fk(t, h) for k, v in pairs(t) do if tostring(k) == 'xhash: #x' .. h then return v end end end
local f1 = fk(S, '0166b1673577a0458') or fk(S, '166b1673577a0458')
local f2 = fk(S, '0efbef835d8e016b6') or fk(S, 'efbef835d8e016b6')
local out = {'f1=' .. tostring(f1) .. ' f2=' .. tostring(f2)}
local keys = {} for k in pairs(S) do local s = tostring(k); if s:find('166b1673') or s:find('efbef835') then keys[#keys+1] = s end end
out[#out+1] = 'keys ' .. table.concat(keys, ',')
if f1 then
  local r = {pcall(f1, 0)}
  out[#out+1] = 'f1(0) -> ' .. tostring(r[1]) .. ' ' .. tostring(r[2]) .. ' ' .. tostring(r[3])
  if r[1] and r[2] then local ok, v = pcall(function() return r[2]:GetValue(0) end); out[#out+1] = '  GetValue(0)=' .. tostring(ok) .. ' ' .. tostring(v) end
end
if f2 then local r = {pcall(f2, 0, true)}; out[#out+1] = 'f2(0,true) -> ' .. tostring(r[1]) .. ' ' .. tostring(r[2]) end
return table.concat(out, '\n')
