globalThis.WZM_BOT_ENV={partyMembers:true,teamFields:false,count:2,team:1,calls:2,friends:0};
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
const cg=Memory.alloc(64);cg.writeU64(0);keep.push(cg);  // +0 request, +8 result, +0x10 inCall, +0x18 fn, +0x20 x0, +0x28 x1
const thunk=Memory.alloc(Process.pageSize);keep.push(thunk);
Memory.protect(thunk,Process.pageSize,'rwx');
{const w=new Arm64Writer(thunk,{pc:thunk});
 w.putPushRegReg('x29','lr');
 for(const[x,y]of[['x0','x1'],['x2','x3'],['x4','x5'],['x6','x7']])w.putPushRegReg(x,y);
 w.putLdrRegAddress('x16',cg);w.putLdrRegRegOffset('x17','x16',0);w.putCbzRegLabel('x17','skip');
 w.putStrRegRegOffset('xzr','x16',0);
 w.putLdrRegRegOffset('x0','x16',0x20);w.putLdrRegRegOffset('x1','x16',0x28);w.putLdrRegRegOffset('x16','x16',0x18);w.putBlrReg('x16');
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
 if(E.fixType!==false){const ad=a[0];const before=Array.from(new Uint8Array(ad.readByteArray(16)),x=>x.toString(16).padStart(2,'0')).join('');
  // known-good bot address (all successful runs): 00ff00ff 0000 | type 01 | 03 | id | channel 1
  // an all-zero prefix sends the handler down a path that faults (0x7405176050); keep the channel as built
  if(ad.readU32()===0)ad.writeByteArray([0x00,0xff,0x00,0xff,0x00,0x00]);ad.add(6).writeU8(1);
  send({s:'botAddrFixed',before});}
 try{send({s:'botHandlerEnter',addr:Array.from(new Uint8Array(a[0].readByteArray(24)),x=>x.toString(16).padStart(2,'0')).join('')});}catch(e){}
 if(!E.stalk){send({s:'botHandlerFast'});return;}
 this.stalked=true;
 Stalker.follow(Process.getCurrentThreadId(),{transform(it){let ins;while((ins=it.next())!==null){
  const off=ins.address.sub(b).toInt32();
  if(off>=LO&&off<HI){
   if(ins.mnemonic==='bl'){const tgt=ptr(ins.operands[0].value).sub(b).toInt32();it.putCallout(()=>{if(calls.length<3000)calls.push([off,tgt]);});}
   else if(ins.mnemonic==='blr'){it.putCallout(()=>{if(calls.length<3000)calls.push([off,-1]);});}
   if(ins.mnemonic.startsWith('b.')||['cbz','cbnz','tbz','tbnz','ret'].includes(ins.mnemonic))it.putCallout(()=>{if(blocks.length<3000)blocks.push(off);});
  }
  it.keep();}}});
},onLeave(r){if(!this.st)return;if(!this.stalked){send({s:'botHandlerLeave',ret:r.toString(),slots:slots()});return;}Stalker.unfollow(Process.getCurrentThreadId());Stalker.flush();
 const hx=x=>'0x'+(x>>>0).toString(16);
 send({s:'botHandlerTrace',ret:r.toString(),blocks:blocks.map(hx),calls:calls.map(([a,c])=>hx(a)+'>'+(c<0?'blr':hx(c)))});}});

for(const [n,o] of [['botClientInit',0x3cd9fc4],['botRejectSend',0x3ba1708],['botSetupCheck',0x3f0a088]]){try{Interceptor.attach(at(o),{onEnter(){if(inCall)send({s:n,t:Date.now()});},onLeave(r){if(inCall)send({s:n+'Ret',r:r.toString()});}});}catch(e){send({s:'hookSkip',n,e:String(e)});}}

