'use strict';
// Mode switch with one hook only, to test whether other hooks affect session init.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const setMode=new NativeFunction(at(0x3ab285c),'void',['pointer','int','pointer']);
const switchMode=new NativeFunction(at(0x3ab2960),'void',[]);
const modeId=i=>at(0x54d9b30).readPointer().add(i*0x1a8).readPointer();
let q=[];
Interceptor.attach(at(0x3abb6e4),{onLeave(){const a=q;q=[];for(const f of a)f();}});
// Logs destinations only, never payloads.
const G=p=>{const q=Process.findModuleByAddress(p);return q?q.name+'+'+p.sub(q.base).toString(16):p.toString();};
// Fails the telemetry lookup in memory so nothing is sent to that host.
Interceptor.attach(Module.findGlobalExportByName('getaddrinfo'),{onEnter(a){let h='';try{h=a[0].readCString(64)||'';}catch(e){}this.block=h.includes('codefusion');send({k:'dns',host:h.replace(/[^\x20-\x7e].*/,''),block:this.block,tid:Process.getCurrentThreadId()});},onLeave(r){if(this.block)r.replace(ptr(8));send({k:'dns_ret',rc:r.toInt32()});}});
Interceptor.attach(Module.findGlobalExportByName('connect'),{onEnter(a){try{const f=a[1].readU16();if(f===2){const p=a[1].add(2).readU16();const port=((p&255)<<8)|(p>>8);const ip=[4,5,6,7].map(i=>a[1].add(i).readU8()).join('.');send({k:'connect',ip,port,tid:Process.getCurrentThreadId(),from:G(this.returnAddress)});}}catch(e){}}});
// OUTCALL: on the session thread, log the last libgame funcs and libc exits the VM reaches.
let sessTid=0;
Interceptor.attach(at(0x3cbb568),{onEnter(){sessTid=Process.getCurrentThreadId();send({k:'build_enter',tid:sessTid});}});
for(const n of ['_exit','exit','pthread_exit','abort','__cxa_throw','longjmp','siglongjmp','pthread_kill','tgkill','kill','syscall']){
 try{const f=Module.findGlobalExportByName(n);if(f)Interceptor.attach(f,{onEnter(a){if(Process.getCurrentThreadId()!==sessTid)return;send({k:'EXITFN',n,a0:a[0].toInt32(),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,16).map(G)});}});}catch(e){}}
rpc.exports={mode(i){q.push(()=>{setMode(modeId(i),0,Memory.allocUtf8String('offline'));switchMode();send({k:'mode_done',i});});},
 read(){return {cur:at(0xc115ea8).readU8(),cls:at(0xcdcd768).readU8(),obj:at(0xcdcd770).readPointer().toString(),state:at(0xc11a688).readS32()};}};
