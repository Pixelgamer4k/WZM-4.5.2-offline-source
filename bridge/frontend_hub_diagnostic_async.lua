local gear;for k,v in pairs(MobileMainMenuButtons) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then gear=v end end
rawset(_G,'WZM_GEAR_DIAGNOSTIC',{gear=gear,old=gear.fenceName});gear.fenceName=''
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
if not command then ;return 'gear command absent' end
local ok,r=xpcall(function() return LUI.Command.Execute(command,0) end,function(e) return debug.traceback(tostring(e),2) end)

return 'gear command '..tostring(ok)..':'..tostring(r)
