import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ORIGINAL_PROFILE_LUA,ORIGINAL_HUB,GAME_452_FINGERPRINT as FP} from './embedded_assets.js';
import {sha256Text,sha256Bytes,fromHex} from './sha256.js';
import {validateGearFrame} from './identity.js';
import {NativeProfilePort,PROFILE_452} from './profile_native.js';
import {NativePreviewSafety} from './preview_guard.js';
import {OriginalHubLoader} from './hub_loader.js';
import {createGearNativeAdapter} from './native_adapter.js';
import {parseReadback,profileVerified,hubVerified,seedVerified} from './probes.js';
import {createGearFramePort,GEAR_CONSENT} from './gear_port.js';

const WZM = new URL('../../WarzoneMobileOffline/',import.meta.url);
// This file is in /projects/<project>/standalone_v4_ports_20261110/gear.
const originalFile = relative => new URL('../../../../WarzoneMobileOffline/'+relative,import.meta.url);
class P {
  constructor(n,m){this.n=n;this.m=m;}
  add(x){return new P(this.n+x,this.m);}
  isNull(){return this.n===0;}
  equals(other){return this.n===other.n;}
  compare(other){return Math.sign(this.n-other.n);}
  toString(){return '0x'+this.n.toString(16);}
}
class NativeMock {
  constructor({count=657,busy=0,groups=[0,3,4,6],size=0x1500}={}) {
    this.base=0x100000000;this.mem=new Map();this.groupHandles=groups;
    this.counter=0;this.bindCalls=[];this.previewInstall=0;
    this.previewRevert=0;this.previewCallback=null;this.previewReady=false;
    this.events=[];this.luaScripts=[];this.nativeHubCalls=0;
    this.probes={profile:'WZMGEARPROFILE|pdo=1|ranked=1|xp=1|groups=3',
      hub:'WZMGEARHUB|keys=1|flow=1',
      seed:'WZMGEARSEED|matched=15|expected=15|checked=60|mismatched=0|invalid=0',
      synthetic:'WZMGEARPROFILESEED|xp=100000|kills=1234|deaths=617|games=100|readable=1'};
    this.count=count;this.busy=busy;this.nextMap=0x500000000;
    this.table=this.p(0x310000000);
    this.setPtr(this.base+PROFILE_452.tableRva,this.table);
    this.set(this.base+PROFILE_452.sizeRva,size);
    for(let i=0;i<2;i++){
      const x=this.table.add(i*PROFILE_452.entryStride);
      this.setPtr(x.n,this.p(0));
      this.set(x.n+8,0);
      this.set(x.n+0x244,0);
      this.set(x.n+0x247,1);
    }
    for(let g=0;g<14;g++){
      this.set(this.base+PROFILE_452.slotsRva+g*16,-1);
      this.setPtr(this.base+PROFILE_452.handlesRva+g*16,
        groups.includes(g)?this.p(0x420000000+g*0x100):this.p(0));
    }
    this.set(this.base+0x6cb1ab0,count);
    this.set(this.base+0x6cb1abc,busy);
  }
  p(n){return new P(n,this);}
  set(k,v){this.mem.set(k,v);}
  setPtr(k,p){this.mem.set(k,p);}
  at=(rva)=>this.p(this.base+rva);
  readPointer=(p)=>{const v=this.mem.get(p.n);return v instanceof P?v:this.p(0);};
  writePointer=(p,v)=>{this.setPtr(p.n,v);};
  readU8=(p)=>this.mem.get(p.n)??0;
  readU32=(p)=>this.mem.get(p.n)??0;
  readS32=(p)=>this.mem.get(p.n)??-1;
  writeU8=(p,v)=>this.set(p.n,v);
  writeU32=(p,v)=>this.set(p.n,v);
  readable=(p,n,_write=false)=>!!p&&!p.isNull()&&p.n!==this.base+0xdead;
  map=(size)=>{
    this.counter++;const ptr=this.p(this.nextMap+this.counter*0x100000);
    this.events.push({kind:'mmap',size,ptr:ptr.toString()});return ptr;
  };
  bindStats=(controller,local,group)=>{this.bindCalls.push([controller,local,group]);};
  previewClient=()=>({ready:this.previewReady,count:this.previewReady?1:0,
    arrayPresent:this.previewReady});
  installPreview=(callback)=>{this.previewInstall++;
    this.previewCallback=callback;
    return ()=>{this.previewRevert++;this.previewCallback=null;};
  };
  luaChunk=(src,name)=>{
    this.luaScripts.push(name);
    if(name.includes('profile_readonly')||name.includes('profile_ddl_verify'))
      return {ok:true,code:'ORIGINAL_LUA_INVOKED',value:this.probes.profile};
    if(name.includes('hub_readonly'))
      return {ok:true,code:'ORIGINAL_LUA_INVOKED',value:this.probes.hub};
    if(name.includes('seed_readonly'))
      return {ok:true,code:'ORIGINAL_LUA_INVOKED',value:this.probes.seed};
    if(name.includes('synthetic_profile_readback'))
      return {ok:true,code:'ORIGINAL_LUA_INVOKED',value:this.probes.synthetic};
    if(name.includes('original_open_gear_up'))
      return {ok:true,code:'ORIGINAL_LUA_INVOKED',
        value:'gear.menuName=xhash(eaba5c1e)\nRequestAddMenu -> true nil'};
    if(name.includes('original_'))return {ok:true,code:'ORIGINAL_LUA_INVOKED',value:'success'};
    return {ok:false,code:'UNKNOWN_MOCK_LUA'};
  };
  luaHub=(bytes,menuKey)=>{
    this.nativeHubCalls++;assert.equal(bytes.length,ORIGINAL_HUB.byteLength);
    assert.ok(menuKey.includes('2b8a71f2b33a70b3'));
    return {ok:true,code:'HUB_ORIGINAL_CALLBACK_INVOKED',value:'success'};
  };
}
function identityContext(overrides={}) {
  const base=0x100000000;
  const mod={name:FP.module,base:new P(base),size:FP.mapped_max_size};
  const L=new P(0x700000000);
  const ptr=n=>new P(n);
  const runtime={
    arch:()=> 'arm64', findModule:()=>mod,
    range:p=> {
      if(p.n>=base&&p.n<base+FP.mapped_max_size)
        return {base:ptr(base),size:FP.mapped_max_size,protection:'rwx'};
      if(p.n===L.n)return {base:L,size:0x100,protection:'rw-'};
      if(p.n===0x700001000)return {base:ptr(0x700001000),size:0x100,protection:'rw-'};
      return null;
    },
    readPointer:_p=>ptr(0x700001000),
    hexBytes:(p,_len)=>{
      if(p.n===base+FP.build_id_rva)return FP.build_id;
      const window=FP.code_windows.find(w=>p.n===base+w.rva);
      return window?.hex??'';
    },
  };
  return {moduleBase:mod.base,identity:'holder/L',L,runtime,
    native:{load(){return 0;},pcall(){return 0;},toString(){return ptr(0);}},
    ...overrides};
}
function harness() {
  let now=100;
  const events=[],adapter=new NativeMock();
  const port=createGearFramePort({notify:e=>events.push(e),clock:()=>now,
    adapterFactory:()=>adapter});
  const context=identityContext();
  const advance=(n=1)=>{for(let i=0;i<n;i++)port.onVerifiedLuiFrame(context);};
  const request=(action,consent)=>port.request({action,consent});
  const finish=(action,consent,n=1)=>{
    const r=request(action,consent);assert.equal(r.accepted,true,r.code);
    advance(n);
    return events.filter(x=>x.event==='RESULT'&&x.requestId===r.requestId).at(-1);
  };
  const setup=()=>{
    assert.equal(finish('installPreviewGuard',GEAR_CONSENT.installPreviewGuard).code,
      'PREVIEW_NULL_CLIENT_GUARD_OWNED');
    assert.equal(finish('prepareNativeProfile',GEAR_CONSENT.prepareNativeProfile).code,
      'PROFILE_NATIVE_BIND_INVOKED_NOT_DDL_PROVEN');
    assert.equal(finish('verifyProfileDDL').code,'ORIGINAL_DDL_READBACK_PRESENT_NOT_PERSISTED');
  };
  return {port,context,adapter,events,request,advance,finish,setup,
    get now(){return now;},set now(x){now=x;}};
}

