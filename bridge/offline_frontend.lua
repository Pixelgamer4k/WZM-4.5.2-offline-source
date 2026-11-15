-- Session-local offline progression queries. Original functions remain restorable.
-- This does not populate catalog assets or persist an online/account inventory.
local S=rawget(_G,'WZM_OFFLINE_FRONTEND')
if not S then S={enabled=true,originals={},queries=0,changed=0,refs={}};rawset(_G,'WZM_OFFLINE_FRONTEND',S) end
local function find(t,h)
 for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return k,v end end
end
local P=rawget(_G,'PROGRESSION');local L=rawget(_G,'LOOT')
if type(P)~='table' or type(L)~='table' or not L.itemTypes then return 'frontend progression module not ready' end
local key,original=find(P,'13d8bd2b211db6cc')
if not key or type(original)~='function' then return 'frontend unlock query not found' end
if not S.originals.progression then
 S.originals.progression={table=P,key=key,fn=original}
 P[key]=function(controller,itemType,ref,...)
  if S.enabled and (itemType==L.itemTypes.WEAPON or itemType==L.itemTypes.ATTACHMENT) and ref~=nil and ref~='' and ref~='none' then
   S.queries=S.queries+1
   if #S.refs<40 then S.refs[#S.refs+1]=tostring(ref) end
   return true
  end
  return original(controller,itemType,ref,...)
 end
end
S.restore=function()
 local old=S.originals.progression
 if old then old.table[old.key]=old.fn end
 S.originals={};S.enabled=false
end
return 'offline weapon/attachment progression installed; queries='..S.queries
