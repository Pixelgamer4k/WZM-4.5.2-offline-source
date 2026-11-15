import assert from 'node:assert/strict';
import {FENCE_LUA_SOURCE,FENCE_SOURCE_BYTE_LENGTH} from './fence_embedded.js';
import {WZM_452_GUARDS,createNativeBootSupervisor} from './native_boot.js';
import {GAME_FINGERPRINT} from './unlock/fingerprint.js';

class Ptr {
  constructor(n){this.n=n;}
  add(v){return new Ptr(this.n+v);}
  isNull(){return this.n===0;}
  compare(v){return this.n===v.n?0:this.n<v.n?-1:1;}
  toString(){return '0x'+this.n.toString(16);}
}
const P=n=>new Ptr(n);
const PROBE = "local W=rawget(_G,'_WZM'); local L=rawget(_G,'LUI'); if W and W.play == true and L and L.primaryRoot then return 'MAINMENU_READY' end return 'WAIT_MAINMENU'";
// The recovery probe checks the real archived Play button without _WZM.play.
const RECOVERY_PROBE = `local L=rawget(_G,'LUI')
local root=L and L.primaryRoot
if not root then return 'WAIT_MAINMENU' end
local remaining=512
local function hasPlay(e,d)
  if not e or d>12 or remaining<=0 then return false end
  remaining=remaining-1
  if tostring(e.id)=='xhash: #x0d6362796dd5f31d1' then return true end
  local c=e:getFirstChild()
  while c and remaining>0 do
    remaining=remaining-1
    if hasPlay(c,d+1) then return true end
    c=c:getNextSibling()
  end
  return false
end
local ok,found=pcall(hasPlay,root,0)
return ok and found and 'MAINMENU_PLAY_PRESENT' or 'WAIT_MAINMENU'`;

function fixture({wrongBuild=false,wrongCode=false}={}) {
  const base=P(0x100000000),holder=P(0x70001000),top=P(0x70003000);
  let L=P(0x70002000),luaAvailable=true;
  const mod={name:'libgame.so',base,size:GAME_FINGERPRINT.elf_mapped_page_bytes};
  const ranges=[{base,size:0x2000,protection:'r--'},
    {base:base.add(0x10a6000),size:0x4290170,protection:'r-x'},
    {base:base.add(0x5337170),size:0x1b6af8,protection:'r--'},
    {base:P(0x70000000),size:0x100000,protection:'rw-'}];
  const values=new Map();
  for(const {offset,hex} of WZM_452_GUARDS.prologues)values.set(base.n+offset,hex);
  values.set(base.n+GAME_FINGERPRINT.gnu_build_id_rva,GAME_FINGERPRINT.gnu_build_id_hex);
  for(const window of GAME_FINGERPRINT.code_windows)
    values.set(base.n+window.rva,window.bytes_hex);
  if(wrongBuild)values.set(base.n+GAME_FINGERPRINT.gnu_build_id_rva,'00'.repeat(16));
  if(wrongCode)values.set(base.n+GAME_FINGERPRINT.code_windows[0].rva,'00'.repeat(32));
  let now=0, attached=null, attaches=0, restores=0, frameCallbacks=0;
  let matchPending=false,matchObserved=false,menuReadyFrames=0,inMatchFrames=0;
  let stage=[],ready=[],continuity=[],kind='fence',menu=false,recoveryPresent=false;
  let fenceLoads=0,menuProbes=0,recoveryProbes=0;
  const runtime={
    now:()=>now,arch:()=> 'arm64',findModule:()=>mod,
    range(p){return ranges.find(r=>p.n>=r.base.n&&p.n<r.base.n+r.size)||null;},
    hexBytes(p,n){const s=values.get(p.n);if(!s)throw Error('unexpected code query');return s.slice(0,n*2);},
    readPointer(p){
      if(p.n===base.n+WZM_452_GUARDS.luaSlot)return luaAvailable?holder:P(0);
      if(p.n===holder.n)return L;
      if(p.n===L.n+0x28)return top;
      throw Error('unexpected pointer read '+p);
    },
    writePointer(p,v){assert.equal(p.n,L.n+0x28);assert.equal(v,top);restores++;},
    nullPointer:()=>P(0),
    readUtf8(){return kind==='probe'?(menu?'MAINMENU_READY':'WAIT_MAINMENU'):
      kind==='recovery'?(recoveryPresent?'MAINMENU_PLAY_PRESENT':'WAIT_MAINMENU'):
      'installed layer=true cond=true pd=9';},
    createBindings({source,sourceByteLength,menuProbeSource,menuRecoveryProbeSource}){
      assert.equal(source,FENCE_LUA_SOURCE);assert.equal(sourceByteLength,FENCE_SOURCE_BYTE_LENGTH);
      assert.equal(menuProbeSource,PROBE);
      assert.equal(menuRecoveryProbeSource,RECOVERY_PROBE);
      return {
        load(_L,_buffer,length){
          kind=length===FENCE_SOURCE_BYTE_LENGTH?'fence':
            length===RECOVERY_PROBE.length?'recovery':'probe';
          if(kind==='fence')fenceLoads++;
          if(kind==='probe')menuProbes++;
          if(kind==='recovery')recoveryProbes++;
          return 0;
        },
        pcall(){return 0;},toString(){return P(0x70005000);},
        chunkName:P(0x70006000),fenceBuffer:P(0x70007000),
        menuProbeBuffer:P(0x70008000),menuProbeByteLength:PROBE.length,
        menuRecoveryProbeBuffer:P(0x70009000),
        menuRecoveryProbeByteLength:RECOVERY_PROBE.length
      };
    },
    attach(p,cb){assert.equal(p.n,base.n+WZM_452_GUARDS.frame);attaches++;attached=cb;
      return {detach(){attached=null;}};}
  };
  const supervisor=createNativeBootSupervisor({runtime,startMs:0,
    fenceSource:FENCE_LUA_SOURCE,fenceByteLength:FENCE_SOURCE_BYTE_LENGTH,
    fingerprint:GAME_FINGERPRINT,menuProbeSource:PROBE,
    menuRecoveryProbeSource:RECOVERY_PROBE,
    notifyStage:x=>stage.push(x),notifyReady:x=>ready.push(x),
    isNativeMatchPending:()=>matchPending,
    isNativeMatchObserved:()=>matchObserved,
    notifyMatchUiContinuity:x=>continuity.push(x),
    onVerifiedLuiFrame(ctx){assert.equal(ctx.L,L);frameCallbacks++;
      if(ctx.menuReady) menuReadyFrames++;
      else inMatchFrames++;}
  });
  return {supervisor,stage,ready,continuity,setMenu:v=>menu=v,
    setRecoveryPresent:v=>recoveryPresent=v,
    setMatchPending:v=>matchPending=v,
    setMatchObserved:v=>matchObserved=v,
    setLuaState:v=>L=P(v),setLuaAvailable:v=>luaAvailable=v,
    setTime:v=>now=v,frame:n=>{for(let i=0;i<n;i++)attached();},
    get attaches(){return attaches},get frameCallbacks(){return frameCallbacks},
    get menuReadyFrames(){return menuReadyFrames},get inMatchFrames(){return inMatchFrames},
    get restores(){return restores},get fenceLoads(){return fenceLoads},
    get menuProbes(){return menuProbes},get recoveryProbes(){return recoveryProbes}};
}

