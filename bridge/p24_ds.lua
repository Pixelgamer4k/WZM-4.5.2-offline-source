local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function get(tb,name) for k,v in pairs(tb) do if tostring(k)==name then return v end end end
local D=_DataSources
local a=get(D,"xhash: #x0f71428806887f67d"); t("a",type(a))
local b=a and get(a,"xhash: #x01ccae3b6ef72f533"); t("b",type(b))
local c=b and get(b,"xhash: #x0c6cf3eff596238ef"); t("c",type(c))
local function walk(n,x,d)
 if type(x)~="table" or d>4 then return end
 for k,v in pairs(x) do
  if type(v)=="table" then
   local ok,val=pcall(function() return v:GetValue(0) end)
   if ok then t(n.."."..tostring(k),val) end
   walk(n.."."..tostring(k),v,d+1)
  elseif type(v)~="function" then t(n.."."..tostring(k),v) end
 end
end
walk("b",b,1)
if #o>70 then for i=#o,71,-1 do o[i]=nil end end
return table.concat(o,"\n")
