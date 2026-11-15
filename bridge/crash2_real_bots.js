// One Crash 2 bot pass. Party apply, then genuine marker-2 creators.
// The server-frame hook is detached by rpc.exports.stop after the bots are in.
// No Veteran respawn guard is left attached.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const opt=globalThis.WZM_CRASH2_BOTS||{},goal=opt.count===undefined?4:opt.count;
if(!Number.isInteger(goal)||goal<1||goal>4)throw Error('bot count must be 1..4');
const veneer=at(0x3cd7b20);
if(veneer.readU32()!==0x58000050||veneer.add(4).readU32()!==0xd61f0200)throw Error('server veneer mismatch');
if(at(0x3cd6960).readU32()!==0xd10243ff||at(0x3cd64e8).readU32()!==0xd10183ff||at(0x265ea3c).readU32()!==0xd10183ff)
 throw Error('bot function opcode mismatch');
const prior=veneer.add(8).readPointer();
const keep=[];
const gate=Memory.alloc(0x80),code=Memory.alloc(Process.pageSize),zero=Memory.alloc(0x400),req=Memory.alloc(32);
keep.push(gate,code,zero,req);Memory.protect(code,Process.pageSize,'rwx');
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
const hooks=[];
function restore(){try{Memory.patchCode(veneer.add(8),8,p=>p.writePointer(prior));}catch(e){}}
function detachAll(){restore();for(const h of hooks){try{h.detach();}catch(e){}}}
const getParty=new NativeFunction(at(0x1601ffc),'pointer',[]);
const apply=new NativeFunction(at(0x162a90c),'int',['pointer','pointer']);
const sendOrig=new NativeFunction(at(0x3b9eab4),'uint64',['pointer','pointer','pointer','pointer']);
const sendGuard=new NativeCallback((x0,x1,x2,x3)=>{if(x0.isNull())return uint64(0);return sendOrig(x0,x1,x2,x3);},'uint64',['pointer','pointer','pointer','pointer']);
keep.push(sendGuard);Interceptor.replace(at(0x3b9eab4),sendGuard);
hooks.push(Interceptor.attach(at(0x3baa1c4),{onLeave(r){if(r.isNull())return;if(r.compare(ptr('0x10000000'))<0||r.and(7).toInt32()!==0)r.replace(ptr(0));}}));
function slots(){const n=at(0x54cafa8).readPointer().readS32(),a=at(0x54cafb0).readPointer(),o=[];
 for(let i=0;i<Math.min(n,24);i++){const c=a.add(i*8).readPointer();if(c.isNull()||!c.add(8).readU8())continue;
  o.push({slot:i,client:c.toString(),state:c.add(8).readU8(),flag:c.add(0xb668).readU32()});}return o;}
function teamOf(slot){try{return at(0x54bfb78).readPointer().readPointer().add(slot*0x31270).add(0x7f20).readU8();}catch(e){return null;}}
const active=new Set();
for(const addr of [0x3cd64e8,0x3cd6960]) hooks.push(Interceptor.attach(at(addr),{onEnter(){active.add(Process.getCurrentThreadId());},onLeave(){active.delete(Process.getCurrentThreadId());}}));
hooks.push(Interceptor.attach(at(0x3ccc9b0),{onEnter(a){if(!active.has(Process.getCurrentThreadId()))return;const p=a[0];if(p.readU32()===0)p.writeByteArray([0,255,0,255,0,0]);p.add(6).writeU8(1);}}));
let armed=false,partyAt=0,stage=0,current=null,lastAt=0,primed=false,primeUsed=false;
const created=[],seen=new Set();
function queue(fn,args){if(gate.readU64().equals(1))throw Error('gate busy');
 gate.add(0x18).writePointer(at(fn));for(let i=0;i<4;i++)gate.add(0x20+i*8).writePointer(args[i]||ptr(0));
 gate.writeU64(1);lastAt=Date.now();}
