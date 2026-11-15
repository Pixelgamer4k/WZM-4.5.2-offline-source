/* Original 4.5.2 game-Lua read-only evidence probes.
 * These are NEW audit sources, not part of the original TUI Lua.
 * An original Lua pcall=0 and text success are never sufficient on their own.
 */
export const PROFILE_PROBE_LUA = `local PD=rawget(_G,'PLAYER_DATA');local Co=rawget(_G,'CoD')
local core
for k,f in pairs(PD or {}) do
 if type(f)=='function' and tostring(k):find('08b73907b55c4d71',1,true) then core=f end
end
local pdo=type(core)=='function' and 1 or 0
local ranked=0;local xp=0;local loadouts=0
if pdo==1 and type(Co)=='table' and type(Co.StatsGroup)=='table' then
 local g=Co.StatsGroup.Ranked
 if g~=nil then
  local ok,r=pcall(core,0,g)
  if ok and r~=nil then
   ranked=1
   local a,v=pcall(function() return r.progression.playerLevel.xp:get() end)
   if a and type(v)=='number' and v>=0 then xp=1 end
  end
 end
 for _,idx in ipairs({3,4,6}) do
  local ok,r=pcall(core,0,idx)
  if ok and r~=nil then
   local a,v=pcall(function() return r.loadouts[0].name:get() end)
   if a and v~=nil then loadouts=loadouts+1 end
  end
 end
end
return 'WZMGEARPROFILE|pdo='..pdo..'|ranked='..ranked..'|xp='..xp..'|groups='..loadouts`;

export const HUB_PROBE_LUA = `local M=rawget(_G,'MobileMainMenuButtons')
local FM=rawget(_G,'LUI')
FM=type(FM)=='table' and FM.FlowManager or nil
local n=0
for k,v in pairs(M or {}) do
 if tostring(k):find('2b8a71f2b33a70b3',1,true) and type(v)=='table' and
 type(v.menuName)=='string' and #v.menuName>0 then n=n+1 end
end
local flow=type(FM)=='table' and type(FM.RequestAddMenu)=='function' and 1 or 0
return 'WZMGEARHUB|keys='..n..'|flow='..flow`;

export const SYNTHETIC_PROFILE_VERIFY_LUA = `local PD=rawget(_G,'PLAYER_DATA');local Co=rawget(_G,'CoD')
local core
for k,f in pairs(PD or {}) do
 if type(f)=='function' and tostring(k):find('08b73907b55c4d71',1,true) then core=f end end
if type(core)~='function' or type(Co)~='table' or type(Co.StatsGroup)~='table' then
 return 'WZMGEARPROFILESEED|xp=0|kills=0|deaths=0|games=0|readable=0' end
local ok,r=pcall(core,0,Co.StatsGroup.Ranked)
if not ok or r==nil then
 return 'WZMGEARPROFILESEED|xp=0|kills=0|deaths=0|games=0|readable=0' end
local good,xp,kills,deaths,games=pcall(function()
 return r.progression.playerLevel.xp:get(),r.kills:get(),
 r.deaths:get(),r.gamesPlayed:get() end)
if not good then return 'WZMGEARPROFILESEED|xp=0|kills=0|deaths=0|games=0|readable=0' end
local function to(n) return type(n)=='number' and n or 0 end
return 'WZMGEARPROFILESEED|xp='..to(xp)..'|kills='..to(kills)..
'|deaths='..to(deaths)..'|games='..to(games)..'|readable=1'`;

export const SEED_VERIFY_LUA = `local PD=rawget(_G,'PLAYER_DATA');local W=rawget(_G,'WEAPON')
local core
for k,f in pairs(PD or {}) do
 if type(f)=='function' and tostring(k):find('08b73907b55c4d71',1,true) then core=f end end
local kits=type(W)=='table' and {
 {'WZM-1',W.M4LootID,W.DaemonPistolLootID,W.KnifeLootID},
 {'WZM-2',W.M4LootID,W.MXGuardianLootID,W.PickaxeLootID},
 {'WZM-3',W.M4LootID,W.DaemonPistolLootID,W.ChainsawLootID},
 {'WZM-4',W.M4LootID,W.LachmannShrouadLootID,W.KnifeLootID},
 {'WZM-5',W.M4LootID,W.DaemonPistolLootID,W.SpearBaseLootID}
} or {}
local matched=0;local checked=0;local mismatched=0;local invalid=0
for _,g in ipairs({3,4,6}) do
 local ok,root=pcall(core or function() return nil end,0,g)
 if ok and root then
  for i=0,4 do
   local kit=kits[i+1]
   local good=kit and #kit==4
   if good then
    for j=2,4 do if kit[j]==nil or kit[j]==0 then good=false end end
   end
   local function get(f)
    local a,v=pcall(f);if not a then return nil end
    return v
   end
   if good then
    local l=get(function() return root.loadouts[i] end)
    if not l then good=false else
     local values={
      get(function() return l.name:get() end),
      get(function() return l.weaponSetups[0].weaponLootID:get() end),
      get(function() return l.weaponSetups[1].weaponLootID:get() end),
      get(function() return l.weaponSetups[2].weaponLootID:get() end)
     }
     for j=1,4 do checked=checked+1
      if tostring(values[j])~=tostring(kit[j]) then good=false;mismatched=mismatched+1 end
     end
    end
   else invalid=invalid+1 end
   if good then matched=matched+1 end
  end
 else invalid=invalid+5 end
end
return 'WZMGEARSEED|matched='..matched..'|expected=15|checked='..checked..
'|mismatched='..mismatched..'|invalid='..invalid`;

export function parseReadback(value, kind) {
  if(typeof value!=='string'||value.length>500||!value.startsWith(kind+'|'))
    return {ok:false,code:'READBACK_SIGNATURE_MISSING'};
  const pieces=value.split('|').slice(1),result={};
  for(const bit of pieces){
    const pos=bit.indexOf('=');
    if(pos<=0)return {ok:false,code:'READBACK_MALFORMED'};
    const name=bit.slice(0,pos),n=Number(bit.slice(pos+1));
    if(!/^[a-z]+$/.test(name)||!Number.isSafeInteger(n)||n<0||name in result)
      return {ok:false,code:'READBACK_MALFORMED'};
    result[name]=n;
  }
  const expected = kind==='WZMGEARPROFILE'?['pdo','ranked','xp','groups']:
    kind==='WZMGEARHUB'?['keys','flow']:
    kind==='WZMGEARPROFILESEED'?['xp','kills','deaths','games','readable']:
    kind==='WZMGEARSEED'?['matched','expected','checked','mismatched','invalid']:[];
  if(!expected.length||expected.some(k=>!(k in result))||
     Object.keys(result).length!==expected.length)
    return {ok:false,code:'READBACK_FIELDS_MISSING'};
  return {ok:true,...result};
}

export function profileVerified(x) {
  return x.ok&&x.pdo===1&&x.ranked===1&&x.xp===1&&x.groups>=1;
}
export function hubVerified(x) {
  return x.ok&&x.keys>=1&&x.flow===1;
}
export function syntheticProfileVerified(x) {
  return x.ok&&x.readable===1&&x.xp===100000&&
    x.kills===1234&&x.deaths===617&&x.games===100;
}
export function seedVerified(x) {
  return x.ok&&x.expected===15&&x.matched===15&&x.checked===60&&
    x.mismatched===0&&x.invalid===0;
}
