import assert from 'node:assert/strict';
import {createMatchPlayer} from '../match_player.js';
import {PACK_SOURCE, PACK_FILES} from '../play_runtime.js';
import {
  HOST_FUNCTION_SOURCE,PARTY_INJECTOR_SOURCE,AI_CREATOR_SOURCE,
  AI_DIFFICULTY_GUARD_SOURCE
} from '../host/embedded_sources.js';
const HOST_SOURCE='globalThis.wzmHost = '+HOST_FUNCTION_SOURCE+';';

const input = {map:'nuketown',mode:'tdm',enemies:3,friends:2,
  difficulty:'Veteran',minutes:60};
const receipt = {
  s:'botInjectFinal',experiment:'both_sides_native_ai',
  created:Array.from({length:5},(_,i)=>({slot:i+1,team:i<3?1:2,difficulty:3})),
  summary:{genuineAi:5,byTeam:{1:3,2:2},slots:Array.from({length:5},(_,i)=>({
    slot:i+1,team:i<3?1:2,state:7
  }))}
};
const guard = {
  s:'botInjectFinal',experiment:'all_native_ai_veteran_guard',
  rows:Array.from({length:5},(_,i)=>({slot:i+1,state:7,flag:2})),
  applied:Array.from({length:5},(_,i)=>({
    slot:i+1,team:i<3?1:2,difficulty:3,label:'Veteran'
  }))
};
// Native archive (2026-11-08/10): botInjectParty.applyRet=1, after.gate/cap=1,
// members.n=20 is table CAPACITY, and each occupied member has status 3.
// Final two connected party clients have [slot, state 7, party flag 1].
const partyApplied = {s:'botInjectParty',applyRet:1,
  before:{f4650:'0',f54:'0',gate:0,cap:0,members:{n:20,v:[]}},
  after:{f4650:'f0f1ce5',f54:'f0f1ce5',gate:1,cap:1,
    members:{n:20,v:[[0,3],[1,3]]}},
  slots:[[0,7,0]]};
const partyReceipt = {s:'botInjectFinal',
  slots:[[0,7,0],[1,7,1],[2,7,1]],
  members:{n:20,v:[[0,3],[1,3]]}};

function harness({rejectHost=false,throwParty=false}={}) {
  let ticket=0, history=[],worldState=6;
  const tasks=new Map(), calls=[], labels=[];
  const defer=(fn,ms)=>{let id=++ticket;tasks.set(id,{fn,ms});return id;};
  const cancel=id=>{tasks.delete(id);};
  const player=createMatchPlayer({
    onStatus:s=>labels.push(s),
    defer,cancel,
    evaluateSource(source) {
      if(source===HOST_SOURCE) {
        calls.push('host');
        globalThis.wzmHost={
          go:(...args)=>{
            calls.push(['go',...args]);
            return rejectHost?0:1;
          },snap:()=>({clc0:worldState,level:1})
        };
      } else if(source===PACK_SOURCE) {
        calls.push('pack');
      } else if(source===PARTY_INJECTOR_SOURCE) {
        if(throwParty) throw Error('simulated party hook failure');
        calls.push('party');
        globalThis.wzmBotArm=()=>calls.push('party arm');
      } else if(source===AI_CREATOR_SOURCE) {
        calls.push('ai');
        globalThis.wzmBotArm=()=>calls.push('ai arm');
      } else if(source===AI_DIFFICULTY_GUARD_SOURCE) {
        calls.push('difficulty');
        globalThis.wzmBotArm=()=>calls.push('guard arm');
      } else throw Error('unexpected embedded source');
    }
  });
  function signal(data) {
    assert.equal(typeof globalThis.__wzmRoute,'function');
    globalThis.__wzmRoute(data);
  }
  function flush(maxDelay=1000) {
    for(let i=0;i<40;i++) {
      const ready=[...tasks.entries()].find(([,job])=>job.ms<=maxDelay);
      if(!ready)break;
      const [id,job]=ready;tasks.delete(id);job.fn();
    }
  }
  function cleanup() {
    player.dispose();
    delete globalThis.wzmHost;
    delete globalThis.wzmBotArm;
    delete globalThis.WZM_BOT_ENV;
    delete globalThis.WZM_BOT_DIFF;
    delete globalThis.WZM_BOTH_SIDES_AI;
    delete globalThis.WZM_PACK_FILES;
  }
  return {player,signal,flush,cleanup,calls,labels,tasks,history,
    setWorldState:v=>{worldState=v;}};
}

