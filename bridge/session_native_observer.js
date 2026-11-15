'use strict';
// Non-mutating monitor: native original session producer, state, update.
// No server-start RPC, no VM patch, no map request, no readiness flag writes.
const base=Process.getModuleByName('libgame.so').base;
const at=o=>base.add(o);
const read8=p=>{try{return p.readU8();}catch(e){return null;}};
const read32=p=>{try{return p.readU32();}catch(e){return null;}};
const readPtr=p=>{try{return p.readPointer().toString();}catch(e){return null;}};
const hooks=[
 ['partyHostProducer',0x1621ab0],
 ['originalAltHostProducer',0x3cc9cd4],
 ['originalAltHostRequest',0x3cc9ecc],
 ['originalAltHostRequest2',0x3cc9f54],
 ['originalSessionFrame',0x3cf1f48],
 ['serverWorkLoop',0x3cf253c],
 ['serverTick',0x3cf10e0],
 ['serverStartup',0x3cf0cf0],
 ['actualSpawn',0x3ce8bec],
 ['protectedInit',0x29b6ae0],
];
let sent={};
for(const[name,va]of hooks){
 try{Interceptor.attach(at(va),{onEnter(a){
  sent[name]=(sent[name]||0)+1;
  if(sent[name]<=5)send({s:'originalNativeCall',name,va:'0x'+va.toString(16),tid:Process.getCurrentThreadId(),args:[a[0].toString(),a[1].toString()]});
 }});}
 catch(e){send({s:'hookFailed',name,error:String(e)});}
}
rpc.exports={
 sample(){
  return{
   phaseBytes:[
    read8(at(0xcdd2a38)),read8(at(0xcdd2a39)),
    read8(at(0xcdd2a3a)),read8(at(0xcdd2a3b)),
   ],
   sessionPhase:read32(at(0xcdef7c8)),
   sessionObject:readPtr(at(0xcdcd770)),
   mode:read8(at(0xc115ea8)),
   mapPtr:readPtr(at(0x54be5e8)),
   ticksSeen:sent.serverTick||0,
   altStartsSeen:sent.originalAltHostProducer||0,
  };
 }
};
