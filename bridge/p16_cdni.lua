local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function walk(n,tb,d)
 if d>3 then return end
 for k,v in pairs(tb) do
  local nm=n.."."..tostring(k)
  if type(v)=="table" then
   local ok,val=pcall(function() return v.GetValue and v:GetValue(0) end)
   if ok and val~=nil and val~=false or (ok and val==false) then t(nm,val) end
   walk(nm,v,d+1)
  end
 end
end
local c=DataSources and DataSources.alwaysLoaded and DataSources.alwaysLoaded.cdni
t("type",type(c))
if type(c)=="table" then walk("cdni",c,1) end
local a={} for k,v in pairs(Engine) do local s=tostring(k):lower() if s:find("cdn") or s:find("install") or s:find("download") then a[#a+1]=tostring(k) end end t("Engine",table.concat(a,","))
return table.concat(o,"\n")
