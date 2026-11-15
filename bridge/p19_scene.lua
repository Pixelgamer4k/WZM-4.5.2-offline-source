local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local F=FrontEndScene
t("CurrentScene",F.CurrentScene); t("Max",F.MaxClientCharacters); t("MaxMain",F.MaxClientCharactersMPMainMenu)
local n=0 for k,v in pairs(F.RequestedSceneStack) do n=n+1 t("stack "..tostring(k),tostring(v)) end t("stackN",n)
for k,v in pairs(F) do if type(v)=="string" or type(v)=="number" then t(tostring(k),v) end end
local a=0 for k,v in pairs(F.ClientCharacters) do a=a+1 end t("ccN",a)
return table.concat(o,"\n")
