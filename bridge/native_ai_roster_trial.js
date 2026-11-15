// Genuine WZM4.5 native-AI roster.
// The real creator 0x3cd6960 resolves its new client through the same address
// hash as addtestclient. A first direct call left a state-5 client with marker
// 0 and returned null, so the match had no enemy. Prime one original
// addtestclient through gamestate and enter-world first, which is the live
// order that produced the confirmed marker-2 enemy, then create the roster.
// Load only after the original player has entered Nuketown. The host's
// 0x3cd7b20 veneer and its server/network guards must remain installed.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const opt=globalThis.WZM_NATIVE_AI_ROSTER||{},goal=opt.count===undefined?2:opt.count;
if(!Number.isInteger(goal)||goal<1||goal>8)throw Error('bot roster size must be 1..8');
const difficulty=3; // Native Veteran; original values 0..3 use the parameter table.
const veneer=at(0x3cd7b20);
if(veneer.readU32()!==0x58000050||veneer.add(4).readU32()!==0xd61f0200)throw Error('server gate veneer missing');
for(const [addr,opcode,label] of [[0x3cd64e8,0xd10183ff,'addtestclient'],[0x3cd6960,0xd10243ff,'native AI creator'],[0x265ea3c,0xd10183ff,'Veteran setter']])
 if(at(addr).readU32()!==opcode)throw Error(label+' original opcode mismatch');