test('source byte identity, binary SHA256 and exact original ELF fingerprint',()=>{
  assert.equal(sha256Text('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Bytes(new Uint8Array()),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  for(const data of Object.values(ORIGINAL_PROFILE_LUA)){
    const bytes=readFileSync(originalFile(data.source));
    assert.deepEqual(Buffer.from(data.text,'utf8'),bytes);
    assert.equal(bytes.length,data.byteLength);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),data.sha256);
  }
  const hub=readFileSync(originalFile(ORIGINAL_HUB.source));
  assert.equal(hub.length,12082);
  assert.deepEqual(Buffer.from(fromHex(ORIGINAL_HUB.hex)),hub);
  assert.equal(sha256Bytes(fromHex(ORIGINAL_HUB.hex)),ORIGINAL_HUB.sha256);
  assert.equal(FP.build_id,'9528f1d264b40639b57e14998e01d080');
});

test('frame validation rejects wrong architecture, ELF size, build ID, text and Lua stack',()=>{
  assert.equal(validateGearFrame(identityContext()).ok,true);
  const cases=[
    [identityContext({runtime:{...identityContext().runtime,arch:()=> 'x64'}}),'WRONG_NATIVE_ARCH'],
    [identityContext({runtime:{...identityContext().runtime,findModule:()=>null}}),'GAME_MODULE_IDENTITY_MISMATCH'],
    [identityContext({runtime:{...identityContext().runtime,hexBytes:()=> 'bad'}}),'GAME_BUILD_ID_MISMATCH'],
    [identityContext({L:null}),'MISSING_VERIFIED_LUI_FRAME'],
    [identityContext({runtime:{...identityContext().runtime,readPointer:()=>new P(0)}}),'LUA_STACK_UNREADABLE'],
  ];
  for(const [ctx,code] of cases)assert.equal(validateGearFrame(ctx).code,code);
  const temp=identityContext();
  const original=temp.runtime.hexBytes;
  temp.runtime.hexBytes=(p,n)=>p.n===temp.moduleBase.n+FP.code_windows[0].rva?'00'.repeat(n):original(p,n);
  assert.equal(validateGearFrame(temp).code,'GAME_CODE_WINDOW_MISMATCH');
});

