local C=LUI.FenceGroup
local W=rawget(_G,"_WZM")
local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
if W and W.orig then C.Passes=W.orig local idx=C.__instance_mt.__index if type(idx)=="table" then idx.Passes=W.orig end W.orig=nil end
t("calls",W and W.n)
local g=W and W.fg
if not g then return table.concat(o,"\n").."\nno group captured" end
local function sv(v) if type(v)=="table" then local b,n={},0 for k,x in pairs(v) do n=n+1 if n>30 then b[#b+1]="..." break end b[#b+1]=tostring(k).."="..tostring(x) end return "{"..table.concat(b,",").."}" end return tostring(v) end
for k,v in pairs(g) do t("g."..tostring(k),sv(v)) end
t("STATE",sv(C.STATE)); t("FSTATE",sv(LUI.Fence.STATE))
return table.concat(o,"\n")
