local key for k in pairs(Engine) do if tostring(k)=="xhash: #x0eb81a5136c5503e4" then key=k end end
local CMD=rawget(_G,"_WZM_CMD") or "map mp_mgl_nuketown"
if not key then return "no exec key" end
local r={pcall(Engine[key],CMD,0)}
return "exec "..CMD.." -> "..tostring(r[1]).." "..tostring(r[2])
