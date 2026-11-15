'use strict';
// Keeps skip_online_fences.lua installed and reports Lua errors from the engine's
// message handler, which runs before the Lua stack unwinds.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const lVar=at(0x54bcd08).readPointer();
const load=new NativeFunction(at(0x4490778),'int',['pointer','pointer','size_t','pointer','pointer']);
const pcall=new NativeFunction(at(0x4486bc4),'int',['pointer','int','int','int']);
const tostr=new NativeFunction(at(0x4483720),'pointer',['pointer','int','pointer']);
const name=Memory.allocUtf8String('=wzm_bridge');
let buf=null,len=0,tick=0,inside=false,installs=0;
const str=(L,i)=>{const p=tostr(L,i,ptr(0));return p.isNull()?null:p.readUtf8String();};
function run(){
 const L=lVar.readPointer();if(L.isNull())return;
 const top=L.add(0x28).readPointer();inside=true;
 try{let r=load(L,buf,len,name,ptr(0));if(r===0)r=pcall(L,0,1,0);
  const t=str(L,-1);if(r!==0||t)send({k:'chunk',r,msg:t,installs:++installs});
 }catch(e){send({k:'exc',e:String(e)});}
 L.add(0x28).writePointer(top);inside=false;
}
let hooked=false;
Interceptor.attach(at(0x337c1c0),{onEnter(){if(!hooked)hooked=hookHandler();if(buf&&(tick++%10===0))run();}});
const seen={};let errs=0;
function hookHandler(){
 const handler=at(0xae8c6f0).readPointer();if(handler.isNull())return false;
 send({k:'ready',handler:handler.sub(b).toString()});
 Interceptor.attach(handler,{onEnter(a){this.L=a[0];this.m=null;
  try{this.m=str(a[0],1);}catch(e){this.m='exc '+e;}
  const key=String(this.m).slice(0,200);
  if(!seen[key]&&!inside){inside=true;const L=a[0],top=L.add(0x28).readPointer();
   try{const c='return debug.traceback("",2)';const cb=Memory.allocUtf8String(c);
    let r=load(L,cb,c.length,name,ptr(0));if(r===0)r=pcall(L,0,1,0);this.tb=str(L,-1);}catch(e){this.tb='exc '+e;}
   L.add(0x28).writePointer(top);inside=false;}},
 onLeave(){let t=null;try{t=str(this.L,-1);}catch(e){}
  const key=String(this.m).slice(0,200);errs++;
  if(!seen[key]){seen[key]=1;send({k:'lua_error',n:errs,msg:this.m,trace:this.tb||t});}}});
 return true;
}
// Asset file opens: one report per path and result, so missing files stand out.
const opened={};
function report(path,fd){
 if(path===null||!/zone\/|\.xsub|\.xpak|\.ff|shard_cache\/xxh64|\.dcache/.test(path))return;
 const short=path.replace(/.*\/files\//,''),st=fd<0?'FAIL':'ok',key=st+short;
 if(opened[key])return;opened[key]=1;send({k:'file_open',st,path:short});
}
for(const [n,idx] of [['open',0],['__open_2',0],['openat',1],['__openat_2',1],['open64',0]]){
 const a=Module.findGlobalExportByName(n);if(!a)continue;
 Interceptor.attach(a,{onEnter(x){try{this.p=x[idx].readUtf8String();}catch(e){this.p=null;}},onLeave(r){report(this.p,r.toInt32());}});
}
for(const n of ['access','faccessat']){const a=Module.findGlobalExportByName(n);if(!a)continue;
 const idx=n==='access'?0:1;
 Interceptor.attach(a,{onEnter(x){try{this.p=x[idx].readUtf8String();}catch(e){this.p=null;}},onLeave(r){report(this.p,r.toInt32());}});}
const zones={};
Interceptor.attach(at(0x12d5890),{onEnter(a){for(let i=0;i<3;i++){try{const t=a[i].readCString(80);if(t&&/^[ -~]{3,}$/.test(t)&&/\.(ff|xsub|xpak)|zone/.test(t)){this.z=t;break;}}catch(e){}}},
 onLeave(r){if(this.z&&!zones[this.z]){zones[this.z]=1;send({k:'zone_lookup',z:this.z,r:r.toString()});}}});
rpc.exports={start(s){buf=Memory.allocUtf8String(s);len=s.length;return true;}};
