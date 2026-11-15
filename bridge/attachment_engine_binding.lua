local out={}
for k,v in pairs(Engine) do if tostring(k):find('2c03d2e893ca114a',1,true) then out[#out+1]='engine='..tostring(v) end end
out[#out+1]='table='..tostring(Table.IsItemIndexInArray)
for k,v in pairs(WEAPON or {}) do if type(v)~='function' then out[#out+1]='WEAPON.'..tostring(k)..'='..tostring(v) end end
return table.concat(out,'\n')
