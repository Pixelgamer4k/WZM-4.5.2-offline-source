local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function dump(v,d)
 d=d or 0
 if type(v)~="table" then return tostring(v) end
 if d>=4 then return "{...}" end
 local a={} for k,x in pairs(v) do a[#a+1]=tostring(k).."="..dump(x,d+1) end
 return "{"..table.concat(a,", ").."}"
end
for k,g in pairs(FenceGroups) do t(tostring(k),dump(g)) end
local d={} for k in pairs(debug) do d[#d+1]=tostring(k) end t("debug",table.concat(d,","))
t("next",type(next)); t("rawget",type(rawget)); t("getmetatable",type(getmetatable))
local g={} for k,v in pairs(_G) do local s=tostring(k) if s:lower():find("fence") or s:lower():find("online") or s:lower():find("network") or s:lower():find("connect") then g[#g+1]=s..":"..type(v) end end table.sort(g) t("globals",table.concat(g,","))
return table.concat(o,"\n")
