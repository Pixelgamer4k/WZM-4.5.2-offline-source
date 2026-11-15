local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local function keys(n,tb) if type(tb)~="table" then t(n,type(tb)) return end local b={} for k,v in pairs(tb) do b[#b+1]=tostring(k)..":"..type(v) end table.sort(b) t(n,table.concat(b,",")) end
keys("FrontEndScene",rawget(_G,"FrontEndScene")); keys("ClientCharacters",rawget(_G,"ClientCharacters")); keys("ClientCharacter",rawget(_G,"ClientCharacter"))
return table.concat(o,"\n")