// Bots have no network endpoint: the send routine 0x3b9eab4 gets a null
// network object for them and faults at 0x3b9eb90. Make that case a no-op.
{const sendTarget=at(0x3b9eab4);const sendOrig=new NativeFunction(sendTarget,'uint64',['pointer','pointer','pointer','pointer']);
 let skipped=0;
 const cb=new NativeCallback((x0,x1,x2,x3)=>{if(x0.isNull()){if(skipped++<3)send({s:'botNullSendSkipped',n:skipped});return uint64(0);}return sendOrig(x0,x1,x2,x3);},'uint64',['pointer','pointer','pointer','pointer']);
 keep.push(cb);Interceptor.replace(sendTarget,cb);send({s:'botSendGuardInstalled'});}

// Second bot-network crash: lookup 0x3baa1c4 returns a garbage handle (e.g. 0x8e0000) for a bot
// address and 0x3ba2b8c dereferences it (fault at 0x3ba2b8c from 0x3ba8420). Treat invalid handles as not found.
{let bad=0;Interceptor.attach(at(0x3baa1c4),{onLeave(r){if(r.isNull())return;
  if(r.compare(ptr('0x10000000'))<0||(r.and(7).toInt32()!==0)){if(bad++<3)send({s:'botBadChannelHandle',h:r.toString(),n:bad});r.replace(ptr(0));}}});
 send({s:'botChannelGuardInstalled'});}

// Crash reporter: log pc/lr/backtrace for any native fault, then let the normal handling continue.
Process.setExceptionHandler(d=>{try{const f=x=>{const m=Process.findModuleByAddress(x);return m?m.name+'+'+x.sub(m.base).toString(16):x.toString();};
 send({s:'botCrash',type:d.type,addr:d.memory?d.memory.address.toString():null,op:d.memory?d.memory.operation:null,pc:f(d.context.pc),lr:f(d.context.lr),
  bt:Thread.backtrace(d.context,Backtracer.FUZZY).slice(0,10).map(f),tid:Process.getCurrentThreadId()});}catch(e){}return false;});
