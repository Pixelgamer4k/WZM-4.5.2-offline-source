local o={}
for k,v in pairs(LUI.Commands.InGame or {}) do
 if tostring(k):lower():find('menu') or tostring(k):lower():find('leave') or tostring(k):lower():find('end') or tostring(k):lower():find('quit') then o[#o+1]=tostring(k)..'='..type(v) end
end
return table.concat(o,'\n')
