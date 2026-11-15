/* WZM 4.5.2 in-process host, party and genuine marker-2 AI adapter.
 *
 * NOT a game-world proof. This ports the real original host `go` and the real
 * native AI creator/setter, but the protected original host/DDL/network path
 * is unverified on a rootless handset. The original Mac runner's `seconds`
 * merely timed its Python process; an actual native time-control driver is
 * deliberately REQUIRED before `configure()` may succeed.
 *
 * NO runtime filesystem, Frida server, ADB, shell, network RPC or auto-start.
 * Host source is evaluated ONCE after an explicit match click, full binary
 * guards and private native evidence. Its modifications are persistent until
 * the game process dies. `dispose()` does NOT pretend to roll them back.
 */

import {HOST_FUNCTION_SOURCE,AI_CREATOR_SOURCE,AI_DIFFICULTY_GUARD_SOURCE,
        ORIGINAL_SOURCE_HASHES} from './embedded_sources.js';
import {createFridaHostRuntime} from './native_proof.js';
import {validateOfflineMatchRequest,ORIGINAL_MAPS,ORIGINAL_MODES,TUI_DEFAULT_MATCH} from './match_contract.js';

export const PRELAUNCH_HOST_CAPABILITIES = Object.freeze([
  'MAINMENU_LUI_VERIFIED',
  'LOCAL_DDL_PROFILE_BOUND',
  'LOADOUTS_READBACK_VERIFIED',
  'HOST_PARTY_PRECONDITIONS_VERIFIED',
  'NATIVE_AI_CREATOR_READY',
  'NATIVE_MATCH_CLOCK_READY',
]);

export const POSTLAUNCH_HOST_PROOFS = Object.freeze([
  'HOST_START_RETURNED', 'LOCAL_PLAYER_WORLD_ENTERED',
  'NATIVE_MARKER2_AI_CREATED', 'AI_TEAM_DIFFICULTY_READBACK',
  'REAL_NATIVE_MATCH_DURATION_STARTED', 'NATIVE_MATCH_END_READBACK',
]);

const ZONE_STAGES = Object.freeze(['VERDANSK_PACK_REGISTRY','VERDANSK_LOCAL_ZONE',
  'BROADCAST_ZONE_INJECTION','ENTITY_CHECK_GUARD']);

function freezeConfig(config) {
  const requirements=Object.freeze([...(config.requires||[])]);
  return Object.freeze({...config,requires:requirements});
}

// v3/v4 MatchRequestGate passes native* fields and omits the display map ID.
// Broadcast and Verdansk share the same engine map, so distinguish them by
// the canonical special-zone prerequisite; NEVER guess based on the native ID.
export function canonicalHostRequest(input) {
  if(!input || typeof input!=='object' || Array.isArray(input))
    return {ok:false,code:'INVALID_HOST_REQUEST'};
  let map=input.map;
  let mode=input.mode;
  if(!map && typeof input.nativeMapId==='string') {
    map= input.requiredZones?.includes('BROADCAST_ZONE_INJECTION') ? 'broadcast' :
      ORIGINAL_MAPS.find(x=>x.native===input.nativeMapId)?.id;
  }
  if(!mode && typeof input.nativeModeHash==='string')
    mode=ORIGINAL_MODES.find(x=>x.native===input.nativeModeHash)?.id;
  if(!map || !mode) return {ok:false,code:'UNKNOWN_ORIGINAL_HOST_MAP_OR_MODE'};
  const enemies=input.enemies??input.enemyBots??TUI_DEFAULT_MATCH.enemies;
  const friends=input.friends??input.friendlyBots??TUI_DEFAULT_MATCH.friends;
  const difficulty=input.difficulty??TUI_DEFAULT_MATCH.difficulty;
  const minutes= input.minutes ?? (
    Number.isInteger(input.durationSeconds) ? input.durationSeconds/60 : TUI_DEFAULT_MATCH.minutes);
  const validated=validateOfflineMatchRequest({map,mode,enemies,friends,difficulty,minutes});
  if(!validated.ok)return validated;
  // Protect against mismatched UI map alias, tampered native mode or omitted
  // Broadcast requirements from the parent match gate.
  if(input.nativeMapId && input.nativeMapId!==validated.nativeMapId)
    return {ok:false,code:'HOST_NATIVE_MAP_MISMATCH'};
  if(input.nativeModeHash && input.nativeModeHash!==validated.nativeModeHash)
    return {ok:false,code:'HOST_NATIVE_MODE_MISMATCH'};
  if(input.nativeDifficulty!==undefined &&
     input.nativeDifficulty!==validated.nativeDifficulty)
    return {ok:false,code:'HOST_NATIVE_DIFFICULTY_MISMATCH'};
  if(input.durationSeconds!==undefined && input.durationSeconds!==validated.durationSeconds)
    return {ok:false,code:'HOST_NATIVE_DURATION_MISMATCH'};
  if(input.requiredZones!==undefined){
    if(!Array.isArray(input.requiredZones) ||
       input.requiredZones.length!==validated.requires.length ||
       validated.requires.some(x=>!input.requiredZones.includes(x)))
      return {ok:false,code:'HOST_ZONE_CAPABILITY_MISMATCH'};
  }
  return freezeConfig(validated);
}