let newClients=[];
Interceptor.attach(at(0x3cd9fc4),{onLeave(r){if(!inCall)return;try{const n=at(0x54cafa8).readPointer().readS32(),sl=at(0x54cafb0).readPointer();for(let i=0;i<n;i++){if(sl.add(i*8).readPointer().equals(r)){r.add(0xb668).writeU32(1);newClients.push(i);send({s:'botClientFlagged',slot:i});}}}catch(e){send({s:'botFlagError',e:String(e)});}}});
let armed=false,uiDone=false,svStage=0,svAt=0,nCalls=0,cur=null;const queue=[],entered={},teamOf={};let friendsLeft=E.friends||0;const zeroCmd=Memory.alloc(0x400);keep.push(zeroCmd);
globalThis.wzmBotArm=()=>{if(!armed){armed=true;if(E.skipParty){uiDone=true;svStage=1;svAt=Date.now();}send({s:'botInjectArmed',count:COUNT,team:TEAM});}};
Interceptor.attach(at(0x337c1c0),{onEnter(){
 if(!armed||uiDone)return;uiDone=true;
 try{
  const p=getParty();const before=fields(p);
  if(p.add(0x4650).readU64().equals(0))p.add(0x4650).writeU64(uint64('0x0f0f1ce5'));
  if(p.add(0x54).readU64().equals(0))p.add(0x54).writeU64(uint64('0x0f0f1ce5'));
  let r=-1;
  // Adding bot party members (pa_manage_bots) makes the party send real connect packets that crash the
  // network-thread handler (fault 0x7405176050 from 0x3ccde74). addtestclient only needs the two fields.
  if(E.partyMembers){req.writeU32(DIFF);req.add(4).writeS32(-1);req.add(8).writeS32(COUNT);req.add(12).writeU8(0);req.add(13).writeU8(TEAM);r=apply(p,req);}
  send({s:'botInjectParty',before,applyRet:r,after:fields(p),slots:slots()});
  svStage=1;svAt=Date.now();
 }catch(e){send({s:'botInjectError',where:'party',error:String(e),stack:e.stack});}
}});
// Perf: runs every server tick; detaches itself once bot injection has finished (stage 5) or failed (9).
let tickHook=null,tickGone=false;
tickHook=Interceptor.attach(at(0x3cf10e0),{onEnter(){
 if(svStage>=5){if(!tickGone){tickGone=true;setTimeout(()=>{try{tickHook.detach();send({s:'botTickDetached'});}catch(e){}},0);}return;}
 if(!svStage)return;const dt=Date.now()-svAt;
 try{
  if(svStage===1&&dt>2000){svStage=2;
   // runs that worked started bot ids at 8 (ids 3-7 used by party connects); the first bot at id 3 faulted
   try{const sv=at(0x54d1118).readPointer().readPointer();const c=sv.add(0x80).readU16();if(c<5){sv.add(0x80).writeU16(E.botIdStart||5);send({s:'botCounterBumped',from:c,to:E.botIdStart||5});}}catch(e){send({s:'botCounterErr',e:String(e)});}
send({s:'botInjectSlots2s',slots:slots()});svAt=Date.now();}
  else if(svStage===2&&dt>300){
   let job=queue.shift();
   if(!job){if(nCalls>=CALLS){svStage=4;svAt=Date.now();return;}nCalls++;job=[0x3cd64e8,0,0,'addtest'];}
   cur=job;cg.add(16).writeU32(job[3]==='addtest'?1:0);cg.add(0x18).writePointer(at(job[0]));cg.add(0x20).writePointer(ptr(job[1]));cg.add(0x28).writePointer(ptr(job[2]));
   cg.writeU64(1);svStage=3;svAt=Date.now();}
  else if(svStage===3&&cg.readU64().equals(0)&&dt>300){
   cg.add(16).writeU32(0);const ret=cg.add(8).readPointer();
   if(cur[3]==='addtest'){
    send({s:'botAddTestClient',ent:ret.toString(),slots:slots()});
    if(!ret.isNull()){const n=at(0x54cafa8).readPointer().readS32(),sl=at(0x54cafb0).readPointer();
     for(let i=1;i<Math.min(n,20);i++){const c=sl.add(i*8).readPointer();if(c.isNull())continue;const k=c.toString();
      if(c.add(8).readU8()===5&&c.add(0xb668).readU32()===1&&!entered[k]){entered[k]=1;const tb=(E.friends&&friendsLeft-->0)?2:(E.teamByte===undefined?1:E.teamByte);c.add(0x280).writeU8(tb);teamOf[i]=tb;send({s:'botTeamSet',slot:i,teamByte:tb});queue.push([0x3cd53bc,c,0,'gamestate '+i]);queue.push([0x3cd0a00,c,zeroCmd,'enterworld '+i]);}}}
   }else{
    if(cur[3].startsWith('enterworld')&&E.teamFields!==false){try{
     const i=parseInt(cur[3].split(' ')[1]);const ent=at(0x54beee0).readPointer().readPointer().add(0x18).readPointer().add(i*0x6f0);
     const tb=teamOf[i]||1;const g=ent.add(0x170).readPointer(),c=ent.add(0x178).readPointer();
     const before=[g.add(0x1a8).readU8(),g.add(0x1ac).readU8(),c.add(0x10).readU8()];
     // candidate team fields (value 2 = your team for you and every bot): game client +0x1a8/+0x1ac, client info +0x10
     g.add(0x1a8).writeU8(tb);g.add(0x1ac).writeU8(tb);c.add(0x10).writeU8(tb);
     send({s:'botTeamFields',slot:i,before,set:tb});}catch(e){send({s:'botTeamFieldsErr',e:String(e)});}}
    send({s:'botStep',step:cur[3],ret:ret.toString(),slots:slots()});}
   svStage=2;svAt=Date.now();}
  else if(svStage===4&&dt>3000){svStage=5;restore();send({s:'botInjectFinal',slots:slots(),members:members(getParty())});}
 }catch(e){svStage=9;try{restore();}catch(_){}send({s:'botInjectError',where:'server',error:String(e),stack:e.stack});}
}});
send({s:'botInjectLoaded',pid:Process.id,oldThunk:oldThunk.toString()});
}
