local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local a={} for k,v in pairs(LUI) do local s=tostring(k) if s:lower():find("fence") then a[#a+1]=s..":"..type(v) end end t("LUIfence",table.concat(a,","))
local function keys(n,tb) local b={} for k,v in pairs(tb) do b[#b+1]=tostring(k)..":"..type(v) end table.sort(b) t(n,table.concat(b,",")) end
for k,v in pairs(LUI) do if tostring(k):lower():find("fence") and type(v)=="table" then keys(tostring(k),v) end end
local gs={} for k,v in pairs(_G) do if type(v)=="table" and rawget(v,"Passes")~=nil then gs[#gs+1]=tostring(k) end end t("hasPasses",table.concat(gs,","))
return table.concat(o,"\n")
