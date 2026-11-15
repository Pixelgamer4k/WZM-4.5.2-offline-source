'use strict';
// Runs one Lua source chunk on the game's own thread, at entry of the native
// LUI frame (0x337c1c0), where no Lua is executing. Never call from an RPC thread.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const lVar=at(0x54bcd08).readPointer();
const load=new NativeFunction(at(0x4490778),'int',['pointer','pointer','size_t','pointer','pointer']);
const pcall=new NativeFunction(at(0x4486bc4),'int',['pointer','int','int','int']);
const tostr=new NativeFunction(at(0x4483720),'pointer',['pointer','int','pointer']);
const name=Memory.allocUtf8String('=wzm_bridge');
let pending=null;
Interceptor.attach(at(0x337c1c0),{onEnter(){
 if(pending===null)return;
 const L=lVar.readPointer();
 if(L.isNull())return;
 const src=pending;pending=null;
 const top=L.add(0x28).readPointer();
 let out={tid:Process.getCurrentThreadId(),L:L.toString()};
 try{
  const buf=Memory.allocUtf8String(src);
  out.load=load(L,buf,src.length,name,ptr(0));
  if(out.load===0)out.pcall=pcall(L,0,1,0);
  const s=tostr(L,-1,ptr(0));
  out.result=s.isNull()?null:s.readUtf8String();
 }catch(e){out.exception=String(e);}
 L.add(0x28).writePointer(top);
 send({kind:'lua_result',out});
}});
rpc.exports={run(src){pending=src;return true;}};
send({kind:'ready',base:b.toString(),L:lVar.readPointer().toString()});