test('synthetic profile preflight refuses missing table, invalid group size and slot',()=>{
  for(const defect of ['table','size','slot']){
    const a=new NativeMock(),p=new NativeProfilePort();
    if(defect==='table')a.setPtr(a.base+PROFILE_452.tableRva,a.p(0));
    if(defect==='size')a.set(a.base+PROFILE_452.sizeRva,PROFILE_452.bufferSize+1);
    if(defect==='slot')a.set(a.base+PROFILE_452.slotsRva,16385);
    const r=p.invoke({adapter:a,generation:'L1',explicitSyntheticProfile:true});
    assert.equal(r.code,'PROFILE_NATIVE_PREFLIGHT_FAILED');
    assert.equal(a.bindCalls.length,0);
    assert.equal(a.counter,0);
  }
});

test('native profile uses 0x66000 mmap and 2x group binds; reports only readback of native flags',()=>{
  const a=new NativeMock(),p=new NativeProfilePort();
  assert.equal(p.invoke({adapter:a,generation:'L1'}).code,'SYNTHETIC_PROFILE_EXPLICIT_CONSENT_REQUIRED');
  const r=p.invoke({adapter:a,generation:'L1',explicitSyntheticProfile:true});
  assert.equal(r.ok,true);
  assert.equal(r.verifiedDDL,false);
  assert.equal(r.nativeInvoked,true);
  assert.equal(a.counter,2);
  assert.equal(a.bindCalls.length,8);
  assert.deepEqual(a.bindCalls.map(x=>x[2]),[0,0,3,3,4,4,6,6]);
  assert.ok(r.readback.entryFlags.every(x=>x.boundFlag===1&&x.fetchPending===0&&x.dataPresent));
  assert.equal(p.invoke({adapter:a,generation:'L1',explicitSyntheticProfile:true}).code,
    'PROFILE_NATIVE_ALREADY_INVOKED_NOT_DDL_PROOF');
  assert.equal(a.bindCalls.length,8);
  assert.equal(p.snapshot().retainedMappings,2);
});