const f=fixture();
f.setTime(14999);f.supervisor.tick();assert.equal(f.attaches,0);
f.setTime(15000);f.supervisor.tick();assert.equal(f.attaches,1);
f.setMatchPending(true);
f.frame(10);
assert.equal(f.supervisor.snapshot().nativeReady,false,
  'offline fence execution by itself must NOT show the floating ball');
assert.equal(f.frameCallbacks,0,
  'match request cannot bypass never-verified original MainMenu');
f.setMatchPending(false);
assert.equal(f.supervisor.snapshot().bootStage,'WAIT_MAINMENU_PLAY_BUTTON');
assert.equal(f.restores,2,'stack restored for both original fence and Play UI probe');
assert.equal(f.frameCallbacks,0,'ownership queue must not be processed before verified menu');
f.setMenu(true);f.frame(10);
assert.equal(f.supervisor.snapshot().nativeReady,true);
assert.equal(f.supervisor.snapshot().bootStage,'MAINMENU_FENCE_READY');
assert.deepEqual(f.ready,[true]);
assert.equal(f.frameCallbacks,1,'one shared LUI callback after genuine MainMenu ready');
assert.equal(f.attaches,1,'no competing native hook');
f.setRecoveryPresent(false);
f.setMenu(false);f.frame(10);
assert.equal(f.supervisor.snapshot().nativeReady,true,
  'the game leaving its proven main menu must not lose the owned LUI frame');
assert.equal(f.supervisor.snapshot().bootStage,'LUI_ACTIVE_OUTSIDE_MAINMENU');
assert.equal(f.frameCallbacks,2,
  'party/AI host stage must reuse original frame after genuine Play menu exits');
assert.equal(f.attaches,1,'post-menu native stage cannot install a second LUI hook');
const restoreBeforeMatch=f.restores;
f.setMatchPending(true);f.frame(10);
assert.equal(f.supervisor.snapshot().bootStage,'IN_MATCH_NATIVE_LUI_FRAME');
assert.equal(f.inMatchFrames,2,'native host and party share original LUI frame');
assert.equal(f.restores,restoreBeforeMatch,
  'menu-only Lua fence MUST NOT be rerun during native match');
assert.equal(f.attaches,1,'in-game native callback must reuse exactly one hook');
f.supervisor.dispose();

