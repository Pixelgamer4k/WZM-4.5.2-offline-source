// One genuine AI-client creation through original script-wrapper target.
// Existing tested host + party-network guards must remain retained.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n),keep=globalThis.wzmNativeAiTrialKeep=[];
const v=at(0x3cd7b20);if(v.readU32()!==0x58000050||v.add(4).readU32()!==0xd61f0200)throw Error('server veneer mismatch');
if(at(0x3cd6960).readU32()!==0xd10243ff)throw Error('creator opcode mismatch');
const prior=v.add(8).readPointer(),gate=Memory.alloc(80),code=Memory.alloc(Process.pageSize),name=Memory.allocUtf8String(''),zero=Memory.alloc(0x400);
keep.push(gate,code,name,zero);Memory.protect(code,Process.pageSize,'rwx');
{const w=new Arm64Writer(code,{pc:code});w.putPushRegReg('x29','lr');for(const[x,y]of[['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
w.putLdrRegAddress('x16',gate);w.putLdrRegRegOffset('x17','x16',0);w.putCbzRegLabel('x17','skip');w.putStrRegRegOffset('xzr','x16',0);
for(let i=0;i<4;i++)w.putLdrRegRegOffset('x'+i,'x16',0x20+i*8);w.putLdrRegRegOffset('x16','x16',0x18);w.putBlrReg('x16');w.putLdrRegAddress('x16',gate);w.putStrRegRegOffset('x0','x16',8);w.putLabel('skip');for(const[x,y]of[['x6','x7'],['x4','x5'],['x2','x3'],['x0','x1']])w.putPopRegReg(x,y);w.putPopRegReg('x29','lr');w.putLdrRegAddress('x16',prior);w.putBrReg('x16');w.flush();}
Memory.patchCode(v.add(8),8,p=>p.writePointer(code));
function restore(){Memory.patchCode(v.add(8),8,p=>p.writePointer(prior));}
function slots(){const n=at(0x54cafa8).readPointer().readS32(),a=at(0x54cafb0).readPointer(),o=[];for(let i=0;i<Math.min(n,20);i++){const c=a.add(i*8).readPointer();if(c.isNull()||!c.add(8).readU8())continue;const ai=c.add(0x6c0).readPointer();o.push({slot:i,client:c.toString(),state:c.add(8).readU8(),flag:c.add(0xb668).readU32(),ai:ai.toString()});}return o;}
const active=new Set();
Interceptor.attach(at(0x3cd6960),{onEnter(){active.add(Process.getCurrentThreadId());},onLeave(){active.delete(Process.getCurrentThreadId());}});
Interceptor.attach(at(0x3ccc9b0),{onEnter(a){if(!active.has(Process.getCurrentThreadId()))return;const p=a[0];if(p.readU32()===0)p.writeByteArray([0,255,0,255,0,0]);p.add(6).writeU8(1);send({s:'nativeAiConnectionAddressGuard'});}});
let armed=false,stage=0,waitAt=0,client=null,slot=-1;const before=new Set(slots().map(x=>x.client));
function queue(fn,args){gate.add(0x18).writePointer(at(fn));for(let i=0;i<4;i++)gate.add(0x20+i*8).writePointer(args[i]||ptr(0));gate.writeU64(1);waitAt=Date.now();}
globalThis.wzmBotArm=()=>{armed=true;send({s:'nativeAiBotArmed',pid:Process.id,before:slots()});};
Interceptor.attach(at(0x3cf10e0),{onEnter(){if(!armed||stage===9)return;try{
 if(stage===0){stage=1;queue(0x3cd6960,[name,ptr(0),ptr(0),ptr(0)]);return;}
 if(gate.readU64().equals(1)||Date.now()-waitAt<250)return;
 if(stage===1){const rows=slots(),row=rows.find(r=>!before.has(r.client)&&r.flag===2);send({s:'nativeAiCreated',entity:gate.add(8).readPointer().toString(),rows});if(!row)throw Error('original creator did not return new AI-marked client');client=ptr(row.client);slot=row.slot;const ai=client.add(0x6c0).readPointer();if(ai.isNull()||!Process.findRangeByAddress(ai))throw Error('native AI allocation missing');stage=2;queue(0x3cd53bc,[client]);return;}
 if(stage===2){send({s:'nativeAiGamestate',slot,rows:slots()});stage=3;queue(0x3cd0a00,[client,zero]);return;}
 if(stage===3){stage=9;restore();send({s:'botInjectFinal',experiment:'original_ai_creator',slot,rows:slots()});}
 }catch(e){stage=9;restore();send({s:'botInjectError',experiment:'original_ai_creator',error:String(e),rows:slots()});}}});
send({s:'nativeAiTrialLoaded',pid:Process.id,code:code.toString(),gate:gate.toString()});
}