test('native profile exception after mutations is a partial failure, not a successful binder',()=>{
  const a=new NativeMock(),p=new NativeProfilePort();
  a.bindStats=()=>{throw Error('native bindStats rejected');};
  const r=p.invoke({adapter:a,generation:'L1',explicitSyntheticProfile:true});
  assert.equal(r.ok,false);
  assert.equal(r.code,'PROFILE_NATIVE_PARTIAL_FAILURE');
  assert.equal(r.writesMayHaveOccurred,true);
  assert.equal(p.invoke({adapter:a,generation:'L1',explicitSyntheticProfile:true}).code,
    'PROFILE_PREVIOUS_PARTIAL_FAILURE_REQUIRES_RESET');
});

test('preview safety guard refuses silent installation and skips only missing native client',()=>{
  const a=new NativeMock();
  const guard=new NativePreviewSafety();
  assert.equal(guard.install(a).code,'EXPLICIT_PREVIEW_GUARD_INTENT_REQUIRED');
  assert.equal(a.previewInstall,0);
  assert.equal(guard.install(a,{explicitGearUpIntent:true}).code,
    'PREVIEW_NULL_CLIENT_GUARD_OWNED');
  assert.equal(guard.install(a,{explicitGearUpIntent:true}).code,'PREVIEW_GUARD_ALREADY_OWNED');
  let calls=0;
  assert.equal(a.previewCallback(()=>{calls++;return 42;},'p',0,'m4'),0);
  assert.equal(calls,0);
  a.previewReady=true;
  assert.equal(a.previewCallback(()=>{calls++;return 42;},'p',0,'m4'),42);
  assert.equal(guard.status().skipped,1);
  assert.equal(guard.status().passed,1);
  assert.equal(guard.status().modelStreamingVerified,false);
  guard.dispose();
  assert.equal(a.previewRevert,1);
});

test('preview guard surfaces native opcode/install exceptions with fail-closed receipt',()=>{
  const a=new NativeMock(),guard=new NativePreviewSafety();
  a.installPreview=()=>{throw Error('ORIGINAL_PREVIEW_OPCODE_MISMATCH');};
  assert.equal(guard.install(a,{explicitGearUpIntent:true}).code,'PREVIEW_GUARD_NATIVE_INSTALL_FAILED');
  assert.equal(guard.status().installed,false);
  assert.equal(guard.install(a,{explicitGearUpIntent:true}).code,'PREVIEW_PREVIOUS_FAILURE');
});

test('hub bytecode original load is separated from its subsequent menu-key readback',()=>{
  const a=new NativeMock(),h=new OriginalHubLoader();
  const r=h.load({adapter:a,generation:'one'});
  assert.equal(r.code,'ORIGINAL_HUB_NATIVE_INVOKED_UNVERIFIED_UI');
  assert.equal(r.gearUpRenderableVerified,false);
  assert.equal(h.status().gearUpRenderableVerified,false);
  assert.equal(a.nativeHubCalls,1);
  assert.equal(h.load({adapter:a,generation:'one'}).code,'HUB_ALREADY_INVOKED_REQUIRES_READBACK');
  a.luaHub=()=>({ok:false,code:'HUB_CALLBACK_FAILED'});
  h.resetLua();
  assert.equal(h.load({adapter:a,generation:'two'}).code,'ORIGINAL_HUB_NATIVE_INVOCATION_FAILED');
});

test('read-only probe parser rejects fabricated success strings and mismatched DDL counts',()=>{
  assert.equal(parseReadback('success','WZMGEARHUB').ok,false);
  assert.equal(profileVerified(parseReadback('WZMGEARPROFILE|pdo=1|ranked=0|xp=1|groups=3','WZMGEARPROFILE')),false);
  assert.equal(hubVerified(parseReadback('WZMGEARHUB|keys=1|flow=0','WZMGEARHUB')),false);
  assert.equal(seedVerified(parseReadback('WZMGEARSEED|matched=15|expected=15|checked=59|mismatched=0|invalid=0','WZMGEARSEED')),false);
  assert.equal(seedVerified(parseReadback('WZMGEARSEED|matched=15|expected=15|checked=60|mismatched=0|invalid=0','WZMGEARSEED')),true);
  assert.equal(parseReadback('WZMGEARHUB|keys=1|keys=2|flow=1','WZMGEARHUB').code,'READBACK_MALFORMED');
});