function advanceToParty(h) {
  h.player.start(input);
  h.setWorldState(7);
  h.signal({s:'hostStartReturned'});
  h.signal({s:'clientEnterWorld',state:6});
  h.flush();
  assert.equal(h.player.snapshot().phase,'PARTY');
}

function completeParty(h) {
  h.signal(partyApplied);
  h.signal(partyReceipt);
  h.flush();
}

{
  const h=harness();
  assert.match(h.player.start(input),/^HOST_REQUESTED:/);
  assert.equal(h.player.snapshot().phase,'HOSTING');
  assert.equal(h.calls.filter(x=>x==='host').length,1);
  h.signal({s:'clientEnterWorld',gate:7,state:6});
  h.flush();
  assert.equal(h.player.snapshot().phase,'HOSTING',
    'enterworld without original hostStartReturned cannot forge host readiness');
  h.signal({s:'hostStartReturned'});
  h.signal({s:'clientEnterWorld',gate:7,state:6});
  h.flush();
  assert.equal(h.player.snapshot().phase,'WORLD_CANDIDATE');
  assert.equal(h.player.snapshot().partyEvaled,false,
    'a native onEnter event is not client state 7 yet');
  h.setWorldState(7);
  h.flush();
  assert.equal(h.player.snapshot().phase,'PARTY');
  assert.equal(h.player.snapshot().worldReceipt.clc0,7);
  assert.equal(globalThis.WZM_BOT_ENV.count,2);
  assert.equal(globalThis.WZM_BOT_ENV.diff,3,
    'original native party starter receives actual selected difficulty');
  assert.deepEqual(globalThis.WZM_BOT_ENV.friends,0,
    'original party primer is not the eventual selected 2 friendly AI');
  completeParty(h);
  assert.equal(h.player.snapshot().phase,'AI');
  assert.equal(h.player.snapshot().partyReceipt.nativePartyMemberCount,2);
  assert.equal(h.player.snapshot().partyReceipt.nativePartyTableCapacity,20);
  assert.deepEqual(h.player.snapshot().partyReceipt.nativePartyMemberIndexes,[0,1]);
  assert.equal(h.player.snapshot().partyReceipt.nativeConnectedPartyClients,2);
  assert.equal(globalThis.WZM_BOTH_SIDES_AI.count,5);
  assert.equal(globalThis.WZM_BOTH_SIDES_AI.difficulty,3);
  h.signal(receipt);
  h.flush();
  assert.equal(h.player.snapshot().phase,'GUARD');
  assert.equal(globalThis.WZM_BOT_DIFF,3);
  h.signal(guard);
  assert.equal(h.player.snapshot().phase,'NATIVE_AI_OBSERVED');
  assert.equal(h.player.snapshot().aiReceipt.created,5);
  assert.equal(h.player.snapshot().worldRenderVerified,false);
  assert.equal(h.player.snapshot().matchStarted,false);
  assert.equal(h.tasks.size,0,'native receipt progression clears timeouts');
  assert.match(h.labels.at(-1),/NOT verified/);
  assert.match(h.player.start(input),/^MATCH_ALREADY_ACTIVE:/);
  h.cleanup();
}
{
  const h=harness();
  h.player.start(input);
  h.setWorldState(7);
  h.signal({s:'hostStartReturned'});
  h.signal({s:'clientEnterWorld',state:6});h.flush();
  completeParty(h);
  h.signal({...receipt,created:receipt.created.slice(0,4)});
  assert.equal(h.player.snapshot().phase,'FAILED');
  assert.match(h.player.snapshot().failure,/NATIVE_AI_READBACK_FAILED/);
  assert.equal(h.player.snapshot().guardReceipt,null);
  h.signal(receipt);h.flush();
  assert.equal(h.player.snapshot().phase,'FAILED','late AI receipts cannot resurrect failure');
  h.cleanup();
}
{
  const h=harness({rejectHost:true});
  assert.match(h.player.start(input),/^HOST_SETUP_FAILED:/);
  assert.equal(h.player.snapshot().phase,'FAILED');
  h.cleanup();
}
{
  const h=harness({throwParty:true});
  h.player.start(input);
  h.setWorldState(7);
  h.signal({s:'hostStartReturned'});
  h.signal({s:'clientEnterWorld',state:6});h.flush();
  assert.equal(h.player.snapshot().phase,'FAILED');
  assert.match(h.player.snapshot().failure,/NATIVE_STAGE_EXCEPTION/);
  h.cleanup();
}
{
  const h=harness();
  h.player.start(input);
  h.signal({s:'hostStartReturned'});
  h.signal({s:'clientEnterWorld',state:0});
  h.flush();
  assert.equal(h.player.snapshot().phase,'HOSTING',
    'invalid native enterworld event cannot advance native match');
  h.cleanup();
}
{
  const h=harness();
  h.player.start(input);
  h.signal({s:'hostStartReturned'});
  h.setWorldState(7);h.signal({s:'clientEnterWorld',state:6});h.flush();
  h.signal(partyApplied);
  h.signal({s:'botInjectFinal',slots:[],members:{n:20,v:[]}});
  assert.equal(h.player.snapshot().phase,'FAILED',
    'an invented party completion without player slot cannot advance to AI');
  h.cleanup();
}
{
  const h=harness();
  h.player.start(input);
  h.signal({s:'hostStartReturned'});
  h.setWorldState(7);h.signal({s:'clientEnterWorld',state:6});h.flush();
  completeParty(h);
  h.signal(receipt);h.flush();
  h.signal({...guard,applied:guard.applied.slice(0,4)});
  assert.equal(h.player.snapshot().phase,'FAILED',
    'a difficulty guard without every native AI readback cannot pass');
  h.cleanup();
}
{
  const h=harness();
  h.player.start(input);
  h.signal({s:'err',e:'original host native start returned exception'});
  assert.equal(h.player.snapshot().phase,'FAILED',
    'the original host err/e event must fail immediately');
  h.cleanup();
}
{
  const h=harness();
  h.player.start(input);
  h.signal({s:'hostStartReturned'});
  h.setWorldState(7);h.signal({s:'clientEnterWorld',state:6});h.flush();
  completeParty(h);
  h.signal({...receipt,summary:{...receipt.summary,genuineAi:6}});
  assert.equal(h.player.snapshot().phase,'FAILED',
    'excess marker2 AI clients cannot masquerade as exact user roster');
  h.cleanup();
}
{
  const h=harness();
  h.player.start(input);
  h.signal({s:'FAULT',pc:'0x123'});
  assert.equal(h.player.snapshot().phase,'FAILED');
  assert.equal(h.player.snapshot().aiReceipt,null);
  h.cleanup();
}
{
  const h=harness();
  assert.match(h.player.start({...input,map:'verdansk'}),/^WAIT_VERDANSK_PACK:/);
  assert.equal(h.player.snapshot().hostInstalled,false);
  h.signal({s:'packInstalledApplied',matched:3,count:3000});
  h.flush();
  assert.equal(h.player.snapshot().hostInstalled,false,
    'a failed local pack registry receipt must not launch Verdansk');
  h.signal({s:'packInstalledApplied',matched:Math.ceil(PACK_FILES.length*.95),count:3000});
  h.flush();
  assert.equal(h.player.snapshot().phase,'HOSTING');
  assert.equal(h.player.snapshot().packInstalled,true);
  assert.deepEqual(h.calls.filter(x=>x==='host').length,1);
  h.cleanup();
}