function sourceWrapper(source,variables,arm=false) {
  // Variables are numbers from the strict match contract; never interpolate
  // user Lua/source/JS or a freeform filesystem path into Script.evaluate.
  const header=Object.entries(variables).map(([k,v]) =>
    `globalThis.${k}=${JSON.stringify(v)};`).join('\n');
  return `(function(){\nconst send=(ev)=>{const sink=globalThis.WZM_STANDALONE_EVENT_SINK; if(typeof sink==='function')sink(ev);};\n${header}\n${source}\n${arm?'globalThis.wzmBotArm();':''}\n})()`;
}

function isWorldEvent(ev) {
  // Original 0x3cd0a00 observer fires onEnter while clc.state is usually 6.
  // It is only a CANDIDATE. Actual world-readiness needs a later native snap
  // with clc0>=7 outside that native event callback.
  return ev && ev.s==='clientEnterWorld' && (ev.state===6 || ev.state===7);
}

export function verifyBotResult(summary,rows,config,created) {
  if(!summary || !Number.isInteger(summary.genuineAi) ||
     summary.genuineAi!==config.enemies+config.friends)
    return {ok:false,code:'HOST_MARKER2_COUNT_MISMATCH'};
  if(!summary.byTeam || summary.byTeam[1]!==config.enemies ||
     (summary.byTeam[2]||0)!==config.friends)
    return {ok:false,code:'HOST_AI_TEAM_READBACK_MISMATCH'};
  // Creator's `rows:slots()` carry state/marker but NOT teams; original
  // `summary:tally()` carries teams/AI counts. Both are needed for evidence.
  const clients=summary.slots;
  if(!Array.isArray(clients) || clients.length!==config.enemies+config.friends ||
     clients.some(x=>x.state!==7 || ![1,2].includes(x.team)))
    return {ok:false,code:'HOST_NATIVE_AI_CLIENT_STATE_MISMATCH'};
  if(!Array.isArray(rows) || rows.filter(x=>x.flag===2).length!==config.enemies+config.friends ||
     rows.filter(x=>x.flag===2).some(x=>x.state!==7))
    return {ok:false,code:'HOST_NATIVE_AI_CLIENT_STATE_MISMATCH'};
  // Unlike a bot counter, the original native creator records actual
  // 0x265ea3c AI-setter results for each *new* marker-2 client; require a
  // unique slot and the chosen difficulty 0..3 for the complete roster.
  if(!Array.isArray(created) || created.length!==config.enemies+config.friends ||
     new Set(created.map(x=>x.slot)).size!==created.length ||
     created.some(x=>!Number.isInteger(x.slot) || ![1,2].includes(x.team) ||
       x.difficulty!==config.nativeDifficulty))
    return {ok:false,code:'HOST_AI_DIFFICULTY_READBACK_MISMATCH'};
  return {ok:true,code:'HOST_AI_TEAM_COUNT_READBACK_VERIFIED'};
}

/**
 * Integration:
 *   let owner;
 *   const port=createInProcessHostAdapter({
 *      runtime:createFridaHostRuntime(),
 *      nativeClock: verifiedGameClockDriver, // REQUIRED; see README
 *      bindNativeOwner: o => {owner=o;} // retain ONLY in native supervisor
 *   });
 *   owner.mark('MAINMENU_LUI_VERIFIED',true,privateLuiEvidence);
 *   // more native proof stages, no UI-supplied capabilities
 *   // On explicit Match click, v3 gate calls port.configure(config),port.go(..)
 *   // On existing LUI frame: port.onLuiFrame(); no second LUI hook installed
 */
