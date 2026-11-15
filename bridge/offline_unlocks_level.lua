-- Session-only: level-gated items (equipment, perks, streaks, field upgrades) ask
-- PROGRESSION.33568d3533d63f69(controller, itemID) -> false offline (profile level 1).
-- Answer true for every real item id. Restore with _G.WZM_UNLOCK_LVL.restore().
local P=rawget(_G,'PROGRESSION')
local S=rawget(_G,'WZM_UNLOCK_LVL')
if S and S.restore then S.restore() end
S={orig={},q=0};rawset(_G,'WZM_UNLOCK_LVL',S)
for k,f in pairs(P) do
  if type(f)=='function' and tostring(k):find('33568d3533d63f69',1,true) then
    S.orig[#S.orig+1]={k,f}
    P[k]=function(c,id,...) if id~=nil then S.q=S.q+1; return true end return f(c,id,...) end
  end
end
S.restore=function() for _,x in ipairs(S.orig) do P[x[1]]=x[2] end S.orig={} end
return 'level unlock wrapped: '..#S.orig
