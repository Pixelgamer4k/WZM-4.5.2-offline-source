local function fn(t,h)for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return v end end end
local request=fn(Fences,'5d874d3bfe6fcb3');local query=fn(Fences,'b06c6d08978b8c65')
if not request or not query then return 'missing native fence binding' end
local before=query(0,'WEAPON_DEF')
local ok,r=pcall(request,0,'WEAPON_DEF')
return 'request='..tostring(ok)..':'..tostring(r)..' before='..tostring(before)..' after='..tostring(query(0,'WEAPON_DEF'))
