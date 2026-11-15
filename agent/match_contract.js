/* WZM 4.5.2 rootless match-request contract from the user's original ./wzm.
 * Pure data validation only. Does not start matches or install hooks.
 * Original authority: WarzoneMobileOffline/wzm and the 20261110 TUI snapshot.
 */
export const ORIGINAL_MAPS = Object.freeze([
  {id:'nuketown', native:'mp_mgl_nuketown', tested:true},
  {id:'crash',native:'mp_mgl_crash2',tested:true},
  {id:'verdansk',native:'mp_mgl_wz2_sierra',tested:true,
    requires:['VERDANSK_PACK_REGISTRY','VERDANSK_LOCAL_ZONE']},
  {id:'broadcast',native:'mp_mgl_wz2_sierra',tested:false,
    requires:['BROADCAST_ZONE_INJECTION','VERDANSK_PACK_REGISTRY','ENTITY_CHECK_GUARD']},
  {id:'hardhat',native:'mp_mgl_hardhat',tested:false},
  {id:'slaughterhouse',native:'mp_mgl_slaughterhouse',tested:false},
  {id:'downtown',native:'mp_mgl_ftue_downtown',tested:false},
  {id:'rebirth',native:'mp_mgl_escape4',tested:false},
]);

export const ORIGINAL_MODES = Object.freeze([
  {id:'tdm',native:'0x3f9bd6e4038d651d',tested:true},
  {id:'domination',native:'0x6cec28f740df15db',tested:false},
  {id:'hardpoint',native:'0x7727d380d55d0e58',tested:false},
  {id:'kill_confirmed',native:'0x39e8297d7f7df31d',tested:false},
  {id:'sd',native:'0x1dbcd710fe215368',tested:false},
  {id:'frontline',native:'0x7aa5ae4c378e7c80',tested:false},
]);

export const ORIGINAL_DIFFICULTIES = Object.freeze(['Recruit','Regular','Hardened','Veteran']);
export const TUI_DEFAULT_MATCH = Object.freeze({map:'nuketown',mode:'tdm',enemies:5,
  friends:0,difficulty:'Veteran',minutes:60});

function integer(name,value,min,max) {
  if (!Number.isInteger(value) || value<min || value>max)
    return {ok:false,code:`INVALID_${name.toUpperCase()}`,range:[min,max]};
  return null;
}

export function validateOfflineMatchRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return {ok:false,code:'INVALID_MATCH_REQUEST'};
  const raw={...TUI_DEFAULT_MATCH,...input};
  const map=ORIGINAL_MAPS.find(x=>x.id===raw.map);
  const mode=ORIGINAL_MODES.find(x=>x.id===raw.mode);
  if (!map)return {ok:false,code:'UNKNOWN_ORIGINAL_MAP'};
  if (!mode)return {ok:false,code:'UNKNOWN_ORIGINAL_MODE'};
  for(const [name,val,min,max] of [
    ['enemies',raw.enemies,1,6],['friends',raw.friends,0,6],['minutes',raw.minutes,2,240]
  ]) {
    const invalid=integer(name,val,min,max);
    if(invalid)return invalid;
  }
  if(raw.enemies+raw.friends>8)return {ok:false,code:'ROSTER_EXCEEDS_NATIVE_LIMIT'};
  if(!ORIGINAL_DIFFICULTIES.includes(raw.difficulty))return {ok:false,code:'UNKNOWN_AI_DIFFICULTY'};
  const optionalCapabilities=[...(map.requires||[])];
  return {
    ok:true,code:'VALIDATED_FROM_ORIGINAL_TUI',
    map:map.id,nativeMapId:map.native,mode:mode.id,nativeModeHash:mode.native,
    enemies:raw.enemies,friends:raw.friends,difficulty:raw.difficulty,
    nativeDifficulty:ORIGINAL_DIFFICULTIES.indexOf(raw.difficulty),
    durationSeconds:raw.minutes*60,
    mapHistoricallyTested:map.tested,modeHistoricallyTested:mode.tested,
    requires:optionalCapabilities,
    needsRuntimeProof:true,
    nativeHostReady:false,
    matchStarted:false,
    note:'Valid configuration is not a native game host. No world/bots have been started.'
  };
}
