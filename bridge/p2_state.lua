local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function pc(n,f,...) local r={pcall(f,...)} t(n,tostring(r[1]).." "..tostring(r[2]).." "..tostring(r[3])) end
t("primaryRoot",LUI.primaryRoot); t("rootsN",#LUI.roots)
for k,v in pairs(LUI.roots) do t("root["..tostring(k).."]",tostring(v)) end
local r=LUI.primaryRoot
pc("root.m_eventHandlers",function() return type(r.m_eventHandlers) end)
pc("IsNavigating",MenuNavigator.IsNavigating); pc("IsMenuCreationSafe",MenuNavigator.IsMenuCreationSafe)
pc("State",function() local s=MenuNavigator.GetStateCopy(0) if type(s)~="table" then return s end local a={} for k,v in pairs(s) do a[#a+1]=tostring(k)..":"..tostring(v) end return table.concat(a,",") end)
if type(package)=="table" and package.loaded then local a={} for k in pairs(package.loaded) do local s=tostring(k) if s:lower():find("flow") or s:lower():find("fence") or s:lower():find("menu") then a[#a+1]=s end end t("loaded",table.concat(a,",")) else t("package",type(package)) end
local g={} for k,v in pairs(_G) do local s=tostring(k) if s:lower():find("flow") or s:lower():find("fence") then g[#g+1]=s..":"..type(v) end end t("globals",table.concat(g,","))
t("debug",type(debug))
return table.concat(o,"\n")
