'use strict';
// Requests a map, then runs the game's own zone-request reset on the game thread. No gate is forced.
const m=Process.getModuleByName('libgame.so'),b=m.base,at=x=>b.add(x);
const G=p=>{try{if(p.compare(b)>=0&&p.compare(b.add(m.size))<0)return 'G+'+p.sub(b);const q=Process.findModuleByAddress(p);return q?q.name+'+'+p.sub(q.base):p.toString();}catch(e){return '?';}};
const cstr=(p,n=300)=>{try{return p.isNull()?null:p.readCString(n);}catch(e){return '<bad>';}};
const request=new NativeFunction(at(0x3abb5b4),'void',['pointer','pointer']);
const reset=new NativeFunction(at(0x3a7edcc),'void',[]);
const setMode=new NativeFunction(at(0x3ab285c),'void',['pointer','int','pointer']);
const switchMode=new NativeFunction(at(0x3ab2960),'void',[]);
const modeId=i=>at(0x54d9b30).readPointer().add(i*0x1a8).readPointer();
let act=[];
Interceptor.attach(at(0x337c1c0),{onEnter(){const a=act;act=[];for(const f of a){try{f();}catch(e){send({k:'exc',e:String(e)});}}}});
// Mode switches block in the graphics sync when run from the UI callback, so they run after the level tick.
let tickAct=[],ticks=0;
Interceptor.attach(at(0x3abb6e4),{onLeave(){ticks++;const a=tickAct;tickAct=[];for(const f of a){try{f();}catch(e){send({k:'exc',e:String(e)});}}}});
const gate={};
for(const [n,v] of [['g1',0x3abb730],['g2',0x3abb7b0],['g3',0x3abb754],['g4',0x3abb780]])
 Interceptor.attach(at(v),{onEnter(){const r=this.context.x0.toInt32()&1;if(gate[n]!==r){gate[n]=r;send({k:'gate',n,r});}}});
