local o={}
local function t(k,v) o[#o+1]=tostring(k).."="..tostring(v) end
local W=rawget(_G,"_WZM"); t("grid",W and W.grid)
local G=rawget(_G,"GRID_AND_LIST"); t("G",G); t("gt",type(G))
local mt=getmetatable(G); t("mt",mt); if type(mt)=="table" then local a={} for k,v in pairs(mt) do a[#a+1]=tostring(k)..":"..type(v) end t("mtk",table.concat(a,",")) end
local n=0 for k in pairs(G) do n=n+1 end t("n",n)
return table.concat(o,"\n")
