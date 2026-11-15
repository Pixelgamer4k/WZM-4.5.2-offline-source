local function key(t,hex) for k in pairs(t) do if tostring(k)=="xhash: #x0"..hex then return k end end end
local function fn(t,hex) local k=key(t,hex); return k and t[k] end
local o={}
local names={IsGameHost="6867e2628caa1981",isGameStartRequested="5383a7c990e23c6b",isPrivateMatchHost="26c8959259db6a4f",isPrivatePartyHost="96957722ef74f5d2",isPrivateMatchLobbySetup="ec2dad2d808876f4",isInPrivateParty="f63537242f1d48ff",IsSystemLinkHost="577e4c9387ebf70e",GetMapName="43bb743c01674954"}
local function flags(tag) local a={} for name,h in pairs(names) do local f=fn(Lobby,h); if f then local r={pcall(f,0)}; a[#a+1]=name.."="..tostring(r[2]) end end table.sort(a); o[#o+1]=tag..": "..table.concat(a," ") end
flags("before")
local r={pcall(fn(Lobby,"c98faf05e7dbe274"),0,true)}; o[#o+1]="StartServer "..tostring(r[1]).." "..tostring(r[2])
local e=fn(Engine,"3ee6f69fea944b13"); o[#o+1]="engineFn "..type(e)
if e then local r2={pcall(e)}; o[#o+1]="engine "..tostring(r2[1]).." "..tostring(r2[2]) end
flags("after")
return table.concat(o,"\n")
