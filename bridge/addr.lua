local function key(t,hex) for k in pairs(t) do if tostring(k)=="xhash: #x0"..hex then return k end end end
local o={}
for _,p in ipairs{{"StartServer","c98faf05e7dbe274"},{"AddBots","f45add213e99c39e"}} do local k=key(Lobby,p[2]); o[#o+1]=p[1].." "..tostring(Lobby[k]) end
return table.concat(o,";")
