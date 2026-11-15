local out={}
local function f(t,h)for k,v in pairs(t) do if tostring(k):find(h,1,true) then return k,v end end end
local k,ready=f(Engine,'d603a26f08ab3858');out[#out+1]='readyfn='..tostring(ready)
local _,getter=f(STREAK,'886546a872fcdaa1')
for _,i in ipairs({0,1}) do local ok,r=pcall(ready,i);out[#out+1]='ready'..i..'='..tostring(ok)..':'..tostring(r);local o,a=pcall(getter,i);out[#out+1]='streak'..i..'='..tostring(o)..':'..tostring(a) end
return table.concat(out,'\n')
