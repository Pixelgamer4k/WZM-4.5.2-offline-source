local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local m=DataSources.alwaysLoaded.cdni.areAllMapsInstalled
local ok,e=pcall(function() m:SetValue(0,true) end); t("mapsSet",tostring(ok).." "..tostring(e)); t("now",m:GetValue(0))
local F=FrontEndScene
t("cc1",tostring(F.ClientCharacters[1])); t("cc0",tostring(F.ClientCharacters[0]))
local c=F.ClientCharacters[1] or F.ClientCharacters[0]
if type(c)=="table" then local a={} for k,v in pairs(c) do a[#a+1]=tostring(k).."="..tostring(v) end t("c",table.concat(a,",")) end
local a={} for k,v in pairs(Engine) do if tostring(k):find("^xhash")==nil then a[#a+1]=tostring(k) end end table.sort(a); t("EnginePlain",table.concat(a,","):sub(1,700))
return table.concat(o,"\n")
