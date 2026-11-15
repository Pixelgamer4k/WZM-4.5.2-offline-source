local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function find(e,id,d) if d>12 then return end if tostring(e.id)==id then return e end local c=e:getFirstChild() while c do local r=find(c,id,d+1) if r then return r end c=c:getNextSibling() end end
local W=find(LUI.primaryRoot,"xhash: #x0d6362796dd5f31d1",0)
local ds=W:GetDataSource()
for k,v in pairs(ds) do
 local val=v:GetValue(0)
 local function dump(x,n,d) if type(x)~="table" then t(n,x) return end if d>3 then t(n,"{...}") return end for a,b in pairs(x) do dump(b,n.."."..tostring(a),d+1) end end
 dump(val,"val",0)
 t("func",tostring(v._getFunc or v._func or v._computeFn))
 for a,b in pairs(v) do if type(b)=="function" then t("fn "..tostring(a),b) end end
 local mt=getmetatable(v); if mt then local ks={} local ix=mt.__index if type(ix)=="table" then for a in pairs(ix) do ks[#ks+1]=tostring(a) end end t("mt",table.concat(ks,","):sub(1,300)) end
 t("input1",tostring(v._inputDataSources and v._inputDataSources[1]))
end
if #o>50 then for i=#o,51,-1 do o[i]=nil end end
return table.concat(o,"\n")
