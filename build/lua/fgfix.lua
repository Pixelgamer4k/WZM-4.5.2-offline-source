local m = (LUI.FlowManager.GetMenuStack(0) or {})[1]
local fg = m.fenceGroup
local was = tostring(fg._wzm)
local SKIP={onlineServices=1,gamerProfile=1,patch=1,ffotd=1,onlinePlayerstats=1,mainOnlineData=1,platformServices=1,
 playlists=1,exchange=1,churnReward=1,onlineServiceSubscription=1,mpOnlineData=1,fnf=1,fenceSpinner=1,ftue=1,motd=1,dailyLineup=1,uxpcloudsyncinit=1}
local pass=function() return 0 end
local nop=function() end
local n, names = 0, {}
for i, f in ipairs(fg._fences) do
  if SKIP[f._name] and (f._state ~= 0 or f.State ~= pass) then f.State=pass; f.Start=nop; f.UpdateState=nop; f.Stop=nop; f._state=0; n = n + 1 end
  if i >= 9 and i <= 26 then names[#names+1] = i .. ':' .. tostring(f._name) .. '=' .. tostring(f._state) end
end
return 'wzm=' .. was .. ' fixed=' .. n .. ' active=' .. tostring(fg._activeFenceIndex) .. ' | ' .. table.concat(names, ' ')
