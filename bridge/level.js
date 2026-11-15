'use strict';
// Requests a map on the game thread and logs the level state machine.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const request=new NativeFunction(at(0x3abb5b4),'void',['pointer','pointer']);
let pending=null,check=null;
const avail=new NativeFunction(at(0x3a804b4),'int',['pointer']);
const a1=new NativeFunction(at(0x1ab2ae8),'int',['pointer']);
const a2=new NativeFunction(at(0x1ab2360),'int',['pointer']);
const force=new NativeFunction(at(0x3abaf90),'void',['pointer','pointer','int']);
let forceName=null;
Interceptor.attach(at(0x337c1c0),{onEnter(){
 if(check){const c=check;check=null;for(const n of c){const p=Memory.allocUtf8String(n);let r=[];try{r=[avail(p)&1,a1(p)&1,a2(p)&1];}catch(e){r=[String(e)];}send({k:'avail',n,r});}}
 if(forceName){const n=forceName;forceName=null;try{force(Memory.allocUtf8String(n),ptr(0),1);send({k:'forced',n});}catch(e){send({k:'exc',e:String(e)});}}
 if(pending===null)return;const n=pending;pending=null;
 const s=Memory.allocUtf8String(n);
 try{request(s,ptr(0));send({k:'requested',n});}catch(e){send({k:'exc',e:String(e)});}
}});
const zones={};
Interceptor.attach(at(0x12d5890),{onEnter(a){try{const t=a[0].readCString(80);if(t&&!zones[t]){zones[t]=1;send({k:'zone',t});}}catch(e){}}});
Interceptor.attach(at(0x199fa34),{onEnter(a){send({k:'loadLevel',n:a[0].readCString(64),f:a[1].toInt32()});}});
for(const n of ['longjmp'])Interceptor.attach(Module.findGlobalExportByName(n),{onEnter(){send({k:'longjmp',bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,8).map(x=>x.sub(b).toString())});}});
Interceptor.attach(at(0x3a55cc4),{onEnter(a){send({k:'error',sev:a[0].toInt32(),code:(a[2].toUInt32()>>>0).toString(16)});}});
let last=-9;setInterval(()=>{const s=at(0xc11a688).readS32();if(s!==last){last=s;send({k:'state',s,name:at(0xc11a68c).readCString(64)});}},100);
rpc.exports={go(n){pending=n;},chk(l){check=l;},frc(n){forceName=n;}};
