-- Fake local profile. Runs after fake_player_data.py has bound the stats handles.
local W=rawget(_G,"_WZM")
local core
for k,f in pairs(W.pdo) do if tostring(k):find("08b73907b55") then core=f end end
local r=core(0,CoD.StatsGroup.Ranked)
r.progression.playerLevel.xp:set(100000)
r.kills:set(1234)
r.deaths:set(617)
r.gamesPlayed:set(100)
return "profile xp="..tostring(r.progression.playerLevel.xp:get()).." kills="..tostring(r.kills:get())
