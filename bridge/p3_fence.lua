local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function dump(v,d,seen)
 d=d or 0; seen=seen or {}
 if type(v)~="table" then return tostring(v) end
 if seen[v] then return "<seen>" end seen[v]=true
 if d>=4 then return "{...}" end
 local a,n={},0
 for k,x in pairs(v) do n=n+1 if n>30 then a[#a+1]="..." break end a[#a+1]=tostring(k).."="..dump(x,d+1,seen) end
 return "{"..table.concat(a,", ").."}"
end
local s=MenuNavigator.GetStateCopy(0)
t("state",dump(s))
t("NavigationAction",dump(MenuNavigator.NavigationAction)); t("ExecutionState",dump(MenuNavigator.ExecutionState))
local function keys(n,tb) local a={} for k,v in pairs(tb) do a[#a+1]=tostring(k)..":"..type(v) end table.sort(a) t(n,table.concat(a,",")) end
keys("Fences",Fences); keys("FenceGroups",FenceGroups); keys("FenceGroupFallbackMenu",FenceGroupFallbackMenu); 
return table.concat(o,"\n")