export function createInProcessHostAdapter({
  runtime=createFridaHostRuntime(), nativeClock=null,
  notify=()=>{}, bindNativeOwner=()=>{}, clock=()=>Date.now(),
  sources={host:HOST_FUNCTION_SOURCE,ai:AI_CREATOR_SOURCE,guard:AI_DIFFICULTY_GUARD_SOURCE}
}={}) {
  if(!runtime || typeof runtime.checkBinary!=='function' ||
     typeof runtime.evaluate!=='function' || typeof runtime.botVeneer!=='function')
    throw new TypeError('Real Frida host runtime required');
  let disposed=false, attempted=false, host=null, cleanupSink=null;
  let phase='WAIT_EXPLICIT_MATCH';
  let config=null, failure=null, generation=0;
  let worldCandidate=false, worldSeen=false, aiStarted=false, guardStarted=false;
  let botResult=null, worldStartAt=null, proof=null;
  const nativeClaims=new Set();
  const proofEvents=[];
  let pendingGuard=false;

  function emit(code,detail={}) {
    const event={s:'standaloneV4Host',code,phase,...detail};
    try{notify(event);}catch(_){}
  }
  function setPhase(name) {phase=name;emit(name);}
  function fail(code,reason=null) {
    failure={code,reason:reason===null?null:String(reason).slice(0,180)};
    setPhase('HOST_UNVERIFIED_ERROR');
    emit(code,failure);
    return false;
  }

  const privateOwner=Object.freeze({
    mark(stage,verified,receipt) {
      if(disposed)throw new Error('HOST_DISPOSED');
      if(![...PRELAUNCH_HOST_CAPABILITIES,...ZONE_STAGES].includes(stage))
        throw new Error('UNKNOWN_NATIVE_HOST_PROOF: '+stage);
      // An explicit, non-empty native receipt is necessary, but NOT sufficient
      // by itself: only the boot/profile/party source owner gets this closure.
      if(verified===true && (!receipt || receipt.verified!==true ||
         receipt.source!=='native-readback')) throw new Error('HOST_NATIVE_PROOF_REQUIRED');
      if(verified===true)nativeClaims.add(stage);else nativeClaims.delete(stage);
      emit('HOST_NATIVE_PROOF_UPDATE',{stage,verified:verified===true});
    },
    reset(reason='LUI_GENERATION_CHANGED') {
      nativeClaims.clear();generation++;
      config=null;
      if(attempted) {
        // Original host contains no reversible global hook set; never re-arm
        // a second copy within the same process or fake a clean rollback.
        fail('HOST_PROCESS_RESTART_REQUIRED',reason);
      } else setPhase('WAIT_EXPLICIT_MATCH');
    }
  });
  bindNativeOwner(privateOwner);

  function preflight(input) {
    if(disposed)return {ok:false,code:'HOST_DISPOSED'};
    if(attempted)return {ok:false,code:'HOST_ORIGINAL_ALREADY_INSTALLED'};
    const validated=canonicalHostRequest(input);
    if(validated.ok===false)return validated;
    const build=runtime.checkBinary();
    if(!build.ok)return build;
    const required=[...PRELAUNCH_HOST_CAPABILITIES,...validated.requires];
    const missing=required.filter(x=>!nativeClaims.has(x));
    if(missing.length)return {ok:false,code:'HOST_NATIVE_PREREQUISITES_MISSING',missing};
    if(!nativeClock || typeof nativeClock.configure!=='function' ||
       typeof nativeClock.readback!=='function' ||
       typeof nativeClock.begin!=='function' || typeof nativeClock.endReadback!=='function')
      return {ok:false,code:'HOST_REAL_NATIVE_DURATION_UNAVAILABLE'};
    return {ok:true,code:'HOST_CONFIG_ELIGIBLE_NOT_RUNNING',config:validated,build};
  }

  function configure(input) {
    const check=preflight(input);
    if(!check.ok){failure={code:check.code,missing:check.missing||[]};emit(check.code,failure);return false;}
    try {
      // A real native game duration setter MUST report its actual native
      // readback. An in-process JS deadline without a native end route is NOT
      // accepted as match duration, and does not satisfy this contract.
      const prepared=nativeClock.configure(check.config.durationSeconds,check.build);
      const readback=nativeClock.readback();
      if(prepared!==true || readback?.verifiedNativeGameClock!==true ||
         readback?.seconds!==check.config.durationSeconds)
        return fail('HOST_NATIVE_DURATION_READBACK_FAILED');
    }catch(e){return fail('HOST_NATIVE_DURATION_SETUP_FAILED',e);}
    config=check.config;
    proof=check.build;
    setPhase('HOST_CONFIG_NATIVE_VERIFIED');
    return true;
  }

  function markHostEvent(ev) {
    if(disposed||!attempted||!ev||typeof ev.s!=='string')return;
    if(proofEvents.length<48)proofEvents.push(ev.s);
    if(['FATAL','comError','sessionError','err','FAULT','botInjectError'].includes(ev.s)) {
      fail('HOST_NATIVE_EVENT_FAILURE',ev.s+': '+String(ev.error||ev.code||''));
      return;
    }
    if(ev.s==='hostStartReturned') {
      setPhase('HOST_START_RETURNED_WORLD_NOT_VERIFIED');
      return;
    }
    if(isWorldEvent(ev)) {
      worldCandidate=true;
      emit('HOST_CLIENT_ENTERWORLD_CANDIDATE',{state:ev.state,gate:ev.gate});
      return;
    }

    if(ev.s==='botInjectFinal' && ev.experiment==='both_sides_native_ai') {
      const result=verifyBotResult(ev.summary,ev.rows,config,ev.created);
      if(!result.ok){fail(result.code);return;}
      botResult=result;
      pendingGuard=true;
      setPhase('HOST_NATIVE_AI_TEAM_COUNT_VERIFIED');
    }
    if(ev.s==='botInjectFinal' && ev.experiment==='all_native_ai_veteran_guard') {
      if(!botResult || !guardStarted)return;
      setPhase('HOST_GUARD_RUNNING_WORLD_PLAY_NOT_VERIFIED');
    }
  }

  function go(nativeMap,nativeGametype,enemies) {
    if(disposed)throw new Error('HOST_DISPOSED');
    if(!config || phase!=='HOST_CONFIG_NATIVE_VERIFIED')throw new Error('HOST_CONFIGURATION_UNVERIFIED');
    if(config.nativeMapId!==nativeMap || config.nativeModeHash!==nativeGametype ||
       config.enemies!==enemies)throw new Error('HOST_GO_CONFIG_MISMATCH');
    if(attempted)throw new Error('HOST_ALREADY_ATTEMPTED');
    const build=runtime.checkBinary();
    if(!build.ok || build.buildId!==proof.buildId)
      throw new Error('HOST_BINARY_CHANGED_BEFORE_DISPATCH');
    attempted=true; // One-shot BEFORE evaluate, so partial hooks never retry.
    setPhase('HOST_LOADING_ORIGINAL_NATIVE_HOOKS');
    try{
      cleanupSink=runtime.setEventSink(markHostEvent);
      host=runtime.evaluate('wzm-v4-original-host-4.5.2',sources.host);
      if(!host || typeof host.go!=='function' || typeof host.snap!=='function')
        throw new Error('Original host source did not expose go/snap');
      const receipt=host.go(nativeMap,nativeGametype,enemies);
      if(receipt!==1)throw new Error('Original host go did not accept queue request');
      if(phase==='HOST_UNVERIFIED_ERROR')throw new Error('Original host signalled immediate native failure');
      setPhase('HOST_NATIVE_REQUEST_QUEUED_NOT_STARTED');
      return 1; // original host queued; NOT a world-loaded/player/bot proof
    }catch(e){fail('HOST_ORIGINAL_RUNTIME_LOAD_FAILED',e);throw e;}
  }

  function activateBots() {
    if(!worldSeen || aiStarted || !config || phase==='HOST_UNVERIFIED_ERROR')return false;
    const window=runtime.botVeneer();
    if(!window.ok){emit(window.code);return false;}
    aiStarted=true;
    try{
      const source=sourceWrapper(sources.ai,{
        WZM_BOTH_SIDES_AI:{count:config.enemies+config.friends,
          difficulty:config.nativeDifficulty}},true);
      runtime.evaluate('wzm-v4-original-marker2-ai-4.5.2',source);
      setPhase('HOST_NATIVE_AI_CREATOR_ARMED');
      return true;
    }catch(e){return fail('HOST_NATIVE_AI_CREATOR_FAILED',e);}
  }

  function activateGuard() {
    if(!pendingGuard || guardStarted || !botResult || phase==='HOST_UNVERIFIED_ERROR')return false;
    const window=runtime.botVeneer();
    if(!window.ok){emit(window.code);return false;}
    guardStarted=true;pendingGuard=false;
    try{
      const source=sourceWrapper(sources.guard,{WZM_BOT_DIFF:config.nativeDifficulty},true);
      runtime.evaluate('wzm-v4-original-ai-difficulty-4.5.2',source);
      setPhase('HOST_NATIVE_DIFFICULTY_GUARD_ARMED');
      return true;
    }catch(e){return fail('HOST_NATIVE_AI_DIFFICULTY_GUARD_FAILED',e);}
  }

  function poll() {
    if(disposed)return {ok:false,code:'HOST_DISPOSED'};
    if(phase==='HOST_UNVERIFIED_ERROR')return {ok:false,code:failure?.code||'HOST_UNVERIFIED_ERROR'};
    if(worldCandidate&&!worldSeen) {
      let snap;
      try{snap=host?.snap();}catch(e){fail('HOST_SNAPSHOT_UNAVAILABLE',e);
        return {ok:false,code:'HOST_SNAPSHOT_UNAVAILABLE'};}
      if(!snap || !Number.isInteger(snap.clc0) || snap.clc0<7) {
        emit('HOST_WORLD_CANDIDATE_WAITING_FOR_STATE7',{clc0:snap?.clc0});
        return {ok:true,code:'HOST_WORLD_CANDIDATE_WAITING_FOR_STATE7'};
      }
      worldSeen=true;worldStartAt=clock();
      setPhase('HOST_LOCAL_CLIENT_WORLD_ENTERED');
      try {
        const started=nativeClock.begin(config.durationSeconds,{worldStartAt,hostSnapshot:snap});
        const value=nativeClock.readback();
        if(started!==true || value?.verifiedNativeGameClock!==true ||
           value?.seconds!==config.durationSeconds)
          {fail('HOST_NATIVE_DURATION_START_FAILED');return {ok:false,code:'HOST_NATIVE_DURATION_START_FAILED'};}
      }catch(e){fail('HOST_NATIVE_DURATION_START_FAILED',e);
        return {ok:false,code:'HOST_NATIVE_DURATION_START_FAILED'};}
      setPhase('HOST_NATIVE_DURATION_RUNNING');
      pendingGuard=false;
      emit('HOST_AI_CREATOR_WAITING_FOR_SERVER_VENEER');
      // Bot hooks start on the NEXT safe owner poll, not inside native enterworld.
      return {ok:true,code:'HOST_NATIVE_DURATION_RUNNING'};
    }
    if(worldSeen) {
      if(!aiStarted)activateBots();
      else if(pendingGuard)activateGuard();
      if(typeof nativeClock?.endReadback==='function') {
        try {
          const end=nativeClock.endReadback();
          if(end?.verifiedNativeEnd===true) {
            setPhase('HOST_NATIVE_MATCH_ENDED');
            return {ok:true,code:'HOST_NATIVE_MATCH_END_READBACK_VERIFIED'};
          }
        } catch(e) { fail('HOST_NATIVE_DURATION_END_READBACK_FAILED',e);
          return {ok:false,code:'HOST_NATIVE_DURATION_END_READBACK_FAILED'}; }
      }
    }
    return {ok:true,code:phase};
  }

  function onLuiFrame() {
    if(disposed||!host||phase==='HOST_UNVERIFIED_ERROR')return;
    try{runtime.invokeFrameProbe();}catch(e){fail('HOST_SHARED_LUI_FRAME_PROBE_FAILED',e);}
  }

  function snapshot() {
    return Object.freeze({phase,disposed,attempted,worldCandidate,worldSeen,aiStarted,guardStarted,
      botResult,request:config&&Object.freeze({map:config.map,mode:config.mode,
        enemies:config.enemies,friends:config.friends,difficulty:config.difficulty,
        durationSeconds:config.durationSeconds}),
      proofEvents:[...proofEvents],failure,generation,
      matchStarted:false,playable:false,
      note:'Native host was requested only; world/AI/match completion require live evidence.'});
  }

  function dispose() {
    if(disposed)return;
    disposed=true;
    try{if(typeof cleanupSink==='function')cleanupSink();}catch(_){}
    if(typeof nativeClock?.dispose==='function')try{nativeClock.dispose();}catch(_){}
    // WARNING: Source-backed host has persistent Interceptor.replaceFast and
    // CModule hooks. No original detach/restore API exists. Do not re-invoke.
    setPhase('HOST_ADAPTER_DISPOSED_HOOKS_PERSIST_UNTIL_PROCESS_EXIT');
  }

  // `privateOwner` deliberately NOT present here; native stage owner captures
  // it once via bindNativeOwner(). UI actions have only the safe public port.
  return Object.freeze({preflight,configure,go,onLuiFrame,poll,snapshot,dispose});
}

export {ORIGINAL_SOURCE_HASHES};
