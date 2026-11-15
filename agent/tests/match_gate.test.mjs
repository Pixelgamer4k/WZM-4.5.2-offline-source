import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {ORIGINAL_MAPS,ORIGINAL_MODES,TUI_DEFAULT_MATCH,validateOfflineMatchRequest}
  from '../match_contract.js';
import {REQUIRED_NATIVE_MATCH_STAGES,createMatchRequestGate}
  from '../match_request_gate.js';

assert.equal(ORIGINAL_MAPS.length,8);
assert.equal(ORIGINAL_MODES.length,6);
const thisDir=dirname(fileURLToPath(import.meta.url));
const originalRegistry=JSON.parse(readFileSync(resolve(thisDir,
  '../../../../WarzoneMobileOffline/analysis/wzm_tui_script_extraction_20261110/command_registry.json'),'utf8'));
assert.deepEqual(ORIGINAL_MAPS.map(x=>x.id),
  originalRegistry.game_config.maps.map(x=>x.aliases[0] === 'rebirth' ? 'rebirth' :
    x.aliases[0]), 'Map list must match the extracted original ./wzm order/aliases');
assert.deepEqual(ORIGINAL_MAPS.map(x=>x.native),
  originalRegistry.game_config.maps.map(x=>x.map_id));
assert.deepEqual(ORIGINAL_MODES.map(x=>x.native),
  originalRegistry.game_config.modes.map(x=>x.hash));
assert.deepEqual([TUI_DEFAULT_MATCH.enemies,TUI_DEFAULT_MATCH.friends,
  TUI_DEFAULT_MATCH.minutes], [originalRegistry.game_config.defaults.enemies,
  originalRegistry.game_config.defaults.friends,originalRegistry.game_config.defaults.minutes]);
assert.deepEqual(TUI_DEFAULT_MATCH,{map:'nuketown',mode:'tdm',enemies:5,
  friends:0,difficulty:'Veteran',minutes:60});
for (const map of ORIGINAL_MAPS) {
  const x=validateOfflineMatchRequest({map:map.id});
  assert.equal(x.ok,true,map.id);
  assert.equal(x.nativeMapId,map.native);
  assert.equal(x.nativeHostReady,false);
}
for (const mode of ORIGINAL_MODES) {
  const x=validateOfflineMatchRequest({mode:mode.id});
  assert.equal(x.ok,true,mode.id);
  assert.equal(x.nativeModeHash,mode.native);
}
assert.equal(validateOfflineMatchRequest({map:'not_a_map'}).code,'UNKNOWN_ORIGINAL_MAP');
assert.equal(validateOfflineMatchRequest({enemies:6,friends:3}).code,'ROSTER_EXCEEDS_NATIVE_LIMIT');
assert.equal(validateOfflineMatchRequest({difficulty:'Unreal'}).code,'UNKNOWN_AI_DIFFICULTY');

const events=[];
const calls=[];
const configurations=[];
let source=null;
const control=createMatchRequestGate({notify:event=>events.push(event),
  bindNativeVerifier:writer=>{source=writer;},
  hostAdapter:{
    configure(config){configurations.push(config);return true;},
    go(...args){calls.push(args);return {dispatched:true};}
  }});
assert.equal(control.verifier,undefined,
  'Public match port must NEVER expose a mutable native-capability writer');
assert.ok(source !== null, 'Only the native owner receives the private writer');
assert.equal(control.inspect({}).code,'NATIVE_MATCH_PREREQUISITES_MISSING');
assert.ok(control.inspect({}).missing.includes('LOCAL_DDL_PROFILE_BOUND'));
assert.equal(control.request({}).accepted,false);
assert.equal(calls.length,0,'Never invoke the real host without native readiness');
assert.throws(()=>source.set('UNKNOWN_STAGE',true),/Unknown native capability/);
for(const stage of REQUIRED_NATIVE_MATCH_STAGES) source.set(stage,true);
assert.equal(control.inspect({}).code,'VERIFIED_MATCH_READY_TO_QUEUE');
const queued=control.request({});
assert.equal(queued.accepted,true);
assert.equal(queued.code,'MATCH_QUEUED_NOT_STARTED');
assert.equal(control.request({}).code,'MATCH_ALREADY_QUEUED');
assert.equal(calls.length,0,'Click enqueues only; original host not run from UI callback');
const result=control.drain();
assert.equal(result.code,'HOST_REQUEST_SENT_WORLD_NOT_VERIFIED');
assert.equal(result.matchStarted,false);
assert.deepEqual(calls,[['mp_mgl_nuketown','0x3f9bd6e4038d651d',5]]);
assert.equal(configurations.length,1);
assert.equal(configurations[0].friendlyBots,0);
assert.equal(configurations[0].difficulty,'Veteran');
assert.equal(configurations[0].nativeDifficulty,3);
assert.equal(configurations[0].durationSeconds,3600);
assert.equal(control.drain().code,'NO_MATCH_REQUEST');

