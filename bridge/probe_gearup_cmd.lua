local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end

local S=rawget(_G,'WZM_FENCE')
if S then
  local t={} for n,c in pairs(S.seen or {}) do t[#t+1]=tostring(n)..':'..tostring(c) end table.sort(t)
  add('fence_seen',table.concat(t,','))
  add('fence_hits',S.hits)
end
local U=rawget(_G,'WZM_UNLOCK')
if U then
  add('unlock_queries',U.queries)
  local t={} for n,c in pairs(U.byType or {}) do t[#t+1]=tostring(n)..':'..tostring(c) end table.sort(t)
  add('unlock_bytype',table.concat(t,','))
  add('unlock_last',U.last)
end

local M=rawget(_G,'MobileMainMenuButtons')
add('MobileMainMenuButtons',type(M))
if type(M)=='table' then
  local hit
  for k,v in pairs(M) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then hit=k end end
  add('gear_key',tostring(hit))
  if hit then
    local v=M[hit]
    add('gear_type',type(v))
    if type(v)=='function' then
      local ok,r=pcall(v)
      add('gear_call',tostring(ok)..':'..type(r))
      v=r
    end
    if type(v)=='table' then
      local t={} for k,val in pairs(v) do t[#t+1]=tostring(k)..'='..tostring(val) end table.sort(t)
      add('gear_fields',table.concat(t,' | '):sub(1,700))
    end
  end
  local keys={} for k in pairs(M) do keys[#keys+1]=tostring(k) end table.sort(keys)
  add('MMB_keys',table.concat(keys,','):sub(1,600))
end

local C=rawget(_G,'Command')
add('Command',type(C))
if type(C)=='table' then
  local keys={} for k in pairs(C) do keys[#keys+1]=tostring(k) end table.sort(keys)
  add('Command_keys',table.concat(keys,','):sub(1,300))
end
local MU=rawget(_G,'MainMenuMobileUtils')
add('MainMenuMobileUtils',type(MU))
if type(MU)=='table' then
  local keys={} for k in pairs(MU) do keys[#keys+1]=tostring(k) end table.sort(keys)
  add('MMU_keys',table.concat(keys,','):sub(1,400))
end
return table.concat(out,'\n')
