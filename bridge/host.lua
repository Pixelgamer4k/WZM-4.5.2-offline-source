local key for k in pairs(Engine) do if tostring(k)=="xhash: #x0eb81a5136c5503e4" then key=k end end
local o={}
for _,c in ipairs{"xstartprivateparty","xsetupprivatematchparty","xupdatepartystate"} do
 local r={pcall(Engine[key],c,0)}; o[#o+1]=c.." "..tostring(r[1]).." "..tostring(r[2])
end
return table.concat(o," | ")
