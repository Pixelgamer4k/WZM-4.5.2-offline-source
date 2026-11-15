local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function find(e,id,d) if d>12 then return end if tostring(e.id)==id then return e end local c=e:getFirstChild() while c do local r=find(c,id,d+1) if r then return r end c=c:getNextSibling() end end
local W=find(LUI.primaryRoot,"xhash: #x0d6362796dd5f31d1",0)
t("W",W)
local ok,ds=pcall(function() return W:GetDataSource() end); t("ds",tostring(ok).." "..tostring(ds))
local function walk(n,x,d)
 if type(x)~="table" or d>3 then return end
 for k,v in pairs(x) do
  if type(v)=="table" then
   local ok2,val=pcall(function() return v:GetValue(0) end)
   if ok2 then t(n.."."..tostring(k),val) end
   walk(n.."."..tostring(k),v,d+1)
  elseif type(v)~="function" and tostring(k)~="_defaultValue" then t(n.."."..tostring(k),v) end
 end
end
if type(ds)=="table" then walk("ds",ds,1) end
local f,err=loadstring and loadstring("return #xc6cf3eff596238ef"); t("lit",tostring(f).." "..tostring(err))
if #o>60 then for i=#o,61,-1 do o[i]=nil end end
return table.concat(o,"\n")
