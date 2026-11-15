local function g(p) local t=DataSources for s in p:gmatch('[^.]+') do t=t and t[s] end
 if type(t)=='table' and t.GetValue then local ok,v=pcall(t.GetValue,t,0) return tostring(v) end return 'nil' end
return 'team='..g('inGame.MP.match.team')..' spec='..g('inGame.MP.spectating.isSpectating')..' alliesAlive='..g('inGame.HUD.alliesAlive')..' axisAlive='..g('inGame.HUD.axisAlive')..' spawnCount='..g('inGame.player.spawnCount')..' activeTeams='..g('inGame.player.activeTeamCount')
