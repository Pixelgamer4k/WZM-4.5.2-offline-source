local C=LUI.FenceGroup
local W=rawget(_G,"_WZM") or {}
rawset(_G,"_WZM",W)
if W.orig then return "already" end
W.orig=C.Passes; W.n=0
local orig=C.Passes
local function wrap(self,...) W.fg=self; W.n=W.n+1 return orig(self,...) end
C.Passes=wrap
local idx=C.__instance_mt and C.__instance_mt.__index
if type(idx)=="table" and idx~=C then idx.Passes=wrap end
return "wrapped idxSame="..tostring(idx==C)
