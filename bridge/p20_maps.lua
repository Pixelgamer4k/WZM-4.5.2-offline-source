local m=DataSources.alwaysLoaded.cdni.areAllMapsInstalled
local ok,e=pcall(function() m:SetValue(0,true) end)
return "set "..tostring(ok).." "..tostring(e).." now="..tostring(m:GetValue(0))
