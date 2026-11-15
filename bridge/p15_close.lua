local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local fm=LUI.primaryRoot.flowManager
local names={}
for i,m in ipairs(fm.menuInfoStack) do if m.isPopup then names[#names+1]=m.name end end
for i=#names,1,-1 do
 local ok,e=pcall(function() fm:RequestLeaveMenuByName(names[i]) end)
 t("close"..i,tostring(ok).." "..tostring(e))
end
return table.concat(o,"\n")
