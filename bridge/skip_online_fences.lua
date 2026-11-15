-- Session-only: treat fences that depend on the shut-down servers as passed.
-- Re-run periodically: LUI rebuilds wipe it, and the marker shows when that happened.
-- Play button status model: 0/4 Finalizing Install, 1 Play, 3 Cancel, 5 party-size warning.
-- Nothing sets it correctly offline, so select Play once the hub exists.
local function play_button()
 local function find(e,id,d)
  if d>12 then return end
  if tostring(e.id)==id then return e end
  local c=e:getFirstChild()
  while c do local r=find(c,id,d+1); if r then return r end; c=c:getNextSibling() end
 end
 local b=find(LUI.primaryRoot,"xhash: #x0d6362796dd5f31d1",0)
 if not b then return false end
 local _,src=next((b:GetDataSource()))
 local status=src._inputDataSources[1]
 -- Something republishes the status every few seconds, so hold it from the navigator frame.
 local W0=rawget(_G,"_WZM")
 local frame=MenuNavigator.Frame
 MenuNavigator.Frame=function(...)
  if status:GetValue(0)~=1 then status:SetValue(0,1); W0.held=(W0.held or 0)+1 end
  return frame(...)
 end
 return true
end
do local W0=rawget(_G,"_WZM")
 if W0 then
  if W0.play then return "" end
  local ok,done=pcall(play_button)
  if ok and done then W0.play=true; return "play button ready" end
  if not ok and W0.playerr~=tostring(done) then W0.playerr=tostring(done); return "play button error: "..W0.playerr end
  return ""
 end
end
local W={n=0}; rawset(_G,"_WZM",W)
local SKIP={onlineServices=1,gamerProfile=1,patch=1,ffotd=1,onlinePlayerstats=1,mainOnlineData=1,platformServices=1,
 playlists=1,exchange=1,churnReward=1,onlineServiceSubscription=1,mpOnlineData=1,fnf=1,fenceSpinner=1,ftue=1,motd=1,dailyLineup=1,uxpcloudsyncinit=1}
local pass=function() return 0 end
local nop=function() end
local C=LUI.FenceGroup
local function apply(self)
 if self._wzm then return end
 self._wzm=true
 for _,f in ipairs(self._fences or {}) do if SKIP[f._name] then f.State=pass; f.Start=nop; f.UpdateState=nop; f.Stop=nop; f._state=0 end end
 W.n=W.n+1
end
local frame,passes=C.Frame,C.Passes
C.Frame=function(self,...) apply(self) return frame(self,...) end
C.Passes=function(self,...) apply(self) return passes(self,...) end
-- The FTUE (tutorial) layer never exists once the ftue fence is skipped, so give its
-- getter a null object that absorbs chained calls. Applied at first widget build
-- because the FTUE module can load after this chunk runs.
local NULL; NULL=setmetatable({},{__index=function() return function() return NULL end end})
W.null=NULL
-- Stand-in for player data that normally comes from the servers: any field is another
-- node, get() is empty, set() and other calls do nothing.
local NODE; NODE=setmetatable({},{__index=function(_,k)
 if k=="get" then return function() return 0 end end
 if k=="set" then return function() end end
 if k=="GetValue" then return function() return 0 end end
 if k=="GetModel" then return function(_,c) return DataSources.alwaysLoaded.cdni.pauseStatusCode:GetModel(c or 0) end end
 return NODE end,__call=function() return NODE end})
W.node=NODE
-- Lobby getters that return nil with no party. Add a hash here when a menu needs another one.
local LOBBY_NIL={["xhash: #x04dae59e12a383b92"]=1}
-- Helpers the shipped scripts call but no longer define.
local MISSING={["xhash: #x05b161c0d5f530c0d"]=1}
local function missing_helpers()
 local G=rawget(_G,"GRID_AND_LIST")
 if W.grid or type(G)~="table" then return end
 W.grid=true
 local mt=getmetatable(G) or {}
 local old=mt.__index
 mt.__index=function(t,k)
  if MISSING[tostring(k)] then return function() end end
  if type(old)=="function" then return old(t,k) elseif old then return old[k] end
 end
 setmetatable(G,mt)
end
local function fix()
 missing_helpers()
 local L=rawget(_G,"Lobby")
 if type(L)=="table" then
  W.lobby=W.lobby or {}
  local keys={} for k,v in pairs(L) do if LOBBY_NIL[tostring(k)] and not W.lobby[tostring(k)] and type(v)=="function" then keys[#keys+1]=k end end
  for _,k in ipairs(keys) do
   local get=L[k]; W.lobby[tostring(k)]=true
   rawset(L,k,function(...) local r=get(...); if r==nil then return NODE end return r end)
  end
 end
 local P=rawget(_G,"PLAYER_DATA")
 if not W.pd and type(P)=="table" then
  local keys={} for k,v in pairs(P) do if type(v)=="function" then keys[#keys+1]=k end end
  for _,k in ipairs(keys) do
   local get=P[k]
   W.pdo=W.pdo or {}; W.pdo[k]=get
   rawset(P,k,function(...) local r=get(...); if r==nil then W.pdnil=true; return NODE end return r end)
  end
  W.pd=#keys
 end
 local F=rawget(_G,"FTUE")
 if not W.layer and type(F)=="table" and type(F.GetFTUELayer)=="function" then
  F.GetFTUELayer=function() return NULL end
  W.layer=true
 end
 -- CONDITIONS[46a3bc59faa7e280] gates FTUE setup; false takes the game's own early return.
 local C2=rawget(_G,"CONDITIONS")
 if not W.cond and type(C2)=="table" then
  for k in pairs(C2) do if tostring(k)=="xhash: #x046a3bc59faa7e280" then W.condk=k end end
  if W.condk~=nil then rawset(C2,W.condk,function() return false end); W.cond=true end
 end
end
fix()
local B=MenuBuilder
local build=B.BuildRegisteredType
B.BuildRegisteredType=function(...) fix() return build(...) end
return "installed layer="..tostring(W.layer).." cond="..tostring(W.cond).." pd="..tostring(W.pd)
