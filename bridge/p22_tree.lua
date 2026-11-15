local o={}
local root=LUI.primaryRoot
local n=0
local mt=getmetatable(root)
local function txt(e) for _,f in ipairs{"getText","GetText","GetCurrentText"} do local fn=e[f] if type(fn)=="function" then local ok,s=pcall(fn,e) if ok and type(s)=="string" then return s end end end end
local function name(e) local ok,i=pcall(function() return e.id end) return tostring(ok and i) end
local hits={}
local all={}
local function walk(e,path,d)
 if d>30 or n>6000 then return end
 n=n+1
 local p=path.."/"..name(e)
 local s=txt(e)
 if s and #s>0 then all[#all+1]=s; if s:upper():find("FINALIZ") or s:upper():find("SEVERAL") or s:upper():find("GAME MODE") then hits[#hits+1]=s.." @ "..p end end
 local c=e:getFirstChild()
 while c do walk(c,p,d+1); c=c:getNextSibling() end
end
local ok,err=pcall(walk,root,"",0)
o[#o+1]="ok="..tostring(ok).." "..tostring(err).." n="..n.." texts="..#all
for _,h in ipairs(hits) do o[#o+1]=h end
o[#o+1]=table.concat(all," | "):sub(1,900)
return table.concat(o,"\n")
