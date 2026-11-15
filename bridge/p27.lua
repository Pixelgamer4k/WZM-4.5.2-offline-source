local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function find(e,id,d) if d>12 then return end if tostring(e.id)==id then return e end local c=e:getFirstChild() while c do local r=find(c,id,d+1) if r then return r end c=c:getNextSibling() end end
local W=find(LUI.primaryRoot,"xhash: #x0d6362796dd5f31d1",0)
local ds=W:GetDataSource()
local k,v=next(ds)
local i=v._inputDataSources[1]
t("val",i:GetValue(0))
for a,b in pairs(i) do if a=="_modelPath" then for x,y in pairs(b) do t("path"..tostring(x),y) end else t(a,type(b)=="function" and "fn" or tostring(b)) end end
rawset(_G,"_WZMI",i)
return table.concat(o,"\n")