const altered={map:'crash',mode:'tdm',enemies:3,friends:2,
  difficulty:'Hardened',minutes:95};
assert.equal(control.request(altered).accepted,true);
const alteredResult=control.drain();
assert.equal(alteredResult.code,'HOST_REQUEST_SENT_WORLD_NOT_VERIFIED');
assert.deepEqual(calls[1],['mp_mgl_crash2','0x3f9bd6e4038d651d',3]);
assert.equal(configurations[1].friendlyBots,2);
assert.equal(configurations[1].nativeDifficulty,2);
assert.equal(configurations[1].difficulty,'Hardened');
assert.equal(configurations[1].durationSeconds,5700);

const maps=control.inspect({map:'broadcast'});
assert.ok(maps.missing.includes('BROADCAST_ZONE_INJECTION'));
assert.ok(maps.missing.includes('VERDANSK_PACK_REGISTRY'));
assert.ok(maps.missing.includes('ENTITY_CHECK_GUARD'));
assert.equal(control.request({map:'broadcast'}).accepted,false);

const noHost=createMatchRequestGate();
assert.ok(noHost.inspect({}).missing.includes('HOST_GADGET_NOT_INTEGRATED'));
assert.equal(noHost.request({}).accepted,false);
assert.equal(noHost.verifier,undefined);

let partialVerifier;
const partialHost=createMatchRequestGate({
  bindNativeVerifier:writer=>{partialVerifier=writer;},
  hostAdapter:{go(){throw Error('Must not dispatch incomplete configuration')}}
});
for(const stage of REQUIRED_NATIVE_MATCH_STAGES) partialVerifier.set(stage,true);
assert.ok(partialHost.inspect({}).missing.includes('HOST_BOT_DIFFICULTY_DURATION_UNWIRED'));
assert.equal(partialHost.request({}).accepted,false);

let rejectedVerifier;
const rejectedCalls=[];
const rejected=createMatchRequestGate({
  bindNativeVerifier:writer=>{rejectedVerifier=writer;},
  hostAdapter:{configure(){return false;},go(){rejectedCalls.push('go');}}
});
for(const stage of REQUIRED_NATIVE_MATCH_STAGES) rejectedVerifier.set(stage,true);
assert.equal(rejected.request({}).accepted,true);
assert.equal(rejected.drain().code,'HOST_CONFIGURATION_UNVERIFIED');
assert.equal(rejectedCalls.length,0,'Cannot call native host if full settings are rejected');

control.request({});
source.reset();
assert.equal(control.snapshot().pending,null);
assert.equal(control.drain().code,'NO_MATCH_REQUEST');
assert.equal(control.inspect({}).code,'NATIVE_MATCH_PREREQUISITES_MISSING');
control.dispose();
assert.equal(control.request({}).code,'MATCH_PORT_DISPOSED');
assert.throws(()=>source.set('MAINMENU_FENCE_READY',true),/verification unavailable/);

let failureVerifier;
const failure=createMatchRequestGate({
  bindNativeVerifier:writer=>{failureVerifier=writer;},
  hostAdapter:{configure(){return true;},go(){throw Error('native host unavailable')}}
});
for(const stage of REQUIRED_NATIVE_MATCH_STAGES) failureVerifier.set(stage,true);
failure.request({});
assert.equal(failure.drain().code,'HOST_REQUEST_FAILED');
assert.equal(events.some(e=>e.code==='MATCH_CANCELLED_NATIVE_RESET'),true);
console.log('PASS v3 original-TUI match and private verifier gate: 8 maps/6 modes, 5/0 Veteran, public API cannot forge native proof, explicit friend/difficulty/duration configuration, zone/reset/error safeguards');
