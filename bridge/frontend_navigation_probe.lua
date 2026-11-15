local out={}
local function dump(t,name,d)
 if d>3 or #out>160 then return end
 if type(t)~='table' then out[#out+1]=name..'='..tostring(t);return end
 local n=0;for k,v in pairs(t) do n=n+1;if n>45 then break end;dump(v,name..'.'..tostring(k),d+1) end
end
dump(MainMenuMobileUtils.MobilePrimaryNavigationTabsData,'tabs',0)
dump(MainMenuMobileUtils.MobilePrimaryNavigationEnum,'tabEnums',0)
dump(MenuNavigator.GetStateCopy(),'navigator',0)
local n=0
local function walk(e,d)
 if d>22 or n>2500 then return end;n=n+1
 local s;pcall(function() if e.getText then s=e:getText() end end)
 if type(s)=='string' and s:find('GEAR UP',1,true) then
  local p=e
  for i=0,5 do if p then
   local ks={};pcall(function() for k,v in pairs(p) do ks[#ks+1]=tostring(k)..'='..tostring(v) end end)
   out[#out+1]='parent'..i..' '..tostring(p.id)..' '..table.concat(ks,','):sub(1,3500)
   pcall(function() if p.GetDataSource then dump(p:GetDataSource(),'parent'..i..'.ds',0) end end)
   p=p:getParent()
  end end
 end
 local c=e:getFirstChild();while c do walk(c,d+1);c=c:getNextSibling() end
end
pcall(walk,LUI.primaryRoot,0)
return table.concat(out,'\n')
