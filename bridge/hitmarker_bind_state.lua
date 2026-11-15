local s=rawget(_G,'_WZM_HITMARKER_BIND')
local function g(p) local t=DataSources for n in p:gmatch('[^.]+') do t=t and t[n] end if t and t.GetValue then local ok,v=pcall(t.GetValue,t,0);return tostring(v) end return 'nil' end
return 'binding='..tostring(s and s.calls)..' updates='..tostring(s and s.updates)..' team='..g('inGame.MP.match.team')..' spec='..g('inGame.MP.spectating.isSpectating')..' spawn='..g('inGame.player.spawnCount')..' alive='..g('inGame.HUD.alliesAlive')
