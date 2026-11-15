local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local fm=LUI.primaryRoot.flowManager
for i,m in ipairs(fm.menuInfoStack) do
 local a={} for k,v in pairs(m) do if type(v)~="table" and type(v)~="userdata" and type(v)~="function" then a[#a+1]=tostring(k)..":"..tostring(v) else a[#a+1]=tostring(k)..":"..type(v) end end
 table.sort(a); t("m"..i,table.concat(a,","))
end
pcall(function() local F=LUI.FenceStatusLayer; t("statusActive",tostring(F.IsAllowedActive and F.IsAllowedActive())) end)
return table.concat(o,"\n")
