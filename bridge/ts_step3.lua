-- Step 3: report the log and the player's team/spectator state.
local function g(p) local t=DataSources for s in p:gmatch('[^.]+') do t=t and t[s] end
 if type(t)=='table' and t.GetValue then local ok,v=pcall(t.GetValue,t,0) return tostring(v) end return 'nil' end
return 'log='..table.concat(rawget(_G,'WZM_LOG') or {},' ; ')..' | team='..g('inGame.MP.match.team')..' spec='..g('inGame.MP.spectating.isSpectating')..' alliesAlive='..g('inGame.HUD.alliesAlive')..' spawnCount='..g('inGame.player.spawnCount')
