// Add more genuine marker-2 AIs in a match that already has one.
// Chains in front of the current server thunk, which is the Veteran guard,
// and links that thunk back when finished. Does not remove the guard.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const opt=globalThis.WZM_MORE_AI||{},goal=opt.count===undefined?3:opt.count;
if(!Number.isInteger(goal)||goal<1||goal>6)throw Error('extra AI count must be 1..6');
const veneer=at(0x3cd7b20);
if(veneer.readU32()!==0x58000050||veneer.add(4).readU32()!==0xd61f0200)throw Error('server veneer mismatch');
// 0x3cd6960 and 0x265ea3c may already be Frida trampolines from the live trial. Calling them still runs the original.
const prior=veneer.add(8).readPointer();
const keep=globalThis.wzmMoreAiKeep=[];
const gate=Memory.alloc(0x80),code=Memory.alloc(Process.pageSize),zero=Memory.alloc(0x400);
keep.push(gate,code,zero);Memory.protect(code,Process.pageSize,'rwx');
const names=[];
for(let i=0;i<goal;i++){const nm=Memory.allocUtf8String('');keep.push(nm);names.push(nm);}
{const w=new Arm64Writer(code,{pc:code});
 w.putPushRegReg('x29','lr');
 for(const [x,y] of [['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
 w.putLdrRegAddress('x16',gate);w.putLdrRegRegOffset('x17','x16',0);w.putCbzRegLabel('x17','skip');
 w.putStrRegRegOffset('xzr','x16',0);
 for(let i=0;i<4;i++)w.putLdrRegRegOffset('x'+i,'x16',0x20+i*8);
 w.putLdrRegRegOffset('x16','x16',0x18);w.putBlrReg('x16');
 w.putLdrRegAddress('x16',gate);w.putStrRegRegOffset('x0','x16',8);
 w.putLabel('skip');
 for(const [x,y] of [['x6','x7'],['x4','x5'],['x2','x3'],['x0','x1']])w.putPopRegReg(x,y);
 w.putPopRegReg('x29','lr');
 w.putLdrRegAddress('x16',prior);w.putBrReg('x16');w.flush();}
Memory.patchCode(veneer.add(8),8,p=>p.writePointer(code));
function restore(){Memory.patchCode(veneer.add(8),8,p=>p.writePointer(prior));}
function slots(){const n=at(0x54cafa8).readPointer().readS32(),a=at(0x54cafb0).readPointer(),o=[];
 for(let i=0;i<Math.min(n,24);i++){const c=a.add(i*8).readPointer();if(c.isNull()||!c.add(8).readU8())continue;
  const ai=c.add(0x6c0).readPointer();o.push({slot:i,client:c.toString(),state:c.add(8).readU8(),flag:c.add(0xb668).readU32(),ai:ai.isNull()?'0':ai.toString()});}return o;}
function teamOf(slot){try{return at(0x54bfb78).readPointer().readPointer().add(slot*0x31270).add(0x7f20).readU8();}catch(e){return null;}}
const active=new Set();
Interceptor.attach(at(0x3cd6960),{onEnter(){active.add(Process.getCurrentThreadId());},onLeave(){active.delete(Process.getCurrentThreadId());}});
Interceptor.attach(at(0x3ccc9b0),{onEnter(a){if(!active.has(Process.getCurrentThreadId()))return;const p=a[0];if(p.readU32()===0)p.writeByteArray([0,255,0,255,0,0]);p.add(6).writeU8(1);send({s:'moreAiConnectionGuard'});}});
let armed=false,stage=0,current=null,lastAt=0;
const created=[],seen=new Set();
function queue(fn,args){if(gate.readU64().equals(1))throw Error('gate busy');
 gate.add(0x18).writePointer(at(fn));for(let i=0;i<4;i++)gate.add(0x20+i*8).writePointer(args[i]||ptr(0));
 gate.writeU64(1);lastAt=Date.now();}
globalThis.wzmBotArm=()=>{
 if(armed)return;const rows=slots();
 if(!rows.some(r=>r.slot===0&&r.state===7))throw Error('local player not in world');
 rows.forEach(r=>seen.add(r.client));armed=true;
 send({s:'moreAiArmed',pid:Process.id,goal,already:rows.filter(r=>r.flag===2).length,rows});
};
Interceptor.attach(at(0x3cf10e0),{onEnter(){if(!armed||stage===99)return;try{
 if(gate.readU64().equals(1)){if(Date.now()-lastAt>8000)throw Error('gate timeout at stage '+stage);return;}
 if(Date.now()-lastAt<250)return;
 if(stage===0){
  if(created.length===goal){stage=99;restore();send({s:'botInjectFinal',experiment:'more_native_ai',created,rows:slots()});return;}
  stage=1;queue(0x3cd6960,[names[created.length],ptr(0),ptr(0),ptr(0)]);return;}
 if(stage===1){const result=gate.add(8).readPointer(),rows=slots();
  const row=rows.find(r=>r.flag===2&&!seen.has(r.client));
  send({s:'moreAiCreated',result:result.toString(),rows});
  if(result.isNull()||!row)throw Error('creator returned no new marker-2 client');
  seen.add(row.client);current={slot:row.slot,client:row.client};stage=2;queue(0x3cd53bc,[ptr(row.client)]);return;}
 if(stage===2){const row=slots().find(r=>r.client===current.client);
  if(!row||row.state!==6)throw Error('gamestate did not reach state 6');
  stage=3;queue(0x3cd0a00,[ptr(row.client),zero]);return;}
 if(stage===3){const row=slots().find(r=>r.client===current.client);
  if(!row||row.state!==7||row.flag!==2)throw Error('enterworld state/marker mismatch');
  const ai=ptr(row.ai);if(ai.isNull())throw Error('AI pointer missing after enter');
  stage=4;queue(0x265ea3c,[ai,ptr(3)]);return;}
 if(stage===4){const row=slots().find(r=>r.client===current.client),ai=ptr(row.ai),df=ai.add(0xb258).readU8();
  if(df!==3)throw Error('Veteran readback failed');
  created.push({slot:row.slot,team:teamOf(row.slot),difficulty:df});
  send({s:'moreAiVeteran',slot:row.slot,team:teamOf(row.slot),difficulty:df});
  current=null;stage=0;lastAt=Date.now();}
}catch(e){stage=99;restore();send({s:'botInjectError',experiment:'more_native_ai',error:String(e),created,rows:slots()});}}});
send({s:'moreAiLoaded',pid:Process.id,goal,guardThunk:prior.toString()});
}
