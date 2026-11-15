local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local function find(t,h) for k,v in pairs(t or {}) do if tostring(k):find(h,1,true) then return k,v end end end

add('PROGRESSION',type(rawget(_G,'PROGRESSION')))
add('LOOT',type(rawget(_G,'LOOT')))
add('LOADOUT',type(rawget(_G,'LOADOUT')))
add('WEAPON',type(rawget(_G,'WEAPON')))
add('OPERATOR',type(rawget(_G,'OPERATOR')))
add('PLAYER_DATA',type(rawget(_G,'PLAYER_DATA')))
add('GUNSMITH',type(rawget(_G,'GUNSMITH')))
add('Fences',type(rawget(_G,'Fences')))
add('WZM_OFFLINE_FRONTEND',type(rawget(_G,'WZM_OFFLINE_FRONTEND')))
add('WZM_FT',type(rawget(_G,'WZM_FT')))

local L=rawget(_G,'LOOT')
if type(L)=='table' and type(L.itemTypes)=='table' then
  local t={}
  for k,v in pairs(L.itemTypes) do t[#t+1]=tostring(k)..':'..tostring(v) end
  table.sort(t)
  add('itemTypes',table.concat(t,','))
elseif type(L)=='table' then
  local t={} for k in pairs(L) do t[#t+1]=tostring(k) end table.sort(t)
  add('LOOT_keys',table.concat(t,','):sub(1,400))
end

local P=rawget(_G,'PROGRESSION')
if type(P)=='table' then
  local k,v=find(P,'13d8bd2b211db6cc')
  add('prog_unlock_key',tostring(k))
  add('prog_unlock_type',type(v))
  local c=0 for _ in pairs(P) do c=c+1 end
  add('prog_entries',c)
end

local F=rawget(_G,'Fences')
if type(F)=='table' then
  local qk,q=find(F,'b06c6d08978b8c65'); local rk,r=find(F,'5d874d3bfe6fcb3')
  add('fence_query',type(q)); add('fence_request',type(r))
  if type(q)=='function' then
    for _,n in ipairs({'WEAPON_DEF','LOADOUT','OPERATOR','CLIENT_CONNECT','WEAPON_LIST','CUSTOMIZATION'}) do
      local ok,res=pcall(q,0,n)
      add('fence_'..n, tostring(ok)..':'..tostring(res))
    end
  end
end

local W=rawget(_G,'WEAPON')
if type(W)=='table' then
  local t={} for k in pairs(W) do t[#t+1]=tostring(k) end table.sort(t)
  add('WEAPON_keys',table.concat(t,','):sub(1,500))
end
return table.concat(out,'\n')
