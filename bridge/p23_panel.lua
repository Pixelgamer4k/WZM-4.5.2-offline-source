local o={}
local function t(s) o[#o+1]=s end
local function find(e,id,d) if d>12 then return end if tostring(e.id)==id then return e end local c=e:getFirstChild() while c do local r=find(c,id,d+1) if r then return r end c=c:getNextSibling() end end
local P=find(LUI.primaryRoot,"xhash: #x08a359ba88f821865",0)
t("panel "..tostring(P))
local function texts(e,a,d) local ok,s=pcall(function() return e.getText and e:getText() end) if ok and type(s)=="string" and #s>0 then a[#a+1]=s end if d<8 then local c=e:getFirstChild() while c do texts(c,a,d+1); c=c:getNextSibling() end end return a end
local c=P:getFirstChild()
while c do
 local vis="?"; pcall(function() vis=tostring(c.IsVisible and c:IsVisible()) end)
 local keys={} for k,v in pairs(c) do if type(v)=="function" then keys[#keys+1]=tostring(k) end end
 t(tostring(c.id).." vis="..vis.." texts="..table.concat(texts(c,{},0)," ; "):sub(1,120).." fns="..table.concat(keys,","):sub(1,160))
 c=c:getNextSibling()
end
local keys={} for k,v in pairs(P) do keys[#keys+1]=tostring(k)..":"..type(v) end t("panelfields "..table.concat(keys,","):sub(1,500))
return table.concat(o,"\n")