// A proven menu survives a reconstructed in-match LUI as VISIBILITY only. The
// new VM is not certified for a fresh menu/unlock, and the Play fence must not
// execute while the actual original Play widget is absent.
{
  const game=fixture();game.setTime(15000);game.supervisor.tick();
  game.setMenu(true);game.frame(10);
  assert.deepEqual(game.ready,[true]);
  game.setMatchPending(true);
  const before=game.fenceLoads;
  game.setLuaState(0x70002100);game.frame(10);
  assert.equal(game.supervisor.snapshot().nativeReady,false,
    'new LUI VM must still require exact menu re-verification');
  assert.equal(game.supervisor.snapshot().matchUiContinuity,true,
    'floating controls retain prior MainMenu visibility through match VM changes');
  assert.deepEqual(game.ready,[true,false]);
  assert.deepEqual(game.continuity,[true]);
  assert.equal(game.fenceLoads,before,'in-match VM must not run MainMenu-only Lua fence');
  assert.equal(game.recoveryProbes,0,'pending native host uses only native in-game frame');
  assert.equal(game.inMatchFrames,1);

  // Losing the in-game LUI pointer temporarily should not destroy a verified
  // match's controls or grant menu readiness again.
  game.setLuaAvailable(false);game.frame(10);
  assert.equal(game.supervisor.snapshot().matchUiContinuity,true);
  assert.equal(game.supervisor.snapshot().nativeReady,false);
  game.setLuaAvailable(true);game.frame(10);
  assert.equal(game.fenceLoads,before);

  // NATIVE_AI_OBSERVED is terminal to the host setup. It must NOT prevent
  // looking for the original MainMenu Play widget after a match.
  game.setMatchPending(false);game.setMatchObserved(true);
  game.setMenu(true); // _WZM alone must never forge the widget probe.
  game.setRecoveryPresent(false);game.frame(10);
  assert.equal(game.supervisor.snapshot().nativeReady,false);
  assert.equal(game.fenceLoads,before);
  assert.ok(game.recoveryProbes>0);
  assert.equal(game.supervisor.snapshot().bootStage,'IN_MATCH_NATIVE_LUI_FRAME');
  assert.equal(game.supervisor.snapshot().matchUiContinuity,true);
  assert.ok(game.inMatchFrames>=3,'observed match callbacks remain alive');

  game.setRecoveryPresent(true);
  game.setMenu(false);game.frame(10);
  assert.equal(game.fenceLoads,before+1,
    'fence may run ONLY after original Play widget returns');
  assert.equal(game.supervisor.snapshot().nativeReady,false,
    'a visible widget without successful original Play status is not readiness');
  game.setMenu(true);game.frame(10);
  assert.equal(game.supervisor.snapshot().nativeReady,true);
  assert.equal(game.supervisor.snapshot().matchUiContinuity,false);
  assert.deepEqual(game.ready,[true,false,true]);
  assert.deepEqual(game.continuity,[true,false]);
  assert.equal(game.menuReadyFrames,2,'new VM MainMenu re-verification restarts true menu callback');
  assert.equal(game.attaches,1,'VM recovery never installs an additional native frame hook');
  game.supervisor.dispose();
}

// A failed/ended native match may not keep the overlay alive indefinitely when
// neither genuine MainMenu nor an observed in-game continuation remains.
{
  const ended=fixture();ended.setTime(15000);ended.supervisor.tick();
  ended.setMenu(true);ended.frame(10);
  ended.setMatchPending(true);ended.setLuaState(0x70002100);ended.frame(10);
  assert.equal(ended.supervisor.snapshot().matchUiContinuity,true);
  ended.setMatchPending(false);ended.setMatchObserved(false);
  ended.setRecoveryPresent(false);ended.frame(10);
  assert.equal(ended.supervisor.snapshot().matchUiContinuity,false);
  assert.equal(ended.supervisor.snapshot().nativeReady,false);
  assert.deepEqual(ended.continuity,[true,false]);
  assert.equal(ended.fenceLoads,1,'no menu-only fence when match ended without original widget');
  ended.supervisor.dispose();
}

// A Lua rebuild outside a previously verified match loses readiness and hides
// the UI until the same authentic widget + original fence can be proven again.
{
  const back=fixture();back.setTime(15000);back.supervisor.tick();
  back.setMenu(true);back.frame(10);back.setLuaState(0x70002100);
  back.setMenu(false);back.setRecoveryPresent(false);back.frame(10);
  assert.deepEqual(back.ready,[true,false]);
  assert.equal(back.supervisor.snapshot().matchUiContinuity,false);
  assert.equal(back.supervisor.snapshot().nativeReady,false);
  assert.equal(back.fenceLoads,1,'unverified menu cannot cause fence execution');
  back.setRecoveryPresent(true);back.setMenu(true);back.frame(10);
  assert.equal(back.supervisor.snapshot().nativeReady,true);
  back.supervisor.dispose();
}

for(const options of [{wrongBuild:true},{wrongCode:true}]) {
  const g=fixture(options);g.setTime(15000);g.supervisor.tick();
  assert.equal(g.attaches,0,'tampered ELF identity must never get an Interceptor');
  assert.equal(g.supervisor.snapshot().bootStage,'NATIVE_UNSUPPORTED');
  g.supervisor.dispose();
}
console.log('PASS rootless main-menu gate: offline Lua alone cannot show ball; original Play UI required, original native build-ID+code windows fail closed, one frame hook, two Lua stack restores');
