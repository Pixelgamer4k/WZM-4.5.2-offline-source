-- Session-only: the "is unlocked" query (xhash 13d8bd2b211db6cc) exists not only in
-- PROGRESSION (offline_unlocks.lua) but in OPERATOR, OPERATOR_SKIN, LOOT and other
-- per-item tables. Offline each answered false, so the Operators screen showed
-- "No items available" and skins were padlocked. Make every copy answer true.
-- Idempotent; restore with _G.WZM_UNLOCK_EXT.restore().
local T=rawget(_G,'WZM_OPT') if T and T.restore then T.restore() rawset(_G,'WZM_OPT',nil) end
local S=rawget(_G,'WZM_UNLOCK_EXT')
if not S then S={q=0,orig={},done={},byTable={}} rawset(_G,'WZM_UNLOCK_EXT',S) end
S.done=S.done or {}
S.byTable=S.byTable or {}
local added={}
for g,tb in pairs(_G) do
  if type(g)=='string' and g~='PROGRESSION' and g:match('^[A-Z][A-Z_]+$') and type(tb)=='table' and not S.done[g] then
    for k,f in pairs(tb) do
      if type(f)=='function' and tostring(k):find('13d8bd2b211db6cc',1,true) then
        S.orig[#S.orig+1]={tb,k,f}; S.done[g]=true; added[#added+1]=g
        tb[k]=function(...)
          S.q=S.q+1; S.byTable[g]=(S.byTable[g] or 0)+1
          return true
        end
      end
    end
  end
end
S.restore=function() for _,x in ipairs(S.orig) do x[1][x[2]]=x[3] end S.orig={} S.done={} end
local all={} for g in pairs(S.done) do all[#all+1]=g end table.sort(all)
return 'added '..table.concat(added,',')..' | all '..table.concat(all,',')
