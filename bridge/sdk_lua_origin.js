'use strict';
{
 const b=Process.getModuleByName('libgame.so').base,sdk=Process.getModuleByName('libeevsdgz.so').base;
 const load=new NativeFunction(b.add(0x4490778),'int',['pointer','pointer','size_t','pointer','pointer']);
 const call=new NativeFunction(b.add(0x4486bc4),'int',['pointer','int','int','int']);
 const str=new NativeFunction(b.add(0x4483720),'pointer',['pointer','int','pointer']);
 const src='return debug and debug.traceback and debug.traceback("SDK caller",2) or "traceback unavailable"';
 const buf=Memory.allocUtf8String(src),name=Memory.allocUtf8String('=sdk_lua_origin');let busy=false,n=0;
 Interceptor.attach(b.add(0x3393470),{onEnter(){
  const a=[this.context.x19,this.context.x20];
  if(busy||!a[1].equals(sdk.add(0x23d04c))||n++>=4)return;
  busy=true;const L=a[0],top=L.add(0x28).readPointer();const args=[];
  try{
   for(let i=1;i<=4;i++){let p=str(L,i,ptr(0));args.push(p.isNull()?null:p.readCString());}
   let rc=load(L,buf,src.length,name,ptr(0));if(!rc)rc=call(L,0,1,0);
   const p=str(L,-1,ptr(0));send({s:'sdkProtectedLuaInvocation',args,rc,trace:p.isNull()?null:p.readCString()});
  }catch(e){send({s:'sdkLuaOriginError',error:String(e)});}
  L.add(0x28).writePointer(top);busy=false;
 }});
 send({s:'sdkLuaOriginArmed',target:'libeevsdgz.so+0x23d04c'});
}
