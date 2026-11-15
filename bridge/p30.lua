local o={}
local function keys(n,tb) if type(tb)~="table" then o[#o+1]=n.."="..type(tb) return end local b,c={},0 for k,v in pairs(tb) do local s=tostring(k) c=c+1 if not s:find("^xhash") then b[#b+1]=s..":"..type(v) end end table.sort(b) o[#o+1]=n.." n="..c.." "..table.concat(b,","):sub(1,420) end
for _,n in ipairs{"Lobby","MP_COMMON","Game","MatchRules","Dvar","MLG","Social","SOCIAL","Playlist","PLAYLIST","Party","Tutorial","FTUE","Onboarding"} do keys(n,rawget(_G,n)) end
return table.concat(o,"\n")
