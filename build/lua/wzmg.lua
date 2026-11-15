local W = rawget(_G, '_WZM')
local k = {}
if type(W) == 'table' then for a, b in pairs(W) do k[#k+1] = tostring(a) .. '=' .. tostring(b):sub(1, 20) end end
return 'type=' .. type(W) .. ' keys: ' .. table.concat(k, ', ') .. ' | C.Frame=' .. tostring(LUI.FenceGroup.Frame)
