local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local function find(t,pat)
  local hits={}
  for k,v in pairs(t or {}) do
    local s=tostring(k)
    if s:find(pat,1,true) then hits[#hits+1]={key=k,val=v} end
  end
  return hits
end
local L=rawget(_G,'LOOT')
add('LOOT',type(L))
-- try a few weapon refs: WEAPON table entries that look like refs
local W=rawget(_G,'WEAPON')
local refs={}
if type(W)=='table' then
  for k,v in pairs(W) do
    local s=tostring(k)
    if s:find('xhash',1,true) then refs[#refs+1]=v end
    if #refs>=1 then break end
  end
end
-- fall back to the known present weapon refs from the frontend
local probeRefs={'iw9_akilo_47','iw9_akilo47','ar_standard','iw9_m4','m4'}
for _,r in ipairs(probeRefs) do refs[#refs+1]=r end
for _,pat in ipairs({'GetItemLootID','GetItemRef','getItemLootID'}) do
  local hs=find(L,pat)
  add('found_'..pat,#hs)
  for _,h in ipairs(hs) do
    add('key_'..pat,tostring(h.key)..' type='..type(h.val))
    if type(h.val)=='function' then
      for _,r in ipairs(refs) do
        local ok,res=pcall(h.val,r)
        add('call_'..r..'_'..pat,tostring(ok)..':'..tostring(res):sub(1,60))
      end
    end
  end
end
return table.concat(out,'\n'):sub(1,1500)
