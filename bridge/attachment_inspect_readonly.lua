local out={}
for _,n in ipairs({'dump','format','byte'}) do out[#out+1]='string.'..n..'='..type(string[n]) end
for k,v in pairs(debug or {}) do out[#out+1]='debug.'..tostring(k)..'='..type(v) end
for k,v in pairs(ATTACHMENT or {}) do if tostring(k):find('a8d84a396e3dd99b',1,true) then
 out[#out+1]='fn='..tostring(v)
 if string.dump then local ok,d=pcall(string.dump,v);out[#out+1]='dump='..tostring(ok)..':'..tostring(d and #d);if ok then out[#out+1]=(d:gsub('.',function(c)return string.format('%02x',string.byte(c))end)) end end
end end
return table.concat(out,'\n')
