-- Session-only: report the CLIENT_CONNECT native fence as complete (4) for the offline frontend.
-- Gear Up / loadouts wait on it; offline the frontend local client never reaches it (stays 2/8).
local function fn(t,h) for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return k,v end end end
local S=rawget(_G,'WZM_CLIENT_FENCE')
if not S then S={};rawset(_G,'WZM_CLIENT_FENCE',S) end
if not S.orig then
 local k,q=fn(Fences,'b06c6d08978b8c65')
 if not q then return 'fence query missing' end
 S.key=k;S.orig=q
 Fences[k]=function(c,name,...) if name=='CLIENT_CONNECT' then return 4 end return S.orig(c,name,...) end
end
return 'CLIENT_CONNECT now '..tostring(Fences[S.key](0,'CLIENT_CONNECT'))..' (orig '..tostring(S.orig(0,'CLIENT_CONNECT'))..')'
