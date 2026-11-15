local o={}
local function add(s) o[#o+1]=s end
local function dump(t,label,depth)
 if type(t)~='table' then add(label..'='..tostring(t));return end
 local a={};for k,v in pairs(t) do a[#a+1]=tostring(k)..'='..tostring(v) end;table.sort(a);add(label..' '..table.concat(a,','):sub(1,2400))
end
for _,n in ipairs({'CoD','PROGRESSION','LOOT','WEAPON','CLIENTCHARACTER','SCENE','MainMenuMobileUtils'}) do
 local t=rawget(_G,n)
 if n=='CoD' then dump(t.StatsGroup,'StatsGroup')
 elseif n=='LOOT' then dump(t.itemTypes,'LOOT.itemTypes')
 elseif n=='PROGRESSION' then dump(t,n)
 elseif n=='WEAPON' then dump(t.REF,'WEAPON.REF')
 elseif n=='MainMenuMobileUtils' then dump(t,n)
 else dump(t,n) end
end
local n=0
local function walk(e,d)
 if d>22 or n>2500 then return end;n=n+1
 local s;pcall(function() if e.getText then s=e:getText() end end)
 if type(s)=='string' and s:find('GEAR UP',1,true) then
  local p=e
  for i=0,4 do if p then dump(p,'gear-parent'..i);p=p:getParent() end end
 end
 local c=e:getFirstChild();while c do walk(c,d+1);c=c:getNextSibling() end
end
pcall(walk,LUI.primaryRoot,0)
local ok,s=pcall(MenuNavigator.GetStateCopy);add('navigator '..tostring(ok));if ok then dump(s,'state') end
return table.concat(o,'\n')