test('typed action API insists on source authenticity, explicit consents, and unsupported real Gear Up',()=>{
  const x=harness();
  assert.equal(x.request('installPreviewGuard').code,'EXPLICIT_GEAR_CONSENT_REQUIRED');
  assert.equal(x.request('prepareNativeProfile').code,'EXPLICIT_GEAR_CONSENT_REQUIRED');
  assert.equal(x.request('seedStarterLoadouts').code,'EXPLICIT_GEAR_CONSENT_REQUIRED');
  assert.equal(x.request('restoreOriginalHub').code,'EXPLICIT_GEAR_CONSENT_REQUIRED');
  assert.equal(x.request('openGearUp').code,'GEAR_UP_CLIENT_RENDER_NOT_VERIFIED');
  assert.equal(x.port.snapshot().gearUpRenderableVerified,false);
  assert.equal(x.port.snapshot().profileDDLVerified,false);
  assert.equal(x.finish('prepareNativeProfile',GEAR_CONSENT.prepareNativeProfile).code,
    'OWNED_PREVIEW_GUARD_REQUIRED');
  assert.equal(x.finish('restoreOriginalHub',GEAR_CONSENT.restoreOriginalHub).code,
    'OWNED_PREVIEW_GUARD_REQUIRED');
  x.port.dispose();
});

test('real stage chain verifies native flags before Lua profile root, hub key and local class readback',()=>{
  const x=harness();
  x.setup();
  const hub=x.finish('restoreOriginalHub',GEAR_CONSENT.restoreOriginalHub,1);
  assert.equal(hub,undefined,'hub original native callback alone is not completion');
  assert.equal(x.port.snapshot().hubReadbackVerified,false);
  x.advance();
  assert.equal(x.port.snapshot().lastResult.code,'HUB_KEY_AND_FLOW_READBACK_NOT_UI_PROOF');
  assert.equal(x.port.snapshot().hubReadbackVerified,true);
  assert.equal(x.port.snapshot().gearUpRenderableVerified,false);
  const seed=x.finish('seedStarterLoadouts',GEAR_CONSENT.seedStarterLoadouts,1);
  assert.equal(seed,undefined,'Original seed Lua return alone cannot claim 15 classes');
  x.advance();
  assert.equal(x.port.snapshot().lastResult.code,'FIFTEEN_LOCAL_CLASSES_READBACK_NOT_PERSISTED');
  assert.equal(x.port.snapshot().seedReadbackVerified,true);
  assert.equal(x.port.snapshot().persistenceVerified,false);
  assert.equal(x.port.snapshot().gearUpRenderableVerified,false);
  x.port.dispose();
});

test('explicit experimental original Gear Up navigation requires real prior stage readbacks and never claims render',()=>{
  const x=harness();
  assert.equal(x.request('tryOriginalGearMenu').code,
    'EXPLICIT_GEAR_CONSENT_REQUIRED');
  assert.equal(x.finish('tryOriginalGearMenu',
    GEAR_CONSENT.tryOriginalGearMenu).code,
    'OWNED_PREVIEW_GUARD_REQUIRED');
  x.setup();
  const early=x.finish('tryOriginalGearMenu',GEAR_CONSENT.tryOriginalGearMenu);
  assert.equal(early.code,'ORIGINAL_GEAR_EDITOR_PREREQUISITES_MISSING');
  assert.ok(early.missing.includes('ORIGINAL_CUSTOMIZATION_HUB_KEY'));
  x.finish('restoreOriginalHub',GEAR_CONSENT.restoreOriginalHub,2);
  x.finish('seedStarterLoadouts',GEAR_CONSENT.seedStarterLoadouts,2);
  const ret=x.finish('tryOriginalGearMenu',GEAR_CONSENT.tryOriginalGearMenu);
  assert.equal(ret.status,'UNVERIFIED');
  assert.equal(ret.code,'ORIGINAL_GEAR_MENU_REQUEST_CALLED_RENDER_UNVERIFIED');
  assert.equal(ret.originalMenuRequested,true);
  assert.equal(ret.gearUpRenderable,false);
  assert.equal(ret.modelStreamingVerified,false);
  assert.ok(x.adapter.luaScripts.includes('=original_open_gear_up'));
  x.adapter.luaChunk=(src,name)=>name==='=original_open_gear_up'?
    {ok:true,code:'ORIGINAL_LUA_INVOKED',value:'RequestAddMenu -> false lua error'}:
    {ok:true,code:'ORIGINAL_LUA_INVOKED',value:'success'};
  const rejected=x.finish('tryOriginalGearMenu',GEAR_CONSENT.tryOriginalGearMenu);
  assert.equal(rejected.code,'ORIGINAL_GEAR_MENU_REQUEST_REJECTED');
  assert.equal(rejected.originalMenuRequested,false);
  x.port.dispose();
});

