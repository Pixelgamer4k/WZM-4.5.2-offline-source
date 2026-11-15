local L = rawget(_G, 'WZM_S3') or {}
local C = rawget(_G, 'WZM_S3C') or {}
local c = {}
for k, v in pairs(C) do c[#c + 1] = k .. ' x' .. v end
table.sort(c)
return 'n=' .. #L .. '\n' .. table.concat(L, '\n') .. '\nCOUNTS\n' .. table.concat(c, '\n')
