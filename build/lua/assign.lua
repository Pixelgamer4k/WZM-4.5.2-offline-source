local C = LUI.FenceGroup
local before = C.Frame
local mine = function(self, ...) return before(self, ...) end
local ok, err = pcall(function() C.Frame = mine end)
local stuck = (C.Frame == mine)
local raw = (rawget(C, 'Frame') == mine)
local mt = getmetatable(C)
local W = rawget(_G, '_WZM')
local wk = {} if type(W) == 'table' then for k, v in pairs(W) do wk[#wk+1] = tostring(k) end end
C.Frame = before
return 'assign ok=' .. tostring(ok) .. ' err=' .. tostring(err) .. ' stuck=' .. tostring(stuck) .. ' raw=' .. tostring(raw) .. ' mt=' .. tostring(mt) .. (mt and (' newindex=' .. tostring(mt.__newindex)) or '') .. ' _WZM keys=' .. table.concat(wk, ',')
