local W=rawget(_G,"_WZM"); local g=W.fg
local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
for i,f in ipairs(g._fences) do
 local nok,n=pcall(f.Name,f); local sok,s=pcall(f.State,f)
 t(i,tostring(n).." state="..tostring(s))
end
local f=g._fences[9]
local a={} for k,v in pairs(f) do a[#a+1]=tostring(k)..":"..type(v).."="..(type(v)=="table" and "t" or tostring(v)) end table.sort(a) t("f9",table.concat(a,","))
local mt=getmetatable(f); t("f9mt",tostring(mt))
local a2={} if mt and type(mt.__index)=="table" then for k,v in pairs(mt.__index) do a2[#a2+1]=tostring(k)..":"..type(v) end end table.sort(a2) t("f9cls",table.concat(a2,","))
return table.concat(o,"\n")
