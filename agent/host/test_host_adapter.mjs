import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  HOST_FUNCTION_SOURCE,AI_CREATOR_SOURCE,AI_DIFFICULTY_GUARD_SOURCE,
  ORIGINAL_SOURCE_HASHES
} from './embedded_sources.js';
import {
  PRELAUNCH_HOST_CAPABILITIES,canonicalHostRequest,verifyBotResult,
  createInProcessHostAdapter
} from './host_adapter.js';

const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const [name,s] of Object.entries({HOST_FUNCTION_SOURCE,AI_CREATOR_SOURCE,AI_DIFFICULTY_GUARD_SOURCE})){
  assert.equal(sha(s),ORIGINAL_SOURCE_HASHES[name].embedded_sha256,'authoritative generated JS digest '+name);
  // Syntax-only: the original side-effectful 110KB hook module is NEVER run
  // by this test. Only a mock runtime gets a copy of its source.
  assert.doesNotThrow(()=>new Function(s),name+' source must parse');
}
assert.equal(HOST_FUNCTION_SOURCE.includes('Interceptor.attach(at(0x337c1c0)'),false,
  'No competing 0x337c1c0 original host LUI hooks');
assert.ok(HOST_FUNCTION_SOURCE.includes('WZM_HOST_MATCH_PROBE_FRAME'));
assert.ok(AI_CREATOR_SOURCE.includes('queue(0x265ea3c,[ai,ptr(BOT_DIFF)])'),
  'Real native AI difficulty setter must receive selected value');
assert.ok(AI_CREATOR_SOURCE.includes('if(df!==BOT_DIFF)'),
  'AI readback must compare selected value');
assert.ok(AI_DIFFICULTY_GUARD_SOURCE.includes('WZM_BOT_DIFF'),
  'Real persistent native difficulty guard accepts configuration');

// Strict TUI maps, modes and native match request field propagation.
const good=canonicalHostRequest({nativeMapId:'mp_mgl_crash2',
  nativeModeHash:'0x3f9bd6e4038d651d',enemyBots:3,friendlyBots:2,
  difficulty:'Hardened',nativeDifficulty:2,durationSeconds:5700,requiredZones:[]});
assert.equal(good.ok,true);
assert.equal(good.enemies,3);assert.equal(good.friends,2);
assert.equal(good.nativeDifficulty,2);assert.equal(good.durationSeconds,5700);
assert.equal(canonicalHostRequest({}).ok,false,'No arbitrary native aliases');
assert.equal(canonicalHostRequest({map:'broadcast',mode:'tdm',enemies:5,friends:0,
  difficulty:'Veteran',minutes:60,requiredZones:[]}).code,'HOST_ZONE_CAPABILITY_MISMATCH');
assert.equal(canonicalHostRequest({map:'crash',mode:'tdm',enemies:1,friends:0,
  difficulty:'Veteran',minutes:60,nativeDifficulty:0}).code,'HOST_NATIVE_DIFFICULTY_MISMATCH');
assert.equal(canonicalHostRequest({map:'crash',mode:'tdm',enemies:1,friends:0,
  difficulty:'Veteran',minutes:60,durationSeconds:180}).code,'HOST_NATIVE_DURATION_MISMATCH');

