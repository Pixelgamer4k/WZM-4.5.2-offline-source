// Minimal roster occupant: create ONE genuine marker-2 client on team 1 and take it
// only as far as enter-world. No class select, no Veteran setter, no difficulty write,
// no further hooks. Purpose: does a non-simulating roster occupant stop the enemy-team
// forfeit without paying the AI frame cost?
// Read-only reporting afterwards; the only writes are the original creator/enter-world
// calls themselves.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const veneer=at(0x3cd7b20);
if(veneer.readU32()!==0x58000050||veneer.add(4).readU32()!==0xd61f0200)throw Error('server veneer mismatch');
if(at(0x3cd6960).readU32()!==0xd10243ff)throw Error('creator opcode mismatch');
const prior=veneer.add(8).readPointer();
const keep=globalThis.wzmObserverKeep=[];
const gate=Memory.alloc(0x80),code=Memory.alloc(Process.pageSize),zero=Memory.alloc(0x400),nm=Memory.allocUtf8String('');
keep.push(gate,code,zero,nm);Memory.protect(code,Process.pageSize,'rwx');
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
  o.push({slot:i,client:c.toString(),state:c.add(8).readU8(),flag:c.add(0xb668).readU32(),c280:c.add(0x280).readU8()});}return o;}
function gfield(slot){try{const g=at(0x54bfb78).readPointer().readPointer().add(slot*0x31270).add(0x79b8);
 return {g10:g.add(0x10).readU8(),g79b8:g.add(0x79b8).readU8(),team:g.add(0x7f20).readU8()};}catch(e){return null;}}
const active=new Set();
Interceptor.attach(at(0x3cd6960),{onEnter(){active.add(Process.getCurrentThreadId());},onLeave(){active.delete(Process.getCurrentThreadId());}});
Interceptor.attach(at(0x3ccc9b0),{onEnter(a){if(!active.has(Process.getCurrentThreadId()))return;const p=a[0];if(p.readU32()===0)p.writeByteArray([0,255,0,255,0,0]);p.add(6).writeU8(1);send({s:'observerConnGuard'});}});
let armed=false,stage=0,current=null,lastAt=0;
const seen=new Set();
function queue(fn,args){if(gate.readU64().equals(1))throw Error('gate busy');
 gate.add(0x18).writePointer(at(fn));for(let i=0;i<4;i++)gate.add(0x20+i*8).writePointer(args[i]||ptr(0));
 gate.writeU64(1);lastAt=Date.now();}
globalThis.wzmBotArm=()=>{
 if(armed)return;const rows=slots();
 if(!rows.some(r=>r.slot===0&&r.state===7))throw Error('local player not in world');
 rows.forEach(r=>seen.add(r.client));armed=true;
 send({s:'observerArmed',pid:Process.id,rows});};
Interceptor.attach(at(0x3cf10e0),{onEnter(){if(!armed||stage===99)return;try{
 if(gate.readU64().equals(1)){if(Date.now()-lastAt>8000)throw Error('gate timeout at stage '+stage);return;}
 if(Date.now()-lastAt<400)return;
 if(stage===0){stage=1;queue(0x3cd6960,[nm,ptr(0),ptr(0),ptr(0)]);return;}
 if(stage===1){const result=gate.add(8).readPointer(),rows=slots();
  const row=rows.find(r=>r.flag===2&&!seen.has(r.client));
  if(result.isNull()||!row)throw Error('creator returned no marker-2 client');
  seen.add(row.client);current={slot:row.slot,client:row.client};
  send({s:'observerCreated',slot:row.slot,client:row.client,state:row.state});
  stage=2;queue(0x3cd53bc,[ptr(row.client)]);return;}
 if(stage===2){const row=slots().find(r=>r.client===current.client);
  if(!row||row.state!==6)throw Error('gamestate did not reach state 6');
  stage=3;queue(0x3cd0a00,[ptr(row.client),zero]);return;}
 if(stage===3){const row=slots().find(r=>r.client===current.client);
  if(!row||row.state!==7)throw Error('enterworld did not reach state 7');
  stage=99;restore();
  send({s:'botInjectFinal',experiment:'observer_occupant',slot:row.slot,fields:gfield(row.slot),rows:slots(),
    note:'entered world only; no class, no Veteran setter, no difficulty write'});return;}
}catch(e){stage=99;restore();send({s:'botInjectError',experiment:'observer_occupant',error:String(e),rows:slots()});}}});
send({s:'observerLoaded',pid:Process.id,guardThunk:prior.toString()});
}