Interceptor.attach(at(0x199fa34),{onEnter(a){send({k:'loadLevel',map:cstr(a[0],64),f:a[1].toInt32()});}});
Interceptor.attach(at(0x199fb60),{onEnter(a){send({k:'addZone',t:cstr(a[1],64)});}});
Interceptor.attach(at(0x12a1104),{onEnter(a){send({k:'FATAL',sev:a[0].toInt32(),fmt:cstr(a[1]),caller:G(this.returnAddress),bt:Thread.backtrace(this.context,Backtracer.ACCURATE).slice(0,12).map(G)});Thread.sleep(0.3);}});
Interceptor.attach(at(0x3a55cc4),{onEnter(a){send({k:'error',sev:a[0].toInt32(),code:(a[2].toUInt32()>>>0).toString(16),caller:G(this.returnAddress)});}});
const lw=Module.findGlobalExportByName('__android_log_write');
Interceptor.attach(lw,{onEnter(a){try{if(a[0].toInt32()>=6&&cstr(a[1],16)==='WZM')send({k:'WZMLOG',msg:cstr(a[2],900)});}catch(e){}}});
let sessionTid=0;
Process.setExceptionHandler(d=>{if(G(d.context.pc).startsWith('G+')||Process.getCurrentThreadId()===sessionTid)send({k:'crash',tid:Process.getCurrentThreadId(),type:d.type,op:d.memory&&d.memory.operation,addr:d.memory&&d.memory.address.toString(),x0:d.context.x0.toString(),x1:d.context.x1.toString(),pc:G(d.context.pc),lr:G(d.context.lr),bt:Thread.backtrace(d.context,Backtracer.FUZZY).slice(0,14).map(G)});Thread.sleep(0.5);return false;});
for(const n of ['exit','_exit','abort','kill','tgkill','raise'])try{const f=Module.findGlobalExportByName(n);if(f)Interceptor.attach(f,{onEnter(a){const sig=a[n==='tgkill'?2:1].toInt32();if(n==='tgkill'&&sig===33)return;send({k:'EXIT',n,a0:a[0].toInt32(),a1:sig,thread:Process.getCurrentThreadId(),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,10).map(G)});Thread.sleep(0.3);}});}catch(e){}
// Session thread: 0x3cbd0e8 loop, builder 0x3cbb568, teardown 0x3cbb5f0. Init is vtable +0x90, run is +0x28.
Interceptor.attach(at(0x3cbb568),{onEnter(){sessionTid=Process.getCurrentThreadId();send({k:'session_build',tid:sessionTid});},onLeave(){send({k:'session_built',cls:at(0xcdcd768).readU8()});}});
Interceptor.attach(at(0x3cbb5f0),{onEnter(){send({k:'session_teardown'});}});
for(const n of ['pthread_exit','__cxa_throw','longjmp','siglongjmp'])try{const f=Module.findGlobalExportByName(n);if(f)Interceptor.attach(f,{onEnter(){if(Process.getCurrentThreadId()===sessionTid)send({k:'THREAD_END',n,bt:Thread.backtrace(this.context,Backtracer.ACCURATE).slice(0,14).map(G)});}});}catch(e){}
// INIT_TARGETS: session init callees, logged on the session thread only.
for(const v of [0x3cbb7a0,0x3f15fc4,0x3f15e9c,0x3f16018,0x29b5a68,0x2a1a144,0x275eb3c,0x3f15e1c,0x3f15c28])Interceptor.attach(at(v),{onEnter(){if(Process.getCurrentThreadId()===sessionTid)send({k:'init_in',f:v.toString(16),from:G(this.returnAddress)});},onLeave(){if(Process.getCurrentThreadId()===sessionTid&&v<0x3f00000)send({k:'init_out',f:v.toString(16)});}});
const dump=()=>{const o={k:'dump',cls768:at(0xcdcd768).readU8(),obj770:at(0xcdcd770).readPointer().toString(),go778:at(0xcdcd778).readU8(),got580:at(0x54da580).readPointer().sub(b).toString(),th:[]};
 const so=at(0xcdcd770).readPointer();if(!so.isNull()){const v=so.readPointer();o.vt=v.sub(b).toString();o.init90=G(v.add(0x90).readPointer());o.run28=G(v.add(0x28).readPointer());o.tick38=G(v.add(0x38).readPointer());o.quit1c=so.add(0x1c).readU8();}
 for(const t of Process.enumerateThreads()){let bt=[];try{bt=Thread.backtrace(t.context,Backtracer.FUZZY).slice(0,14).map(G);}catch(e){}
  if(t.name==='WZM_Main'||bt.some(x=>/^G\+0x3(c[a-f]|d[0-2])/.test(x)))o.th.push({n:t.name,id:t.id,s:t.state,bt:bt.filter(x=>x.startsWith('G+')).slice(0,10)});}
 send(o);};
const nodes={fui_boot:0xc0e3770,global:0xc0e3920,fui:0xc0e3ad0,gstream:0xc0e3c80,ingame:0xc0e4340,frontend:0xc0e4190,level:0xc0e4bb0};
let last='';setInterval(()=>{const s=at(0xc11a688).readS32();let o=`state=${s} mode=${at(0xc115ea8).readU8()}/${at(0xc115eb0).readU8()}`;for(const k in nodes){const n=at(nodes[k]);o+=` ${k}:${n.add(0x20).readU8()}/${n.add(0x21).readU8()}:${(cstr(n.add(0xea),24)||'-').replace(/[^\x20-\x7e].*/,'')}`;}if(o!==last){last=o;send({k:'snap',o});}},200);
rpc.exports={dump(){dump();},go(n){act.push(()=>{request(Memory.allocUtf8String(n),ptr(0));send({k:'requested',n});});},reset(){act.push(()=>{reset();send({k:'reset_done'});});},mode(i){send({k:'mode_queued',i,ticks});tickAct.push(()=>{send({k:'mode_start',i});setMode(modeId(i),0,Memory.allocUtf8String('offline'));switchMode();send({k:'mode_done',i,cur:at(0xc115ea8).readU8()});});}};
