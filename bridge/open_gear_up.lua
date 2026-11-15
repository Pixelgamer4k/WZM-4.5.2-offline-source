local o={}
local M=rawget(_G,'MobileMainMenuButtons');local gear
for k,v in pairs(M or {}) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then gear=v end end
for k,v in pairs(gear or {}) do o[#o+1]='gear.'..tostring(k)..'='..tostring(v) end
local FM=LUI.FlowManager;local fns={}
for k,v in pairs(FM) do if type(v)=='function' then fns[#fns+1]=tostring(k) end end
table.sort(fns);o[#o+1]='FlowManager: '..table.concat(fns,','):sub(1,1500)
local ok,r=xpcall(function() return FM.RequestAddMenu(gear.menuName,true,0,false,{},true) end,function(e) return tostring(e)..'\n'..debug.traceback('',2) end)
o[#o+1]='RequestAddMenu -> '..tostring(ok)..' '..tostring(r):sub(1,1500)
return table.concat(o,'\n')
