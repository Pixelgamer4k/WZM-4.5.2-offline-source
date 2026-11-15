-- Read-only check of the exact model named in the close traceback.
local d=DataSources and DataSources.alwaysLoaded and DataSources.alwaysLoaded.HUD and DataSources.alwaysLoaded.HUD.hitMarker
local o={}
for _,name in ipairs({'scale','color','material'}) do
 local s=d and d[name]
 o[#o+1]=name..'.source='..type(s)
 if s and s.GetValue then local ok,v=pcall(s.GetValue,s,0);o[#o+1]=name..'.value='..tostring(ok)..':'..tostring(v)..':'..type(v) end
 if s and s.GetModel then local ok,v=pcall(s.GetModel,s,0);o[#o+1]=name..'.model='..tostring(ok)..':'..tostring(v)..':'..type(v) end
end
return table.concat(o,' | ')
