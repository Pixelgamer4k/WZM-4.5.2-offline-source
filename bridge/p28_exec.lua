local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function find(e,id,d) if d>12 then return end if tostring(e.id)==id then return e end local c=e:getFirstChild() while c do local r=find(c,id,d+1) if r then return r end c=c:getNextSibling() end end
local W=find(LUI.primaryRoot,"xhash: #x0d6362796dd5f31d1",0)
local ds=W:GetDataSource(); local k,v=next(ds)
local val=v:GetValue(0)
t("type",val._type)
local function h(m) return tostring(m).."\n"..debug.traceback("",2) end
local r={xpcall(val._execute,h,0)}; t("exec",tostring(r[1]).." "..tostring(r[2]))
return table.concat(o,"\n")