function fixture({withClock=true}={}) {
  const evals=[];
  const notices=[];
  let handler=null, owner=null, worldState=0, veneer=false, ended=false;
  let readbackSeconds=0, configuredClock=0, startedClock=0, refusedClock=false;
  let buildOk=true;
  const host={go(...args){evals.push({kind:'go',args});return 1;},
    snap(){return {clc0:worldState,level:0,netState:0};}};
  const runtime={
    checkBinary(){return buildOk?{ok:true,buildId:'9528f1d264b40639b57e14998e01d080'}:
      {ok:false,code:'HOST_BINARY_OPCODE_MISMATCH'};},
    botVeneer(){return veneer?{ok:true,code:'HOST_SERVER_VENEER_VERIFIED'}:
      {ok:false,code:'HOST_SERVER_VENEER_NOT_PREPARED'};},
    setEventSink(callback){handler=callback;return()=>{if(handler===callback)handler=null;};},
    evaluate(name,source) {
      assert.ok(name.startsWith('wzm-v4-original-'));
      evals.push({kind:'eval',name,source});
      return name.includes('original-host')?host:undefined;
    },
    invokeFrameProbe(){evals.push({kind:'shared-native-frame-probe'});},
  };
  const nativeClock={
    configure(seconds){configuredClock++;readbackSeconds=seconds;return !refusedClock;},
    readback(){return {verifiedNativeGameClock:!refusedClock,seconds:readbackSeconds};},
    begin(seconds){startedClock++;return seconds===readbackSeconds&&!refusedClock;},
    endReadback(){return {verifiedNativeEnd:ended};},
  };
  const port=createInProcessHostAdapter({runtime,
    nativeClock:withClock?nativeClock:null,bindNativeOwner:x=>owner=x,
    notify:ev=>notices.push(ev),clock:()=>123456});
  return {port,evals,notices,nativeClock,
    owner:()=>owner,emit:e=>{assert.ok(handler);handler(e);},
    setWorld:v=>worldState=v,setVeneer:v=>veneer=v,setEnded:v=>ended=v,
    refuseClock:v=>refusedClock=v,setBuild:v=>buildOk=v,
    get configuredClock(){return configuredClock},get startedClock(){return startedClock}};
}

function markEligible(f) {
  for(const stage of PRELAUNCH_HOST_CAPABILITIES)
    f.owner().mark(stage,true,{verified:true,source:'native-readback'});
}

const original=good;
const f=fixture();
assert.equal('mark' in f.port,false,'UI-facing port has NO mutable verification method');
assert.equal(f.port.preflight(original).code,'HOST_NATIVE_PREREQUISITES_MISSING');
assert.equal(f.evals.length,0,'not even CModule hooks may be loaded during menu/init');
assert.throws(()=>f.owner().mark('HOST_PARTY_PRECONDITIONS_VERIFIED',true),/HOST_NATIVE_PROOF_REQUIRED/);
markEligible(f);
assert.equal(f.port.preflight(original).ok,true);
assert.equal(f.port.configure(original),true,'real native duration driver successfully read back');
assert.equal(f.configuredClock,1);
assert.equal(f.port.snapshot().phase,'HOST_CONFIG_NATIVE_VERIFIED');
assert.equal(f.evals.length,0,'configure must NOT eagerly install invasive host hooks');
assert.throws(()=>f.port.go('mp_mgl_crash2','bad',3),/HOST_GO_CONFIG_MISMATCH/);
assert.equal(f.evals.length,0);
assert.equal(f.port.go(original.nativeMapId,original.nativeModeHash,original.enemies),1);
assert.equal(f.evals.filter(x=>x.kind==='eval').length,1);
assert.deepEqual(f.evals.find(x=>x.kind==='go').args,[original.nativeMapId,original.nativeModeHash,3]);
assert.throws(()=>f.port.go(original.nativeMapId,original.nativeModeHash,3),/HOST_CONFIGURATION_UNVERIFIED/);
f.port.onLuiFrame();
assert.ok(f.evals.some(x=>x.kind==='shared-native-frame-probe'));
// A forged `clientEnterWorld` event with no native state7 readback does not
// arm any native marker-2 bot script.
f.emit({s:'clientEnterWorld',state:6});
assert.equal(f.port.snapshot().worldSeen,false);
assert.equal(f.port.poll().code,'HOST_WORLD_CANDIDATE_WAITING_FOR_STATE7');
f.setWorld(7);
assert.equal(f.port.poll().code,'HOST_NATIVE_DURATION_RUNNING');
assert.equal(f.port.snapshot().worldSeen,true);
assert.equal(f.startedClock,1,'real native clock.begin invoked only after world readback');
assert.equal(f.evals.filter(x=>x.kind==='eval').length,1,'bot native script is staged later');
f.port.poll();
assert.equal(f.evals.filter(x=>x.kind==='eval').length,1,'no bot hook until original server veneer is verified');
f.setVeneer(true);f.port.poll();
assert.equal(f.evals.filter(x=>x.kind==='eval').length,2);
const creator=f.evals.find(x=>x.kind==='eval'&&x.name.includes('marker2-ai'));
assert.ok(creator.source.includes('"count":5,"difficulty":2'),
  'actual original marker-2 creator must receive 3 enemy + 2 ally and difficulty 2');
