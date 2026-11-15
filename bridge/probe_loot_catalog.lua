local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local L=rawget(_G,'LOOT')
if type(L)~='table' then return 'no LOOT' end
local tabs={}
for k,v in pairs(L) do
  if type(v)=='table' then
    local n=0 for _ in pairs(v) do n=n+1 end
    if n>0 then tabs[#tabs+1]={k=k,n=n,v=v} end
  end
end
table.sort(tabs,function(a,b) return a.n>b.n end)
for i=1,math.min(#tabs,8) do
  local t=tabs[i]
  add('tbl'..i,tostring(t.k)..' n='..t.n..' sample='..tostring((next(t.v))))
end
-- biggest table: is it an item catalog keyed by ref/id?
if tabs[1] then
  local v=tabs[1].v
  local c=0
  local samples={}
  for k,val in pairs(v) do
    c=c+1
    if c<=6 then samples[#samples+1]=tostring(k)..'=>'..type(val) end
  end
  add('biggest',tostring(tabs[1].k)..' '..table.concat(samples,' | '):sub(1,400))
end
return table.concat(out,'\n'):sub(1,1500)
