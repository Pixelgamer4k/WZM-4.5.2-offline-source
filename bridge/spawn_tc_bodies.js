// Give the already-connected marker-1 clients the original body init they skipped.
// Enter-world calls 0x267af98 only when client+0xb668 is 2. tcBot5 and tcBot8
// are marker 1, so they reached state 7 with no body. Their AI, entity and
// entity+0x178 pointers are live and mapped. Do not change the marker.
// Chains in front of the Veteran guard and links that thunk back afterward.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const veneer=at(0x3cd7b20);
if(veneer.readU32()!==0x58000050||veneer.add(4).readU32()!==0xd61f0200)throw Error('server veneer mismatch');
if(at(0x267af98).readU32()!==0xd10303ff)throw Error('body init opcode mismatch');
const prior=veneer.add(8).readPointer();
const keep=globalThis.wzmTcBodyKeep=[];
const gate=Memory.alloc(0x80),code=Memory.alloc(Process.pageSize);
keep.push(gate,code);Memory.protect(code,Process.pageSize,'rwx');
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
function nameOf(c){try{const s=c.add(774).readCString();return s?s.split('\\')[0]:null;}catch(e){return null;}}
function ready(c){
 const ai=c.add(0x6c0).readPointer(),ent=c.add(0x278).readPointer();
 if(ai.isNull()||ent.isNull()||!Process.findRangeByAddress(ai)||!Process.findRangeByAddress(ent))return false;
 const box=ent.add(0x178).readPointer();
 return !box.isNull()&&!!Process.findRangeByAddress(box);
}
function targets(){
 const n=at(0x54cafa8).readPointer().readS32(),a=at(0x54cafb0).readPointer(),o=[];
 for(let i=0;i<Math.min(n,24);i++){
  const c=a.add(i*8).readPointer();
  if(c.isNull()||c.add(8).readU8()!==7||c.add(0xb668).readU32()!==1)continue;
  const name=nameOf(c);
  if(name!=='tcBot5'&&name!=='tcBot8')continue;
  o.push({slot:i,client:c.toString(),name,ready:ready(c)});}
 return o;
}
let armed=false,stage=0,queueList=[],current=null,lastAt=0;const done=[];
function queue(client){gate.add(0x18).writePointer(at(0x267af98));for(let i=0;i<4;i++)gate.add(0x20+i*8).writePointer(i?ptr(0):client);gate.writeU64(1);lastAt=Date.now();}
globalThis.wzmBotArm=()=>{
 const rows=targets();
 if(!rows.length)throw Error('tcBot5 and tcBot8 are not both in the world');
 if(rows.some(r=>!r.ready))throw Error('body init pointers are not mapped');
 queueList=rows;armed=true;send({s:'tcBodyArmed',rows,guardThunk:prior.toString()});
};
Interceptor.attach(at(0x3cf10e0),{onEnter(){if(!armed||stage===99)return;try{
 if(gate.readU64().equals(1)){if(Date.now()-lastAt>8000)throw Error('body init timed out');return;}
 if(Date.now()-lastAt<250)return;
 if(!current){if(!queueList.length){stage=99;restore();send({s:'botInjectFinal',experiment:'tc_body_init',done,rows:targets()});return;}
  current=queueList.shift();stage=1;queue(ptr(current.client));return;}
 const c=ptr(current.client),ai=c.add(0x6c0).readPointer(),ent=c.add(0x278).readPointer();
 const linked=ai.readPointer().equals(ent),mark=c.add(0x7e140).readU8();
 if(!linked||mark!==1)throw Error(current.name+' init readback failed');
 done.push({slot:current.slot,name:current.name,marker:c.add(0xb668).readU32(),linked:true,mark});
 send({s:'tcBodyReady',...done[done.length-1]});
 current=null;lastAt=Date.now();
}catch(e){stage=99;restore();send({s:'botInjectError',experiment:'tc_body_init',error:String(e),done});}}});
send({s:'tcBodyLoaded',pid:Process.id});
}
