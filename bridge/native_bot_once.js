{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const running=new NativeFunction(at(0x3cbb774),'int',[]);
const add=new NativeFunction(at(0x3cd64e8),'pointer',[]);
let fired=false,readyAt=0;
Interceptor.attach(at(0x3cf10e0),{onEnter(){
 if(fired)return;
 try{if(at(0x54bb7e8).readPointer().add(8).readU32()!==8)return;}catch(e){return;}
 if(!readyAt){readyAt=Date.now();return;}if(Date.now()-readyAt<30000)return;
 fired=true;
 const info={s:'nativeBotAttempt',tid:Process.getCurrentThreadId()};
 try{
  info.serverRunning=running();
  const world=at(0x54d1118).readPointer().readPointer();
  info.context=world.toString();info.contextFlag=world.isNull()?null:world.add(0x18).readU8();
  info.capacity=at(0x54cafa8).readPointer().readS32();
  const party=new NativeFunction(at(0x375bda4),'pointer',[])();
  info.partyAddressEligible=new NativeFunction(at(0x3910ee0),'int',['pointer'])(party);
  const slots=at(0x54cafb0).readPointer();info.slots=[];
  for(let i=0;i<Math.min(info.capacity,8);i++){const c=slots.add(i*8).readPointer();info.slots.push(c.isNull()?null:c.add(8).readU8());}
  if(!info.serverRunning||world.isNull()){info.skipped='server not active';send(info);return;}
  info.entity=add().toString();send(info);
 }catch(e){info.error=String(e);send(info);}
}});
send({s:'nativeBotAttemptArmed'});

}
