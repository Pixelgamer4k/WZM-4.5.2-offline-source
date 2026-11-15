/* WZM 4.5.2 Gear Up/Profile native frame integration, not a standalone hook.
 * The prime's one verified LUI frame owner calls onVerifiedLuiFrame(context).
 * No phone/ADB/root, external thread, Mac Python, network or file I/O in-game.
 *
 * All mutable stages REQUIRE explicit UI intent. A native call+pcall=0 does not
 * imply a working Gear Up/client/3D preview or persistent player progress.
 */
import {ORIGINAL_PROFILE_LUA,ORIGINAL_HUB} from './embedded_assets.js';
import {sha256Text,bytesUtf8,sha256Bytes,fromHex} from './sha256.js';
import {validateGearFrame} from './identity.js';
import {createGearNativeAdapter} from './native_adapter.js';
import {NativeProfilePort} from './profile_native.js';
import {NativePreviewSafety} from './preview_guard.js';
import {OriginalHubLoader} from './hub_loader.js';
import {PROFILE_PROBE_LUA,HUB_PROBE_LUA,SEED_VERIFY_LUA,SYNTHETIC_PROFILE_VERIFY_LUA,
  parseReadback,profileVerified,hubVerified,seedVerified,syntheticProfileVerified} from './probes.js';

export const GEAR_ACTIONS = Object.freeze([
  'inspect','installPreviewGuard','prepareNativeProfile','verifyProfileDDL',
  'seedSyntheticProfile','restoreOriginalHub','seedStarterLoadouts','openGearUp',
  'tryOriginalGearMenu',
]);
export const GEAR_CONSENT = Object.freeze({
  installPreviewGuard:'GUARD_ORIGINAL_PREVIEW_FN',
  prepareNativeProfile:'SYNTHETIC_PROFILE_IN_MEMORY',
  restoreOriginalHub:'LOAD_ORIGINAL_12082_BYTE_LUAJIT_HUB',
  seedSyntheticProfile:'WRITE_ORIGINAL_FAKE_PROFILE_STATS',
  seedStarterLoadouts:'OVERWRITE_15_STARTER_LOADOUTS',
  tryOriginalGearMenu:'TRY_ORIGINAL_GEAR_MENU_WITH_INCOMPLETE_3D_CLIENT',
});
const WAIT_MS=120000;

function sourceReceipt() {
  for(const [name,data] of Object.entries(ORIGINAL_PROFILE_LUA)){
    if(!data||!data.text||!data.sha256||bytesUtf8(data.text).length!==data.byteLength||
       sha256Text(data.text)!==data.sha256)
      return {ok:false,code:'ORIGINAL_LUA_SOURCE_INTEGRITY_FAILED',name};
  }
  if(typeof ORIGINAL_HUB.hex!=='string'||ORIGINAL_HUB.byteLength!==ORIGINAL_HUB.hex.length/2)
    return {ok:false,code:'ORIGINAL_HUB_PAYLOAD_LENGTH_MISMATCH'};
  return {ok:true,code:'ORIGINAL_PROFILE_LUA_SOURCES_VERIFIED',
    scriptCount:Object.keys(ORIGINAL_PROFILE_LUA).length};
}

