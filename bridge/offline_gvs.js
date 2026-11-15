'use strict';
// Let the GVS initializer take its original unavailable-service branch. Only
// these two GVS callsites see unavailable; every other query remains original.
let hook=null;
const timer=setInterval(()=>{
 const m=Process.findModuleByName('libgame.so');if(!m)return;
 try{
  const entry=m.base.add(0x12a278c);
  if(entry.readU32()!==0xd10203ff)return;
  const callers=new Set(['0x38feb50','0x38fec6c']);let n=0;
  hook=Interceptor.attach(entry,{
   onEnter(){this.gvs=callers.has(this.returnAddress.sub(m.base).toString());},
   onLeave(r){if(this.gvs){const original=r.toInt32();r.replace(0);if(++n<=8)send({kind:'gvs_unavailable',original,n});}}
  });
  clearInterval(timer);send({kind:'offline_gvs_armed',base:m.base.toString(),scope:'GVS initializer only'});
 }catch(e){send({kind:'gvs_hook_error',error:String(e)});clearInterval(timer);}
},20);
rpc.exports={state(){
 const m=Process.findModuleByName('libgame.so');if(!m)return {module:false};
 const q=m.base.add(0x54bcd08).readPointer();
 return {module:true,L:q.isNull()?'0x0':q.readPointer().toString()};
}};
