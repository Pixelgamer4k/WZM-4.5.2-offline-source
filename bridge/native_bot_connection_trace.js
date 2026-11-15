{
'use strict';
const base=Process.getModuleByName('libgame.so').base,at=n=>base.add(n);
const create=new NativeFunction(at(0x3cd6670),'uint64',['pointer','int','int','uint64'],{traps:'all'});
const defaults=new NativeFunction(at(0x3d16768),'pointer',[]);
const name=Memory.allocUtf8String('tcBotOffline0');let done=false,readyAt=0;
globalThis.wzmBotArm=()=>{if(!readyAt){readyAt=Date.now();send({s:'botPlayerReadyArmed'});}};
function snapshot(){const n=at(0x54cafa8).readPointer().readS32(),slots=at(0x54cafb0).readPointer(),v=[];if(n<1||n>200)throw Error('bad capacity '+n);for(let i=0;i<Math.min(n,20);i++){const p=slots.add(i*8).readPointer();v.push(p.isNull()?null:{index:i,state:p.add(8).readU8(),connection:p.add(0x280).readU8(),bot:p.add(0xb668).readU32()});}return v;}
Interceptor.attach(at(0x3cf10e0),{onEnter(){
 if(done)return;
 try{if(at(0x54bb7e8).readPointer().add(8).readU32()!==8)return;}catch(e){return;}
 if(!readyAt||Date.now()-readyAt<1500)return;
 done=true;
 try{
  if(at(0xcdcd9b0).readU32()!==2){send({s:'botConnectSkipped',reason:'inactive server'});return;}
  const before=snapshot();if(!before.some(x=>x&&x.state===0)){send({s:'botConnectSkipped',reason:'no free slot'});return;}
  const d=defaults();if(d.isNull())throw Error('no default character');
  const head=d.readS32(),body=d.add(4).readS32();
  send({s:'botConnectBegin',head,body,before});
  globalThis.wzmBotProbeActive=true;
  let id;try{id=create(name,head,body,uint64(0));}finally{globalThis.wzmBotProbeActive=false;}
  send({s:'botConnectResult',identity:id.toString(),after:snapshot()});
 }catch(e){const c=e.context;const m=c?Process.findModuleByAddress(c.pc):null;send({s:'botConnectError',error:String(e),keys:Object.getOwnPropertyNames(e),fault:e.address?e.address.toString():null,memory:e.memory||null,pc:c?(m?m.name+'+'+c.pc.sub(m.base).toString():c.pc.toString()):null,lr:c?c.lr.toString():null});}
}});
send({s:'botConnectArmed',pid:Process.id});

}

{
 const b=Process.getModuleByName('libgame.so').base;let lines=0;
 const text=p=>{try{const s=p.readCString(200)||'';return /error|reject|EXE\/|fail|bot|connect/i.test(s)?s:null;}catch(e){return null;}};
 for(const [name,off] of [['botConnectionHandler',0x3ccc9b0],['botAlternateConnectBranch',0x3ccd8fc],['botOobReply',0x3ba1708],['botGameMessage',0x12a3d5c]]){
  Interceptor.attach(b.add(off),{onEnter(a){
   if(!globalThis.wzmBotProbeActive||lines++>=20)return;
   const strings=[];for(let i=0;i<4;i++){const s=text(a[i]);if(s)strings.push({arg:i,text:s});}
   send({s:name,strings,caller:this.returnAddress.sub(b).toString()});
  }});
 }
}

{
 const base=Process.getModuleByName('libgame.so').base;let n=0;
 for(const [name,off] of [['botDispatchAddress',0x3ccc9b0],['botFallbackPredicate',0x3ccf024],['botFreeSlotScan',0x3ccf064],['botClientInitialize',0x3ccd784],['botChannelAttach',0x3ccd85c]]){
  try{Interceptor.attach(base.add(off),{onEnter(a){
   if(!globalThis.wzmBotProbeActive||n++>=12)return;
   const event={s:name};
   if(off===0x3ccc9b0){try{event.addressHex=Array.from(new Uint8Array(a[0].readByteArray(24)),x=>x.toString(16).padStart(2,'0')).join('');event.type=a[0].add(6).readU8();event.botId=a[0].add(8).readU32();event.channel=a[0].add(12).readU16();}catch(e){event.error=String(e);}}
   send(event);
  }});}catch(e){send({s:'botTraceHookSkipped',name,error:String(e)});}
 }
}