export class GearFramePort {
  constructor({notify=()=>{},clock=()=>Date.now(),
    adapterFactory=createGearNativeAdapter,verifyFrame=validateGearFrame,maxQueue=8}={}) {
    this.notify=notify;this.clock=clock;this.adapterFactory=adapterFactory;
    this.verifyFrame=verifyFrame;this.maxQueue=maxQueue;
    this.source=sourceReceipt();this.queue=[];this.jobs=new Map();
    this.serial=0;this.currentIdentity=null;this.inFrame=false;
    this.nativeModuleAddress=null;
    this.profile=new NativeProfilePort({notify:x=>this.emit('NATIVE_PROFILE',null,x)});
    this.preview=new NativePreviewSafety({notify:x=>this.emit('PREVIEW_GUARD',null,x)});
    this.hub=new OriginalHubLoader({notify:x=>this.emit('HUB_NATIVE',null,x)});
    this.profileDDLVerified=false;this.hubReadbackVerified=false;
    this.seedReadbackVerified=false;this.syntheticProfileVerified=false;
    this.lastFrame=null;this.lastResult=null;
    this.disposed=false;
  }
  emit(event,job,details={}) {
    const msg={channel:'wzm.gearPort.v4',event,
      ...(job?{requestId:job.requestId,action:job.action}:{}),...details};
    try{this.notify(msg);}catch(_){}return msg;
  }
  request(input) {
    if(this.disposed)return {accepted:false,code:'GEAR_PORT_DISPOSED'};
    if(!this.source.ok)return {accepted:false,...this.source};
    if(!input||typeof input!=='object'||Array.isArray(input))
      return {accepted:false,code:'INVALID_GEAR_ACTION'};
    const {action}=input;
    if(!GEAR_ACTIONS.includes(action))return {accepted:false,code:'UNSUPPORTED_GEAR_ACTION'};
    if(input.gameVersion!==undefined&&input.gameVersion!=='4.5.2.22729281')
      return {accepted:false,code:'UNSUPPORTED_GAME_VERSION'};
    if(action==='openGearUp')return {accepted:false,code:'GEAR_UP_CLIENT_RENDER_NOT_VERIFIED',
      missing:['AUTHENTIC_NATIVE_CLIENT_CONNECT','MODEL_AND_SKIN_STREAMING',
        'EDITOR_RENDER_AND_ACTIVITY_LIFECYCLE_TEST'],gearUpRenderable:false};
    const requestedId=input.requestId??('gear-'+(++this.serial).toString(36));
    if(typeof requestedId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(requestedId))
      return {accepted:false,code:'INVALID_REQUEST_ID'};
    const prior=this.jobs.get(requestedId);
    if(prior)return prior.action===action?
      {accepted:true,code:'DUPLICATE_REQUEST_ID',requestId:requestedId,status:prior.status}:
      {accepted:false,code:'REQUEST_ID_COLLISION'};
    const required=GEAR_CONSENT[action];
    if(required&&input.consent!==required)
      return {accepted:false,code:'EXPLICIT_GEAR_CONSENT_REQUIRED',required};
    if(this.queue.length>=this.maxQueue)
      return {accepted:false,code:'GEAR_ACTION_QUEUE_FULL'};
    const job={requestId:requestedId,action,status:'QUEUED',step:0,
      started:this.clock(),generation:null};
    this.jobs.set(requestedId,job);this.queue.push(job);
    this.emit('QUEUED',job,{code:'WAITING_FOR_ORIGINAL_452_LUI_FRAME'});
    return {accepted:true,code:'WAITING_FOR_ORIGINAL_452_LUI_FRAME',
      requestId:requestedId,action,status:'QUEUED'};
  }
  finish(job,status,code,extra={}) {
    job.status=status;
    const event=this.emit('RESULT',job,{status,code,...extra});
    this.lastResult=event;this.queue.shift();
    // Bounded duplicate memory, retaining all outstanding jobs.
    while(this.jobs.size>128){
      const old=this.jobs.keys().next().value;
      if(this.queue.some(x=>x.requestId===old))break;
      this.jobs.delete(old);
    }
    return event;
  }
  stopAll(code) {
    while(this.queue.length)this.finish(this.queue[0],'FAILED',code);
  }
  heartbeat(now=this.clock()) {
    while(this.queue.length&&now-this.queue[0].started>=WAIT_MS)
      this.finish(this.queue[0],'FAILED','GEAR_LUI_FRAME_TIMEOUT',
        {waitedMs:now-this.queue[0].started});
  }
  onLuaReset() {
    this.stopAll('LUA_GENERATION_RESET');
    this.currentIdentity=null;
    this.profileDDLVerified=false;this.hubReadbackVerified=false;
    this.seedReadbackVerified=false;this.syntheticProfileVerified=false;
    this.profile.resetLua();this.hub.resetLua();
    // Native Interceptor.replace on preview remains owned across Lua rebuilds;
    // it must not be replaced twice or reverted as if Lua owned its lifetime.
    this.emit('STATE',null,{code:'GEAR_LUA_GENERATION_RESET',
      previewGuardStillOwned:this.preview.installed});
  }
  snapshot() {
    return {source:this.source,queue:this.queue.map(x=>({
      requestId:x.requestId,action:x.action,status:x.status,step:x.step})),
      currentIdentity:this.currentIdentity,profile:this.profile.snapshot(),
      nativeModuleAddress:this.nativeModuleAddress,
      preview:this.preview.status(),hub:this.hub.status(),
      profileDDLVerified:this.profileDDLVerified,
      hubReadbackVerified:this.hubReadbackVerified,
      seedReadbackVerified:this.seedReadbackVerified,
      syntheticProfileVerified:this.syntheticProfileVerified,
      gearUpRenderableVerified:false,clientConnectionVerified:false,
      persistenceVerified:false,lastResult:this.lastResult,lastFrame:this.lastFrame};
  }
  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.stopAll('GEAR_PORT_DISPOSED');
    this.preview.dispose();
    this.emit('STATE',null,{code:'GEAR_PORT_DISPOSED',
      nativeProfileBuffersRemainMapped:this.profile.mapped.length});
  }
  onVerifiedLuiFrame(ctx) {
    if(this.disposed||this.inFrame||!this.queue.length)return;
    this.inFrame=true;
    const job=this.queue[0];
    try {
      // Independent exact ELF proof, in addition to the external LUI owner.
      const identity=this.verifyFrame(ctx);
      if(!identity.ok){
        this.finish(job,'UNSUPPORTED','GEAR_NATIVE_FRAME_UNVERIFIED',{guard:identity});
        return;
      }
      const generation=identity.frameIdentity;
      const moduleAddress=String(ctx.moduleBase);
      if(this.nativeModuleAddress!==null &&
         this.nativeModuleAddress!==moduleAddress) {
        this.stopAll('NATIVE_MODULE_RELOADED');
        this.preview.dispose();
        this.disposed=true;
        this.emit('STATE',null,{code:'NATIVE_MODULE_RELOAD_REQUIRES_NEW_PORT',
          previous:this.nativeModuleAddress,current:moduleAddress});
        return;
      }
      this.nativeModuleAddress=moduleAddress;
      this.lastFrame={guard:identity.code,generation};
      if(this.currentIdentity!==null&&this.currentIdentity!==generation){
        this.onLuaReset();
        return;
      }
      this.currentIdentity=generation;
      if(job.generation!==null&&job.generation!==generation){
        this.finish(job,'FAILED','GEAR_GENERATION_CHANGED_MID_ACTION');
        return;
      }
      job.generation=generation;
      const a=this.adapterFactory(ctx);
      const count=a.readU32(a.at(0x6cb1ab0));
      const busy=a.readU8(a.at(0x6cb1abc));
      // 657 original registrations were the historical readback on 4.5.2.
      // This is a count threshold, not proof all 3D assets/skins stream.
      const catalog={count,busy,countThresholdReached:count>=657&&count<=2048&&busy===0};
      if(job.action==='inspect') {
        const ret=a.luaChunk(PROFILE_PROBE_LUA,'=gear_profile_readonly');
        const profile=ret.ok?parseReadback(ret.value,'WZMGEARPROFILE'):
          {ok:false,code:'PROFILE_LUA_PROBE_FAILED',native:ret.code};
        this.finish(job,'COMPLETED','GEAR_READ_ONLY_INSPECTION',
          {catalog,profile,profileReadbackPresent:profileVerified(profile),
            previewClient:a.previewClient(),previewGuardOwned:this.preview.installed,
            gearUpRenderable:false});
        return;
      }
      if(!catalog.countThresholdReached){
        this.finish(job,'UNSUPPORTED','ORIGINAL_CATALOG_NOT_VERIFIED',
          {catalog,expectedAtLeast:657});
        return;
      }
      if(job.action==='installPreviewGuard') {
        const r=this.preview.install(a,{explicitGearUpIntent:true});
        this.finish(job,r.ok?'COMPLETED':'FAILED',r.code,
          {native:r,gearUpRenderable:false});
        return;
      }
      if(!this.preview.installed){
        this.finish(job,'UNSUPPORTED','OWNED_PREVIEW_GUARD_REQUIRED');
        return;
      }
      if(job.action==='prepareNativeProfile'){
        const r=this.profile.invoke({adapter:a,generation,explicitSyntheticProfile:true});
        this.finish(job,r.ok?'COMPLETED':'FAILED',r.code,
          {native:r,ddlVerified:false,persistenceVerified:false});
        return;
      }
      if(this.profile.status!=='NATIVE_BINDS_INVOKED'){
        this.finish(job,'UNSUPPORTED','ORIGINAL_BINDSTATS_INVOCATION_REQUIRED');
        return;
      }
      if(job.action==='verifyProfileDDL'){
        const ret=a.luaChunk(PROFILE_PROBE_LUA,'=gear_profile_ddl_verify');
        const proof=ret.ok?parseReadback(ret.value,'WZMGEARPROFILE'):
          {ok:false,code:'PROFILE_LUA_PROBE_FAILED',native:ret};
        this.profileDDLVerified=profileVerified(proof);
        this.finish(job,this.profileDDLVerified?'COMPLETED':'FAILED',
          this.profileDDLVerified?'ORIGINAL_DDL_READBACK_PRESENT_NOT_PERSISTED':
            'ORIGINAL_DDL_READBACK_UNAVAILABLE',
          {nativeBindInvoked:true,proof,persistenceVerified:false});
        return;
      }
      if(!this.profileDDLVerified){
        this.finish(job,'UNSUPPORTED','ORIGINAL_DDL_READBACK_REQUIRED');
        return;
      }
      if(job.action==='seedSyntheticProfile'){
        if(job.step===0){
          // The exact original fake_player_data.lua requires _WZM.pdo and
          // CoD.StatsGroup.Ranked; absence yields a native Lua error, not fake
          // profile readiness. This is explicit in-memory test data only.
          const payload=ORIGINAL_PROFILE_LUA.fake_player_data;
          const ret=a.luaChunk(payload.text,'=original_fake_player_data');
          if(!ret.ok) {
            this.finish(job,'FAILED','ORIGINAL_SYNTHETIC_PROFILE_LUA_FAILED',
              {sourceSha256:payload.sha256,native:ret});return;
          }
          job.step=1;
          this.emit('PROGRESS',job,{code:'ORIGINAL_SYNTHETIC_PROFILE_LUA_INVOKED',
            sourceSha256:payload.sha256,persistenceVerified:false});
          return;
        }
        const ret=a.luaChunk(SYNTHETIC_PROFILE_VERIFY_LUA,'=gear_synthetic_profile_readback');
        const proof=ret.ok?parseReadback(ret.value,'WZMGEARPROFILESEED'):
          {ok:false,code:'PROFILE_SEED_READBACK_FAILED',native:ret};
        this.syntheticProfileVerified=syntheticProfileVerified(proof);
        this.finish(job,this.syntheticProfileVerified?'COMPLETED':'FAILED',
          this.syntheticProfileVerified?'ORIGINAL_LOCAL_PROFILE_FIELDS_READBACK_NOT_PERSISTED':
            'ORIGINAL_PROFILE_FIELD_READBACK_MISMATCH',
          {proof,persistenceVerified:false,userAccountProfileVerified:false});
        return;
      }
      if(job.action==='restoreOriginalHub'){
        if(job.step===0){
          const r=this.hub.load({adapter:a,generation});
          if(!r.ok){this.finish(job,'FAILED',r.code,{original:r});return;}
          job.step=1;
          this.emit('PROGRESS',job,{code:'ORIGINAL_HUB_CALLED_AWAITING_INDEPENDENT_READBACK',
            binarySha256:ORIGINAL_HUB.sha256,gearUpRenderable:false});
          return;
        }
        const ret=a.luaChunk(HUB_PROBE_LUA,'=gear_hub_readonly');
        const proof=ret.ok?parseReadback(ret.value,'WZMGEARHUB'):
          {ok:false,code:'HUB_LUA_PROBE_FAILED',native:ret};
        this.hubReadbackVerified=hubVerified(proof);
        this.finish(job,this.hubReadbackVerified?'COMPLETED':'FAILED',
          this.hubReadbackVerified?'HUB_KEY_AND_FLOW_READBACK_NOT_UI_PROOF':
            'HUB_KEY_OR_FLOW_READBACK_UNVERIFIED',
          {proof,gearUpRenderable:false,clientConnected:false});
        return;
      }
      if(job.action==='seedStarterLoadouts'){
        if(!this.hubReadbackVerified) {
          this.finish(job,'UNSUPPORTED','ORIGINAL_HUB_READBACK_REQUIRED');
          return;
        }
        if(job.step===0){
          const payload=ORIGINAL_PROFILE_LUA.seed_all_loadouts;
          const ret=a.luaChunk(payload.text,'=original_seed_all_loadouts');
          if(!ret.ok||ret.value==='no pdo'){
            this.finish(job,'FAILED','ORIGINAL_SEED_LUA_FAILED',
              {sourceSha256:payload.sha256,original:ret});return;
          }
          job.step=1;
          this.emit('PROGRESS',job,{code:'ORIGINAL_SEED_INVOKED_AWAITING_DDL_READBACK',
            sourceSha256:payload.sha256,noPersistenceClaim:true});
          return;
        }
        const ret=a.luaChunk(SEED_VERIFY_LUA,'=gear_seed_readonly');
        const proof=ret.ok?parseReadback(ret.value,'WZMGEARSEED'):
          {ok:false,code:'SEED_LUA_PROBE_FAILED',native:ret};
        this.seedReadbackVerified=seedVerified(proof);
        this.finish(job,this.seedReadbackVerified?'COMPLETED':'FAILED',
          this.seedReadbackVerified?'FIFTEEN_LOCAL_CLASSES_READBACK_NOT_PERSISTED':
            'SEED_LOADOUT_DDL_READBACK_MISMATCH',
          {proof,persistenceVerified:false,matchEquipmentVerified:false});
        return;
      }
      if(job.action==='tryOriginalGearMenu') {
        // Only attempt the archival ORIGINAL request after the critical
        // in-memory DDL/class and preview safety protections were actually
        // read back on separate verified native LUI frames. This does NOT
        // construct a frontend CLIENT_CONNECT or load missing 3D models.
        if(!this.hubReadbackVerified || !this.seedReadbackVerified ||
           !this.profileDDLVerified || !this.preview.installed) {
          this.finish(job,'UNSUPPORTED','ORIGINAL_GEAR_EDITOR_PREREQUISITES_MISSING',{
            missing:[
              !this.profileDDLVerified?'DDL_PROFILE_READBACK':null,
              !this.hubReadbackVerified?'ORIGINAL_CUSTOMIZATION_HUB_KEY':null,
              !this.seedReadbackVerified?'FIFTEEN_LOCAL_LOADOUTS_READBACK':null,
              !this.preview.installed?'ORIGINAL_PREVIEW_CLIENT_CRASH_GUARD':null,
            ].filter(Boolean),gearUpRenderable:false});
          return;
        }
        const payload=ORIGINAL_PROFILE_LUA.open_gear_up;
        const ret=a.luaChunk(payload.text,'=original_open_gear_up');
        const requested=ret.ok && typeof ret.value==='string' &&
          ret.value.includes('RequestAddMenu -> true ');
        const client=a.previewClient();
        this.finish(job,requested?'UNVERIFIED':'FAILED',
          requested?'ORIGINAL_GEAR_MENU_REQUEST_CALLED_RENDER_UNVERIFIED':
            'ORIGINAL_GEAR_MENU_REQUEST_REJECTED',
          {sourceSha256:payload.sha256,native:ret,
            originalMenuRequested:requested,previewClient:client,
            gearUpRenderable:false,modelStreamingVerified:false,
            savedProfileVerified:false});
        return;
      }
      this.finish(job,'FAILED','UNKNOWN_GEAR_ACTION_BRANCH');
    } catch(error){
      this.finish(job,'FAILED','GEAR_ORIGINAL_FRAME_EXECUTION_EXCEPTION',
        {error:String(error).slice(0,220)});
    } finally{this.inFrame=false;}
  }
}

export function createGearFramePort(options={}){return new GearFramePort(options);}