// The original difficulty guard's rows() enumerates every connected native
// client. An extra marker-2 bot or a changed marker-2 slot cannot be called
// an exact match just because all selected bots received the setter.
for (const [label, extraRows] of [
  ['extra native marker2 AI', [{slot:9,state:7,flag:2}]],
  ['unknown native marker2 AI replaces expected slot', [{slot:9,state:7,flag:2}]]
]) {
  const h=harness();
  try {
    advanceToParty(h);
    completeParty(h);
    h.signal(receipt);h.flush();
    assert.equal(h.player.snapshot().phase,'GUARD');
    const observedRows=label.startsWith('extra') ? [...guard.rows,...extraRows] :
      [...guard.rows.slice(0,4),...extraRows];
    h.signal({...guard,rows:observedRows});
    assert.equal(h.player.snapshot().phase,'FAILED',label);
    assert.match(h.player.snapshot().failure,/DIFFICULTY_GUARD_FAILED/,label);
    assert.equal(h.player.snapshot().guardReceipt,null,label);
  } finally {h.cleanup();}
}

function assertPartyRejected(name,{applied=partyApplied,final=partyReceipt,
  expectedFailure='PARTY_NATIVE_READBACK_FAILED'}={}) {
  const h=harness();
  try {
    advanceToParty(h);
    if(applied!==null)h.signal(applied);
    if(final!==null)h.signal(final);
    h.flush();
    const snapshot=h.player.snapshot();
    assert.equal(snapshot.phase,'FAILED',name);
    assert.match(snapshot.failure,new RegExp(expectedFailure),name);
    assert.equal(snapshot.partyReceipt,null,name+' must not fabricate party success');
    assert.equal(snapshot.aiEvaled,false,name+' must not install AI creator');
    assert.equal(h.calls.includes('ai'),false,name+' must not execute AI source');
  } finally {h.cleanup();}
}

