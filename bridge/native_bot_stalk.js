// One-shot: call the original bot connection factory 0x3cd6670 on the server
// thread and record, with Stalker, which basic blocks of the connection
// handler 0x3ccc9b0 run and which calls it makes. Read-only: changes nothing.
{
'use strict';
const base=Process.getModuleByName('libgame.so').base,at=n=>base.add(n);
const create=new NativeFunction(at(0x3cd6670),'uint64',['pointer','int','int','uint64'],{traps:'all'});
const defaults=new NativeFunction(at(0x3d16768),'pointer',[]);
const name=Memory.allocUtf8String('tcBotOffline0');
const LO=0x3ccc9b0,HI=0x3cd0000;
let done=false,readyAt=0;const blocks=[],calls=[];
globalThis.wzmBotArm=()=>{if(!readyAt){readyAt=Date.now();send({s:'botPlayerReadyArmed'});}};
function snapshot(){const n=at(0x54cafa8).readPointer().readS32(),slots=at(0x54cafb0).readPointer(),v=[];for(let i=0;i<Math.min(n,20);i++){const p=slots.add(i*8).readPointer();v.push(p.isNull()?null:{i,state:p.add(8).readU8()});}return v;}
Interceptor.attach(at(LO),{onEnter(a){
 if(!globalThis.wzmBotProbeActive)return;
 this.st=true;
 try{this.addr=Array.from(new Uint8Array(a[0].readByteArray(24)),x=>x.toString(16).padStart(2,'0')).join('');}catch(e){}
 const tid=Process.getCurrentThreadId();
 Stalker.follow(tid,{transform(it){
  let ins;
  while((ins=it.next())!==null){
   const off=ins.address.sub(base).toInt32();
   if(off>=LO&&off<HI){
    if(ins.mnemonic==='bl'||ins.mnemonic==='blr'){
     const tgt=ins.mnemonic==='bl'?ptr(ins.operands[0].value).sub(base).toInt32():-1;
     it.putCallout(c=>{if(calls.length<4000)calls.push([off,tgt===-1?c.pc.sub(base).toInt32():tgt]);});
    }
    if(ins.mnemonic.startsWith('b.')||['cbz','cbnz','tbz','tbnz','ret'].includes(ins.mnemonic)){
     it.putCallout(()=>{if(blocks.length<4000)blocks.push(off);});
    }
   }
   it.keep();
  }
 }});
},onLeave(r){
 if(!this.st)return;
 Stalker.unfollow(Process.getCurrentThreadId());Stalker.flush();
 send({s:'botStalkLeave',ret:r.toString(),addr:this.addr});
}});
Interceptor.attach(at(0x3cf10e0),{onEnter(){
 if(done)return;
 try{if(at(0x54bb7e8).readPointer().add(8).readU32()!==8)return;}catch(e){return;}
 if(!readyAt||Date.now()-readyAt<1500)return;
 done=true;
 try{
  if(at(0xcdcd9b0).readU32()!==2){send({s:'botConnectSkipped',reason:'inactive server'});return;}
  const before=snapshot();
  const d=defaults();const head=d.readS32(),body=d.add(4).readS32();
  globalThis.wzmBotProbeActive=true;let id;
  try{id=create(name,head,body,uint64(0));}finally{globalThis.wzmBotProbeActive=false;}
  setTimeout(()=>{
   const hx=x=>'0x'+x.toString(16);
   send({s:'botStalkTrace',blocks:blocks.map(hx),calls:calls.map(([a,b])=>hx(a)+'>'+hx(b))});
   send({s:'botConnectResult',identity:id.toString(),before,after:snapshot()});
  },300);
 }catch(e){send({s:'botConnectError',error:String(e),stack:e.stack});}
}});
send({s:'botConnectArmed',pid:Process.id});
}
