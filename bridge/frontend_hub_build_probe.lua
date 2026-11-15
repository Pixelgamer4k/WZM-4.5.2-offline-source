local gear;for k,v in pairs(MobileMainMenuButtons) do if tostring(k):find('2b8a71f2b33a70b3',1,true) then gear=v end end
local ok,r=xpcall(function() return MenuBuilder.buildMenu(gear.menuName,{controllerIndex=0}) end,function(e) return debug.traceback(tostring(e),2) end)
if ok and r then rawset(_G,'WZM_HUB_BUILD_PROBE',r) end
return 'build='..tostring(ok)..':'..tostring(r)
