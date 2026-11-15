local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local M=rawget(_G,'MobileMainMenuButtons')
local gear
for k,v in pairs(M or {}) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then gear=v end end
if type(gear)~='table' then return 'gear table missing' end
for _,n in ipairs({'disabled','visible','ftueDisableUnlockMessageDataSource','ftueIsDisabledDataSource'}) do
  local f=gear[n]
  if type(f)=='function' then
    local r={pcall(f)}
    local parts={}
    for i=1,#r do parts[#parts+1]=type(r[i])..':'..tostring(r[i]) end
    add(n,table.concat(parts,' | '):sub(1,260))
  else
    add(n,'('..type(f)..')')
  end
end
return table.concat(out,'\n')