// The original final event does NOT include applyRet. Requiring its separate
// botInjectParty readback blocks forged/late final events even with valid slots.
assertPartyRejected('final without native party apply event',{applied:null});
assertPartyRejected('original apply rejected by native routine',{
  applied:{...partyApplied,applyRet:-1},final:null,
  expectedFailure:'PARTY_NATIVE_APPLY_FAILED'});
assertPartyRejected('integer member capacity with zero occupied members',{
  applied:{...partyApplied,after:{...partyApplied.after,
    members:{n:20,v:[]}}},final:null,
  expectedFailure:'PARTY_NATIVE_APPLY_FAILED'});
assertPartyRejected('applied native members have the wrong status',{
  applied:{...partyApplied,after:{...partyApplied.after,
    members:{n:20,v:[[0,4],[1,4]]}}},final:null,
  expectedFailure:'PARTY_NATIVE_APPLY_FAILED'});
assertPartyRejected('native apply member indexes must be unique',{
  applied:{...partyApplied,after:{...partyApplied.after,
    members:{n:20,v:[[0,3],[0,3]]}}},final:null,
  expectedFailure:'PARTY_NATIVE_APPLY_FAILED'});
assertPartyRejected('native apply member count must match party primer',{
  applied:{...partyApplied,after:{...partyApplied.after,
    members:{n:20,v:[[0,3]]}}},final:null,
  expectedFailure:'PARTY_NATIVE_APPLY_FAILED'});
assertPartyRejected('native apply must report original gate and capacity',{
  applied:{...partyApplied,after:{...partyApplied.after,gate:0}},final:null,
  expectedFailure:'PARTY_NATIVE_APPLY_FAILED'});
assertPartyRejected('native apply local client must be state 7',{
  applied:{...partyApplied,slots:[[0,6,0]]},final:null,
  expectedFailure:'PARTY_NATIVE_APPLY_FAILED'});
assertPartyRejected('zero final members must not reach AI',{
  final:{...partyReceipt,members:{n:20,v:[]}}});
assertPartyRejected('original member status 4 is not successful party status',{
  final:{...partyReceipt,members:{n:20,v:[[0,4],[1,4]]}}});
assertPartyRejected('final native member indexes changed',{
  final:{...partyReceipt,members:{n:20,v:[[0,3],[2,3]]}}});
assertPartyRejected('final member table capacity changed',{
  final:{...partyReceipt,members:{n:21,v:[[0,3],[1,3]]}}});
assertPartyRejected('final cannot claim 20 occupied party members',{
  final:{...partyReceipt,members:{n:20,v:Array.from({length:20},(_,i)=>[i,3])}}});
assertPartyRejected('final local client state must still be 7',{
  final:{...partyReceipt,slots:[[0,6,0],[1,7,1],[2,7,1]]}});
assertPartyRejected('final only one native party client connected',{
  final:{...partyReceipt,slots:[[0,7,0],[1,7,1]]}});
assertPartyRejected('final second native party client not in state 7',{
  final:{...partyReceipt,slots:[[0,7,0],[1,7,1],[2,5,1]]}});
assertPartyRejected('final native party slot marker missing',{
  final:{...partyReceipt,slots:[[0,7,0],[1,7,1],[2,7,0]]}});
assertPartyRejected('final excess native party clients',{
  final:{...partyReceipt,slots:[[0,7,0],[1,7,1],[2,7,1],[3,7,1]]}});
assertPartyRejected('final duplicate slot identity',{
  final:{...partyReceipt,slots:[[0,7,0],[1,7,1],[1,7,1]]}});

console.log('PASS v6: original party apply/native member + client slot readbacks, 19 fail-closed regressions, exact AI roster and other match gates');
