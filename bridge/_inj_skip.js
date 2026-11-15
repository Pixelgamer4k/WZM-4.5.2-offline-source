globalThis.WZM_BOT_ENV={skipParty:true};
// Offline bot injection experiment (memory-only, one shot).
// Real path: Lobby.AddBots -> 0x1604408 -> local apply 0x162a90c (pa_manage_bots)
//   -> party bot members; game script -> addtestclient 0x3cd64e8 -> 0x3cd6670 -> 0x3ccc9b0.
// Offline, the local party has no session: party+0x4650 and party+0x54 are 0, so
// the host gate 0x160ac1c and eligibility 0x3910ee0 both fail. This fills them
// with a nonzero local marker, then asks for bots through the original code.
// addtestclient is called natively on the server thread (chained in front of the
// host's frame thunk via the veneer at 0x3cd7b20) so that hooks and Stalker see it.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const E=globalThis.WZM_BOT_ENV||{};
const COUNT=E.count||5, TEAM=E.team===undefined?1:E.team, DIFF=E.diff||0, CALLS=E.calls||1;
const getParty=new NativeFunction(at(0x1601ffc),'pointer',[]);
const gate=new NativeFunction(at(0x160ac1c),'int',['pointer']);
const cap=new NativeFunction(at(0x160aa70),'int',['pointer','int']);
const apply=new NativeFunction(at(0x162a90c),'int',['pointer','pointer'],{traps:'all'});
const req=Memory.alloc(16);
const keep=globalThis.wzmBotKeep=globalThis.wzmBotKeep||[];
function slots(){const n=at(0x54cafa8).readPointer().readS32(),s=at(0x54cafb0).readPointer(),v=[];for(let i=0;i<Math.min(n,20);i++){const p=s.add(i*8).readPointer();if(!p.isNull()&&p.add(8).readU8())v.push([i,p.add(8).readU8(),p.add(0xb668).readU32()]);}return v;}
function members(p){const arr=p.add(0x20f8).readPointer(),n=p.add(0x4050+0x3c0).readS32(),v=[];if(arr.isNull())return {n,arr:'null'};for(let i=0;i<Math.min(Math.max(n,0),24);i++){const st=arr.add(i*0x240+0x1f2).readU8();if(st)v.push([i,st]);}return {n,v};}
function fields(p){return {f4650:p.add(0x4650).readU64().toString(16),f54:p.add(0x54).readU64().toString(16),gate:gate(p)&1,cap:cap(p,COUNT)&1,members:members(p)};}

