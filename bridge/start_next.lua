-- Run StartServer on the next natural navigator frame, outside any Frida hook.
local function key(t,hex) for k in pairs(t) do if tostring(k)=="xhash: #x0"..hex then return k end end end
local go=Lobby[key(Lobby,"c98faf05e7dbe274")]
local frame=MenuNavigator.Frame
MenuNavigator.Frame=function(...)
 MenuNavigator.Frame=frame
 pcall(go,0,true)
 return frame(...)
end
return "scheduled"
