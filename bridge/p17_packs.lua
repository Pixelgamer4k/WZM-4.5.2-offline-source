local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local c=DataSources.alwaysLoaded.cdni
local p=c.pack
local a={} for k,v in pairs(p) do a[#a+1]=tostring(k)..":"..type(v) end t("packkeys",table.concat(a,","))
local mt=getmetatable(p); if mt and type(mt.__index)=="table" then local b={} for k,v in pairs(mt.__index) do b[#b+1]=tostring(k) end t("packmt",table.concat(b,",")) end
for i=0,12 do
 local ok,e=pcall(function() return p:GetDataSourceAtIndex(i,0) end)
 if ok and type(e)=="table" then
  local f={} for k,v in pairs(e) do if type(v)=="table" then local o2,val=pcall(function() return v:GetValue(0) end) if o2 then f[#f+1]=tostring(k).."="..tostring(val) end end end
  table.sort(f); t("p"..i,table.concat(f,","))
 else t("p"..i,tostring(ok).." "..tostring(e)) end
end
return table.concat(o,"\n")
