local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local FM=LUI.FlowManager
local a={} for k,v in pairs(FM) do a[#a+1]=tostring(k)..":"..type(v) end table.sort(a) t("FM",table.concat(a,","))
local r=LUI.primaryRoot
local function dump(v,d) d=d or 0 if type(v)~="table" then return tostring(v) end if d>=3 then return "{...}" end local b,n={},0 for k,x in pairs(v) do n=n+1 if n>40 then b[#b+1]="..." break end b[#b+1]=tostring(k).."="..dump(x,d+1) end return "{"..table.concat(b,", ").."}" end
for _,n in ipairs{"flowManager","m_flowManager","menuStack","fenceState","m_fences"} do local ok,v=pcall(function() return r[n] end) if ok and v~=nil then t("root."..n,dump(v)) end end
for k,v in pairs(FM) do if type(v)=="table" then t("FM."..tostring(k),dump(v,1)) end end
t("xhashfn",type(xhash)); t("hashfn",type(Engine.XHash)..","..type(Engine.HashString or nil))
return table.concat(o,"\n")
