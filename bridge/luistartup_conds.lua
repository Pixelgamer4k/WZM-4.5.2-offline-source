-- Read-only: find and call the checks LUIStartup branches on (proto 8 of bytecode_00b846f5).
-- Keys are xhashes printed as lo..hi hex; match on that substring.
local want={
 {"Engine","112586a3f4fb490e","K7"},{"Game","a55fdde5204b925f","K15"},{"Engine","09258f49f515f97b","K18"},
 {"CONDITIONS","f0175efa6a059582","K20"},{"CONDITIONS","1c7cf5fa83797f47","K21"},
 {"CONDITIONS","65b2cac5b9de3065","K23"},{"Engine","a5339ef52227398f","K24"},
 {"Engine","084287be93239e99","K28"},{"CONDITIONS","2234a19de5f09e17","K33"}}
local out={}
for _,w in ipairs(want) do
 local t=_G[w[1]];local f,key
 if type(t)=="table" then for k,v in pairs(t) do if tostring(k):find(w[2],1,true) then f=v key=k end end end
 if not f then out[#out+1]=w[3].."=missing"
 else
  local ok,r=pcall(f)
  out[#out+1]=w[3].."="..tostring(r).."("..tostring(ok)..","..tostring(f)..")"
 end
end
return table.concat(out," ")
