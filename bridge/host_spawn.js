'use strict';
// Starts the built-in host through the party function 0x1621ab0 on a natural frame and traces the server spawn.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
// Perf: native (CModule) versions of the hottest functional hooks. Same logic as the JS hooks
// they replace, without a JS round trip per call (the Lua asset lookup alone runs ~4k times/s).
const LC_CAP=16384;const FASTMEM=Memory.alloc(256+8*LC_CAP*2);
const FAST=new CModule(`
#include <gum/guminterceptor.h>
#include <stdint.h>
extern volatile int32_t fast_flow;
extern uint64_t fast_cfg[8];
extern int32_t lc_n;
extern uint64_t lc_keys[];
extern uint64_t lc_vals[];
extern volatile uint64_t fast_hits[4];
typedef struct { uint64_t v; } D;
void lc_enter(GumInvocationContext *ic){ D *d=GUM_IC_GET_INVOCATION_DATA(ic,D);
  d->v=((uint32_t)(uintptr_t)gum_invocation_context_get_nth_argument(ic,0)==0x4b)?((uint64_t)gum_invocation_context_get_nth_argument(ic,1)&0x7fffffffffffffffULL):0; }
void lc_leave(GumInvocationContext *ic){ D *d=GUM_IC_GET_INVOCATION_DATA(ic,D);
  if(!d->v||gum_invocation_context_get_return_value(ic)!=NULL)return;
  int lo=0,hi=lc_n-1; while(lo<=hi){int m=(lo+hi)>>1; if(lc_keys[m]==d->v){gum_invocation_context_replace_return_value(ic,(gpointer)lc_vals[m]);fast_hits[0]++;return;} if(lc_keys[m]<d->v)lo=m+1; else hi=m-1;} }
void ne_enter(GumInvocationContext *ic){ D *d=GUM_IC_GET_INVOCATION_DATA(ic,D); d->v=0; if(!fast_flow)return;
  uint64_t ra=(uint64_t)gum_invocation_context_get_return_address(ic);
  if(ra==fast_cfg[0])d->v=fast_cfg[1]; else if(ra==fast_cfg[2])d->v=fast_cfg[3]; }
void ne_leave(GumInvocationContext *ic){ D *d=GUM_IC_GET_INVOCATION_DATA(ic,D);
  if(!fast_flow||!d->v||gum_invocation_context_get_return_value(ic)!=NULL)return;
  fast_hits[1]++; ic->cpu_context->pc=d->v; }
void g1_leave(GumInvocationContext *ic){ if(fast_flow&&(uint64_t)gum_invocation_context_get_return_address(ic)==fast_cfg[4]){gum_invocation_context_replace_return_value(ic,(gpointer)1);fast_hits[2]++;} }
void g2_leave(GumInvocationContext *ic){ if(fast_flow&&(uint64_t)gum_invocation_context_get_return_address(ic)==fast_cfg[5]){gum_invocation_context_replace_return_value(ic,(gpointer)0);fast_hits[3]++;} }
`,{fast_flow:FASTMEM,fast_cfg:FASTMEM.add(8),fast_hits:FASTMEM.add(72),lc_n:FASTMEM.add(104),lc_keys:FASTMEM.add(112),lc_vals:FASTMEM.add(112+8*LC_CAP)});
const fastSetFlow=()=>FASTMEM.writeS32(1);
const mapDvar=at(0x54be5e8).readPointer().readPointer();
const gameMalloc=new NativeFunction(Module.getGlobalExportByName('malloc'),'pointer',['size_t']);
const setGametype=new NativeFunction(at(0x1e51c3c),'void',['uint64']);
// Diagnostic only; enabled via WZM_SKIP_STUB53=1 when launching the runner.
// This does NOT reimplement the original object's protected initialization.
const BYPASS_STUB53 = false;
const BYPASS_STUB60 = false;
// Test the ORIGINAL separately registered host request producer instead of
// the forced party HostStart path. Enabled only explicitly by the runner.
const USE_ORIGINAL_ALT_PRODUCER = false;
const OBSERVE_PROTECTED_WRAPPERS = false;
// Passive original native session-loop observer, no state substitution.
const OBSERVE_SESSION_FRAMES = false;
// Read-only, bounded VM53 buffer and strlen return observer.
const OBSERVE_VM53_STRLEN = false;
// Passive, opt-in enumeration of original libc calls from the VM53 thread.
const OBSERVE_VM53_LIBC_IO = false;
// Branch at original VM53 bytecode +0x2be can reach native abort.
const OBSERVE_VM53_ABORT_BRANCH = false;
// Passive VM53 interpreter trace. Requires wrapper observer; no VM skips.
const OBSERVE_VM53_STAGES = false;
// Optional post-malloc VM bytecode branch witness, no writes/replacements.
const OBSERVE_VM53_BRANCHES = false;
// Opt-in VM53 bytecode cursor trace: samples the interpreter stream pointer
// (ctx+0x160, base 0x5d6ce6) on hot branch-handler hits plus a 5 ms timer.
// Read-only; distinguishes spin-loop vs forward progress.
const OBSERVE_VM53_CURSOR = false;
// Opt-in targeted steer (memory-only, requires the cursor trace): the VM
// spin loop's back-edge is branchE4 at bytecode 0x54dc testing u16 ctx+0.
// When that hot site is hit, write 0 to the predicate once so the branch
// falls through to the forward path (0x54e4). Single write, single site.
const STEER_VM53_ZERO_PRED = false;
// Same steer but pinned: write 0 on every hit of the hot gate, so every
// pass through wait-loop A falls through. Logging is rate-limited.
const STEER_VM53_PIN_PRED = false;
// Opt-in global-mailbox witness: logs the VM's mutable global reads and
// polls the libeevsdgz .data range for worker writes. Read-only.
const OBSERVE_VM53_GLOBALS = false;
// Optional snapshots of the 224-byte protected object at native handler entries.
const OBSERVE_VM53_OBJECT_DIFFS = false;
// Late original VM53 bytecode +0x674 (memset) and +0x684 (strlen),
// observe native arguments and continuation only; no dereference or mutation.
const OBSERVE_VM53_LATE_CALLS = false;
// Java-side finish/ANR witnesses live in finish_path_probe.js (frida-java
// bridge bundle, loaded by host_spawn.py under WZM_FINISH_TRACE=1) because
// Frida 17 does not expose Java as an implicit global here.
// Read-only network witness: DNS/connect/socket activity during the host
// path, any thread. Names the remote endpoints the session talks to.
const OBSERVE_NET_IO = false;
// Optionally fail telemetry DNS in memory (nothing sent to that host).
const BLOCK_TELEMETRY_DNS = false;
// Read-only libart JNI witness: which native code calls Java finish/exit.
const OBSERVE_JNI_FINISH = false;
// Verbose JNI CallVoidMethod family witness: every call (tid, mid, caller)
// during the host window, to catch a cached-mid finish call.
const OBSERVE_JNI_ALL_VOID = false;
// Read-only game log sink witness during the host window.
const OBSERVE_GAME_LOG = false;
// Read-only binder transaction witness: names the interface token and
// thread for activity-lifecycle transactions during the host window.
const OBSERVE_BINDER = false;
// Targeted kill-switch (opt-in, memory-only): when the protection thread
// issues IAppTask.finishAndRemoveTask / IActivityTaskManager task-kill
// binder transactions during the host window, the ioctl request value is
// rewritten to BINDER_VERSION so the write is dropped while the call still
// succeeds. No code or data of the game is patched.
const BLOCK_KILL_SWITCH = false;
// Offline loopback channel (opt-in, memory-only): the Demonware channel-open
// routine 0x1b2fee8 only marks a channel CONNECTED ([chan,#0x28]=5) for
// loopback transports (flags bit 1, or the transport byte +0x3c0). Both call
// sites pass flags=0 and the online relay can never complete offline, so the
// client channel state stays low and CL_CheckForResend (0x15e1100) turns the
// stalled resend into a fatal Com_Error once the interval elapses
// (0x3ba2388 requires state in {3,4,5}; 0x3ba2790 requires ==5). Setting
// flags bit 1 takes the same fast path an online loopback session takes.
// No code or data of the game is patched; only the live argument register.
const FORCE_LOOPBACK_CHAN = false;
const ROUTE_LOCAL_HOST_PACKET = false;
// The connectionless command compare at 0x3cefcfc uses a protocol string.
// When that slot is empty it points x8 at the constant 0x452899, whose first
// byte is 0, so "getchallenge" can never match and the server answers
// EXE/ERR_UNREGISTERED_CONNECTION from 0x3ccf4a4. If the packet token read
// by 0x3b8d19c (return 0x3cefc4c) is a real command, use that token as x8.
// Register only. No game bytes are written.
const FORCE_OOB_CMD = false;
const SEND_GAMESTATE = false;
const GAMESTATE_RETRY = false;
// The enter-world team gate reads the party member for this client. The member
// list is the pointer at party+0x20f8 (party object 0x613a4f0), stride 0x240.
// It counts only when byte +0x1f2 is 4, word +0x1e0 is nonzero, and the object
// pointer at +0x1f8 is set. Measured client+0x280 was 0, so that byte is not
// the spectator cause.
const JOIN_ALLIES = false;
const BOTS = false; // WZM_BOTS=1: connect steering below stops once the human client enters the world
// WZM_ENEMY_AI=N: the first N genuine marker-2 bots (in enter-world order) stay team 1,
// every later marker-2 bot is given team 2 like the local player. -1 keeps the old
// all-bots-enemies rule. The value is substituted by host_spawn.py.
const ENEMY_AI = -1;
let ENEMY_AI_RT = ENEMY_AI; // can be changed when a match is started from the menu (rpc go)
let mark2EnterSeq = 0;
let humanInWorld=false;const steerHooks=[];
const steerOn=()=>flowOverride&&!(BOTS&&humanInWorld);
const MATCH_PROBE = false;
const MATCH_LUA_OVERRIDE = null;
const MATCH_LUA_DELAY = 10000;
const MATCH_LUA_STEPS = null; // [[delayMs, luaSource], ...], run in order, once each
const NATURAL_UI_RESTART = false;
const LOAD_CLIENT_ZONES = false;
const UI_RETRY = false;
const UI_RESTART_DELAY_MS = 6000;
const UI_WAIT_ASSET = false;
// Skip trace-only per-call hooks (s3a566d4 alone fires ~57k times a run): the extra CPU load
// overheats the phone, and Oplus thermal control (tempLevel 5) then removes the game's task.
const QUIET = false;
// WZM_LOW_OVERHEAD=1: keep the VM53 steer writes but drop the 5 ms cursor sampler
// and the per-hit trace sends. The write path is unchanged; only logging/telemetry goes.
const LOW_OVERHEAD = false;
let matchRequest=null;
// Read-only client-connection observer (opt-in): watches the client connection
// FSM that CL_CheckForResend (0x15e1100) drives — clc.state at
// *(0x54bb7e8)+idx*0x1ec+8, the channel-connected gate 0x3ba2388, and the
// resend predicate 0x3ba2790. Logs transitions only; no writes at all.
const OBSERVE_CL_RESEND = false;
// Missing-entity guard (opt-in, memory-only): Lua spatial-query builtins
// resolve Lua handles to native objects via 0x333ae2c; when the object is
// gone it returns NULL and the getter 0x333af54 derefs NULL+0x60 (SIGSEGV on
// WZM_Main, host66 tombstone fault addr 0x60). At the two caller sites
// (0x337f800 in fn A 0x337f768, 0x337f470 in fn B 0x337f364) a NULL resolver
// result now redirects the live PC to the function's own return-0 epilog
// (0x337fa34 / 0x337f3a8) — the same "empty result" the engine produces when
// the query gate is closed. No code bytes and no game data are written.
const NULL_ENTITY_GUARD = false;
// Read-only connect-identity observer (opt-in): the server replies to the
// client's routed packet with EXE/ERR_UNREGISTERED_CONNECTION (host73). Before
// changing any address field, capture (a) the channel id uint16[address+0xc]
// and 32 bytes of the client's outgoing type-3/queue-2 packet (caller
// 0x3ba1884), (b) the same for the server's reply packet (caller 0x3ba17ac,
// the return site inside the reply builder 0x3ba1708), and (c) the true caller
// LR of 0x3ba1708 itself — which server path produced the rejection. Logs only;
// no writes at all. See HANDOVER_CLIENT_CONNECT_20261102.md step 1.
const OBSERVE_CONNECT_ID = false;
const vm53ActiveThreads = new Set();
const vm53ObjectSnapshots = new Map();
const vm53ReadObjectBytes=p=>{try{return new Uint8Array(p.readByteArray(0xe0));}catch(e){return null;}};
send({s:'jsMainInfo'});
if(OBSERVE_VM53_LATE_CALLS){
  try{
    const vm=Process.getModuleByName('libeevsdgz.so').base;
    const events=[
      ['memsetBeforeBL',0x29f9fc],
      ['memsetAfterBL',0x29fa00],
      ['strlenBeforeBL',0x2a7428],
      ['strlenAfterBL',0x2a742c]
    ];
    const hits={};
    for(const [name,offset] of events){
      try{Interceptor.attach(vm.add(offset),{onEnter(){
        const tid=Process.getCurrentThreadId();
        if(!flowOverride||!vm53ActiveThreads.has(tid))return;
        const n=(hits[name]||0)+1;hits[name]=n;
        if(n>8 && n%256!==0)return;
        const ctx=this.context;
        const item={s:'vm53LateOriginalNativeCall',name,n,thread:tid,
          offset:'0x'+offset.toString(16),x0:ctx.x0.toString(),
          x1:ctx.x1.toString(),x2:ctx.x2.toString(),
          ctxPointer:ctx.x19.toString()};
        try{
          const bytecode=ctx.x19.add(0x160).readPointer().sub(vm.add(0x5d6ce6)).toInt32();
          item.bytecodeCursor=bytecode;
        }catch(e){item.bytecodeCursor='unreadable';}
        // No arbitrary pointer/string dereference, no byte contents and
        // no NativeFunction calls. Record original arguments only.
        send(item);
      }});}catch(e){send({s:'vm53LateNativeHookFailed',name,error:String(e)});}
    }
    send({s:'vm53LateNativeHooksArmed',count:events.length,readOnly:true});
  }catch(e){send({s:'vm53LateNativeModuleUnavailable',error:String(e)});}
}
if(OBSERVE_NET_IO||BLOCK_TELEMETRY_DNS){
  const netCounts={};
  const netLog=(item,name)=>{const n=(netCounts[name]||0)+1;netCounts[name]=n;
    if(n<=32||n%512===0){item.n=n;send(item);}};
  const cstr=p=>{try{return p.isNull()?'':(p.readCString(64)||'').replace(/[^\x20-\x7e].*/,'');}catch(e){return '';}};
  const gai=Module.findGlobalExportByName('getaddrinfo');
  if(gai)try{Interceptor.attach(gai,{onEnter(a){
      this.host=cstr(a[0]);this.block=BLOCK_TELEMETRY_DNS&&this.host.includes('codefusion');
      netLog({s:'netGetaddrinfo',host:this.host,block:this.block,vm53:vm53ActiveThreads.has(Process.getCurrentThreadId()),tid:Process.getCurrentThreadId()},'getaddrinfo');
    },onLeave(r){if(this.block){r.replace(ptr(8));send({s:'netTelemetryDnsFailed',host:this.host});}}});}catch(e){send({s:'netHookFailed',name:'getaddrinfo',error:String(e)});}
  try{Interceptor.attach(Module.findGlobalExportByName('connect'),{onEnter(a){
    try{const f=a[1].readU16();
      if(f===2){const p=a[1].add(2).readU16();const port=((p&255)<<8)|(p>>8);
        const ip=[4,5,6,7].map(i=>a[1].add(i).readU8()).join('.');
        netLog({s:'netConnect4',ip,port,fd:a[0].toInt32(),vm53:vm53ActiveThreads.has(Process.getCurrentThreadId()),tid:Process.getCurrentThreadId(),from:rel(this.returnAddress)},'connect');
      }else if(f===1){netLog({s:'netConnectLocal',path:cstr(a[1].add(2)),tid:Process.getCurrentThreadId()},'connect');}
    }catch(e){}
  }});}catch(e){send({s:'netHookFailed',name:'connect',error:String(e)});}
  for(const fn of ['send','sendto','recv','recvfrom']){
    try{const fp=Module.findGlobalExportByName(fn);if(!fp)continue;
      Interceptor.attach(fp,{onEnter(a){
        const tid=Process.getCurrentThreadId();
        if(!vm53ActiveThreads.has(tid))return;
        netLog({s:'netSocketIO',fn,fd:a[0].toInt32(),len:a[2].toInt32(),tid},fn);
      }});
    }catch(e){}
  }
  try{Interceptor.attach(Module.findGlobalExportByName('socket'),{onEnter(a){
    netLog({s:'netSocket',domain:a[0].toInt32(),type:a[1].toInt32(),vm53:vm53ActiveThreads.has(Process.getCurrentThreadId()),tid:Process.getCurrentThreadId()},'socket');}});}catch(e){}
  send({s:'netIoHooksArmed',blockTelemetry:BLOCK_TELEMETRY_DNS,readOnly:!BLOCK_TELEMETRY_DNS});
}
if(OBSERVE_BINDER){
  try{
    // Witness outgoing binder transactions (write side of BINDER_WRITE_READ).
    // Read-only: observes parcel interface tokens to name who asks the system
    // to finish/destroy the activity. No fd filtering: the request number
    // _IOWR('b',1,48) is binder-specific ('b' magic), so matching it is
    // sufficient identification (verified: /dev/binderfs/binder on-device).
    const BWR=0xC0306201;
    const readTok=p=>{
      try{
        const b=p.readByteArray(96);if(!b)return null;
        const u=new Uint8Array(b);
        for(let o=0;o<=16;o+=4){
          const len=u[o]|(u[o+1]<<8)|(u[o+2]<<16)|(u[o+3]<<24);
          if(len<4||len>60)continue;
          let s='',ok=true;
          for(let i=0;i<len;i++){
            const c=u[o+4+i*2],z=u[o+5+i*2];
            if(z!==0||c<0x20||c>0x7e){ok=false;break;}
            s+=String.fromCharCode(c);
          }
          if(ok)return s;
        }
      }catch(e){}
      return null;
    };
    let binderLogged=0;
    const killDropCache=new Map(),killDropTok=new Map();
    Interceptor.attach(Module.findGlobalExportByName('ioctl'),{onEnter(a){
      if(!flowOverride)return;
      if(a[1].toUInt32()!==BWR)return;
      try{
        const bwr=a[2];
        // write_size (in) is valid on entry; write_consumed is driver-filled on return.
        const wcons=bwr.readU64().toNumber();
        const wbuf=bwr.add(16).readPointer();
        if(wbuf.isNull()||wcons<4||wcons>(1<<20))return;
        let off=0,guard=0;
        const tid=Process.getCurrentThreadId();
        while(off+4<=wcons&&guard++<48){
          const cmd=wbuf.add(off).readU32();off+=4;
          const nr=cmd&0xff,type=(cmd>>8)&0xff,psz=(cmd>>16)&0x3fff;
          if(type!==0x63)break;
          if((nr===0||nr===17)&&psz>=64){
            const txn=wbuf.add(off);
            // binder_transaction_data: target@0, cookie@8, code@16, flags@20,
            // sender_pid@24, sender_euid@28, data_size@32, offsets_size@40,
            // data.ptr.buffer@48, data.ptr.offsets@56 (64 bytes total).
            const code=txn.add(16).readU32();
            const flags=txn.add(20).readU32();
            const dsize=txn.add(32).readU64().toNumber();
            const dptr=txn.add(48).readPointer();
            if(code===0&&dsize===0){off+=psz;continue;} // PING: skip entirely
            if(BLOCK_KILL_SWITCH){
              // The protection retries a dropped kill in a tight loop; cache
              // positive drop decisions so repeats skip the token decode and
              // rate-limit the log so hot observers are not starved.
              const ck=tid+':'+code+':'+dsize;
              if(killDropCache.has(ck)){
                a[1]=ptr(0xc0046209);
                const n=(killDropCache.get(ck)||0)+1;killDropCache.set(ck,n);
                if(n%4096===0)send({s:'killSwitchDropped',cached:true,tok:killDropTok.get(ck),code,tid,n});
                off+=psz;continue;
              }
            }
            let tok=null;
            if(!dptr.isNull()&&dsize>8&&dsize<8192)tok=readTok(dptr);
            if(BLOCK_KILL_SWITCH&&tok&&
               ((tok==='android.app.IAppTask'&&code===1)||
                (tok==='android.app.IActivityTaskManager'&&code===37))){
              // Drop the task-kill write by turning this ioctl into a
              // harmless BINDER_VERSION query; the call itself still succeeds.
              a[1]=ptr(0xc0046209);
              const ck=tid+':'+code+':'+dsize;
              killDropCache.set(ck,1);killDropTok.set(ck,tok);
              send({s:'killSwitchDropped',tok,code,tid,vm53:vm53ActiveThreads.has(tid)});
              off+=psz;continue;
            }
            const interesting=tok&&/activity|window|task/i.test(tok);
            if(interesting||(tok&&binderLogged<300)||(!tok&&binderLogged<12)){
              binderLogged++;
              const ev={s:'binderTx',code,flags,tok,dsize,tid,vm53:vm53ActiveThreads.has(tid),caller:rel(this.returnAddress)};
              if(!tok&&dsize>=8&&dsize<=96&&binderLogged<=6){
                try{ev.head=Array.from(new Uint8Array(dptr.readByteArray(Math.min(dsize,48)))).map(x=>('0'+x.toString(16)).slice(-2)).join('');}catch(e){}
              }
              send(ev);
            }
          }
          off+=psz;
        }
      }catch(e){}
    }});
    send({s:'binderHooksArmed',readOnly:true});
  }catch(e){send({s:'binderHookFailed',error:String(e).slice(0,200)});}
}
if(OBSERVE_JNI_FINISH){
  try{
    const art=Process.getModuleByName('libart.so');
    const ex=n=>{try{return art.findExportByName(n);}catch(e){return null;}};
    const nameRe=/finish|exit|destroy|quit|anr|monitor/i;
    const mids=new Map();
    const hookGet=(sym,kind)=>{const f=ex(sym);if(!f)return;
      try{Interceptor.attach(f,{onEnter(a){try{this.nm=a[2].readCString();this.sg=a[3].readCString();}catch(e){this.nm=null;}},
        onLeave(r){if(this.nm&&nameRe.test(this.nm)){mids.set(r.toString(),this.nm+this.sg);
          send({s:'jniMidRegistered',kind,name:this.nm,sig:this.sg,mid:r.toString()});}}});}catch(e){send({s:'jniHookFailed',name:sym,error:String(e)});}};
    hookGet('_ZN3art3JNIILb0EE11GetMethodIDEP7_JNIEnvP7_jclassPKcS7_','virtual');
    hookGet('_ZN3art3JNIILb0EE17GetStaticMethodIDEP7_JNIEnvP7_jclassPKcS7_','static');
    const hookCall=(sym,kind,midIdx)=>{const f=ex(sym);if(!f)return;
      try{Interceptor.attach(f,{onEnter(a){const mid=a[midIdx].toString();const nm=mids.get(mid);
        if(nm)send({s:'jniCallMatched',kind,name:nm,tid:Process.getCurrentThreadId(),caller:rel(this.returnAddress)});}});}catch(e){send({s:'jniHookFailed',name:sym,error:String(e)});}};
    hookCall('_ZN3art3JNIILb0EE14CallVoidMethodEP7_JNIEnvP8_jobjectP10_jmethodIDz','void',2);
    hookCall('_ZN3art3JNIILb0EE15CallVoidMethodVEP7_JNIEnvP8_jobjectP10_jmethodIDSt9__va_list','voidV',2);
    hookCall('_ZN3art3JNIILb0EE15CallVoidMethodAEP7_JNIEnvP8_jobjectP10_jmethodIDP6jvalue','voidA',2);
    hookCall('_ZN3art3JNIILb0EE20CallStaticVoidMethodEP7_JNIEnvP7_jclassP10_jmethodIDz','staticVoid',2);
    hookCall('_ZN3art3JNIILb0EE21CallStaticVoidMethodVEP7_JNIEnvP7_jclassP10_jmethodIDSt9__va_list','staticVoidV',2);
    hookCall('_ZN3art3JNIILb0EE21CallStaticVoidMethodAEP7_JNIEnvP7_jclassP10_jmethodIDP6jvalue','staticVoidA',2);
    hookCall('_ZN3art3JNIILb0EE23CallNonvirtualVoidMethodEP7_JNIEnvP8_jobjectP7_jclassP10_jmethodIDz','nonvirtualVoid',3);
    send({s:'jniFinishHooksArmed',midCount:mids.size,readOnly:true});
  }catch(e){send({s:'jniFinishUnavailable',error:String(e).slice(0,300)});}
}
if(OBSERVE_JNI_ALL_VOID){
  try{
    const art=Process.getModuleByName('libart.so');
    const ex=n=>{try{return art.findExportByName(n);}catch(e){return null;}};
    const voidCounts={};
    const hookAll=(sym,kind,midIdx)=>{const f=ex(sym);if(!f)return;
      try{Interceptor.attach(f,{onEnter(a){
        if(!flowOverride)return;
        const n=(voidCounts[kind]||0)+1;voidCounts[kind]=n;
        if(n>512&&n%512!==0)return;
        send({s:'jniVoidCall',kind,n,mid:a[midIdx].toString(),tid:Process.getCurrentThreadId(),caller:rel(this.returnAddress)});
      }});}catch(e){send({s:'jniAllHookFailed',name:sym,error:String(e)});}};
    hookAll('_ZN3art3JNIILb0EE14CallVoidMethodEP7_JNIEnvP8_jobjectP10_jmethodIDz','void',2);
    hookAll('_ZN3art3JNIILb0EE15CallVoidMethodVEP7_JNIEnvP8_jobjectP10_jmethodIDSt9__va_list','voidV',2);
    hookAll('_ZN3art3JNIILb0EE15CallVoidMethodAEP7_JNIEnvP8_jobjectP10_jmethodIDP6jvalue','voidA',2);
    hookAll('_ZN3art3JNIILb0EE20CallStaticVoidMethodEP7_JNIEnvP7_jclassP10_jmethodIDz','staticVoid',2);
    hookAll('_ZN3art3JNIILb0EE23CallNonvirtualVoidMethodEP7_JNIEnvP8_jobjectP7_jclassP10_jmethodIDz','nonvirtualVoid',3);
    send({s:'jniAllVoidHooksArmed',readOnly:true});
  }catch(e){send({s:'jniAllVoidUnavailable',error:String(e).slice(0,300)});}
}
if(OBSERVE_GAME_LOG){
  const gstr=p=>{try{return p.isNull()?null:(p.readCString(160)||'').replace(/[^\x20-\x7e]/g,'').slice(0,150);}catch(e){return null;}};
  // The sink fires ~600k times a run; send only distinct lines that look like flow changes.
  const keep=/error|disconnect|quit|exit|kick|drop|leave|end|timeout|fail|lobby|front|session|party|class|loadout|spawn|team|intermission|prematch|restart|map_restart|shutdown/i;
  const seenLog=new Set();
  try{Interceptor.attach(at(0x12a3d5c),{onEnter(a){
    if(!flowOverride)return;
    const t=[gstr(a[0]),gstr(a[1]),gstr(a[2])].filter(x=>x).join(' | ');
    if(!t||!keep.test(t)||seenLog.has(t)||seenLog.size>400)return;
    seenLog.add(t);send({s:'gameLog',text:t,tid:Process.getCurrentThreadId()});
  }});send({s:'gameLogHookArmed',readOnly:true,filtered:true});}catch(e){send({s:'gameLogHookFailed',error:String(e)});}
}
// With player data ready, host start reaches a JNI call whose Java null check faults inside
// ART. ART turns that fault into a Java exception, but only if Frida lets the signal through.
const HOST_START_PROPAGATE = false;
// Game mode before host start. The real party start 0x1625510 only sends the level request
// 0x3abb5b4 when feature bit 77 of the current mode is set (0x3abaf4c). Mode 10, the front
// end, lacks it, so the map never loads. -1 off, -2 list the mode table only, N switch to mode N.
const MP_MODE = -1;
const modeTable=()=>at(0x54d9b30).readPointer();
const modeBit=(i,bit)=>(modeTable().add(i*0x1a8+0x180+(bit>>5)*4).readU32()<<(bit&31))>>>31;
function listModes(){
  const rows=[];
  for(let i=0;i<32;i++){
    const h=modeTable().add(i*0x1a8).readU64();
    if(h.equals(0))continue;
    rows.push({i,hash:h.and(uint64('0x7fffffffffffffff')).toString(16),bit77:modeBit(i,77),c0:modeTable().add(i*0x1a8+0xc0).readU8()});
  }
  send({s:'modeTable',current:at(0xc115ea8).readU8(),pending:at(0xc115eb0).readU8(),rows});
}
const requestMode=new NativeFunction(at(0x3ab285c),'void',['uint64','int','pointer']);
const applyMode=new NativeFunction(at(0x3ab2960),'void',[]);
// Read-only, with a forced mode: log every mode request (0x3ab285c, rare) and every apply that
// changes the mode (0x3ab2960 runs each frame, so only when pending != current).
if(MP_MODE!==-1){
  // Hostname lookups (rare): the game resolves a host about 1 s before it closes itself in MP.
  try{Interceptor.attach(Module.findGlobalExportByName('getaddrinfo'),{onEnter(a){let h=null;try{h=a[0].readCString();}catch(e){}
    send({s:'dnsLookup',host:h,bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,10).map(rel)});}});}catch(e){send({s:'dnsHookFailed',e:''+e});}
  Interceptor.attach(at(0x3ab285c),{onEnter(a){send({s:'modeRequestSeen',hash:a[0].toString(),current:at(0xc115ea8).readU8(),lr:rel(this.returnAddress),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,8).map(rel)});}});
  Interceptor.attach(at(0x3ab2960),{onEnter(){const c=at(0xc115ea8).readU8(),p=at(0xc115eb0).readU8();this.chg=c!==p;
    if(this.chg)send({s:'modeApplySeen',current:c,pending:p,lr:rel(this.returnAddress),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,8).map(rel)});}});
}
// Mode 10 is br_mgl, 11 is mp_mgl (names from the game's FNV-1a, offset 0x47f5817a5ef961ba).
// Applying from the frame hook hangs (front-end zone reload waits on this thread). MP_MODE+100
// only requests the mode and leaves the apply to the game.
function switchMode(i){
  if(i>=200){i-=200;at(0xc115ea8).writeU8(i);at(0xc115eb0).writeU8(i);
    send({s:'modeSwitched',forced:true,current:at(0xc115ea8).readU8(),bit77:modeBit(i,77)});return;}
  const apply=i<100;if(!apply)i-=100;
  const h=modeTable().add(i*0x1a8).readU64().and(uint64('0x7fffffffffffffff'));
  send({s:'modeSwitch',from:at(0xc115ea8).readU8(),to:i,hash:h.toString(16),apply});
  requestMode(h,1,ptr(0));
  if(apply)applyMode();
  send({s:'modeSwitched',current:at(0xc115ea8).readU8(),bit77:modeBit(at(0xc115ea8).readU8(),77)});
}
// MODE_WATCH logs mode requests 0x3ab285c(hash) and real applies after host start; MODE_LOCK also
// rewrites a request for another mode to the current one, to test whether a mode change ends the match.
const MODE_WATCH = false, MODE_LOCK = false;
if(MODE_WATCH||MODE_LOCK){
  Interceptor.attach(at(0x3ab285c),{onEnter(a){
    const cur=at(0xc115ea8).readU8(),curHash=modeTable().add(cur*0x1a8).readU64().and(uint64('0x7fffffffffffffff'));
    const req=uint64(a[0].toString()).and(uint64('0x7fffffffffffffff'));
    const lock=MODE_LOCK&&cur===11&&!req.equals(curHash);
    if(lock)a[0]=ptr(curHash.toString());
    send({s:'modeRequest',hash:req.toString(16),current:cur,locked:lock,lr:rel(this.returnAddress),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,6).map(rel)});
  }});
  Interceptor.attach(at(0x3ab2960),{onEnter(){this.c=at(0xc115ea8).readU8();this.p=at(0xc115eb0).readU8();
    if(this.c!==this.p)send({s:'modeApply',current:this.c,pending:this.p,lr:rel(this.returnAddress)});}});
}
// Quit path: 0x3a79c54 -> 0x12a1010 calls Java finish() then exit(0). QUIT_TRACE logs who asks;
// QUIT_BLOCK turns the quit into a no-op so the match can keep running (memory-only, diagnostic).
const QUIT_TRACE = false, QUIT_BLOCK = false;
if(QUIT_TRACE||QUIT_BLOCK){
  Interceptor.attach(at(0x3a79c54),{onEnter(a){send({s:'quitRequested',x0:a[0].toString(),x1:a[1].toString(),bt:Thread.backtrace(this.context,Backtracer.ACCURATE).slice(0,14).map(rel)});}});
  if(QUIT_BLOCK)Interceptor.replace(at(0x12a1010),new NativeCallback(function(){send({s:'quitBlocked'});},'void',[]));
}
const hostStart=new NativeFunction(at(0x1621ab0),'void',[],HOST_START_PROPAGATE?{exceptions:'propagate'}:{});
const worldUnload=new NativeFunction(at(0x138462c),'void',['int']); // reaches R_UnloadWorld 0x2d172f8
// The client match entry runs these three just before 0x3a876a0; they clear the scope stack that call pops.
const prep1=new NativeFunction(at(0x134754c),'void',['int']),prep2=new NativeFunction(at(0x3a545c0),'void',[]),prep3=new NativeFunction(at(0x218fbd4),'void',[]);
const rel=p=>{const q=Process.findModuleByAddress(p);return q?q.name.slice(0,12)+'+'+p.sub(q.base).toString(16):p.toString();};
// LuaFile cache. In-match LUIStartup requires LuaFile 56794f44b636e9f1 (K29); whether its zone is still
// registered when the UI restarts varies by run, and the Lua loader 0x33285f8 then fails silently.
// At the menu, copy the contiguous block of 0x50-byte LuaFile headers around K29 (+0x28 deps, low 16
// bits of +0x30 dep count, +0x34 payload size, +0x38 payload) into malloc memory, and serve the copy
// when the asset lookup 0x19a9930(0x4b, hash, 0) comes back empty. Memory-only; no game bytes change.
const LUA_ASSET_CACHE = false;
// Read-only: names the Lua function at 0x341db10 asks the game-type registry for (0x2b0f170
// returns -1, then error "9cc335ab21209deb:201"). The registry is rebuilt by 0x2b0e1c4.
const UI_LOOKUP_TRACE = false;
// The omnvar registry (names the HUD reads via LUI.DataSourceFromOmnvar) is built by
// 0x2b0e1c4(category, gametype, session). ftue_orientation lacks the MP HUD's omnvars, so this
// swaps in another game type hash for that build only. '' leaves it alone (args still logged).
const OMNVAR_GAMETYPE = '';
// Registry layout: buckets int[4096] at 0x7b12880 (hash & 0xfff), entries {u64 hash, int next} at
// 0x7b6d880 (hash 0 ends the list), descriptors 0x30 bytes at 0x7b16880 (+0x29 type: 0 bool,
// 1 float, 2 int, 3 bitfield, 4 hash, 5 int, 6 string). OMNVAR_ADD appends the listed names as int
// omnvars by copying an existing type-2 descriptor, so HUD models bound to them read 0, not nil.
const OMNVAR_ADD = [];
Interceptor.attach(at(0x2b0e1c4),{onEnter(a){
  const orig=a[1].toString();
  if(OMNVAR_GAMETYPE)a[1]=ptr(OMNVAR_GAMETYPE);
  send({s:'omnvarBuild',category:a[0].toInt32()&0xff,gametype:orig,used:a[1].toString(),lr:rel(this.returnAddress)});
},onLeave(){addOmnvars('build');}});
// The registry is reset and refilled elsewhere too (0x2b0d060), so add again just before the UI restart.
if(OMNVAR_ADD.length)Interceptor.attach(at(0x138456c),{onEnter(){addOmnvars('uiRestart');}});
function addOmnvars(when){
  if(!OMNVAR_ADD.length)return;
  try{
    const ent=at(0x7b6d880),bk=at(0x7b12880),desc=at(0x7b16880);
    let n=0;while(!ent.add(n*16).readU64().equals(0))n++;
    let tmpl=-1;for(let i=0;i<n;i++)if(desc.add(i*0x30+0x29).readU8()===2){tmpl=i;break;}
    if(tmpl<0)throw new Error('no int omnvar to copy');
    const added=[];
    for(const hx of OMNVAR_ADD){
      const h=uint64(hx);
      let i=bk.add(h.and(0xfff).toNumber()*4).readS32(),dup=false;
      while(i!==-1){if(ent.add(i*16).readU64().equals(h)){dup=true;break;}i=ent.add(i*16+8).readS32();}
      if(dup||n>=1800)continue;
      ent.add(n*16).writeU64(h);ent.add(n*16+8).writeS32(-1);
      Memory.copy(desc.add(n*0x30),desc.add(tmpl*0x30),0x30);
      const b=bk.add(h.and(0xfff).toNumber()*4);let j=b.readS32();
      if(j===-1)b.writeS32(n);else{while(ent.add(j*16+8).readS32()!==-1)j=ent.add(j*16+8).readS32();ent.add(j*16+8).writeS32(n);}
      added.push({hash:hx,index:n});n++;
    }
    send({s:'omnvarAdded',when,template:tmpl,total:n,added});
  }catch(e){send({s:'omnvarAddFailed',when,e:''+e});}
}
// Read-only: capture decrypted LuaJIT chunks. lua_load 0x4490458(L, reader 0x332783c, ud, name);
// the reader returns (buf, *size). Chunks whose name contains a LUA_CHUNK_DUMP entry are sent as hex.
const LUA_CHUNK_DUMP = [];
if(LUA_CHUNK_DUMP.length){
  // Entries 'grep:<text>' also capture any chunk whose bytes contain <text>.
  const greps=LUA_CHUNK_DUMP.filter(x=>x.startsWith('grep:')).map(x=>Array.from(x.slice(5),c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join(' '));
  const names=LUA_CHUNK_DUMP.filter(x=>!x.startsWith('grep:'));
  let cur=null;
  Interceptor.attach(at(0x4490458),{onEnter(a){let n='';try{n=a[3].readCString(64)||'';}catch(e){}
    cur={name:n,parts:[],want:names.some(x=>n.includes(x))};},
    onLeave(){if(cur&&cur.want){const all=cur.parts.join('');send({s:'luaChunk',name:cur.name,len:all.length/2,hex:all});}cur=null;}});
  Interceptor.attach(at(0x332783c),{onEnter(a){this.sz=a[2];},onLeave(r){
    if(!cur||r.isNull())return;const n=this.sz.readU64().toNumber();if(!n)return;
    if(!cur.want)for(const g of greps)if(Memory.scanSync(r,n,g).length){cur.want=true;break;}
    cur.parts.push(Array.from(new Uint8Array(r.readByteArray(n))).map(x=>('0'+x.toString(16)).slice(-2)).join(''));}});
}
// For a name the registry lacks, report the registry inactive (0x2b0cdf4 -> 0) to 0x341db10 only,
// so it takes its own no-value path 0x341dd48 (returns nil, like the sibling 0x341dd78 does)
// instead of raising "9cc335ab21209deb:201". Name is in x22 there. Memory-only.
const UI_MISSING_NIL = false;
if(UI_MISSING_NIL){
  const lookup=new NativeFunction(at(0x2b0f170),'int',['uint64']);
  // Callers compare the value with numbers, so the no-value path then pushes integer 0
  // (lua_pushinteger 0x44844a0, as 0x341dcf4 does) and returns one result.
  const pushInt=new NativeFunction(at(0x44844a0),'void',['pointer','int64']);
  const site=at(0x341db50);let nils=0;const flagged=new Set();
  Interceptor.attach(at(0x2b0cdf4),{onLeave(r){
    if(!this.returnAddress.equals(site)||r.toInt32()===0)return;
    const name=uint64(this.context.x22.toString());
    if(lookup(name)!==-1)return;
    r.replace(ptr(0));nils++;flagged.add(this.threadId);
    if(nils<=5||nils%1000===0)send({s:'uiMissingNil',n:nils,hash:name.toString(16)});
  }});
  // The existence check 0x341dd78(L, name) pushes false for a missing name, and the Lua data
  // source then returns nil without reading. Push true on top (lua_pushboolean 0x448487c); it
  // returns one result, so Lua sees the top value.
  const pushBool=new NativeFunction(at(0x448487c),'void',['pointer','int']);
  let exists=0;
  Interceptor.attach(at(0x341dd78),{onEnter(a){this.L=a[0];this.name=uint64(a[1].toString());},onLeave(r){
    if(r.toInt32()!==1||lookup(this.name)!==-1)return;
    pushBool(this.L,1);exists++;
    if(exists<=5)send({s:'uiMissingExists',n:exists,hash:this.name.toString(16)});
  }});
  Interceptor.attach(at(0x341db10),{onEnter(a){this.L=a[0];},onLeave(r){
    if(!flagged.has(this.threadId))return;
    flagged.delete(this.threadId);
    const before=r.toInt32();
    if(before===0){pushInt(this.L,0);r.replace(ptr(1));}
    if(nils<=5)send({s:'uiMissingPushed',before,lr:rel(this.returnAddress)});
  }});
}
if(UI_LOOKUP_TRACE){
  const missing=new Map();let found=0;
  Interceptor.attach(at(0x2b0f170),{onEnter(a){this.h=a[0];},onLeave(r){
    if(!this.returnAddress.equals(at(0x341db5c)))return;
    if(r.toInt32()!==-1){found++;return;}
    const k=this.h.toString();const n=(missing.get(k)||0)+1;missing.set(k,n);
    if(n===1&&missing.size<=40)send({s:'uiLookupMissing',hash:k,count:at(0x7b7d884).readU32(),found});
    if(missing.size===1&&n===1){const hs=[];for(let i=0;i<4096;i++){const e=at(0x7b6d880).add(i*16);const h=e.readU64();if(h.equals(0))break;hs.push(h.toString(16));}
      send({s:'uiRegistryDump',n:hs.length,hashes:hs});}
  }});
}
if(LUA_ASSET_CACHE)try{
  const find=new NativeFunction(at(0x19a9930),'pointer',['int','uint64','int']);
  const malloc=new NativeFunction(Module.findGlobalExportByName('malloc'),'pointer',['size_t']);
  const anchor=find(0x4b,uint64('0x56794f44b636e9f1'),0);
  if(anchor.isNull())throw new Error('K29 not registered at the menu');
  const ok=p=>{try{const h=p.readU64(),w=p.add(0x30).readU32(),n=w&0xffff,size=p.add(0x34).readU32(),pl=p.add(0x38).readPointer();
    if(h.equals(0)||size===0||size>(8<<20)||pl.isNull())return false;pl.readU8();if(n)p.add(0x28).readPointer().readPointer();return true;}catch(e){return false;}};
  let lo=anchor,hi=anchor;
  while(ok(lo.sub(0x50)))lo=lo.sub(0x50);
  while(ok(hi.add(0x50)))hi=hi.add(0x50);
  const count=hi.sub(lo).toInt32()/0x50+1;
  const remap=new Map(),byHash=new Map();let bytes=0;
  for(let i=0;i<count;i++){const old=lo.add(i*0x50),copy=malloc(0x50);Memory.copy(copy,old,0x50);remap.set(old.toString(),copy);}
  for(let i=0;i<count;i++){
    const old=lo.add(i*0x50),copy=remap.get(old.toString());
    const size=old.add(0x34).readU32(),pl=malloc(size);Memory.copy(pl,old.add(0x38).readPointer(),size);copy.add(0x38).writePointer(pl);bytes+=size;
    const n=old.add(0x30).readU32()&0xffff;
    if(n){const d=malloc(n*8),od=old.add(0x28).readPointer();
      for(let j=0;j<n;j++){const q=od.add(j*8).readPointer();d.add(j*8).writePointer(remap.get(q.toString())||q);}
      copy.add(0x28).writePointer(d);bytes+=n*8;}
    byHash.set(old.readU64().and(uint64('0x7fffffffffffffff')).toString(16),copy);
  }
  send({s:'luaCacheBuilt',entries:count,bytes,first:lo.readU64().toString(16),anchor:anchor.toString()});
  {const ks=[...byHash.keys()].map(k=>BigInt('0x'+k)).sort((x,y)=>x<y?-1:x>y?1:0).slice(0,LC_CAP);
   ks.forEach((k,i)=>{FASTMEM.add(112+8*i).writeU64(uint64(k.toString()));FASTMEM.add(112+8*LC_CAP+8*i).writePointer(byHash.get(k.toString(16)));});
   FASTMEM.add(104).writeS32(ks.length);
   Interceptor.attach(at(0x19a9930),{onEnter:FAST.lc_enter,onLeave:FAST.lc_leave});
   send({s:'luaCacheNative',entries:ks.length,total:byHash.size});
   let lastServed=0;setInterval(()=>{const n=FASTMEM.add(72).readU64().toNumber();if(n!==lastServed){lastServed=n;send({s:'luaCacheServed',n});}},30000);}
}catch(e){send({s:'luaCacheFailed',e:''+e});}
if(OBSERVE_SESSION_FRAMES){
  const functions=[['sessionOuterLoop',0x3cf253c],['sessionTick',0x3cf10e0],
    ['sessionSpecialBlock',0x3cf11e0],['sessionState3',0x3ce93c4],
    ['sessionStart',0x3cf0cf0],['nativeZoneLoad',0x199efac]];
  const counters={};
  for(const [name,offset] of functions){
    try{
      Interceptor.attach(at(offset),{onEnter(args){
        const count=(counters[name]||0)+1;counters[name]=count;
        if(count<=8||count%2048===0){
          const item={s:'nativeSessionTickWitness',name,count,
            thread:Process.getCurrentThreadId(),hostAttemptActive:flowOverride,
            sessionState:at(0xcdef7c8).readU32(),x0:args[0].toString()};
          if(name==='sessionTick'||name==='sessionOuterLoop'||name==='sessionSpecialBlock'){
            try{item.sessionPlus30=args[0].add(0x30).readU32();}catch(e){item.sessionPlus30='unreadable';}
          }
          send(item);
        }
      }});
    }catch(e){send({s:'nativeSessionTickHookFailed',name,error:String(e)});}
  }
  send({s:'nativeSessionTickHooksArmed',count:functions.length,readOnly:true});
}
if(OBSERVE_PROTECTED_WRAPPERS){
  try{
    const vm=Process.getModuleByName('libeevsdgz.so').base;
    const wrappers=[[0,0x2569d8],[1,0x21216c],[2,0x2413e4],[3,0x248268],[4,0x24a038],[5,0x24bd00],[7,0x250e8c],[8,0x252cf8],[9,0x2413b8],[10,0x2413c4],[11,0x254aa0],[12,0x21a378],[14,0x259430],[15,0x21c624],[16,0x24bcf0],[17,0x2413d0],[19,0x2569f0],[20,0x25b254],[21,0x24bd14],[22,0x24bd20],[23,0x21e43c],[24,0x25d02c],[25,0x2569e4],[26,0x2201d8],[27,0x25f2f8],[28,0x222294],[30,0x223e98],[31,0x2611b8],[32,0x2311b8],[33,0x223ea8],[34,0x233510],[35,0x25d01c],[37,0x236f10],[38,0x238b70],[39,0x2311ac],[41,0x23b0b4],[42,0x2185e4],[43,0x2413ac],[46,0x2569fc],[52,0x226608],[53,0x216818],[54,0x2283d0],[55,0x22a1a0],[56,0x22bda4],[57,0x22d9b0],[58,0x22f5a4],[59,0x2448b4],[60,0x246648]];
    for(const [idx,off] of wrappers){
      try{
        Interceptor.attach(vm.add(off),{onEnter(a){
          if(!flowOverride)return;
          const tid=Process.getCurrentThreadId();vm53ActiveThreads.add(tid);
          if(idx===53){
            if(OBSERVE_VM53_OBJECT_DIFFS){
              const bytes=vm53ReadObjectBytes(a[0]);
              vm53ObjectSnapshots.set(tid,{ptr:a[0],last:bytes,reads:0});
              send({s:'vm53ObjectWatchArmed',thread:tid,size:0xe0,readable:bytes!==null});
            }
          }
          send({s:'actualProtectedWrapperEnter',idx,thread:Process.getCurrentThreadId(),x0:a[0].toString(),x1:a[1].toString(),x2:a[2].toString(),caller:rel(this.returnAddress)});
        },onLeave(ret){
          if(flowOverride)send({s:'actualProtectedWrapperReturned',idx,ret:ret.toString()});
          const tid=Process.getCurrentThreadId();vm53ActiveThreads.delete(tid);
          if(idx===53){vm53ObjectSnapshots.delete(tid);}
        }});
        send({s:'actualProtectedWrapperHookInstalled',idx,off:'0x'+off.toString(16)});
      }catch(e){send({s:'actualProtectedWrapperHookFailed',idx,error:String(e)});}
    }
  }catch(e){send({s:'vmModuleUnavailable',error:String(e)});}
}
if(OBSERVE_VM53_STRLEN){
  const vm=Process.getModuleByName('libeevsdgz.so').base;
  const visits={entry:0,returned:0};
  try{
    Interceptor.attach(vm.add(0x321020),{onEnter(){
      const tid=Process.getCurrentThreadId();
      if(!flowOverride||!vm53ActiveThreads.has(tid))return;
      const n=++visits.entry;if(n>8&&n%1024!==0)return;
      try{
        const ctx=this.context.x0;
        const heap=ctx.add(0x44).readPointer();
        const bytes=Array.from(new Uint8Array(heap.readByteArray(16)));
        send({s:'vm53StrlenInput',n,thread:tid,heap:heap.toString(),
          bytes16:bytes.map(x=>x.toString(16).padStart(2,'0')).join(''),
          hasNul16:bytes.includes(0)});
      }catch(e){send({s:'vm53StrlenInputUnreadable',n,error:String(e)});}
    }});
    Interceptor.attach(vm.add(0x321040),{onEnter(){
      const tid=Process.getCurrentThreadId();
      if(!flowOverride||!vm53ActiveThreads.has(tid))return;
      const n=++visits.returned;if(n<=8||n%1024===0)
        send({s:'vm53StrlenReturned',n,thread:tid,length:this.context.x0.toString()});
    }});
    send({s:'vm53StrlenHooksArmed',readOnly:true,entry:'0x321020',return:'0x321040'});
  }catch(e){send({s:'vm53StrlenHookFailed',error:String(e)});}
}
if(OBSERVE_VM53_LIBC_IO){
  const ioNames=['opendir','readdir','readdir64','scandir','open','openat',
    '__open_2','readlink','readlinkat','access','fopen','fgets','getdents64'];
  const ioCounts={};
  // readCString(160) in Frida reads a fixed byte count, even beyond NUL:
  // never include unrelated adjacent process memory in the saved log.
  const safePath=p=>{
    if(p.isNull())return '';
    try{
      let result='';
      for(let i=0;i<120;i++){
        const b=p.add(i).readU8();
        if(b===0)break;
        result+=b>=32&&b<=126?String.fromCharCode(b):'?';
      }
      return result;
    }catch(e){return 'unreadable';}
  };
  for(const name of ioNames){
    try{
      const target=Module.findGlobalExportByName(name);if(!target)continue;
      Interceptor.attach(target,{onEnter(a){
        const tid=Process.getCurrentThreadId();
        this.vm53IoActive=flowOverride&&vm53ActiveThreads.has(tid);
        if(!this.vm53IoActive)return;
        this.vm53IoN=(ioCounts[name]||0)+1;ioCounts[name]=this.vm53IoN;
        if(this.vm53IoN<=12||this.vm53IoN%1024===0){
          let path='';
          if(name==='openat'||name==='readlinkat')path=safePath(a[1]);
          else if(['readdir','readdir64','getdents64','fgets'].includes(name))path='';
          else path=safePath(a[0]);
          send({s:'vm53LibcEnter',name,n:this.vm53IoN,thread:tid,path});
        }
      },onLeave(ret){
        if(!this.vm53IoActive||this.vm53IoN>12&&this.vm53IoN%1024!==0)return;
        const item={s:'vm53LibcReturn',name,n:this.vm53IoN,result:ret.toString()};
        if((name==='readdir'||name==='readdir64')&&!ret.isNull())
          item.direntName=safePath(ret.add(19));
        send(item);
      }});
    }catch(e){send({s:'vm53LibcHookFailed',name,error:String(e)});}
  }
  send({s:'vm53LibcIoHooksArmed',readOnly:true});
}
if(OBSERVE_VM53_ABORT_BRANCH){
  const vm=Process.getModuleByName('libeevsdgz.so').base;
  const program=vm.add(0x5d6ce6);
  const targets=[['conditionalHandler',0x36b5d8],
    ['auxConditional',0x36b59c],['fatalHandler',0x332b40]];
  const counts={};
  for(const [name,offset] of targets){
    try{
      Interceptor.attach(vm.add(offset),{onEnter(){
        const tid=Process.getCurrentThreadId();
        if(!flowOverride||!vm53ActiveThreads.has(tid))return;
        if(name==='fatalHandler'){
          send({s:'vm53OriginalFatalHandlerReached',thread:tid,
            name,off:'0x332b40'});
          return;
        }
        try{
          const ctx=this.context.x0;
          const codePtr=ctx.add(0x160).readPointer();
          const bytecodeOffset=codePtr.sub(program).toInt32();
          const value=ctx.readU16();
          // Covers +0x2be / +0x32e / +0x388 / +0x516
          // and later bytecode +0x6ae / +0x6e6. Exact cursor
          // is always AFTER the opcode, so those last two are
          // observed at +0x6b2 and +0x6ea respectively.
          if(bytecodeOffset>=0x260&&bytecodeOffset<=0x700){
            const key=name+':'+bytecodeOffset;
            const n=(counts[key]||0)+1;counts[key]=n;
            if(n<=8||n%1024===0)
              send({s:'vm53PostStrlenBranch',name,thread:tid,
                bytecodeCursorOffset:bytecodeOffset,
                predicate:value,n});
          }
        }catch(e){send({s:'vm53PostStrlenBranchUnreadable',name,error:String(e)});}
      }});
    }catch(e){send({s:'vm53AbortBranchHookFailed',name,error:String(e)});}
  }
  send({s:'vm53AbortBranchHooksArmed',count:targets.length,readOnly:true});
}
if(OBSERVE_VM53_STAGES){
  const vm=Process.getModuleByName('libeevsdgz.so').base;
  const points=[['interpreter',0x3b6818],['firstDispatch',0x36f094],
    ['loadImmediate',0x3b241c],['scratchTransfer',0x3abb2c],
    ['pointerArithmetic',0x272f0c],['pointerStep',0x262efc],
    ['scratchStore',0x38a8c8],['helper7',0x286830],
    ['helper9',0x2d4a20],['helper9Native',0x3bdbe4],
    ['mutableGlobalRead',0x39c190],['rodataByte',0x36be18],
    ['scratchNumericStore',0x3897f0],['mallocHandler',0x2f19e4],
    ['mallocResultCopy',0x3aba00],['allocatedHeapByteStore',0x38986c]];
  if(OBSERVE_VM53_BRANCHES)points.push(
    ['predCalc',0x280720],['branchE4',0x36b5d8],
    ['branchEC',0x36b59c],['immBranchData',0x3a5810],
    ['scratchTwoStore',0x38965c],['pointerFromHeap',0x2729b0],
    ['pointerFromRO',0x26d6b0],['fetchScratchTwo',0x36b974],
    ['advanceRO',0x263b30],['branchAltStore',0x38a188],
    ['branchAltCalc',0x3a6034]);
  const branchProbeHits={};
  const heapProbeHits={};
  // Allocation handlers tail-dispatch: onLeave is not allocator completion.
  Interceptor.attach(vm.add(0x2f1a04),{onEnter(){
    const tid=Process.getCurrentThreadId();
    if(!flowOverride||!vm53ActiveThreads.has(tid))return;
    try{
      const ctx=this.context.x19,pc=ctx.add(0x160).readPointer();
      const opcode=pc.add(8).readU32();
      const table=vm.add(0x5aea78).readPointer();
      const next=opcode<65536?table.add(opcode*8).readPointer():ptr(0);
      send({s:'vm53AllocationCompleted',thread:tid,result:this.context.x0.toString(),
        bytecode:rel(pc),nextOpcode:opcode,nextHandler:rel(next)});
    }catch(e){send({s:'vm53AllocationObservationError',error:String(e)});}
  }});
  const hits={};
  for(const [name,off] of points)try{
    Interceptor.attach(vm.add(off),{onEnter(){
      const tid=Process.getCurrentThreadId();
      if(!flowOverride||!vm53ActiveThreads.has(tid))return;
      if(OBSERVE_VM53_BRANCHES&&(name==='branchE4'||name==='branchEC')){
        try{
          const count=(branchProbeHits[name]||0)+1;branchProbeHits[name]=count;
          // The VM iterates through thousands of encoded words. Keep the
          // read-only observer from flooding the bridge and delaying startup.
          if(count<=64||count%4096===0)send({s:'vm53BranchPredicate',name,thread:tid,count,
            ctx0:this.context.x0.readU16(),ctx6e:this.context.x0.add(0x6e).readU16()});
        }catch(e){send({s:'vm53BranchPredicateUnreadable',name,error:String(e)});}
      }
      if(OBSERVE_VM53_BRANCHES&&name==='allocatedHeapByteStore'){
        try{
          const count=(heapProbeHits[name]||0)+1;heapProbeHits[name]=count;
          if(count<=16||count%1024===0){
            const dest=this.context.x0.add(0xbe).readPointer();
            send({s:'vm53HeapByteStoreReached',thread:tid,count,destination:dest.toString(),priorByte:dest.readU8()});
          }
        }catch(e){send({s:'vm53HeapByteStoreUnreadable',error:String(e)});}
      }
      if(name==='mallocHandler'){
        try{
          const ctx=this.context.x0,buf=ctx.add(0x152).readPointer();
          this.vm53MallocCtx=ctx;
          send({s:'vm53MallocHandlerEnter',thread:tid,size:buf.readU64().toString(),
            scratch:buf.toString()});
        }catch(e){send({s:'vm53MallocHandlerInputUnreadable',thread:tid,error:String(e)});}
      }
      if(OBSERVE_VM53_OBJECT_DIFFS){
        const snap=vm53ObjectSnapshots.get(tid);
        if(snap){
          const now=vm53ReadObjectBytes(snap.ptr);snap.reads++;
          if(!now&&snap.reads===1)send({s:'vm53ObjectWatchUnreadable',name,thread:tid});
          if(now&&snap.last){
            let first=-1,changed=0;
            for(let j=0;j<0xe0;j++)if(snap.last[j]!==now[j]){if(first<0)first=j;changed++;}
            if(first>=0)send({s:'vm53ObjectDiff',name,thread:tid,off:'0x'+first.toString(16),
              before:snap.last[first],after:now[first],changedBytes:changed,stageHits:snap.reads});
          }
          if(now)snap.last=now;
        }
      }
      const n=(hits[name]||0)+1;hits[name]=n;
      if(n<=3)send({s:'vm53StageReached',name,n,thread:tid,off:'0x'+off.toString(16),
        caller:rel(this.returnAddress)});
    },onLeave(){
      if(name==='mallocHandler'&&this.vm53MallocCtx){
        try{send({s:'vm53MallocHandlerReturned',thread:Process.getCurrentThreadId(),
          result:this.vm53MallocCtx.add(0xee).readPointer().toString()});}
        catch(e){send({s:'vm53MallocHandlerReturnUnreadable',error:String(e)});}
      }
    }});
  }catch(e){send({s:'vm53StageHookFailed',name,error:String(e)});}
  send({s:'vm53StageHooksInstalled',count:points.length,readOnly:true,objectDiffs:OBSERVE_VM53_OBJECT_DIFFS});
}
if(OBSERVE_VM53_CURSOR){
  try{
    const vmC=Process.getModuleByName('libeevsdgz.so').base;
    const bcBase=vmC.add(0x5d6ce6);
    let ctxPtr=null,sampleTimer=null,lastCursor=-1,sampleN=0;
    let cMin=Infinity,cMax=-1;const seen=new Set();
    const cursorHits={};
    const startSampler=p=>{
      if(sampleTimer||p.isNull())return;
      ctxPtr=p;
      if(LOW_OVERHEAD)return;
      send({s:'vm53CursorSamplerArmed',ctx:p.toString()});
      sampleTimer=setInterval(()=>{
        if(!flowOverride)return;
        let cur;
        try{cur=ctxPtr.add(0x160).readPointer().sub(bcBase).toInt32();}
        catch(e){send({s:'vm53CursorUnreadable',error:String(e).slice(0,120)});
          clearInterval(sampleTimer);sampleTimer=null;return;}
        sampleN++;
        if(cur<cMin)cMin=cur;if(cur>cMax)cMax=cur;seen.add(cur);
        if(cur!==lastCursor){send({s:'vm53Cursor',cursor:cur,n:sampleN});lastCursor=cur;}
        if(sampleN%400===0)send({s:'vm53CursorRange',min:cMin,max:cMax,distinct:seen.size,n:sampleN});
      },5);
    };
    let steerFired=false;
    // Critical VM53/VM60/VM56 branch sites (logged cursor = stream_ptr - 0x5d6ce6):
    // VM53 (base 0x5d6ce6, delta 0x0):
    //   0x3d6a (op@0x3d66, branchE4): ctx+0=1 -> jumps to 0x3d78..0x4698 (224B ctor + ret).
    // VM60 (base 0x77d8e6, delta +0x1a6c00):
    //   0x1a6ecc (op@0x02c8, branchBC): ctx+0xbc=1 -> 0x042c -> 0x7f1a (skips 11x raise(SIGTRAP) & scan).
    //   0x1aecda (op@0x80d6, branchE4): ctx+0=0 -> 0x80de -> 0x8902 -> 0x8128 (skips 0x3b9534 kill).
    //   0x1aed38 (op@0x8134, branchE4): ctx+0=1 -> 0x876a..0x88fe (VM60 ctor + ret).
    // VM56 (base 0x6637c6, delta +0x8cae0):
    //   0x8cd84  (op@0x02a0, branchBC): ctx+0xbc=1 -> 0x03f4 -> 0x7ed6 (skips 11x raise(SIGTRAP) & scan).
    //   0x94b02  (op@0x801e, branchE4): ctx+0=0 -> 0x8026 -> 0x8776 -> 0x8080 (skips 0x3b9534 kill).
    //   0x94b70  (op@0x808c, branchE4): ctx+0=1 -> 0x86d6..0x8772 (VM56 ctor + ret).
    // VM52 (base 0x64248e, delta +0x6b7a8): 0x6f502 (op@0x3d56, branchE4): ctx+0=1 -> 0xb90e..0xc28a (ret).
    // VM54 (base 0x64e9a0, delta +0x77cba): 0x7bb84 (op@0x3ec6, branchE4): ctx+0=1 -> 0x3ed8..0x47f0 (ret).
    // VM55 (base 0x65adb2, delta +0x840cc): 0x843c4 (branchBC=1), 0x8c142 (branchE4=0), 0x8c1b0 (branchE4=1).
    // VM58 (base 0x674914, delta +0x9dc2e): 0xa5a62 (branchBC=0), 0xa5ab8 (branchE4=1).
    // VM59 (base 0x771498, delta +0x19a7b2): 0x19e4a8 (branchE4=1).
    // VM16 (base 0x79b768, delta +0x1c4a82): 0x1c662a (op@0x1ba4, branchE4): ctx+0=1 -> 0x1f80..0x968a (ret).
    // VM34 (base 0x691e96, delta +0xbb1b0): 0xbb484 (branchBC=1), 0xc3272 (branchE4=0), 0xc32e0 (branchE4=1).
    // VM35 (base 0x85fcd0, delta +0x288fea): 0x28cee4 (op@0x3ef6, branchE4): ctx+0=1 -> 0x3f08..0x4b02 (ret).
    // VM37 (base 0x6a6d70, delta +0xd008a): 0xd0346 (branchBC=1), 0xd80c4 (branchE4=0), 0xd811a (branchE4=1).
    // VM38 (base 0x6bb9f2, delta +0xe4d0c): 0xe9a18 (op@0x4d08, branchE4): ctx+0=1 -> 0xc828..0xcec6 (ret).
    // Complete 48-VM-stub steer table (cursors = stream_ptr - 0x5d6ce6):
    // Includes all Template A (single branchE4/BC/150 -> ctor), Template B
    // (early branchBC=1 to skip 11x raise(SIGTRAP), plus gate0=0 + next=1),
    // and Stub 11 (0x22f3d0) where host61 stopped.
    const STEER_SITES=[
      0x3d6a,0x54e0, // VM53
      0x1a6ecc,0x1aecda,0x1aed38, // VM60
      0x8cd84,0x94b02,0x94b70, // VM56
      0x843c4,0x8c142,0x8c1b0, // VM55
      0xbb484,0xc3272,0xc32e0,0xc397e, // VM34
      0xd0346,0xd80c4,0xd811a, // VM37
      0x6f502, // VM52
      0x7bb84, // VM54
      0x9d2f4,0x9d362, // VM57
      0xa5a62,0xa5ab8, // VM58
      0x19e4a8, // VM59
      0x243498, // VM0
      -0xaf80, // VM1
      0x184cda, // VM2
      0x1b34a8,0x1bb008, // VM3
      0x1cfed4, // VM5
      0x21d830,0x21d876, // VM7
      0x220704, // VM8
      0x15bcbc, // VM9
      0x1680c8, // VM10
      0x22f3d0, // VM11
      0x1df04,0x1df4a, // VM12
      0x273f8a, // VM14
      0x289e8, // VM15
      0x1c662a, // VM16
      0x174894, // VM17
      0x25d582,0x25d5e0, // VM19
      0x28063a, // VM20
      0x1d9e1e, // VM21
      0x1e3630, // VM22
      0x352b8, // VM23
      0x2996d4, // VM24
      0x24d0ee,0x24d134, // VM25
      0x3f70c, // VM26
      0x2a759c, // VM27
      0x500a6,0x50124, // VM28
      0x5558e, // VM30
      0x2b7f08,0x2b7f66, // VM31
      0xba438,0xba496, // VM32
      0x62e3c, // VM33
      0x28cee4, // VM35
      0xe9a18, // VM38
      0xafc4c,0xafcaa, // VM39
      0xf5a68, // VM41
      0x191590, // VM43
      0x2694da // VM46
    ];
    const ZERO_SITES=new Set([
      0x54e0,0x1aecda,0x94b02,0x8c142,0xc3272,0xd80c4,0x9d2f4,0xa5a62,
      0x21d830,0x1df04,0x25d582,0x24d0ee,0x500a6,0x2b7f08,0xba438,0xafc4c
    ]);
    const branchHooks=STEER_VM53_PIN_PRED?[['branchE4',0x36b5d8],['branchBC',0x36b614],['branch150',0x36b650]]:[['branchE4',0x36b5d8],['branchBC',0x36b614],['branch150',0x36b650],['branchEC',0x36b59c]];
    for(const [nm,off] of branchHooks){
      try{Interceptor.attach(vmC.add(off),{onEnter(){
        const tid=Process.getCurrentThreadId();
        if(!flowOverride||!vm53ActiveThreads.has(tid))return;
        try{
          const ctx=this.context.x0;
          startSampler(ctx);
          const cur=ctx.add(0x160).readPointer().sub(bcBase).toInt32();
          if((STEER_VM53_ZERO_PRED||STEER_VM53_PIN_PRED)&&!steerFired&&(nm==='branchE4'||nm==='branchBC'||nm==='branch150')&&
             (cur===0x54e0||(STEER_VM53_PIN_PRED&&STEER_SITES.includes(cur)))){
            const want=ZERO_SITES.has(cur)?0:1;
            const slot=(nm==='branchBC')?ctx.add(0xbc):((nm==='branch150')?ctx.add(0x150):ctx);
            if(STEER_VM53_PIN_PRED){
              const k='pin'+cur.toString(16);
              const n=(cursorHits[k]||0)+1;cursorHits[k]=n;
              slot.writeU16(want);
              if(!LOW_OVERHEAD&&(n<=20||n%1024===0))send({s:'vm53SteerPinned',cursor:cur,want,n,tid});
            }else{
              steerFired=true;
              const prior=ctx.readU16();
              ctx.writeU16(0);
              send({s:'vm53SteerFired',cursor:cur,prior,after:ctx.readU16(),tid});
            }
          }
          const c=(cursorHits[nm]||0)+1;cursorHits[nm]=c;
          if(!LOW_OVERHEAD&&(c<=128||c%2048===0)){
            send({s:'vm53BranchCursor',name:nm,count:c,cursor:cur,tid});
          }
        }catch(e){}
      }});}catch(e){send({s:'vm53CursorHookFailed',name:nm,error:String(e)});}
    }
    send({s:'vm53CursorHooksArmed',readOnly:true});
  }catch(e){send({s:'vm53CursorUnavailable',error:String(e).slice(0,200)});}
}
const safe=p=>{try{return p.isNull()?null:p.readCString(120);}catch(e){return 'unreadable';}};
let pending=null,flowOverride=false;
// A replacement, not a hook: hooks stay active for everything called from here.
let mgrOriginal=null;
const mgrReplacement=new NativeCallback(function(a0,a1,a2){
 if(pending){const j=pending;pending=null;
  try{const k=gameMalloc(j.map.length+1);k.writeUtf8String(j.map);mapDvar.add(0x28).writePointer(k);const svWaitDvar=at(0x600f968).readPointer();if(!svWaitDvar.isNull())svWaitDvar.add(0x28).writeU32(60000);
  // Forced mode (MP_MODE>=200): write the mode before the game type is set and drop the game-type
  // list cached at 0xc115e88 (built once by 0x3ab2464(0) in the boot mode), so 0x3ab0c10 rebuilds it.
  if(MP_MODE>=200){switchMode(MP_MODE);at(0xc115e88).writePointer(ptr(0));send({s:'gametypeCacheCleared'});}
  setGametype(uint64(j.gametype));send({s:'gametypeSet',gametype:j.gametype,current:at(0x6ba3db0).readPointer().toString()});flowOverride=true;fastSetFlow();send({s:'mainTid',t:Process.getCurrentThreadId()});}catch(e){send({s:'err',e:''+e});}
  const r=mgrOriginal(a0,a1,a2);
  if(USE_ORIGINAL_ALT_PRODUCER){
    const phase=at(0xcdd2a38),session=at(0xcdef7c8);
    send({s:'altProducerBefore',bytes:Array.from({length:5},(_,i)=>phase.add(i).readU8()),session:session.readU32()});
    try{
      (new NativeFunction(at(0x3cc9f54),'void',[]))();
      send({s:'altProducerReturned',bytes:Array.from({length:5},(_,i)=>phase.add(i).readU8()),session:session.readU32()});
    }catch(e){send({s:'altProducerException',error:String(e)});}
    return r;
  }
  if(MP_MODE!==-1)try{listModes();if(MP_MODE>=0)switchMode(MP_MODE);}catch(e){send({s:'modeSwitchFailed',e:''+e});}
  send({s:'hostStart',after:'frame'});try{prep1(0);prep2();prep3();worldUnload(1);send({s:'prepDone',depth:at(0xb1beb40).add(0x58).readU32()});hostStart();send({s:'hostStartReturned'});}catch(e){send({s:'err',e:''+e,pc:e.context?rel(e.context.pc):null,lr:e.context?rel(e.context.lr):null,x0:e.context?''+e.context.x0:null,x8:e.context?''+e.context.x8:null,bt:e.context?Thread.backtrace(e.context,Backtracer.FUZZY).slice(0,10).map(rel):[]});}
  return r;
 }
 return mgrOriginal(a0,a1,a2);
},'pointer',['pointer','int','int']);
mgrOriginal=new NativeFunction(Interceptor.replaceFast(at(0x1617e74),mgrReplacement),'pointer',['pointer','int','int']);
Interceptor.attach(at(0x375afcc),{onLeave(r){if(flowOverride)r.replace(ptr(1));}});
// The early UI restart in 0x15c7bd0 needs scripts from zones that were just unloaded, so skip it at this one call site.
const uiRestartSite=at(0x15c7bdc);
Interceptor.attach(at(0x1384370),{onLeave(r){if(flowOverride&&!NATURAL_UI_RESTART&&this.returnAddress.equals(uiRestartSite)){r.replace(ptr(0));send({s:'uiRestartSkipped'});}}});
// Stack argument +8 becomes request byte +0xa6, 'zones already loaded'. Nothing is loaded here, so ask for the load.
Interceptor.attach(at(0x3cc9780),{onEnter(){this.context.sp.add(8).writeU8(0);}});
for(const[n,x]of[['spawnWrap',0x3cc9780],['spawnReq',0x3cc97a0],['sessSpawn',0x3cf0cf0],['serverSpawn',0x3ce8bec],['svInitGame',0x29b8244],['svSettleFrames',0x3cf24dc],['zoneLoadStep',0x3a7fc24],['entryLike_15db318',0x15db318],['wait_15d6684',0x15d6684],['after_19adc08',0x19adc08],['net_3ce70b8',0x3ce70b8]])Interceptor.attach(at(x),{onEnter(){send({s:n,th:Process.getCurrentThreadId()});}});
let svFrameCount=0;if(!QUIET)Interceptor.attach(at(0x3cf10e0),{onEnter(){svFrameCount++;if(svFrameCount<=10||svFrameCount%200===0)send({s:'svFrame',n:svFrameCount,th:Process.getCurrentThreadId()});}});
if(FORCE_LOOPBACK_CHAN){
  let loopbackHits=0,lbCtorHits=0;
  Interceptor.attach(at(0x1b2fee8),{onEnter(a){if(!flowOverride)return;a[2]=a[2].or(2);
    try{this.chan=a[1].readPointer();this.st0=this.chan.add(0x28).readU32();
      this.tp=this.chan.add(0x10).readPointer();this.vt=this.tp.isNull()?null:this.tp.readPointer();}catch(e){this.chan=null;}
  },onLeave(r){if(!flowOverride||!this.chan)return;loopbackHits++;
    if(loopbackHits<=32||loopbackHits%256===0){let st1=-1;try{st1=this.chan.add(0x28).readU32();}catch(e){}
      send({s:'loopbackForced',n:loopbackHits,st0:this.st0,st1,ret:r.toInt32(),lr:rel(this.returnAddress),
        transport:rel(this.tp),vt:this.vt?rel(this.vt):null,lbByte:(()=>{try{return this.tp.add(0x3c0).readU8();}catch(e){return -1;}})(),th:Process.getCurrentThreadId()});}
  }});
  Interceptor.attach(at(0x412144c),{onEnter(){if(!flowOverride)return;lbCtorHits++;
    if(lbCtorHits<=16)send({s:'loopbackTransportCreated',n:lbCtorHits,obj:rel(this.context.x0),lr:rel(this.returnAddress),th:Process.getCurrentThreadId()});}});
  send({s:'loopbackForceArmed'});
}
if(NULL_ENTITY_GUARD){
  let nullEntHits=0;
  // Hook the resolver's real entry rather than its one-instruction BL callers.
  // Only the two verified spatial-query callers may use their own zero epilog.
  FASTMEM.add(8).writePointer(at(0x337f800));FASTMEM.add(16).writePointer(at(0x337fa34));
  FASTMEM.add(24).writePointer(at(0x337f470));FASTMEM.add(32).writePointer(at(0x337f3a8));
  Interceptor.attach(at(0x333ae2c),{onEnter:FAST.ne_enter,onLeave:FAST.ne_leave});
  setInterval(()=>{const n=FASTMEM.add(80).readU64().toNumber();if(n!==nullEntHits){nullEntHits=n;send({s:'nullEntityResolverGuard',n});}},30000);
  send({s:'nullEntityGuardArmed',strategy:'resolver-return'});
}
let routeStrt=false,serverToClient=false;
if(ROUTE_LOCAL_HOST_PACKET){
  let reroutes=0,delivered=0;
  const oobSendSite=at(0x3ba1884),reliableSendSite=at(0x3ba1310),replySendSite=at(0x3ba1954),textSendSite=at(0x3ba17ac);
  Interceptor.attach(at(0x3badfa0),{onEnter(a){
    if(!flowOverride)return;
    const fromReply=this.returnAddress.equals(replySendSite);
    const fromText=routeStrt&&this.returnAddress.equals(textSendSite);
    const fromReliable=this.returnAddress.equals(reliableSendSite);
    if(!this.returnAddress.equals(oobSendSite)&&!fromReliable&&!fromReply&&!fromText)return;
    const address=a[0].add(0x10);
    // The connect packet is rewritten to local before the server stores the
    // client address, so a later reliable send is already type 1 on queue 2.
    // Queue 2 is the server's own incoming bucket. The client reads queue 0.
    // Both sides share this send. Queue 2 is the client talking to the server,
    // and looping that back makes the client parse its own packets.
    const toClient=fromReliable&&serverToClient&&address.add(8).readU32()!==2;
    if(address.add(6).readU8()!==3&&!toClient)return;
    if(!fromReply&&!fromText&&!toClient&&address.add(8).readU32()!==2)return;
    if(fromReply&&address.add(8).readU32()!==0)return;
    if(fromText&&address.add(8).readU32()>2)return;
    const queue=address.add(8).readU32();
    // The reliable sender always builds queue 2. That bucket is the server's
    // incoming pump, so a server map message never reaches the client pump,
    // which reads queue 0. Move it after strt_resp has been accepted.
    this.retarget=toClient;
    this.q=queue;
    if(this.retarget)address.add(8).writeU32(0);
    address.add(6).writeU8(1);
    reroutes++;
    if(reroutes<=16)send({s:'localHostPacketRouted',n:reroutes,queue,toQueue:this.retarget?0:queue,fromType:3,toType:1});
  },onLeave(r){
    if(!this.retarget||delivered>=6)return;
    delivered++;
    send({s:'serverPacketToClient',n:delivered,ret:r.toInt32(),queue:this.q});
  }});
  send({s:'localHostPacketRoutingArmed'});
}
if(FORCE_OOB_CMD){
  const oobKeep=[];
  let oobTok=null,slotSeeded=false,clientReplyLogged=false,gsClient=null,gsGate=null,gsArmed=false;
  const replyText=Memory.allocUtf8String('connectResponse');
  const startText=Memory.allocUtf8String('strt_resp');
  const cmdSite=at(0x3cefc4c);
  Interceptor.attach(at(0x3b8d19c),{onEnter(a){
    this.capture=flowOverride&&this.returnAddress.equals(cmdSite);
    this.out=a[1];
  },onLeave(){
    if(!this.capture)return;
    let text='';
    try{text=(this.out.readCString(80)||'').split('\n')[0].split(' ')[0];}catch(e){text='';}
    if(text.indexOf('strt_cmd')===0)text='strt_cmd';
    oobTok=text;
    send({s:'oobCmd',text});
  }});
  try{Interceptor.attach(at(0x3cefcfc),{onEnter(){
    if(!flowOverride||!oobTok)return;
    if(oobTok!=='getchallenge'&&oobTok!=='connect'&&oobTok!=='stats'&&oobTok!=='strt_cmd')return;
    const p=Memory.allocUtf8String(oobTok);
    oobKeep.push(p);
    this.context.x8=p;
    send({s:'oobCmdForced',text:oobTok});
    oobTok=null;
  }});}catch(e){send({s:'oobCmdHookFailed',error:String(e)});}
  // A local connect (address type 1) never reaches the challenge-slot walk at
  // 0x3cce4e0, so the handler falls through to the unregistered-connection
  // send. Keep the handler on the path that parses the challenge, then enter
  // the walk and seed its first slot with that challenge and this address.
  // The original accept path then sends the real connectResponse.
  try{steerHooks.push(Interceptor.attach(at(0x3ccca68),{onEnter(){
    if(!steerOn())return;
    if(this.context.x26.and(0xff).toUInt32()===0)this.context.x26=ptr(1);
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{steerHooks.push(Interceptor.attach(at(0x3ccd18c),{onEnter(){
    if(!steerOn())return;
    this.context.x26=ptr(0);
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{steerHooks.push(Interceptor.attach(at(0x3ba1518),{onLeave(r){
    if(!steerOn()||!this.returnAddress.equals(at(0x3ccd738)))return;
    r.replace(ptr(0));
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  const walkCaller=at(0x3cce510);
  try{steerHooks.push(Interceptor.attach(at(0x3ba1478),{onEnter(a){
    if(!steerOn()||slotSeeded||!this.returnAddress.equals(walkCaller))return;
    slotSeeded=true;
    const slot=a[1].sub(0x88);
    const challenge=this.context.x21.toUInt32();
    try{slot.add(0x88).writeByteArray(a[0].readByteArray(16));}catch(e){}
    slot.add(0x98).writeU32(challenge);
    slot.add(0xa0).writeU8(0);
    try{
      const src=this.context.x29.sub(0x710).add(0x78);
      slot.add(0xa1).writeByteArray(src.readByteArray(0x15));
    }catch(e){}
    send({s:'challengeSlotSeeded',challenge});
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // The seeded slot matches the address and the challenge. The protocol text
  // still fails strcmp, and that miss sends the error at 0x3ccd5cc. A zero
  // result here is the match, and it enters the handler's real accept path.
  try{steerHooks.push(Interceptor.attach(at(0x5334a20),{onLeave(r){
    if(!steerOn()||!this.returnAddress.equals(at(0x3cce530)))return;
    r.replace(ptr(0));
    send({s:'protocolMatched'});
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // A matched challenge with queue 2 fails 0x3f02e0c and the handler sends the
  // error. Returning 1 takes the free-slot path at 0x3ccd784, which is where a
  // new client is filled in.
  try{steerHooks.push(Interceptor.attach(at(0x3f02e0c),{onLeave(r){
    if(!steerOn()||!this.returnAddress.equals(at(0x3ccf028)))return;
    r.replace(ptr(1));
    let n=-1;
    try{n=at(0x54cafa8).readPointer().readS32();}catch(e){}
    send({s:'addressAccepted',clients:n});
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{steerHooks.push(Interceptor.attach(at(0x3ccd784),{onEnter(){
    if(!steerOn())return;
    send({s:'clientSlotChosen'});
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // The free slot then looks up a channel by the address port. A loopback
  // connect has no such channel, and the miss builds another error. The next
  // call only needs the boolean, so report the lookup as found.
  try{steerHooks.push(Interceptor.attach(at(0x3ba22a4),{onLeave(r){
    if(!steerOn()||!this.returnAddress.equals(at(0x3ccd860)))return;
    r.replace(ptr(1));
    send({s:'channelBound'});
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // A non-empty result here takes an error string. An empty result continues
  // into the setup that sends connectResponse, once the client byte is 5.
  try{steerHooks.push(Interceptor.attach(at(0x3f0a088),{onLeave(r){
    if(!steerOn()||!this.returnAddress.equals(at(0x3ccebbc)))return;
    r.replace(ptr(0));
    send({s:'setupContinued'});
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{steerHooks.push(Interceptor.attach(at(0x3ccee30),{onEnter(){
    if(!steerOn())return;
    try{this.context.x22.add(8).writeU8(5);}catch(e){return;}
    gsClient=this.context.x22;
    send({s:'clientMarkedConnected'});
  }}));}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // State 4 walks the server entries and, with no overlap, keeps index 0xf.
  // That index is what raises the transmission error. Use the first entry.
  try{Interceptor.attach(at(0x15e169c),{onEnter(){
    if(!flowOverride)return;
    const idx=this.context.x23.toUInt32();
    if(idx===0xf)this.context.x23=ptr(0);
    send({s:'state4Exit',idx});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // The host path calls this after a successful connect and it stores client
  // state 3, which is the resend path that raises a dev error. Skip it.
  try{Interceptor.attach(at(0x15d9f58),{onEnter(){
    if(!flowOverride)return;
    this.context.pc=this.returnAddress;
    send({s:'clientResetSkipped',caller:rel(this.returnAddress)});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // An empty follow-up body stores state 3, and state 3's resend raises a dev
  // error. State 5 is the forward step from that same store: it sends strt_cmd.
  try{Interceptor.attach(at(0x15e58cc),{onEnter(){
    if(!flowOverride||this.context.x9.toUInt32()!==3)return;
    this.context.x9=ptr(5);
    send({s:'state5Forced'});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // The store at 0x15e58e0 writes 3 and a register edit there does not stick.
  // Remove the store and write 5 ourselves when that path runs.
  try{
    Memory.patchCode(at(0x15e58e0),4,code=>{code.writeByteArray([0x1f,0x20,0x03,0xd5]);});
    send({s:'stateStoreNopped'});
  }catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let clcWatch=false;
  try{Interceptor.attach(at(0x15e58e0),{onEnter(){
    if(!flowOverride)return;
    let idx=-1;
    try{
      const base=at(0x54bb7e8).readPointer();
      const ctx=this.context;
      const addr=ctx.x8;
      idx=addr.sub(base).toInt32()/0x1ec;
      addr.add(8).writeU32(5);
      // The monitor write-protects the whole page, and workers fault on it.
      if(!clcWatch&&!SEND_GAMESTATE){
        clcWatch=true;
        const word=base.add(8);
        let writes=0;
        MemoryAccessMonitor.enable([{base:word,size:4}],{onAccess(d){
          if(d.operation!=='write'||writes>=8)return;
          writes++;
          send({s:'clcWrite',from:rel(d.from),value:word.readU32()});
        }});
      }
    }catch(e){}
    send({s:'state5Stored',idx});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // Whatever puts the client back at 3 does it after this function has
  // returned. The resend reads the word on entry, so a 3 or 4 there becomes
  // 5 and the resend sends strt_cmd.
  let sawState4=false;
  try{Interceptor.attach(at(0x15e1100),{onEnter(a){
    if(!flowOverride)return;
    try{
      const idx=a[0].toInt32();
      if(idx<0||idx>8)return;
      const base=at(0x54bb7e8).readPointer();
      if(base.isNull())return;
      const word=base.add(idx*0x1ec+8);
      const st=word.readU32();
      if(st===4)sawState4=true;
      if(!sawState4||st!==3)return;
      word.writeU32(5);
      send({s:'statePromoted',from:st,idx});
    }catch(e){}
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x3ba2ccc),{onEnter(a){
    this.strt=false;
    if(!flowOverride)return;
    try{this.strt=(a[1].readCString(12)||'').indexOf('strt')===0;}catch(e){this.strt=false;}
  },onLeave(r){
    if(!this.strt)return;
    send({s:'strtSent',ret:r.toInt32()});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x3ba1708),{onEnter(a){
    routeStrt=false;
    if(!flowOverride)return;
    try{routeStrt=(a[2].readCString(8)||'').indexOf('strt')===0;}catch(e){routeStrt=false;}
  },onLeave(){routeStrt=false;}});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x3ccbffc),{onEnter(){if(flowOverride)send({s:'strtRespQueued'});}});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let lastSvByte=-1,svElapsed=0,svStep=0,startReleased=false,worldByte=false,dropsHeld=0;
  try{Interceptor.attach(at(0x3cd09a8),{onEnter(){
    if(!flowOverride)return;
    let b=-1;
    try{b=this.context.x0.add(8).readU8();}catch(e){return;}
    if(b===lastSvByte)return;
    lastSvByte=b;
    send({s:'svClientByte',byte:b});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x3cd09fc),{onEnter(){
    if(!flowOverride||svElapsed>=6)return;
    svElapsed++;
    send({s:'svStartElapsed',n:svElapsed});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // The tick stores 1 for every byte other than 4, and a client below 5
  // is left out of the snapshot. Let one post-start tick through and
  // store 7, which is the byte the gamestate writer requires, then hold
  // it there.
  try{Interceptor.attach(at(0x3ccf884),{onEnter(){
    if(!flowOverride)return;
    const byte=this.context.x20.toUInt32()&255;
    if((byte===5||byte===7)&&(!startReleased||worldByte))this.context.x20=ptr(0);
    // 0x3ccf854 is the drop function: the store at 0x3ccf91c is the zombie state.
    if(SEND_GAMESTATE&&byte>=5){
      this.context.x20=ptr(0);
      if(dropsHeld<12){dropsHeld++;send({s:'svDropHeld',n:dropsHeld,byte,caller:rel(this.context.lr)});}
    }
    if(svStep>=6)return;
    svStep++;
    send({s:'svTransition',n:svStep,byte,released:startReleased});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x3ccf91c),{onEnter(){
    if(!flowOverride||!startReleased||worldByte)return;
    const c=this;c.context.x8=ptr(7);
    worldByte=true;
    send({s:'svByte7'});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x15d8a74),{onEnter(){if(flowOverride)send({s:'state6Enter'});}});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let gateHeld=0,mapFollows=0;
  try{Interceptor.attach(at(0x3ba2388),{onLeave(r){
    if(!flowOverride||!startReleased||(r.toInt32()&1)!==0)return;
    r.replace(ptr(1));
    if(gateHeld>=4)return;
    gateHeld++;
    send({s:'chanGateHeld',n:gateHeld});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x369a4b0),{onLeave(r){
    if(!flowOverride||!startReleased||!this.returnAddress.equals(at(0x36a14ac)))return;
    const bit=r.toInt32()&1;
    if(bit===0)r.replace(ptr(1));
    if(mapFollows>=4)return;
    mapFollows++;
    send({s:'mapFollow',n:mapFollows,ret:bit});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let type6=0;
  const setX8=(c,v)=>{c.context.x8=v;};
  const getX8=c=>c.context.x8.toUInt32();
  try{Interceptor.attach(at(0x3d0cf84),{onEnter(){
    if(!flowOverride||!startReleased||SEND_GAMESTATE)return;
    let st=0;
    try{st=this.context.x20.add(8).readU8();}catch(e){return;}
    if(st!==1&&st!==5&&st!==7)return;
    if((getX8(this)&255)===0)setX8(this,ptr(1));
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x3cd0c14),{onEnter(){
    if(!flowOverride||!startReleased||SEND_GAMESTATE)return;
    const flag=getX8(this)&255;
    if(flag!==0)setX8(this,ptr(0));
    if(type6>=4)return;
    type6++;
    send({s:'type6Gate',n:type6,serverFlag:flag});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let type6Writes=0;
  try{Interceptor.attach(at(0x3cd0c44),{onEnter(){
    if(!flowOverride||type6Writes>=6)return;
    type6Writes++;
    send({s:'type6Write',n:type6Writes});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let seqSeen=0;
  try{Interceptor.attach(at(0x13972d8),{onEnter(){
    if(!flowOverride||!serverToClient||seqSeen>=8)return;
    seqSeen++;
    send({s:'clientSequenced',n:seqSeen,st:getX8(this)});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let parsed=0;
  try{Interceptor.attach(at(0x15f27a0),{onEnter(){
    if(!flowOverride||parsed>=8)return;
    parsed++;
    send({s:'reliableType',n:parsed,type:this.context.x0.toUInt32()&255});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let tx=0;
  try{Interceptor.attach(at(0x3d0ca50),{onEnter(){
    if(!flowOverride||!serverToClient||tx>=4)return;
    tx++;
    send({s:'serverTransmit',n:tx});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  let relSends=0;
  try{Interceptor.attach(at(0x3ba12a4),{onEnter(){
    if(!flowOverride||!serverToClient||relSends>=4)return;
    relSends++;
    send({s:'reliableSend',n:relSends});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // A server text command reaches 0x15daf98 and that call stores state 3.
  // Leave the client on state 5 so its next resend sends strt_cmd.
  try{Interceptor.attach(at(0x3b8d19c),{onLeave(r){
    if(!flowOverride||!this.returnAddress.equals(at(0x15daf74)))return;
    let text='';
    try{text=(r.readCString(80)||'').split('\n')[0];}catch(e){text='';}
    send({s:'clientCmd',text});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  try{Interceptor.attach(at(0x15d9fb8),{onEnter(){
    if(!flowOverride||!this.returnAddress.equals(at(0x15daf9c)))return;
    this.context.pc=this.returnAddress;
    send({s:'disconnectIgnored'});
  }});}catch(e){send({s:'connectSteerFailed',error:String(e)});}
  // Queue 2 is drained without the dispatcher when this gate is clear, which
  // drops the client's later packets. Open it only for the server pump.
  FASTMEM.add(40).writePointer(at(0x3cf0908));FASTMEM.add(48).writePointer(at(0x3cf0910));
  try{Interceptor.attach(at(0x3a566d4),{onLeave:FAST.g1_leave});}catch(e){send({s:'dispatchGateFailed',error:String(e)});}
  try{Interceptor.attach(at(0x3a5670c),{onLeave:FAST.g2_leave});}catch(e){send({s:'dispatchGateFailed',error:String(e)});}
  // State 2 only advances on connectResponse. The compare uses the protocol
  // slot, which is empty for this reply, so point it at the command.
  try{Interceptor.attach(at(0x15da2d8),{onEnter(){
    if(!flowOverride)return;
    let st=-1;
    try{const base=at(0x54bb7e8).readPointer();if(!base.isNull())st=base.add(8).readU32();}catch(e){return;}
    if(st===5){
      let cur='';
      try{cur=this.context.x21.readCString(12)||'';}catch(e){cur='';}
      if(cur.indexOf('strt_resp')!==0)return;
      this.context.x21=startText;
      send({s:'strtRespToken'});
      return;
    }
    if(st!==2)return;
    this.context.x21=replyText;
    if(!clientReplyLogged){clientReplyLogged=true;send({s:'clientReplyToken',state:st});}
  }});}catch(e){send({s:'clientReplyHookFailed',error:String(e)});}
  try{Interceptor.attach(at(0x15da5f4),{onEnter(){
    if(!flowOverride)return;
    send({s:'connectResponseAccepted'});
  }});}catch(e){send({s:'clientReplyHookFailed',error:String(e)});}
  try{Interceptor.attach(at(0x15da794),{onEnter(){if(!flowOverride)return;startReleased=true;serverToClient=true;if(gsGate&&gsClient&&!gsArmed){gsArmed=true;gsGate.add(8).writeU64(uint64(gsClient.toString()));gsGate.writeU64(1);}send({s:'strtRespAccepted'});}});}catch(e){send({s:'clientReplyHookFailed',error:String(e)});}
  // The client never sends the sequenced packet that makes 0x3cd4c1c call the
  // gamestate sender. A thunk on the frame call runs the same two calls once,
  // as plain code on the server thread, so the route hook still fires.
  if(SEND_GAMESTATE){
    try{
      const framePatch=at(0x3cf2570);
      const thunk=Memory.alloc(Process.pageSize);
      oobKeep.push(thunk);
      gsGate=Memory.alloc(16);
      gsGate.writeU64(0);
      Memory.protect(thunk,Process.pageSize,'rwx');
      const w=new Arm64Writer(thunk,{pc:thunk});
      w.putPushRegReg('x29','lr');
      for(const[x,y]of[['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
      w.putLdrRegAddress('x16',gsGate);
      w.putLdrRegRegOffset('x17','x16',0);
      w.putCbzRegLabel('x17','frame');
      w.putStrRegRegOffset('xzr','x16',0);
      w.putLdrRegAddress('x16',at(0x3d160c0));
      w.putBlrReg('x16');
      w.putLdrRegAddress('x16',gsGate);
      w.putLdrRegRegOffset('x0','x16',8);
      w.putLdrRegAddress('x16',at(0x3cd53bc));
      w.putBlrReg('x16');
      w.putLabel('frame');
      for(const[x,y]of[['x6','x7'],['x4','x5'],['x2','x3'],['x0','x1']])w.putPopRegReg(x,y);
      w.putPopRegReg('x29','lr');
      w.putLdrRegAddress('x16',at(0x3cf10e0));
      w.putBrReg('x16');
      w.flush();
      // A page within branch range is not always free, so the call goes through
      // a veneer in the wiped body after protected stub 38.
      const veneer=at(0x3cd7b20);
      if(!veneer.readU64().equals(0)||!veneer.add(8).readU64().equals(0))throw new Error('veneer padding not empty');
      Memory.patchCode(veneer,16,code=>{const p=new Arm64Writer(code,{pc:veneer});p.putLdrRegAddress('x16',thunk);p.putBrReg('x16');p.flush();});
      Memory.patchCode(framePatch,4,code=>{const p=new Arm64Writer(code,{pc:framePatch});p.putBlImm(veneer);p.flush();});
      let gsTx=0;
      Interceptor.attach(at(0x3cd53bc),{onEnter(){if(flowOverride)send({s:'gamestateSent',byte:this.context.x0.add(8).readU8()});}});
      let svMsgs=0;
      Interceptor.attach(at(0x3cd4c1c),{onEnter(){if(!flowOverride||svMsgs>=6)return;svMsgs++;send({s:'svClientMessage',n:svMsgs});}});
      Interceptor.attach(at(0x3cd0a00),{onEnter(a){
        if(!flowOverride)return;
        const gate=a[0].add(0x280).readU8();
        if(BOTS&&!humanInWorld){humanInWorld=true;
          // remove connect-steering hooks: mid-function patches in 0x3ccc9b0 (e.g. 0x3ccca68) are branch targets
          // for later connects (bots) and jumping into a patch crashes (fault 0x7405176050 from 0x3ccde74)
          let d=0;for(const h of steerHooks){try{h.detach();d++;}catch(e){}}Interceptor.flush();send({s:'humanInWorld',steerHooksRemoved:d});}
        send({s:'clientEnterWorld',gate,state:a[0].add(8).readU8()});
        if(JOIN_ALLIES&&gate===7){a[0].add(0x280).writeU8(2);send({s:'joinAllies',gate});}
      }});
      Interceptor.attach(at(0x3d0ca50),{onLeave(r){
        if(!flowOverride||!this.returnAddress.equals(at(0x3cd59bc))||gsTx>=4)return;
        gsTx++;
        send({s:'gamestateTransmit',n:gsTx,ret:r.toInt32()});
      }});
      send({s:'gamestateThunkArmed'});
      if(GAMESTATE_RETRY){
        let attempts=0;
        const retry=setInterval(()=>{
          if(!startReleased||!gsClient)return;
          try{
            const clc=at(0x54bb7e8).readPointer().add(8).readU32();
            const sv=gsClient.add(8).readU8();
            if(clc>=7||worldByte||sv>=7||attempts>=3){clearInterval(retry);return;}
            if((clc===5||clc===6)&&(sv===5||sv===6)&&gsGate.readU64().equals(0)){
              attempts++;gsGate.add(8).writePointer(gsClient);gsGate.writeU64(1);
              send({s:'gamestateRetryArmed',attempts,clc,sv});
            }
          }catch(e){clearInterval(retry);send({s:'gamestateRetryError',error:String(e)});}
        },2000);
      }

    }catch(e){send({s:'connectSteerFailed',error:String(e)});}
  }
  send({s:'oobCmdForceArmed'});
}
if(SEND_GAMESTATE){
  // 0x3b71818 is the only allocator of the player data buffers the server's
  // chunked data lands in. Its task loop waits on online fetches that never
  // finish offline, so do what its success path does at 0x3b71ac8.
  // The resolver hook's onLeave pc edit does not stop 0x337f800 reading a null
  // entity. Check it natively and take the same zero epilog on a null result.
  const nullVeneer=at(0x3cd7b30);
  if(!nullVeneer.readU64().equals(0))throw new Error('veneer padding not empty');
  Memory.patchCode(nullVeneer,36,code=>{
    const w=new Arm64Writer(code,{pc:nullVeneer});
    w.putCbnzRegLabel('x0','entity');
    w.putLdrRegAddress('x16',at(0x337fa34));
    w.putBrReg('x16');
    w.putLabel('entity');
    w.putLdrRegAddress('x16',at(0x333af54));
    w.putBrReg('x16');
    w.flush();
  });
  Memory.patchCode(at(0x337f800),4,code=>{const w=new Arm64Writer(code,{pc:at(0x337f800)});w.putBlImm(nullVeneer);w.flush();});
  const luaVar=at(0x54bcd08).readPointer();
  const uiWitness=(name,x)=>{
    let n=0;
    try{Interceptor.attach(at(x),{onEnter(a){
      n++;
      if(n<=4||n%500===0)send({s:'ui',name,n,a0:a[0].toString(),a1:a[1].toString(),L:luaVar.readPointer().toString(),th:Process.getCurrentThreadId(),lr:rel(this.returnAddress)});
    },onLeave(){if(n<=4)send({s:'uiDone',name,L:luaVar.readPointer().toString()});}});}catch(e){send({s:'uiWitnessFailed',name,error:String(e)});}
  };
  for(const[name,x]of[['reinit33790e8',0x33790e8],['stateNew3364384',0x3364384],['shutdown33837bc',0x33837bc],['frame337c1c0',0x337c1c0],['init13d1c28',0x13d1c28],['init138456c',0x138456c]])uiWitness(name,x);
  // 0x15c7bd0 restarts the UI before global has loaded, which is why that call
  // stays skipped. Run the same two calls once the world is up, from the client
  // packet pump on the main thread rather than inside the UI frame.
  let worldAt=0;
  const uiGate=Memory.alloc(8);
  uiGate.writeU64(0);
  const uiThunk=Memory.alloc(Process.pageSize);
  Memory.protect(uiThunk,Process.pageSize,'rwx');
  {
    const w=new Arm64Writer(uiThunk,{pc:uiThunk});
    w.putPushRegReg('x29','lr');
    for(const[x,y]of[['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
    w.putLdrRegAddress('x16',uiGate);
    w.putLdrRegRegOffset('x17','x16',0);
    w.putCbzRegLabel('x17','pump');
    w.putStrRegRegOffset('xzr','x16',0);
    w.putLdrRegAddress('x16',at(0x1384ee4));
    w.putBlrReg('x16');
    w.putLdrRegAddress('x16',at(0x138456c));
    w.putBlrReg('x16');
    w.putLabel('pump');
    for(const[x,y]of[['x6','x7'],['x4','x5'],['x2','x3'],['x0','x1']])w.putPopRegReg(x,y);
    w.putPopRegReg('x29','lr');
    w.putLdrRegAddress('x16',at(0x1397098));
    w.putBrReg('x16');
    w.flush();
  }
  const uiVeneer=at(0x3cd7b58);
  if(!uiVeneer.readU64().equals(0)||!uiVeneer.add(8).readU64().equals(0))throw new Error('veneer padding not empty');
  Memory.patchCode(uiVeneer,16,code=>{const w=new Arm64Writer(code,{pc:uiVeneer});w.putLdrRegAddress('x16',uiThunk);w.putBrReg('x16');w.flush();});
  for(const site of [0x3a564bc,0x3a5666c])Memory.patchCode(at(site),4,code=>{const w=new Arm64Writer(code,{pc:at(site)});w.putBlImm(uiVeneer);w.flush();});
  let ddlThunk=null;
  if(JOIN_ALLIES){
    const teamCaller=at(0x298f8bc);
    // 0x3cd7598(clientNum) returns the client's party team; 0 offline. Client 0 (you) -> 2.
    // With WZM_BOTS the marker-1 test clients and the first ENEMY_AI genuine marker-2 bots
    // go to team 1; any later marker-2 bot joins team 2 so both sides have bots.
    try{Interceptor.attach(at(0x3cd7598),{onEnter(a){this.cn=a[0].toInt32();},onLeave(r){
      if(!this.returnAddress.equals(teamCaller))return;
      const v=r.toInt32();let want=2,mark=-1;
      if(BOTS&&this.cn!==0){
        want=1;
        try{const c=at(0x54cafb0).readPointer().add(this.cn*8).readPointer();
          mark=c.isNull()?0:c.add(0xb668).readU32();}catch(e){mark=-1;}
        if(mark===2){mark2EnterSeq++;if(ENEMY_AI_RT>=0&&mark2EnterSeq>ENEMY_AI_RT)want=2;}
        send({s:'teamAssign',client:this.cn,mark,markSeq:mark2EnterSeq,team:want});
      }
      if(v===0)r.replace(ptr(want));
      send({s:'teamByte',client:this.cn,was:v,now:v===0?want:v});
    }});}catch(e){send({s:'teamByteFailed',error:String(e)});}
    // 0x362c048 indexes *(0x54bd120) by the word at 0xaffa56c. That word is still
    // -1, so the load reads the header qword 0x100000002 and faults. Client 0's
    // slot is the pointer this same function already loaded at 0x362b7bc.
    const ddlCave=at(0x3cd7b00);
    if(!ddlCave.readU64().equals(0)||!ddlCave.add(8).readU64().equals(0))throw new Error('ddl veneer padding not empty');
    ddlThunk=Memory.alloc(Process.pageSize);
    Memory.protect(ddlThunk,Process.pageSize,'rwx');
    {
      const w=new Arm64Writer(ddlThunk,{pc:ddlThunk});
      w.putPushRegReg('x29','lr');
      w.putLdrRegAddress('x16',at(0x337ef88));
      w.putBlrReg('x16');
      w.putInstruction(0x11000408);
      w.putCbzRegLabel('w8','none');
      w.putBLabel('back');
      w.putLabel('none');
      w.putInstruction(0x2a1f03e0);
      w.putLabel('back');
      w.putPopRegReg('x29','lr');
      w.putRet();
      w.flush();
    }
    Memory.patchCode(ddlCave,16,code=>{const w=new Arm64Writer(code,{pc:ddlCave});w.putLdrRegAddress('x16',ddlThunk);w.putBrReg('x16');w.flush();});
    Memory.patchCode(at(0x362c038),4,code=>{const w=new Arm64Writer(code,{pc:at(0x362c038)});w.putBlImm(ddlCave);w.flush();});
    let updates=0;
    Interceptor.attach(at(0x362b740),{onEnter(a){
      if(updates>=2)return;
      updates++;
      const client=a[0].toInt32();
      const info={client,slot:'unread'};
      try{info.slot=at(0x54bd120).readPointer().add(client*8).readPointer().toString();}catch(e){info.slot=String(e);}
      try{
        const ps=at(0x54bfb78).readPointer().readPointer().add(client*0x31270);
        info.team=ps.add(0x7f20).readU8();
        info.pm=ps.add(0x10).readU32();
      }catch(e){info.ps=String(e);}
      try{info.spawn=at(0x54cafb0).readPointer().readPointer().add(client*0x8fad8).add(0xb668).readU32();}catch(e){info.spawnErr=String(e);}
      send({s:'playerUpdate',info});
    }});
    let ddlLogged=0;
    Interceptor.attach(at(0x362c03c),{onEnter(){
      if(ddlLogged>=3)return;
      ddlLogged++;
      send({s:'ddlIndex',w0:this.context.x0.toInt32()});
    }});
  }
  Interceptor.attach(at(0x3cd0a00),{onEnter(a){
    if(!flowOverride||worldAt)return;
    worldAt=Date.now();
    if(JOIN_ALLIES){
      try{
        const client=a[0];
        const base=at(0x54cafb0).readPointer().readPointer();
        const delta=client.sub(base).toUInt32();
        const index=delta/0x8fad8;
        const members=at(0x613a4f0).add(0x20f8).readPointer();
        if(!Number.isInteger(index)||index>=18||members.isNull())send({s:'partyMember',index,delta,members:members.toString()});
        else{
        const slot=members.add(index*0x240);
        const info={index,state:slot.add(0x1f2).readU8(),team:slot.add(0x1e0).readU32(),obj:slot.add(0x1f8).readPointer().toString()};
        if(!slot.add(0x1f8).readPointer().isNull()&&(info.state!==4||info.team===0)){
          slot.add(0x1f2).writeU8(4);
          if(info.team===0)slot.add(0x1e0).writeU32(2);
          info.wrote=true;
          info.state=slot.add(0x1f2).readU8();
          info.team=slot.add(0x1e0).readU32();
        }
        send({s:'partyMember',info});
        }
        try{
          const obj=client.add(0x6c0).readPointer();
          const spawn=client.add(0xb668).readU32();
          send({s:'spawnState',was:spawn,obj:obj.toString()});
        }catch(e){send({s:'spawnStateFailed',error:String(e)});}
      }catch(e){send({s:'partyMemberFailed',error:String(e)});}
    }
    if(UI_RETRY&&!UI_WAIT_ASSET)setTimeout(()=>{uiGate.writeU64(1);send({s:'uiRetryArmed'});},UI_RESTART_DELAY_MS);
    // LUIStartup's in-game branch requires LuaFile K29. The game's loader 0x33285f8 finds it with
    // 0x19a9930(0x4b, hash, 0) and fails silently while its zone is still loading. Wait for it.
    if(UI_RETRY&&UI_WAIT_ASSET){
      const find=new NativeFunction(at(0x19a9930),'pointer',['int','uint64','int']);
      let polls=0;
      const t=setInterval(()=>{
        polls++;
        let h=ptr(0);try{h=find(0x4b,uint64('0x56794f44b636e9f1'),0);}catch(e){send({s:'uiAssetPollFailed',e:''+e});clearInterval(t);return;}
        if(polls<=3||polls%10===0||!h.isNull())send({s:'uiAssetPoll',polls,found:!h.isNull(),ms:Date.now()-worldAt});
        if(!h.isNull()||polls>=180){clearInterval(t);setTimeout(()=>{uiGate.writeU64(1);send({s:'uiRetryArmed',afterAsset:!h.isNull()});},1000);}
      },1000);
    }
  }});
  Interceptor.attach(at(0x1384ee4),{onEnter(){if(worldAt)send({s:'uiPrepareEnter'});}});
  Interceptor.attach(at(0x138456c),{onEnter(){if(worldAt)send({s:'uiRestartEnter'});},onLeave(){if(worldAt)send({s:'uiRestartReturned',L:luaVar.readPointer().toString()});}});
  if(MATCH_PROBE){
    const probeSrc=[
      "local out={}",
      "local seen={}",
      "local function relevant(s) s=tostring(s):lower(); return s:find('team') or s:find('spectat') or s:find('spawn') or s:find('class') or s:find('alive') end",
      "local function walk(t,path,depth)",
      " if type(t)~='table' or seen[t] or depth>4 or #out>80 then return end",
      " seen[t]=true",
      " for k,v in pairs(t) do",
      "  local n=tostring(k); local p=path..'.'..n",
      "  if type(v)=='table' and type(v.GetValue)=='function' then",
      "   if relevant(p) then local ok,x=pcall(v.GetValue,v,0); out[#out+1]=p..'='..(ok and tostring(x) or 'ERROR') end",
      "  elseif type(v)=='table' then walk(v,p,depth+1)",
      "  elseif type(v)=='function' and relevant(n) then out[#out+1]=p..'=function' end",
      " end",
      "end",
      "walk(DataSources and DataSources.inGame,'inGame',0)",
      "out[#out+1]='inGameType='..type(DataSources and DataSources.inGame)",
      "local cmds=LUI and LUI.Commands and LUI.Commands.InGame",
      "if type(cmds)=='table' then for k,v in pairs(cmds) do if relevant(k) then out[#out+1]='cmd.'..tostring(k)..'='..type(v) end end end",
      "table.sort(out); return table.concat(out,' | ')"
    ].join('\n');
    const probeSrc2=MATCH_LUA_OVERRIDE||probeSrc;
    const load=new NativeFunction(at(0x4490778),'int',['pointer','pointer','uint64','pointer','pointer']);
    const pcallk=new NativeFunction(at(0x4486bc4),'int',['pointer','int','int','int']);
    const tostr=new NativeFunction(at(0x4483720),'pointer',['pointer','int','pointer']);
    const probeName=Memory.allocUtf8String('=wzm_match_probe');
    const probeBuf=Memory.allocUtf8String(probeSrc2);
    const steps=(MATCH_LUA_STEPS||[[MATCH_LUA_DELAY,probeSrc2]]).map(([d,src],i)=>({d,i,buf:Memory.allocUtf8String(src),n:src.length}));
    let stepAt=0;
    Interceptor.attach(at(0x337c1c0),{onEnter(){
      if(!worldAt||stepAt>=steps.length||Date.now()-worldAt<steps[stepAt].d)return;
      const L=luaVar.readPointer();
      if(L.isNull())return;
      const st=steps[stepAt++];
      const top=L.add(0x28).readPointer();
      let text='';
      try{
        const rc=load(L,st.buf,st.n,probeName,ptr(0));
        const pc=rc===0?pcallk(L,0,1,0):-1;
        const s=tostr(L,-1,ptr(0));
        text=s.isNull()?'':(s.readCString()||'');
        send({s:'matchProbe',step:st.i,load:rc,pcall:pc,ms:Date.now()-worldAt,text});
        if(pc===0&&text.includes('spec=false')&&typeof globalThis.wzmBotArm==='function')globalThis.wzmBotArm();
      }catch(e){send({s:'matchProbeFailed',step:st.i,error:String(e)});}
      try{L.add(0x28).writePointer(top);}catch(e){}
    }});
  }
  let luaErrors=0;
  // Perf: ~750 calls/s; Lua error trace only, off in quiet play.
  if(!QUIET)try{Interceptor.attach(at(0x1699b80),{onEnter(a){
    if(luaErrors>=24||!this.returnAddress.equals(at(0x3362f54)))return;
    luaErrors++;
    let text='';
    try{text=a[3].readUtf8String(700)||'';}catch(e){try{text=a[3].readCString(700)||'';}catch(e2){text='unreadable';}}
    send({s:'luaError',n:luaErrors,text});
  }});}catch(e){send({s:'uiWitnessFailed',name:'luaError',error:String(e)});}
  const dataKeep=[uiThunk,ddlThunk];
  let lastLevel=-1;
  // 0x199f51c builds the zone list. A true result from 0x37a0e18 at 0x199f7e4
  // leaves out code_post_gfx, global, ingame and ingame_mp.
  // Perf: ~4.9k calls/s; only matters with LOAD_CLIENT_ZONES, else trace only.
  if(LOAD_CLIENT_ZONES||!QUIET)try{Interceptor.attach(at(0x37a0e18),{onLeave(r){
    if(!this.returnAddress.equals(at(0x199f7e4)))return;
    send({s:'zoneListGate',ret:r.toInt32()&1});
    if(LOAD_CLIENT_ZONES)r.replace(ptr(0));
  }});
  Interceptor.attach(at(0x199fb60),{onEnter(a){send({s:'zoneQueued',name:a[1].readCString()});}});}catch(e){send({s:'uiWitnessFailed',name:'zones',error:String(e)});}
  setInterval(()=>{const v=at(0xc11a688).readS32();if(v!==lastLevel){lastLevel=v;send({s:'levelState',v});}},250);
  let dataDone=false;
  Interceptor.attach(at(0x15d8a74),{onEnter(){
    if(!flowOverride||dataDone)return;
    dataDone=true;
    const table=at(0x54bcb10).readPointer();
    const size=at(0xc13b090).readU32();
    for(const group of [0,1]){
      const entry=table.add(group*0x248);
      if(!entry.readPointer().isNull())continue;
      const buffer=Memory.alloc(0x66000);
      dataKeep.push(buffer);
      entry.writePointer(buffer);
      entry.add(8).writeU32(size);
    }
    send({s:'playerDataPrepared',size,slots:[table.readPointer().toString(),table.add(0x248).readPointer().toString()]});
  }});
}
if(OBSERVE_CL_RESEND){
  let lastClState=-1;
  Interceptor.attach(at(0x15e1100),{onEnter(a){if(!flowOverride)return;
    try{const idx=a[0].toInt32();if(idx<0||idx>8)return;const base=at(0x54bb7e8).readPointer();if(base.isNull())return;
      const st=base.add(idx*0x1ec+8).readU32();
      if(st!==lastClState){lastClState=st;send({s:'clState',state:st,idx,th:Process.getCurrentThreadId()});}}catch(e){}
  }});
  let last2388=-1,last2790=-1;
  Interceptor.attach(at(0x3ba2388),{onLeave(r){if(!flowOverride)return;const v=r.toInt32()&1;
    if(v!==last2388){last2388=v;send({s:'chanGate2388',ret:v});}}});
  Interceptor.attach(at(0x3ba2790),{onLeave(r){if(!flowOverride)return;const v=r.toInt32()&1;
    if(v!==last2790){last2790=v;send({s:'resendPred2790',ret:v});}}});
  // 0x379cd34 serializes address fields into a bitstream; it is not a send.
  // Keep its activity separate from the queue-dequeue observation.
  let lbSendN=0;Interceptor.attach(at(0x379cd34),{onEnter(a){if(!flowOverride)return;lbSendN++;
    if(lbSendN<=16||lbSendN%64===0)send({s:'addressBitstreamSerialize',n:lbSendN,th:Process.getCurrentThreadId()});}});
  let deqN=0;Interceptor.attach(at(0x3bae1c8),{onEnter(a){this.q=a[0].toInt32();this.buf=a[1];},onLeave(r){if(!flowOverride)return;const v=r.toInt32();
    if(v>0){deqN++;if(deqN<=8){let hex='';try{hex=Array.from(new Uint8Array(this.buf.readByteArray(Math.min(v,48)))).map(b=>b.toString(16).padStart(2,'0')).join('');}catch(e){hex='bad';}
      send({s:'queueDequeue',n:deqN,q:this.q,ret:v,hex,th:Process.getCurrentThreadId()});}
    else if(deqN<=32||deqN%256===0)send({s:'queueDequeue',n:deqN,q:this.q,ret:v,th:Process.getCurrentThreadId()});}}});
  let oobN=0;Interceptor.attach(at(0x3ba2ccc),{onEnter(a){if(!flowOverride)return;oobN++;
    if(oobN<=16||oobN%64===0)send({s:'oobPrint',n:oobN,th:Process.getCurrentThreadId()});}});
  let routeHits=0;
  Interceptor.attach(at(0x3badfa0),{onEnter(a){
    if(!flowOverride)return;routeHits++;
    if(routeHits<=24||routeHits%128===0)try{
      const address=a[0].add(0x10);
      send({s:'packetRoute',n:routeHits,type:address.add(6).readU8(),queue:address.add(8).readU32(),
        networkState:at(0x67efe20).readU32(),th:Process.getCurrentThreadId(),caller:rel(this.returnAddress)});
    }catch(e){send({s:'packetRouteUnreadable',error:String(e)});}
  }});
  send({s:'packetRouteObserverArmed',networkState:at(0x67efe20).readU32()});
  send({s:'clResendObserverArmed'});
}
if(OBSERVE_CONNECT_ID){
  const rdHex=(p,n)=>{try{return Array.from(new Uint8Array(p.readByteArray(n))).map(b=>b.toString(16).padStart(2,'0')).join('');}catch(e){return 'bad';}};
  const site1884=at(0x3ba1884),site17ac=at(0x3ba17ac);
  let coutN=0,crepN=0;
  Interceptor.attach(at(0x3badfa0),{onEnter(a){
    if(!flowOverride)return;
    const fromClient=this.returnAddress.equals(site1884);
    const fromReply=this.returnAddress.equals(site17ac);
    if(!fromClient&&!fromReply)return;
    try{const address=a[0].add(0x10);
      const type=address.add(6).readU8(),queue=address.add(8).readU32(),chanId=address.add(0xc).readU16();
      // The route-rewrite hook (WZM_ROUTE_LOCAL_HOST_PACKET) attaches to this
      // same site first and may already have flipped type 3->1; the channel id
      // at +0xc is untouched by that write, so match on the queue only.
      if(fromClient&&queue===2){coutN++;if(coutN<=16)send({s:'clientConnectAddr',n:coutN,chanId,type,queue,addrHex:rdHex(address,0x20),th:Process.getCurrentThreadId()});}
      else if(fromReply){crepN++;if(crepN<=24)send({s:'replyPacketAddr',n:crepN,chanId,type,queue,addrHex:rdHex(address,0x20),th:Process.getCurrentThreadId()});}
    }catch(e){send({s:'connectIdUnreadable',error:String(e)});}
  }});
  let replyN=0;
  Interceptor.attach(at(0x3ba1708),{onEnter(){if(!flowOverride)return;replyN++;if(replyN<=24)send({s:'replySender',n:replyN,caller:rel(this.returnAddress),th:Process.getCurrentThreadId()});}});
  send({s:'connectIdObserverArmed'});
}
Interceptor.attach(at(0x199efac),{onEnter(a){send({s:'zoneList',map:safe(a[0]),flag:a[1].toInt32()});}});
Interceptor.attach(at(0x3abb5b4),{onEnter(a){send({s:'levelRequest',map:safe(a[0])});}});
// Mode feature test: log the bit-77 checks (the map-load decision in party start 0x1625510).
let featN=0;
// Perf: ~51k calls/s in a match; trace only, so off in quiet play.
if(!QUIET)Interceptor.attach(at(0x3ab13f4),{onEnter(a){this.b=a[0].toInt32();},onLeave(r){if(this.b!==77||++featN>12)return;
  send({s:'feature77',mode:at(0xc115ea8).readU8(),table:modeTable().toString(),r:r.toInt32()&1,lr:rel(this.returnAddress)});}});
Interceptor.attach(at(0x199efac),{onEnter(){send({s:'zoneListCaller',lr:rel(this.returnAddress),mode:at(0xc115ea8).readU8()});}});
Interceptor.attach(at(0x12a1104),{onEnter(a){send({s:'FATAL',code:(a[0].toUInt32()>>>0).toString(16),arg:(safe(a[2])||'').split('�')[0],lr:rel(this.context.lr)});}});
Interceptor.attach(at(0x3a55cc4),{onEnter(a){send({s:'comError',code:a[0].toInt32(),fmt:(safe(a[1])||'').split('�')[0].slice(0,40),a2:(safe(a[2])||a[2].toString()).split('�')[0].slice(0,120),lr:rel(this.context.lr)});}});
Interceptor.attach(at(0x375ab30),{onEnter(a){send({s:'sessionError',hash:a[1].toString(),lr:rel(this.context.lr)});}});
if(!QUIET)Interceptor.attach(at(0x3663500),{onEnter(a){if(!flowOverride)return;const t=a[1].toInt32(),e=at(0xb1beb40).add(t*0x340),n=e.add(0x58).readU32();const es=[];for(let i=0;i<n;i++){const q=e.add(i*32+0x60);const v=q.readPointer();es.push([rel(v),safe(q.add(8).readPointer())]);}send({s:'stackPop',ctx:t,arg:rel(a[0]),depth:n,entries:es,lr:rel(this.returnAddress)});}});
if(!QUIET)for(const[n,x]of[['s3a876a0',0x3a876a0],['s3ce70b8b',0x392d054],['s2e8dd0c',0x2e8dd0c],['s3a566d4_',0x15d8780],['s138462c',0x138462c],['s3a61660',0x3a61660],['s13ce534',0x13ce534]])Interceptor.attach(at(x),{onEnter(){if(flowOverride)send({s:n});}});
if(!QUIET)for(const[n,x]of[['s13ce274',0x13ce274],['s13c20bc',0x13c20bc],['s1ab0e50',0x1ab0e50],['s13c7960',0x13c7960],['s199f97c',0x199f97c],['s28f839c',0x28f839c],['s15c7bd0',0x15c7bd0],['s3655138',0x3655138],['s2b0e1c4',0x2b0e1c4],['s19addf4',0x19addf4],['s15fb6e0',0x15fb6e0],['s19ade38',0x19ade38],['s2b0d0f0',0x2b0d0f0],['s367c818',0x367c818],['s2b0efcc',0x2b0efcc],['s2064cc8',0x2064cc8],['s2949874',0x2949874],['s1f0db10',0x1f0db10],['s3ce7054',0x3ce7054],['s294982c',0x294982c],['s3a566d4',0x3a566d4],['s3ab285c',0x3ab285c],['s3ab2960',0x3ab2960],['s3a54618',0x3a54618],['s19ae_zoneBegin',0x199ef98],['s3cbd030',0x3cbd030],['s3beecec',0x3beecec]])try{Interceptor.attach(at(x),{onEnter(){if(flowOverride)send({s:n});}});}catch(e){send({s:'noHook',n});}
for(const n of['exit','_exit','abort','pthread_exit','longjmp','siglongjmp','_longjmp','__cxa_throw','raise'])try{const f=Module.findGlobalExportByName(n);if(f)Interceptor.attach(f,{onEnter(){if(flowOverride)send({s:'libc_'+n,th:Process.getCurrentThreadId(),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,10).map(rel)});}});}catch(e){}
const protectionStubs=[[0x139a7d4, 31], [0x1e1ee74, 42], [0x1e51580, 30], [0x1e51644, 33], [0x20dbea4, 39], [0x20dc920, 32], [0x22271b0, 36], [0x23ec8f8, 55], [0x255c5f4, 11], [0x26f0064, 12], [0x2770020, 14], [0x279e694, 26], [0x27a4128, 8], [0x27d6070, 16], [0x27d6188, 5], [0x27e330c, 21], [0x27e3398, 22], [0x27fac0c, 23], [0x2814f2c, 0], [0x2814fdc, 25], [0x2815528, 19], [0x287e900, 46], [0x28d5354, 15], [0x28eafa8, 59], [0x2900994, 52], [0x2903c24, 4], [0x290cb3c, 57], [0x292d784, 43], [0x2930594, 9], [0x2938400, 10], [0x2938528, 17], [0x293853c, 2], [0x2949790, 41], [0x298789c, 20], [0x298b108, 34], [0x29c1a58, 56], [0x29c4bb0, 35], [0x29c5080, 24], [0x29de998, 53], [0x2a0df4c, 3], [0x2a1a144, 1], [0x2a1a4bc, 60], [0x2a1a90c, 54], [0x2a20568, 37], [0x33e99f0, 13], [0x33ead9c, 18], [0x33eedb0, 6], [0x3497e20, 47], [0x349a914, 45], [0x34b882c, 44], [0x35128b8, 48], [0x351e858, 49], [0x3520d0c, 50], [0x3523a20, 51], [0x36709c8, 7], [0x379507c, 58], [0x3a7f3a0, 27], [0x3af171c, 28], [0x3bfccc0, 29], [0x3cd646c, 40], [0x3cd7af0, 38]];
if(BYPASS_STUB53){
  Interceptor.replace(at(0x29de998),new NativeCallback(function(obj){send({s:'stub53SkippedDiagnostic',object:obj.toString(),note:'protected 224-byte object constructor omitted'});},'void',['pointer']));
  send({s:'stub53BypassArmed'});
}
if(BYPASS_STUB60){
  Interceptor.replace(at(0x2a1a4bc),new NativeCallback(function(a,b,c,count,items){send({s:'stub60SkippedDiagnostic',count,items,note:'protected initializer omitted; downstream behavior not valid gameplay'});},'void',['pointer','pointer','pointer','int','int']));
  send({s:'stub60BypassArmed'});
}
// Read-only discriminator: stub53 gets a 0xe0-stride allocated object (x0),
// NOT the arena header (x19). Record both before the virtualized call.
const boundedHex=(p,n)=>{try{return Array.from(new Uint8Array(p.readByteArray(n))).map(v=>v.toString(16).padStart(2,'0')).join('');}catch(e){return 'unreadable';}};
let stubHooks=0;if(!QUIET)for(const[x,n]of protectionStubs)try{if((BYPASS_STUB53&&n===53)||(BYPASS_STUB60&&n===60))continue;Interceptor.attach(at(x),{onEnter(){if(!flowOverride)return;send({s:'stubIn',idx:n,th:Process.getCurrentThreadId(),lr:rel(this.context.lr)});if(n===53){this.stub53Object=this.context.x0;send({s:'stub53ObjectBefore',object:this.context.x0.toString(),arena:this.context.x19.toString(),objectHex:boundedHex(this.context.x0,0xe0),arenaHeaderHex:boundedHex(this.context.x19,0x30)});}},onLeave(){if(!flowOverride)return;if(n===53)send({s:'stub53ObjectAfter',object:this.stub53Object?this.stub53Object.toString():null,objectHex:this.stub53Object?boundedHex(this.stub53Object,0xe0):null});send({s:'stubOut',idx:n});}});stubHooks++;}catch(e){}
send({s:'stubHooks',ok:stubHooks,of:protectionStubs.length});
const classify=p=>{try{const m=Process.findModuleByAddress(p);if(!m)return 'heap/anon '+p;const off=p.sub(m.base);return m.name+'+'+off+(m.name==='libgame.so'?(off.compare(0x10a7000)<0?' <.text?>':' <data>'):'');}catch(e){return 'bad';}};
if(!QUIET)Interceptor.attach(at(0x29b6ae0),{onEnter(a){if(!flowOverride)return;this.triggerPhase=true;const hx=(p,n)=>{try{return Array.from(new Uint8Array(p.readByteArray(n))).map(x=>x.toString(16).padStart(2,'0')).join('');}catch(e){return 'bad';}};send({s:'trigger29b6ae0',x0:classify(a[0]),x1:classify(a[1]),w2:a[2].toInt32(),w3:a[3].toInt32(),x0hex:hx(a[0],64),x1hex:hx(a[1],160)});}});
if(!QUIET)Interceptor.attach(at(0x365eba0),{onEnter(a){this.src=a[0];this.n=a[1];},onLeave(r){if(flowOverride&&this.triggerPhase)send({s:'alloc365',src:classify(this.src),n:this.n.toInt32(),ret:classify(r)});}});
Process.setExceptionHandler(d=>{const pc=d.context.pc;const m=Process.findModuleByAddress(pc);if(m&&m.name==='libgame.so')send({s:'FAULT',pc:rel(pc),fault:d.address?d.address.toString():null,x0:d.context.x0.toString(),lr:rel(d.context.lr),bt:Thread.backtrace(d.context,Backtracer.FUZZY).slice(0,8).map(rel)});return false;});
function zones(){const o=[];let n=at(0xc0e4d78).readPointer();for(let i=0;i<14&&!n.isNull();i++){o.push(n.add(0x20).readU8()+':'+n.add(0x2a).readCString()+'>'+n.add(0xea).readCString());n=n.add(0x10).readPointer();}return o;}
rpc.exports={go(m,g,e){if(e!==undefined&&e!==null)ENEMY_AI_RT=e;pending={map:m,gametype:g};matchRequest=pending;return 1;},snap(){let clc0=-2;try{const q=at(0x54bb7e8).readPointer();clc0=q.isNull()?-1:q.add(8).readU32();}catch(e){}let netState=-2;try{netState=at(0x67efe20).readU32();}catch(e){}return{level:at(0xc11a688).readS32(),mode:at(0xc115ea8).readU8(),cls:at(0xcdcd768).readU32(),clc0,netState,zones:zones()};}};
