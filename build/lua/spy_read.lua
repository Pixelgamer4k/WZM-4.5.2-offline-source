local s = rawget(_G, 'WZM_SPY') or {}
local out = {'calls ' .. #s}
for i = 1, #s do out[#out + 1] = s[i] end
return table.concat(out, '\n')
