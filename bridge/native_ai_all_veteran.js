// Apply original Veteran AI setter to every active genuine AI bot, both teams.
// Existing tested host + party-network guards must remain retained.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n),keep=globalThis.wzmNativeAiDifficultyKeep=[];
const v=at(0x3cd7b20);if(v.readU32()!==0x58000050||v.add(4).readU32()!==0xd61f0200)throw Error('server veneer mismatch');
if(at(0x265ea3c).readU32()!==0xd10183ff)throw Error('difficulty setter opcode mismatch');
const prior=v.add(8).readPointer(),gate=Memory.alloc(80),code=Memory.alloc(Process.pageSize),name=Memory.allocUtf8String(''),zero=Memory.alloc(0x400);
keep.push(gate,code,name,zero);Memory.protect(code,Process.pageSize,'rwx');
{const w=new Arm64Writer(code,{pc:code});w.putPushRegReg('x29','lr');for(const[x,y]of[['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
w.putLdrRegAddress('x16',gate);w.putLdrRegRegOffset('x17','x16',0);w.putCbzRegLabel('x17','skip');w.putStrRegRegOffset('xzr','x16',0);
for(let i=0;i<4;i++)w.putLdrRegRegOffset('x'+i,'x16',0x20+i*8);w.putLdrRegRegOffset('x16','x16',0x18);w.putBlrReg('x16');w.putLdrRegAddress('x16',gate);w.putStrRegRegOffset('x0','x16',8);w.putLabel('skip');for(const[x,y]of[['x6','x7'],['x4','x5'],['x2','x3'],['x0','x1']])w.putPopRegReg(x,y);w.putPopRegReg('x29','lr');w.putLdrRegAddress('x16',prior);w.putBrReg('x16');w.flush();}
Memory.patchCode(v.add(8),8,p=>p.writePointer(code));
function restore(){Memory.patchCode(v.add(8),8,p=>p.writePointer(prior));}
function slots(){const n=at(0x54cafa8).readPointer().readS32(),a=at(0x54cafb0).readPointer(),o=[];for(let i=0;i<Math.min(n,20);i++){const c=a.add(i*8).readPointer();if(c.isNull()||!c.add(8).readU8())continue;const ai=c.add(0x6c0).readPointer();o.push({slot:i,client:c.toString(),state:c.add(8).readU8(),flag:c.add(0xb668).readU32(),ai:ai.toString()});}return o;}
let armed=false,stage=0,waitAt=0,client=null,slot=-1,pending=null;const applied=[];const before=new Set(slots().map(x=>x.client));
function queue(fn,args){gate.add(0x18).writePointer(at(fn));for(let i=0;i<4;i++)gate.add(0x20+i*8).writePointer(args[i]||ptr(0));gate.writeU64(1);waitAt=Date.now();}
globalThis.wzmBotArm=()=>{armed=true;send({s:'nativeAiDifficultyArmed',pid:Process.id,before:slots()});};
Interceptor.attach(at(0x3cf10e0),{onEnter(){if(!armed||stage===9)return;try{
 if(gate.readU64().equals(1)||Date.now()-waitAt<250)return;
 if(stage===0){if(pending===null)pending=slots().filter(r=>r.flag===2);if(!pending.length){stage=9;restore();send({s:'botInjectFinal',experiment:'all_native_ai_veteran',applied,rows:slots()});return;}const row=pending.shift();client=ptr(row.client);slot=row.slot;const ai=client.add(0x6c0).readPointer();if(ai.isNull()||!Process.findRangeByAddress(ai))throw Error('AI data absent');send({s:'nativeAiDifficultyBefore',slot,ai:ai.toString(),difficulty:ai.add(0xb258).readU8()});stage=1;queue(0x265ea3c,[ai,ptr(3)]);return;}
 if(stage===1){const ai=client.add(0x6c0).readPointer(),value=ai.add(0xb258).readU8();if(value!==3)throw Error('Veteran readback mismatch');const g=at(0x54bfb78).readPointer().readPointer().add(slot*0x31270);applied.push({slot,team:g.add(0x7f20).readU8(),difficulty:value,label:'Veteran'});stage=0;}


 }catch(e){stage=9;restore();send({s:'botInjectError',experiment:'all_native_ai_veteran',error:String(e),rows:slots()});}}});
send({s:'nativeAiDifficultyLoaded',pid:Process.id,code:code.toString(),gate:gate.toString()});
}
