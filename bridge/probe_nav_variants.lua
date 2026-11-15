local out={}
local function add(k,v) out[#out+1]=k..'='..tostring(v) end
local M=rawget(_G,'MobileMainMenuButtons')
local gear
for k,v in pairs(M or {}) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then gear=v end end
if type(gear)~='table' then return 'gear table missing' end
local mn=gear.menuName
local Q=MenuNavigator.QueueURIXHash
add('Q_type',type(Q))

local function try(label,fn)
  local r={pcall(fn)}
  local parts={}
  for i=1,#r do parts[#parts+1]=type(r[i])..':'..tostring(r[i]) end
  add(label,table.concat(parts,' | '):sub(1,220))
end

try('single_hash',function() return Q(mn,0) end)
try('table_hash',function() return Q({mn},0) end)
try('table_hash_empty',function() return Q({mn},0,{}) end)
-- inspect MenuBuilder internals
local MB=rawget(_G,'MenuBuilder')
local inner=rawget(MB,'_M')
if type(inner)=='table' then
  local t={} for k,v in pairs(inner) do t[#t+1]=tostring(k)..'('..type(v)..')' end table.sort(t)
  add('MB._M',table.concat(t,', '):sub(1,400))
end
local lf=rawget(MB,'LoadFile')
add('LoadFile_type',type(lf))
try('LoadFile_nil',function() return lf() end)
try('LoadFile_str',function() return lf('mobile_customization') end)
return table.concat(out,'\n')
