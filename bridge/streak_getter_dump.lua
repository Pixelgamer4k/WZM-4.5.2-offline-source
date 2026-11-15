for k,v in pairs(STREAK) do if tostring(k):find('886546a872fcdaa1',1,true) then
 local d=string.dump(v);return (d:gsub('.',function(c)return string.format('%02x',string.byte(c))end))
end end
return 'not found'
