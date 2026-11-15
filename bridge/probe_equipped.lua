-- Read the in-match equipped weapon(s) and my own entity, to learn how the
-- engine names the current weapon while the loadout DDL is empty.
local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local E=rawget(_G,'Engine')
add('Engine',type(E))
-- find player entities / client info
local cands={'MP','Player','CL','Client','ENTITY','ACTOR','CG','BG'}
for _,n in ipairs(cands) do
  local t=rawget(_G,n)
  if t~=nil then add('G_'..n,type(t)) end
end
local C=rawget(_G,'CG')
if type(C)=='table' then
  local k={} for kk,vv in pairs(C) do if type(vv)=='function' or type(vv)=='table' then k[#k+1]=tostring(kk) end end
  table.sort(k) add('CG_keys',table.concat(k,','):sub(1,400))
end
local EG=rawget(_G,'E_GAME')
add('E_GAME',type(EG))
-- common engine accessors for the local player's weapon
local probes={
  {'GetLocalClientNum',function() return Engine:GetLocalClientNum() end},
  {'GetWeaponName',function() return Engine:GetWeaponName(0) end},
}
for _,p in ipairs(probes) do
  local ok,res=pcall(p[2])
  add(p[1],tostring(ok)..':'..tostring(res):sub(1,60))
end
return table.concat(out,'\n'):sub(1,1200)
