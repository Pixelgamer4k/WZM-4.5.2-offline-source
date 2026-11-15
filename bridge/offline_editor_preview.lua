-- Session-only: defer optional scene playback while its native client is unavailable.
-- Leaves readiness and weapon data untouched; connected sessions use original playback.
local S=rawget(_G,'WZM_EDITOR_PREVIEW')
if not S then S={originals={},events={}};rawset(_G,'WZM_EDITOR_PREVIEW',S) end
local function find(t,h)for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return k,v end end end
local _,query=find(Fences,'b06c6d08978b8c65')
if not query then return 'missing fence query' end
for _,hash in ipairs({'a5e8570db713b763','663ef3e5f5364452'}) do
 local k,f=find(SCENE,hash)
 if k and type(f)=='function' and not S.originals[k] then
  S.originals[k]=f
  SCENE[k]=function(...)
   if query(0,'CLIENT_CONNECT')~=4 then
    S.events[#S.events+1]='defer '..hash..' '..debug.traceback('',2)
    return
   end
   return f(...)
  end
 end
end
local k,r=find(Fences,'5d874d3bfe6fcb3')
if k and not S.request then
 S.request={key=k,fn=r}
 Fences[k]=function(c,n,...)
  if n=='CLIENT_CONNECT' then S.events[#S.events+1]='CLIENT_CONNECT requested '..debug.traceback('',2) end
  return r(c,n,...)
 end
end
S.restore=function()
 for k,f in pairs(S.originals) do SCENE[k]=f end
 if S.request then Fences[S.request.key]=S.request.fn end
 rawset(_G,'WZM_EDITOR_PREVIEW',nil)
end
return 'preview deferral installed; events='..#S.events