test('missing hub key rejects native pcall=0 claim, and missing loadout reads reject original seed success',()=>{
  const x=harness();
  x.setup();
  x.adapter.probes.hub='WZMGEARHUB|keys=0|flow=1';
  const hub=x.request('restoreOriginalHub',GEAR_CONSENT.restoreOriginalHub);
  x.advance(2);
  assert.equal(x.port.snapshot().lastResult.requestId,hub.requestId);
  assert.equal(x.port.snapshot().lastResult.code,'HUB_KEY_OR_FLOW_READBACK_UNVERIFIED');
  assert.equal(x.port.snapshot().hubReadbackVerified,false);
  assert.equal(x.finish('seedStarterLoadouts',GEAR_CONSENT.seedStarterLoadouts).code,
    'ORIGINAL_HUB_READBACK_REQUIRED');
  x.port.dispose();
  const y=harness();
  y.setup();y.advance();
  y.finish('restoreOriginalHub',GEAR_CONSENT.restoreOriginalHub,2);
  y.adapter.probes.seed='WZMGEARSEED|matched=4|expected=15|checked=60|mismatched=11|invalid=0';
  y.finish('seedStarterLoadouts',GEAR_CONSENT.seedStarterLoadouts,2);
  assert.equal(y.port.snapshot().lastResult.code,'SEED_LOADOUT_DDL_READBACK_MISMATCH');
  assert.equal(y.port.snapshot().seedReadbackVerified,false);
  y.port.dispose();
});

test('in-memory fake player profile requires separate consent and independent stats-value readback',()=>{
  const x=harness();x.setup();
  assert.equal(x.finish('seedSyntheticProfile',GEAR_CONSENT.seedSyntheticProfile,1),undefined);
  assert.equal(x.port.snapshot().syntheticProfileVerified,false);
  x.advance();
  assert.equal(x.port.snapshot().lastResult.code,
    'ORIGINAL_LOCAL_PROFILE_FIELDS_READBACK_NOT_PERSISTED');
  assert.equal(x.port.snapshot().syntheticProfileVerified,true);
  x.port.dispose();
});

test('no frame timeout, duplicate requests, Lua generation resets and hook lifetime remain explicit',()=>{
  const x=harness();
  const r=x.request('inspect');
  assert.equal(x.port.request({action:'inspect',requestId:r.requestId}).code,'DUPLICATE_REQUEST_ID');
  assert.equal(x.port.request({action:'verifyProfileDDL',requestId:r.requestId}).code,'REQUEST_ID_COLLISION');
  x.now+=120001;
  x.port.heartbeat();
  assert.equal(x.port.snapshot().lastResult.code,'GEAR_LUI_FRAME_TIMEOUT');
  const guard=x.finish('installPreviewGuard',GEAR_CONSENT.installPreviewGuard);
  assert.equal(guard.code,'PREVIEW_NULL_CLIENT_GUARD_OWNED');
  x.port.onLuaReset();
  assert.equal(x.port.snapshot().currentIdentity,null);
  assert.equal(x.port.snapshot().preview.installed,true,'native guard belongs to process, not Lua _G');
  x.port.dispose();
  assert.equal(x.adapter.previewRevert,1);
});

