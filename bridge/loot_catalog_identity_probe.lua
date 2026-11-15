local function fn(h)for k,v in pairs(LOOT) do if tostring(k):find(h,1,true) then return v end end end
local fns={ref=fn('3d5d69ba555e016d'),id=fn('c36548909cff94cd'),kind=fn('cca887ac48250918'),name=fn('46b7ac889104ded3'),count=fn('3ddeddd761299c7f')}
local o={}
for _,value in ipairs({11354,'iw9_ar_mike4','iw9_ar_akilo',WEAPON.Knife_iw9}) do
 for name,f in pairs(fns) do local ok,r=pcall(f,value);o[#o+1]=name..'('..tostring(value)..')='..tostring(ok)..':'..type(r)..':'..tostring(r) end
end
return table.concat(o,'\n')