const prior=veneer.add(8).readPointer();
const keep=globalThis.wzmNativeRosterKeep=[];
const gate=Memory.alloc(0x80),code=Memory.alloc(Process.pageSize),zero=Memory.alloc(0x400);
keep.push(gate,code,zero);Memory.protect(code,Process.pageSize,'rwx');
const names=[];for(let i=0;i<goal;i++){const nm=Memory.allocUtf8String('');keep.push(nm);names.push(nm);}
// All registers used by the call are restored before the original host thunk.
{const w=new Arm64Writer(code,{pc:code});w.putPushRegReg('x29','lr');
 for(const [x,y] of [['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
 w.putLdrRegAddress('x16',gate);w.putLdrRegRegOffset('x17','x16',0);
 w.putCbzRegLabel('x17','skip');w.putStrRegRegOffset('xzr','x16',0);
 for(let i=0;i<4;i++)w.putLdrRegRegOffset('x'+i,'x16',0x20+i*8);
 w.putLdrRegRegOffset('x16','x16',0x18);w.putBlrReg('x16');
 w.putLdrRegAddress('x16',gate);w.putStrRegRegOffset('x0','x16',8);
 w.putLabel('skip');
 for(const [x,y] of [['x6','x7'],['x4','x5'],['x2','x3'],['x0','x1']])w.putPopRegReg(x,y);
 w.putPopRegReg('x29','lr');w.putLdrRegAddress('x16',prior);w.putBrReg('x16');w.flush();}
Memory.patchCode(veneer.add(8),8,p=>p.writePointer(code));
let restored=false;
function restore(){if(!restored){Memory.patchCode(veneer.add(8),8,p=>p.writePointer(prior));restored=true;}}
function slots(){const count=at(0x54cafa8).readPointer().readS32(),arr=at(0x54cafb0).readPointer();
 if(count<1||count>32)throw Error('server slot count outside verified bounds');const rows=[];
 for(let i=0;i<count;i++){const c=arr.add(i*8).readPointer();if(c.isNull())continue;
  const state=c.add(8).readU8();if(state===0)continue;
  const flag=c.add(0xb668).readU32(),ai=c.add(0x6c0).readPointer();
  rows.push({slot:i,client:c.toString(),state,flag,ai:ai.toString()});}
 return rows;}
function aiOf(row){if(row.flag!==2||row.state!==7)throw Error('not an entered native AI client');
 const ai=ptr(row.ai);if(ai.isNull()||!Process.findRangeByAddress(ai.add(0xb258)))throw Error('AI data missing or unmapped');
 return ai;}
function teamOf(slot){const root=at(0x54bfb78).readPointer().readPointer();if(root.isNull())return null;
 return root.add(slot*0x31270+0x7f20).readU8();}
const active=new Set();
function track(addr){Interceptor.attach(at(addr),{onEnter(){active.add(Process.getCurrentThreadId());},onLeave(){active.delete(Process.getCurrentThreadId());}});}
track(0x3cd64e8);track(0x3cd6960);
Interceptor.attach(at(0x3ccc9b0),{onEnter(a){if(!active.has(Process.getCurrentThreadId()))return;
 const address=a[0];if(address.readU32()===0)address.writeByteArray([0,255,0,255,0,0]);
 address.add(6).writeU8(1);send({s:'nativeRosterConnectionGuard'});}});
let armed=false,stage=0,created=[],current=null,seen=new Set(),lastAt=0,lastScan=0,partyReady=false,counterReady=false,primed=false;
// The original offline party has no remote session; both fields were validated
// by the existing successful party_bot_inject.js experiment. Prepare them on
// the real LUI frame, without allocating test clients or party bot records.
const getParty=new NativeFunction(at(0x1601ffc),'pointer',[]);
Interceptor.attach(at(0x337c1c0),{onEnter(){if(!armed||partyReady)return;try{
 const p=getParty();if(p.isNull())throw Error('party unavailable');
 const old4650=p.add(0x4650).readU64(),old54=p.add(0x54).readU64();
 if(old4650.equals(0))p.add(0x4650).writeU64(uint64('0x0f0f1ce5'));
 if(old54.equals(0))p.add(0x54).writeU64(uint64('0x0f0f1ce5'));
 partyReady=true;send({s:'nativeRosterPartyPrepared',old4650:old4650.toString(),old54:old54.toString()});
 }catch(e){send({s:'nativeRosterPartyError',error:String(e)});}}});
const maxStageWait=12000;
function queue(fn,args){if(gate.readU64().equals(1))throw Error('server gate still busy');
 gate.add(0x18).writePointer(at(fn));for(let i=0;i<4;i++)gate.add(0x20+i*8).writePointer(args[i]||ptr(0));
 gate.writeU64(1);lastAt=Date.now();}
function doneRows(){let rows;try{rows=slots();}catch(e){return [{snapshotError:String(e)}];}
 return created.map(c=>{const r=rows.find(x=>x.client===c.client);
 if(!r)return {slot:c.slot,missing:true};let df=null,team=null;
 try{df=aiOf(r).add(0xb258).readU8();}catch(_){}
 try{team=teamOf(r.slot);}catch(_){}
 return {slot:r.slot,state:r.state,marker:r.flag,team,difficulty:df};});}
// The watcher must restore the native veneer before unloading this script:
// otherwise the original server frame would jump to a freed Frida code page.
rpc.exports={stop(){if(gate.readU64().equals(1))return {stopped:false,busy:true};
 stage=99;restore();return {stopped:true,created:doneRows()};}};
globalThis.wzmBotArm=()=>{if(armed)return;const rows=slots();if(!rows.some(r=>r.slot===0&&r.state===7))throw Error('local player not yet in world');
 seen=new Set(rows.map(r=>r.client));armed=true;send({s:'nativeRosterArmed',pid:Process.id,goal,initial:rows});};
// Stage 10..12 primes one marker-1 client. Stage 0/1 creates each marker-2 AI,
// 2/3 brings it through gamestate and enter-world, 4 applies Veteran, and 8
// keeps Veteran on every live native AI. No other agent owns this veneer.
Interceptor.attach(at(0x3cf10e0),{onEnter(){if(!armed||stage===99)return;
 try{
  if(gate.readU64().equals(1)){
   if(Date.now()-lastAt>maxStageWait)throw Error('server gate timed out at stage '+stage);
   return;
  }
  if(Date.now()-lastAt<250)return;
  if(stage===0){if(!partyReady)return;
   if(!counterReady){const svroot=at(0x54d1118).readPointer(),sv=svroot.readPointer();
    if(sv.isNull())throw Error('server counter root missing');
    const id=sv.add(0x80).readU16();if(id<5){sv.add(0x80).writeU16(5);send({s:'nativeRosterCounterAdvanced',from:id,to:5});}
    counterReady=true;}
   if(!primed){stage=10;queue(0x3cd64e8,[ptr(0),ptr(0),ptr(0),ptr(0)]);return;}
   if(created.length===goal){stage=8;lastScan=0;
    send({s:'botInjectFinal',experiment:'native_roster_veteran',created:doneRows()});return;}
   stage=1;queue(0x3cd6960,[names[created.length],ptr(0),ptr(0),ptr(0)]);return;}
  if(stage===10){const result=gate.add(8).readPointer(),rows=slots();
   const row=rows.find(r=>r.flag===1&&r.state===5&&!seen.has(r.client));
   send({s:'nativeRosterPrime',result:result.toString(),rows});
   if(result.isNull()||!row)throw Error('addtestclient returned no marker-1 state-5 client');
   seen.add(row.client);ptr(row.client).add(0x280).writeU8(1);
   current={slot:row.slot,client:row.client};stage=11;queue(0x3cd53bc,[ptr(row.client)]);return;}
  if(stage===11){const row=slots().find(r=>r.client===current.client);
   if(!row||row.state!==6)throw Error('prime gamestate must enter state 6');
   stage=12;queue(0x3cd0a00,[ptr(row.client),zero]);return;}
  if(stage===12){const row=slots().find(r=>r.client===current.client);
   if(!row||row.state!==7||row.flag!==1)throw Error('prime enterworld state/marker mismatch');
   send({s:'nativeRosterPrimed',slot:row.slot,marker:row.flag});
   primed=true;current=null;stage=0;lastAt=Date.now();return;}
  if(stage===1){const result=gate.add(8).readPointer(),rows=slots();
   const row=rows.find(r=>r.flag===2&&r.state===5&&!seen.has(r.client));
   if(result.isNull()||!row){send({s:'nativeRosterCreateMiss',result:result.toString(),rows});
    throw Error('native creator returned no distinct marker-2 state-5 client');}
   if(ptr(row.ai).isNull())throw Error('original native AI allocation absent');
   current={slot:row.slot,client:row.client,entity:result.toString()};seen.add(row.client);
   send({s:'nativeRosterCreated',...current,rows});stage=2;queue(0x3cd53bc,[ptr(row.client)]);return;}
  if(stage===2){const row=slots().find(r=>r.client===current.client);
   if(!row||row.state!==6)throw Error('native bot gamestate must enter state 6');
   stage=3;queue(0x3cd0a00,[ptr(row.client),zero]);return;}
  if(stage===3){const row=slots().find(r=>r.client===current.client);
   if(!row||row.state!==7||row.flag!==2)throw Error('native bot enterworld state/marker mismatch');
   const ai=aiOf(row);send({s:'nativeRosterEntered',slot:row.slot,marker:row.flag,team:teamOf(row.slot),ai:ai.toString(),beforeDifficulty:ai.add(0xb258).readU8()});
   stage=4;queue(0x265ea3c,[ai,ptr(difficulty)]);return;}
  if(stage===4){const row=slots().find(r=>r.client===current.client),ai=aiOf(row);
   if(ai.add(0xb258).readU8()!==difficulty)throw Error('native Veteran setter readback failed');
   created.push(current);send({s:'nativeRosterVeteran',slot:row.slot,team:teamOf(row.slot),difficulty});
   current=null;stage=0;lastAt=Date.now();return;}
  if(stage===8){if(Date.now()-lastScan<1000)return;lastScan=Date.now();
   for(const row of slots().filter(r=>r.flag===2&&r.state===7)){
    const ai=aiOf(row);if(ai.add(0xb258).readU8()===difficulty)continue;
    current={slot:row.slot,client:row.client};stage=9;
    send({s:'nativeRosterDifficultyReset',slot:row.slot,previous:ai.add(0xb258).readU8()});
    queue(0x265ea3c,[ai,ptr(difficulty)]);return;}
  }
  if(stage===9){const row=slots().find(r=>r.client===current.client),ai=aiOf(row);
   if(ai.add(0xb258).readU8()!==difficulty)throw Error('Veteran respawn readback mismatch');
   send({s:'nativeRosterVeteranReapplied',slot:row.slot,team:teamOf(row.slot),difficulty});stage=8;current=null;}
 }catch(e){stage=99;restore();send({s:'botInjectError',experiment:'native_roster_veteran',error:String(e),created:doneRows()});}
}});
send({s:'nativeRosterLoaded',pid:Process.id,goal,serverThunk:code.toString(),gate:gate.toString()});
}
