local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local mt = getmetatable(fg)
local cls = mt and mt.__index
local C = LUI.FenceGroup
return 'cls==C ' .. tostring(cls == C) .. ' | cls.Frame==C.Frame ' .. tostring(cls and cls.Frame == C.Frame) ..
  ' | rawFrame ' .. tostring(rawget(cls or {}, 'Frame') ~= nil) .. ' | cls=' .. tostring(cls) .. ' C=' .. tostring(C) ..
  ' | fg.Frame==C.Frame ' .. tostring(fg.Frame == C.Frame) .. ' rawget(fg,Frame)=' .. tostring(rawget(fg, 'Frame'))
