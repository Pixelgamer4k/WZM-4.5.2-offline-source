local SP = rawget(_G, 'WZM_SKINSPY')
if not SP then return 'spy gone (UI reset)' end
local t = {}
for k, v in pairs(SP.counts) do t[#t+1] = k .. '=' .. v end
table.sort(t)
return #t .. ' fns called: ' .. table.concat(t, ' ')
