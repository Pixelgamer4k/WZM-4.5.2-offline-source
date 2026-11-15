'use strict';
const b=Process.getModuleByName('libgame.so').base,sdk=Process.getModuleByName('libeevsdgz.so').base;
const load=new NativeFunction(b.add(0x4490778),'int',['pointer','pointer','size_t','pointer','pointer']);
const call=new NativeFunction(b.add(0x4486bc4),'int',['pointer','int','int','int']);
const str=new NativeFunction(b.add(0x4483720),'pointer',['pointer','int','pointer']);
const src='return debug and debug.traceback and debug.traceback("SDK caller",2) or "traceback unavailable"';
const buf=Memory.allocUtf8String(src),name=Memory.allocUtf8String('=sdk_lua_at_close');let busy=false;
Interceptor.attach(sdk.add(0x2a12e0),{onEnter(a){
 if(busy)return;busy=true;
 try{
  const L=a[0].add(0x940).readPointer();
  const current=b.add(0x54bcd08).readPointer().readPointer();
  send({s:'sdkCloseLuaCandidate',L:L.toString(),current:current.toString()});
  if(!L.equals(current)||L.isNull())return;
  const top=L.add(0x28).readPointer(),args=[];
  try{
   for(let i=1;i<=4;i++){const p=str(L,i,ptr(0));args.push(p.isNull()?null:p.readCString());}
   let rc=load(L,buf,src.length,name,ptr(0));if(!rc)rc=call(L,0,1,0);
   const p=str(L,-1,ptr(0));send({s:'sdkLuaAtClose',args,rc,trace:p.isNull()?null:p.readCString()});
  }finally{L.add(0x28).writePointer(top);}
 }catch(e){send({s:'sdkLuaAtCloseError',error:String(e)});}
}});
send({s:'sdkLuaAtCloseArmed'});
