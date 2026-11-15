local o={};local n=0
local function add(s)o[#o+1]=s end
local function walk(e,path,d)
 if d>24 or n>3500 then return end;n=n+1;local p=path..'/'..tostring(e.id);local s;pcall(function()s=e:getText()end)
 if type(s)=='string' and (s:find('Waiting for client',1,true) or s:find('EDIT LOADOUTS',1,true)) then
  add('TEXT '..s..' '..p);local x=e
  for i=0,4 do if x then local v={};for k,a in pairs(x)do if type(a)~='function' then v[#v+1]=tostring(k)..'='..tostring(a) end end;add('P'..i..' '..table.concat(v,','):sub(1,2200));x=x:getParent()end end
 end
 local c=e:getFirstChild();while c do walk(c,p,d+1);c=c:getNextSibling() end
end
pcall(walk,LUI.primaryRoot,'',0)
for _,name in ipairs({'SCENE','DeferredFence','FrontEndScene'}) do local t=rawget(_G,name);for k,v in pairs(t or {})do if type(v)~='function' then add(name..'.'..tostring(k)..'='..tostring(v)) end end end
return table.concat(o,'\n')