// ---- native server-thread call gate ----
const veneer=at(0x3cd7b20);
const oldThunk=veneer.add(8).readPointer();
const cg=Memory.alloc(32);cg.writeU64(0);keep.push(cg);  // +0 request, +8 result
const thunk=Memory.alloc(Process.pageSize);keep.push(thunk);
Memory.protect(thunk,Process.pageSize,'rwx');
{const w=new Arm64Writer(thunk,{pc:thunk});
 w.putPushRegReg('x29','lr');
 for(const[x,y]of[['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
 w.putLdrRegAddress('x16',cg);w.putLdrRegRegOffset('x17','x16',0);w.putCbzRegLabel('x17','skip');
 w.putStrRegRegOffset('xzr','x16',0);
 w.putLdrRegAddress('x16',at(0x3cd64e8));w.putBlrReg('x16');
 w.putLdrRegAddress('x16',cg);w.putStrRegRegOffset('x0','x16',8);
 w.putLabel('skip');
 for(const[x,y]of[['x6','x7'],['x4','x5'],['x2','x3'],['x0','x1']])w.putPopRegReg(x,y);
 w.putPopRegReg('x29','lr');
 w.putLdrRegAddress('x16',oldThunk);w.putBrReg('x16');w.flush();}
const ins0=veneer.readU32(),ins1=veneer.add(4).readU32();
// veneer is "ldr x16,#8; br x16; .quad target": only the literal changes
if(ins0!==0x58000050||ins1!==0xd61f0200)throw Error('unexpected veneer '+ins0.toString(16)+' '+ins1.toString(16));
Memory.patchCode(veneer.add(8),8,c=>c.writePointer(thunk));
function restore(){Memory.patchCode(veneer.add(8),8,c=>c.writePointer(oldThunk));}
globalThis.wzmBotRestore=restore;

// ---- trace of the connection handler while our call runs ----
let inCall=false;const blocks=[],calls=[];const LO=0x3ccc9b0,HI=0x3cd0000;
Interceptor.attach(at(0x3cd64e8),{onEnter(){inCall=cg.add(16).readU32()===1;},onLeave(r){if(inCall)send({s:'botAddTestLeave',ret:r.toString()});inCall=false;}});
Interceptor.attach(at(0x3cd6670),{onEnter(a){if(inCall)send({s:'botFactoryEnter',name:a[0].readCString(),head:a[1].toInt32(),body:a[2].toInt32()});},onLeave(r){if(inCall)send({s:'botFactoryLeave',ret:r.toString()});}});
Interceptor.attach(at(LO),{onEnter(a){
 if(!inCall)return;this.st=true;
 if(E.fixType!==false&&a[0].add(6).readU8()!==1){send({s:'botAddrTypeFixed',from:a[0].add(6).readU8()});a[0].add(6).writeU8(1);}
 try{send({s:'botHandlerEnter',addr:Array.from(new Uint8Array(a[0].readByteArray(24)),x=>x.toString(16).padStart(2,'0')).join('')});}catch(e){}
 Stalker.follow(Process.getCurrentThreadId(),{transform(it){let ins;while((ins=it.next())!==null){
  const off=ins.address.sub(b).toInt32();
  if(off>=LO&&off<HI){
   if(ins.mnemonic==='bl'){const tgt=ptr(ins.operands[0].value).sub(b).toInt32();it.putCallout(()=>{if(calls.length<3000)calls.push([off,tgt]);});}
   else if(ins.mnemonic==='blr'){it.putCallout(()=>{if(calls.length<3000)calls.push([off,-1]);});}
   if(ins.mnemonic.startsWith('b.')||['cbz','cbnz','tbz','tbnz','ret'].includes(ins.mnemonic))it.putCallout(()=>{if(blocks.length<3000)blocks.push(off);});
  }
  it.keep();}}});
},onLeave(r){if(!this.st)return;Stalker.unfollow(Process.getCurrentThreadId());Stalker.flush();
 const hx=x=>'0x'+(x>>>0).toString(16);
 send({s:'botHandlerTrace',ret:r.toString(),blocks:blocks.map(hx),calls:calls.map(([a,c])=>hx(a)+'>'+(c<0?'blr':hx(c)))});}});

let armed=false,uiDone=false,svStage=0,svAt=0,nCalls=0;
globalThis.wzmBotArm=()=>{if(!armed){armed=true;if(E.skipParty){uiDone=true;svStage=1;svAt=Date.now();}send({s:'botInjectArmed',count:COUNT,team:TEAM});}};
Interceptor.attach(at(0x337c1c0),{onEnter(){
 if(!armed||uiDone)return;uiDone=true;
 try{
  const p=getParty();const before=fields(p);
  if(p.add(0x4650).readU64().equals(0))p.add(0x4650).writeU64(uint64('0x0f0f1ce5'));
  if(p.add(0x54).readU64().equals(0))p.add(0x54).writeU64(uint64('0x0f0f1ce5'));
  let r=-1;
  if(!(E.skipParty)){req.writeU32(DIFF);req.add(4).writeS32(-1);req.add(8).writeS32(COUNT);req.add(12).writeU8(0);req.add(13).writeU8(TEAM);r=apply(p,req);}
  send({s:'botInjectParty',before,applyRet:r,after:fields(p),slots:slots()});
  svStage=1;svAt=Date.now();
 }catch(e){send({s:'botInjectError',where:'party',error:String(e),stack:e.stack});}
}});
Interceptor.attach(at(0x3cf10e0),{onEnter(){
 if(!svStage)return;const dt=Date.now()-svAt;
 try{
  if(svStage===1&&dt>2000){svStage=2;send({s:'botInjectSlots2s',slots:slots()});svAt=Date.now();}
  else if(svStage===2&&dt>300){nCalls++;cg.add(16).writeU32(1);cg.writeU64(1);svStage=3;svAt=Date.now();}
  else if(svStage===3&&cg.readU64().equals(0)&&dt>500){
   cg.add(16).writeU32(0);
   send({s:'botAddTestClient',ent:cg.add(8).readPointer().toString(),slots:slots()});
   svStage=nCalls<CALLS?2:4;svAt=Date.now();}
  else if(svStage===4&&dt>3000){svStage=5;restore();send({s:'botInjectFinal',slots:slots(),members:members(getParty())});}
 }catch(e){svStage=9;try{restore();}catch(_){}send({s:'botInjectError',where:'server',error:String(e),stack:e.stack});}
}});
send({s:'botInjectLoaded',pid:Process.id,oldThunk:oldThunk.toString()});
}
