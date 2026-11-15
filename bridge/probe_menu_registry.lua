local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local M=rawget(_G,'MobileMainMenuButtons')
local gear
for k,v in pairs(M or {}) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then gear=v end end
if type(gear)~='table' then return 'gear table missing' end
local mn=gear.menuName
add('menuName',tostring(mn))
local MB=rawget(_G,'MenuBuilder')
add('MB_M',type(rawget(MB,'_M')))
add('MB_NAME',tostring(rawget(MB,'_NAME')))
local ok,res=pcall(MB.IsTypeRegistered,mn)
add('IsTypeRegistered',tostring(ok)..':'..tostring(res))
local ok2,res2=pcall(MB.IsTypeRegistered,0,mn)
add('IsTypeRegistered2',tostring(ok2)..':'..tostring(res2))
-- internal registry tables
for k,v in pairs(MB) do
  if type(v)=='table' then
    local n=0 local sample={}
    for kk,vv in pairs(v) do n=n+1 if #sample<6 then sample[#sample+1]=tostring(kk)..'->'..type(vv) end end
    add('MBtbl_'..tostring(k),n..' ['..table.concat(sample,', ')..']')
  end
end
return table.concat(out,'\n')
