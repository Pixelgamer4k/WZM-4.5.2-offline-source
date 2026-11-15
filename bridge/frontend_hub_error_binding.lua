local out={}
for n,t in pairs(_G) do if type(t)=='table' then
 for k,v in pairs(t) do if tostring(k):find('a8d84a396e3dd99b',1,true) then
 out[#out+1]=tostring(n)..'.'..tostring(k)..' '..tostring(v)
 end end
end end
return table.concat(out,'\n')
