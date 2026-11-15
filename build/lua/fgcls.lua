local FM = LUI.FlowManager
local m = (FM.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local SKIP={onlineServices=1,gamerProfile=1,patch=1,ffotd=1,onlinePlayerstats=1,mainOnlineData=1,platformServices=1,
 playlists=1,exchange=1,churnReward=1,onlineServiceSubscription=1,mpOnlineData=1,fnf=1,fenceSpinner=1,ftue=1,motd=1,dailyLineup=1,uxpcloudsyncinit=1}
local pass=function() return 0 end
local nop=function() end
local n = 0
for _, f in ipairs(fg._fences) do
  if SKIP[f._name] then
    local cls = getmetatable(f) and getmetatable(f).__index
    if type(cls) == 'table' and rawget(cls, 'State') ~= pass then rawset(cls, 'State', pass); rawset(cls, 'UpdateState', nop); rawset(cls, 'Start', nop); rawset(cls, 'Stop', nop); n = n + 1 end
    f._state = 0
  end
end
for i = 1, 30 do pcall(function() fg:Frame(0) end) end
return 'classes patched=' .. n .. ' active=' .. tostring(fg._activeFenceIndex) .. ' state=' .. tostring(fg._state) .. ' f9=' .. tostring(fg._fences[9]:State(0)) .. ' fenced=' .. tostring(m.fenced)
