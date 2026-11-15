local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local L=rawget(_G,'LOOT')
add('LOOT',type(L))
local wantLoot='88a02b7599f5b517'   -- GetItemLootID
local wantRef='3d5d69ba555e016d'    -- GetItemRef
local function get(pat)
  for k,v in pairs(L or {}) do
    if tostring(k):find(pat,1,true) then return k,v end
  end
end
local k1,lootFn=get(wantLoot)
local k2,refFn=get(wantRef)
add('GetItemLootID',tostring(k1)..' '..type(lootFn))
add('GetItemRef',tostring(k2)..' '..type(refFn))
if type(lootFn)=='function' then
  -- what does the running match hold? try ids 0..12 and known-ish refs
  for _,arg in ipairs({1,2,3,100,1000,10001,100001}) do
    local ok,res=pcall(lootFn,arg)
    add('loot('..arg..')',tostring(ok)..':'..tostring(res):sub(1,48))
  end
end
if type(refFn)=='function' then
  for _,arg in ipairs({1,2,3,100,1000,10001}) do
    local ok,res=pcall(refFn,arg)
    add('ref('..arg..')',tostring(ok)..':'..tostring(res):sub(1,48))
  end
end
return table.concat(out,'\n'):sub(1,1600)
