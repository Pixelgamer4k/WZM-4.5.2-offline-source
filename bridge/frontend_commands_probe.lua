local o={}
local function emit(s)o[#o+1]=s end
local function dump(t,path,d)
 if type(t)~='table' or d>3 then return end
 for k,v in pairs(t) do
  local p=path..'.'..tostring(k)
  if type(v)=='table' then
   if v._execute then emit(p..' type='..tostring(v._type)) else dump(v,p,d+1) end
  elseif type(v)~='function' then emit(p..'='..tostring(v)) end
 end
end
dump(LUI.Commands.CAC,'CAC',0)
dump(LUI.Commands.Loadout,'Loadout',0)
dump(LUI.Commands.Customization,'Customization',0)
local function walk(e,d)
 if d>20 then return end
 local s;pcall(function() if e.getText then s=e:getText() end end)
 if type(s)=='string' and s:find('GEAR UP',1,true) then
  local ds=e:getParent():GetDataSource()
  for k,v in pairs(ds or {}) do local ok,r=pcall(function() return v:GetValue(0) end)
   emit('gear '..tostring(k)..'='..tostring(ok)..':'..tostring(r))
   if type(r)=='table' then for a,b in pairs(r) do emit(' value.'..tostring(a)..'='..tostring(b)) end end
  end
 end
 local c=e:getFirstChild();while c do walk(c,d+1);c=c:getNextSibling() end
end
pcall(walk,LUI.primaryRoot,0)
return table.concat(o,'\n')
