local f;for k,v in pairs(Engine) do if tostring(k):find('2c03d2e893ca114a',1,true) then f=v end end
local out={}
for _,r in ipairs({'iw9_ar_mike4','iw9_ar_mike4_mp','none'}) do
 local ok,a=pcall(f,r);out[#out+1]=r..'='..tostring(ok)..':'..tostring(a)
 if ok and type(a)=='table' then local n=0;for k,v in pairs(a) do n=n+1;if n<6 then out[#out+1]=tostring(k)..'='..tostring(v) end end;out[#out+1]='count='..n end
end
return table.concat(out,'\n')