function finish(row){stage=99;send(row);}
globalThis.wzmBotArm=()=>{
 if(armed)return;const rows=slots();
 if(!rows.some(r=>r.slot===0&&r.state===7))throw Error('local player not in world');
 rows.forEach(r=>seen.add(r.client));armed=true;send({s:'crash2Armed',goal,rows});
};
hooks.push(Interceptor.attach(at(0x337c1c0),{onEnter(){
 if(!armed||partyAt)return;partyAt=Date.now();
 try{const p=getParty();
  if(p.add(0x4650).readU64().equals(0))p.add(0x4650).writeU64(uint64('0x0f0f1ce5'));
  if(p.add(0x54).readU64().equals(0))p.add(0x54).writeU64(uint64('0x0f0f1ce5'));
  req.writeU32(0);req.add(4).writeS32(-1);req.add(8).writeS32(goal);req.add(12).writeU8(0);req.add(13).writeU8(1);
  const ret=apply(p,req);
  send({s:'crash2Party',applyRet:ret,gate:p.add(0x4650).readU32(),cap:p.add(0x54).readU32()});
 }catch(e){finish({s:'botInjectError',experiment:'crash2_real_bots',error:String(e)});}
}}));
hooks.push(Interceptor.attach(at(0x3cf10e0),{onEnter(){if(!partyAt||stage===99)return;try{
 if(gate.readU64().equals(1)){if(Date.now()-lastAt>8000)throw Error('gate timeout at stage '+stage);return;}
 if(Date.now()-partyAt<2000||Date.now()-lastAt<250)return;
 if(stage===0){
  try{const sv=at(0x54d1118).readPointer().readPointer();const id=sv.add(0x80).readU16();if(id<5)sv.add(0x80).writeU16(5);}catch(e){}
  if(created.length===goal){finish({s:'botInjectFinal',experiment:'crash2_real_bots',created,primeUsed,rows:slots()});return;}
  stage=10;queue(0x3cd6960,[names[created.length],ptr(0),ptr(0),ptr(0)]);return;}
 if(stage===10){const result=gate.add(8).readPointer(),rows=slots();
  const row=rows.find(r=>r.flag===2&&!seen.has(r.client));
  if(result.isNull()||!row){if(primeUsed)throw Error('creator returned no marker-2 client after prime');
   primeUsed=true;stage=20;queue(0x3cd64e8,[ptr(0),ptr(0),ptr(0),ptr(0)]);
   send({s:'crash2PrimeNeeded',result:result.toString(),rows});return;}
  primed=true;seen.add(row.client);current={slot:row.slot,client:row.client,kind:'ai'};stage=2;queue(0x3cd53bc,[ptr(row.client)]);return;}
 if(stage===20){const result=gate.add(8).readPointer(),rows=slots();
  const row=rows.find(r=>r.flag===1&&r.state===5&&!seen.has(r.client));
  if(result.isNull()||!row)throw Error('prime addtestclient returned no client');
  seen.add(row.client);ptr(row.client).add(0x280).writeU8(1);
  current={slot:row.slot,client:row.client,kind:'prime'};stage=2;queue(0x3cd53bc,[ptr(row.client)]);return;}
 if(stage===2){const row=slots().find(r=>r.client===current.client);
  if(!row||row.state!==6)throw Error('gamestate did not reach state 6');
  stage=3;queue(0x3cd0a00,[ptr(row.client),zero]);return;}
 if(stage===3){const row=slots().find(r=>r.client===current.client);
  if(!row||row.state!==7)throw Error('enterworld did not reach state 7');
  if(current.kind==='prime'){primed=true;current=null;stage=0;lastAt=Date.now();send({s:'crash2Primed',slot:row.slot});return;}
  if(row.flag!==2)throw Error('real bot lost marker 2');
  const ai=ptr(row.client).add(0x6c0).readPointer();if(ai.isNull())throw Error('AI pointer missing');
  current.ai=ai.toString();stage=4;queue(0x265ea3c,[ai,ptr(3)]);return;}
 if(stage===4){const ai=ptr(current.ai),df=ai.add(0xb258).readU8();
  if(df!==3)throw Error('Veteran readback failed');
  created.push({slot:current.slot,team:teamOf(current.slot),difficulty:df});
  send({s:'crash2Veteran',slot:current.slot,team:teamOf(current.slot)});
  current=null;stage=0;lastAt=Date.now();}
}catch(e){finish({s:'botInjectError',experiment:'crash2_real_bots',error:String(e),created,rows:slots()});}}}));
rpc.exports={stop(){detachAll();return true;}};
send({s:'crash2Loaded',pid:Process.id,goal,guardThunk:prior.toString()});
}
