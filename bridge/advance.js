'use strict';
// Temporary: let the level state machine past its readiness checks, and log the load.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const G=p=>{const m=Process.findModuleByAddress(p);return m?(m.name==='libgame.so'?'G+'+p.sub(b):m.name+'+'+p.sub(m.base)):p.toString();};
Process.setExceptionHandler(d=>{
 send({k:'crash',type:d.type,tid:Process.getCurrentThreadId(),thread:(Process.enumerateThreads().find(t=>t.id===Process.getCurrentThreadId())||{}).name,addr:d.memory&&d.memory.address.toString(),op:d.memory&&d.memory.operation,pc:G(d.context.pc),lr:G(d.context.lr),x0:d.context.x0.toString(),x1:d.context.x1.toString(),bt:Thread.backtrace(d.context,Backtracer.FUZZY).slice(0,16).map(G)});
 Thread.sleep(1.0);return false;});
const seen={};
for(const [n,a] of [['s1_ready',0x3abb730],['s2_ready',0x3abb7b0],['s3_ready',0x3abb754],['s4_ready',0x3abb780]])
 Interceptor.attach(at(a),{onEnter(){const v=this.context.x0.toInt32()&1;if(!seen[n+v]){seen[n+v]=1;send({k:n,was:v});}this.context.x0=ptr(1);}});
Interceptor.attach(at(0x199fa34),{onEnter(a){send({k:'loadLevel',n:a[0].readCString(16),f:a[1].toInt32()});}});
Interceptor.attach(at(0x199fb60),{onEnter(a){let t=null;try{t=a[1].readCString(24)}catch(e){};send({k:'addZone',t});}});
const zones={};
Interceptor.attach(at(0x12d5890),{onEnter(a){try{const t=a[0].readCString(64).split('.ff')[0];if(!zones[t]&&!/\/(ara|deu|ens|fra|jp|jpf|jpp|por|sa|sch|sna|spa|srv|ww)_/.test(t)){zones[t]=1;send({k:'zone',t});}}catch(e){}}});
Interceptor.attach(at(0x3a55cc4),{onEnter(a){send({k:'error',sev:a[0].toInt32(),code:a[2].toUInt32().toString(16)});}});
Interceptor.attach(Module.findGlobalExportByName('longjmp'),{onEnter(){send({k:'longjmp',bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,6).map(x=>x.sub(b).toString())});}});
let last=-9;setInterval(()=>{const s=at(0xc11a688).readS32();if(s!==last){last=s;send({k:'state',s});}},100);