test('frame version rejection prevents any native profile writes',()=>{
  const x=harness();
  const r=x.request('inspect');
  const broken=identityContext({runtime:{...identityContext().runtime,arch:()=> 'x64'}});
  x.port.onVerifiedLuiFrame(broken);
  assert.equal(x.port.snapshot().lastResult.code,'GEAR_NATIVE_FRAME_UNVERIFIED');
  assert.equal(x.adapter.counter,0);
  assert.equal(x.adapter.bindCalls.length,0);
  assert.equal(x.adapter.previewInstall,0);
  x.port.dispose();
});

test('native game library reloading at a different base invalidates owned preview hook',()=>{
  const x=harness();
  assert.equal(x.finish('installPreviewGuard',GEAR_CONSENT.installPreviewGuard).code,
    'PREVIEW_NULL_CLIENT_GUARD_OWNED');
  const changed=identityContext({moduleBase:new P(0x200000000)});
  const originalVerify=x.port.verifyFrame;
  x.port.verifyFrame=ctx=>ctx===changed?{ok:true,code:'EXACT_WZM452_NATIVE_FRAME',
    frameIdentity:'new-module'}:originalVerify(ctx);
  const pending=x.request('inspect');
  x.port.onVerifiedLuiFrame(changed);
  assert.equal(x.port.snapshot().lastResult.requestId,pending.requestId);
  assert.equal(x.port.snapshot().lastResult.code,'NATIVE_MODULE_RELOADED');
  assert.equal(x.adapter.previewRevert,1);
  assert.equal(x.port.request({action:'inspect'}).code,'GEAR_PORT_DISPOSED');
});

test('original LUI Lua load/pcall two-step hub adapter restores stack and verifies callback order',()=>{
  const saved={Module:globalThis.Module,Memory:globalThis.Memory,
    NativeFunction:globalThis.NativeFunction,Interceptor:globalThis.Interceptor};
  const events=[];
  const runtime=identityContext().runtime;
  const oldStack=new P(0x700001000);
  runtime.readPointer=_=>oldStack;
  runtime.writePointer=(addr,p)=>events.push(['restoreStack',String(p)]);
  runtime.nullPointer=()=>new P(0);
  const lua=identityContext();
  lua.runtime=runtime;
  lua.native={
    load(_L,buffer,length) {events.push(['load',length,buffer.kind]);return 0;},
    pcall(_L,nargs) {events.push(['pcall',nargs]);return 0;},
    toString(){return {isNull:()=>false,readUtf8String:()=> 'returned'};},
  };
  const oldBytes=readFileSync(originalFile(ORIGINAL_HUB.source));
  const allocatedBytes=[];
  globalThis.Memory={
    alloc(n){return {kind:'bytes',writeByteArray(bytes){
      allocatedBytes.push(Buffer.from(bytes));assert.equal(n,bytes.length);
    }};},
    allocUtf8String(text){return {kind:'utf8',text};}
  };
  globalThis.Module={getGlobalExportByName:()=>new P(123)};
  globalThis.NativeFunction=function(){return ()=>new P(0x800000000);};
  globalThis.Interceptor={};
  try{
    const a=createGearNativeAdapter(lua);
    const r=a.luaHub(fromHex(ORIGINAL_HUB.hex),'return "menu"');
    assert.equal(r.ok,true);
    assert.deepEqual(allocatedBytes,[oldBytes]);
    assert.deepEqual(events.filter(x=>x[0]==='pcall').map(x=>x[1]),[0,1]);
    assert.equal(events.at(-1)[0],'restoreStack');
    events.length=0;
    const result=a.luaChunk('return 123','=test');
    assert.equal(result.ok,true);
    assert.equal(events.filter(x=>x[0]==='pcall').length,1);
    assert.equal(events.at(-1)[0],'restoreStack');
    lua.native.pcall=()=>{throw Error('forced original Lua pcall failure');};
    events.length=0;
    const failed=a.luaChunk('return 1','=test');
    assert.equal(failed.code,'ORIGINAL_LUA_EXCEPTION');
    assert.equal(events.at(-1)[0],'restoreStack');
  }finally{
    for(const [k,v] of Object.entries(saved)){
      if(v===undefined)delete globalThis[k];else globalThis[k]=v;
    }
  }
});