assert.ok(creator.source.includes('globalThis.wzmBotArm();'),
  'native bot creation is actually armed after world enter');
const rows=Array.from({length:5},(_,slot)=>({slot,state:7,flag:2}));
const slots=rows.map((x,i)=>({slot:i,state:7,team:i<3?1:2}));
const summary={genuineAi:5,byTeam:{1:3,2:2},slots};
const created=slots.map(x=>({slot:x.slot,team:x.team,difficulty:2}));
assert.equal(verifyBotResult(summary,rows,original,created).ok,true);
assert.equal(verifyBotResult({...summary,byTeam:{1:5}},rows,original,created).ok,false);
assert.equal(verifyBotResult(summary,[...rows.slice(1)],original,created).ok,false);
assert.equal(verifyBotResult(summary,rows,original,created.map(x=>({...x,difficulty:3}))).code,
  'HOST_AI_DIFFICULTY_READBACK_MISMATCH','old forced Veteran cannot prove Hardened selection');
f.emit({s:'botInjectFinal',experiment:'both_sides_native_ai',summary,rows,created});
assert.equal(f.port.snapshot().botResult.ok,true);
f.port.poll();
const guard=f.evals.find(x=>x.kind==='eval'&&x.name.includes('original-ai-difficulty'));
assert.ok(guard.source.includes('globalThis.WZM_BOT_DIFF=2;'));
assert.ok(guard.source.includes('globalThis.wzmBotArm();'));
f.emit({s:'botInjectFinal',experiment:'all_native_ai_veteran_guard',applied:[],rows});
assert.equal(f.port.snapshot().phase,'HOST_GUARD_RUNNING_WORLD_PLAY_NOT_VERIFIED');
assert.equal(f.port.snapshot().matchStarted,false);
f.setEnded(true);
assert.equal(f.port.poll().code,'HOST_NATIVE_MATCH_END_READBACK_VERIFIED');
f.port.dispose();
assert.equal(f.port.snapshot().disposed,true);

// Missing native match-time driver => cannot issue original host go merely by
// using Python's seconds watchdog or a fake JS-only countdown.
const noClock=fixture({withClock:false});
markEligible(noClock);
assert.equal(noClock.port.preflight(original).code,'HOST_REAL_NATIVE_DURATION_UNAVAILABLE');
assert.equal(noClock.port.configure(original),false);
assert.equal(noClock.evals.length,0);
const badClock=fixture();markEligible(badClock);badClock.refuseClock(true);
assert.equal(badClock.port.configure(original),false);
assert.equal(badClock.evals.length,0);
const wrongBinary=fixture();markEligible(wrongBinary);wrongBinary.setBuild(false);
assert.equal(wrongBinary.port.configure(original),false);
assert.equal(wrongBinary.evals.length,0);

// Original host callback does not self-clean: never install it twice even if
// owner changes LUI generation and asks to reconfigure.
const reset=fixture();markEligible(reset);
assert.equal(reset.port.configure(original),true);
assert.equal(reset.port.go(original.nativeMapId,original.nativeModeHash,3),1);
reset.owner().reset('LUI_GENERATION_CHANGED');
assert.equal(reset.port.snapshot().phase,'HOST_UNVERIFIED_ERROR');
assert.equal(reset.port.configure(original),false);
assert.equal(reset.evals.filter(x=>x.kind==='eval').length,1);

console.log('PASS v4 in-process original host: source pins/single LUI owner, original go, private native capability, real clock readback or fail closed, map+friend+AI difficulty propagation, original marker2 + guard staged on verified world, team readback, no false playable claim');
