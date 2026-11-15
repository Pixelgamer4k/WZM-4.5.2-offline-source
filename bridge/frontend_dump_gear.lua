local command
local function walk(e,d)
 if d>20 then return end
 local s;pcall(function() if e.getText then s=e:getText() end end)
 if type(s)=='string' and s:find('GEAR UP',1,true) then
  for k,v in pairs(e:getParent():GetDataSource() or {}) do
   if tostring(k):find('66655dca2c3e8a12',1,true) then command=v:GetValue(0) end
  end
 end
 local c=e:getFirstChild();while c and not command do walk(c,d+1);c=c:getNextSibling() end
end
walk(LUI.primaryRoot,0)
if not command then return 'gear command absent' end
local o={}
for _,field in ipairs({'_execute','_preExecute'}) do
 local f=command[field]
 if type(f)=='function' then
  o[#o+1]=field
  if debug.getupvalue then for i=1,12 do local n,v=debug.getupvalue(f,i);if not n then break end;o[#o+1]='upvalue '..i..' '..tostring(n)..'='..tostring(v) end end
  local ok,bc=pcall(string.dump,f)
  if ok then local h={};for i=1,#bc do h[i]=string.format('%02x',bc:byte(i)) end;o[#o+1]=field..' hex='..table.concat(h) end
 end
end
return table.concat(o,'\n')
