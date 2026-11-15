'use strict';
// Arms the party on a natural party-manager frame through the game's own transition 0x162184c and traces how far
// the single boot session gets towards the match entry. Memory only; no mode switch, no session rebuild.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const party=at(0x613a4f0);const c={};const log=[];
const note=(k)=>{c[k]=(c[k]||0)+1;if(c[k]===1)log.push({t:Date.now(),k});};
const mark=(k,x)=>Interceptor.attach(at(x),{onEnter(){note(k);}});
const mapDvar=at(0x54be5e8).readPointer().readPointer();
const readMap=()=>{const p=mapDvar.add(0x28).readPointer();return p.isNull()?null:p.readCString();};
const start=new NativeFunction(at(0x162184c),'void',['pointer','int']);
const gameMalloc=new NativeFunction(Module.getGlobalExportByName('malloc'),'pointer',['size_t']);
const gateDvar=at(0x54bd798).readPointer().readPointer();
let armed=false,wantMap=null,keep=null,forceGate=false,passLogin=false;
const managerLoginSite=at(0x1617f98);
function arm(){
 if(wantMap){keep=gameMalloc(wantMap.length+1);keep.writeUtf8String(wantMap);mapDvar.add(0x28).writePointer(keep);}
 for(const o of[0x4418,0x4419,0x441a])party.add(o).writeU8(1);
 if(forceGate){installPlaylist();setGametype(uint64('0x763e0e0566b83935'));log.push({k:'gametypeSet',current:at(0x6ba3db0).readPointer().toString()});}
 log.push({k:'partyRaw',idx4660:party.add(0x4660).readS32(),cnt4664:party.add(0x4664).readS32(),members20f8:party.add(0x20f8).readPointer().toString()});
 if(forceGate){for(const o of[0,0x650,0xca0,0x12f0])party.add(0x4660+o).writeS32(-1);passLogin=true;}
 start(party,0);armed=true;log.push({t:Date.now(),k:'armed',b4595:party.add(0x4595).readU8(),map:readMap()});
}
// One playlist entry at table base 0xc146e98 (stride 0x150): mode +0xc0, id +0xcc, enabled u16 +0x10e.
// The mode is the running one so that playlist application has no reason to call the mode switcher.
function installPlaylist(){
 const e=at(0xc146e98),modeId=at(0x54d9b30).readPointer().add(at(0xc115ea8).readU8()*0x1a8).readU64();
 log.push({k:'playlistBefore',count:at(0xc187af8).readU32(),sel:at(0xc187b14).readU32(),modeInTable:modeId.toString(16)});
 e.add(0xc0).writeU64(uint64('0x27e9a82bbcbf63e1'));e.add(0xcc).writeU32(1);e.add(0x10e).writeU16(1);
 at(0xc187af8).writeU32(1);at(0xc187b14).writeU32(1);
}
const setGametype=new NativeFunction(at(0x1e51c3c),'void',['uint64']); // ftue_orientation from the live table
function zones(){const o=[];let n=at(0xc0e4d78).readPointer();for(let i=0;i<12&&!n.isNull();i++){o.push([n.add(0x20).readU8(),n.add(0x21).readU8(),n.add(0x2a).readCString(),n.add(0xea).readCString()]);n=n.add(0x10).readPointer();}return o;}
let pending=false;
Interceptor.attach(at(0x1617e74),{onEnter(){note('mgrFrame');if(pending){pending=false;try{arm();}catch(e){log.push({k:'armErr',e:''+e});}}}});
for(const[k,x]of[['updater',0x1624f6c],['ineligibleBranch',0x1625368],['no4595Branch',0x1625420],['matchEntry',0x1625510],['altAsset',0x199efac]])mark(k,x);
Interceptor.attach(at(0x3abb5b4),{onEnter(a){note('levelRequest');log.push({t:Date.now(),k:'levelRequest',map:a[0].readCString(),flag:a[1].toInt32()});}});
Interceptor.attach(at(0x373ab04),{onEnter(a){this.a=[a[0].toInt32(),a[1].toInt32()];this.site=this.returnAddress.equals(managerLoginSite);},onLeave(r){const k='login_'+this.a[1]+'_ret'+(r.toInt32()&1);note(k);if(this.site&&passLogin){r.replace(ptr(1));note('managerLoginPassed');}}});
Process.setExceptionHandler(d=>{const m=Process.findModuleByAddress(d.address);if(m&&m.name==='libgame.so'){const rel=p=>{const q=Process.findModuleByAddress(p);return q?q.name.slice(0,12)+'+'+p.sub(q.base).toString(16):p.toString();};send({fault:rel(d.address),type:d.type,x0:d.context.x0.toString(),x1:d.context.x1.toString(),lr:rel(d.context.lr),bt:Thread.backtrace(d.context,Backtracer.FUZZY).slice(0,14).map(rel)});}return false;});
rpc.exports={
 go(m,f){wantMap=m||null;forceGate=!!f;pending=true;return{map:readMap(),gateDvar:gateDvar.add(0x28).readU8()};},
 snap(){return{counts:c,log:log.slice(0,60),map:readMap(),party:{b4418:party.add(0x4418).readU8(),b4419:party.add(0x4419).readU8(),b441a:party.add(0x441a).readU8(),d43d0:party.add(0x43d0).readU32(),b4595:party.add(0x4595).readU8()},mode:[at(0xc115ea8).readU8(),at(0xc115eb0).readU8()],zones:zones()};}
};
Interceptor.attach(at(0x160b58c),{onLeave(r){note('eligible_ret'+(r.toInt32()&1));}});
// Streams each step of the match entry body as it starts, so the last step before an exit survives the process.
let inEntry=false;
Interceptor.attach(at(0x1625510),{onEnter(){inEntry=true;send({step:'entry'});},onLeave(){inEntry=false;send({step:'entryDone'});}});
for(const x of[0x1616234,0x1e51c3c,0x3f161fc,0x1e53450,0x160b654,0x3645a58,0x134754c,0x3a545c0,0x218fbd4,0x3a876a0,0x3ab21c8,0x2b0e1c4,0x2093edc,0x1df82f4,0x3a7fff4,0x3a7fc24,0x19ade0c,0x15e4a58,0x15e4c8c,0x15d8780,0x15db318,0x15d6684,0x138462c,0x3a54610,0x3a61660,0x1384ee4,0x138456c,0x3781648,0x3782f00,0x3837bf8,0x161b9a0]){
 try{Interceptor.attach(at(x),{onEnter(){if(inEntry)send({step:x.toString(16),thread:Process.getCurrentThreadId()});}});}catch(e){send({noHook:x.toString(16)});}
}
const safeStr=p=>{try{return p.isNull()?null:p.readCString(200);}catch(e){return 'unreadable';}};
Interceptor.attach(at(0x12a1104),{onEnter(a){const q=this.context;send({fatal:(a[0].toUInt32()>>>0).toString(16),fmt:safeStr(a[1]),arg:safeStr(a[2]),lr:q.lr.sub(b).toString(),bt:Thread.backtrace(q,Backtracer.ACCURATE).slice(0,10).map(p=>p.sub(b).toString())});}});
Interceptor.attach(at(0x12a3d5c),{onEnter(a){send({fatalMsg:safeStr(a[3]),tag:safeStr(a[2])});}});
// The match start waits for the login flow to finish. There is no login, so report it finished while the entry runs.
let flowPassed=0;
Interceptor.attach(at(0x375afcc),{onLeave(r){if(inEntry){r.replace(ptr(1));if(!flowPassed++)send({step:'loginFlowReportedDone'});}}});
for(const x of[0x3b6d850,0x3b6d90c,0x3b71810,0x13d1e24,0x15d7244])try{Interceptor.attach(at(x),{onEnter(){if(inEntry)send({step:x.toString(16)});}});}catch(e){send({noHook:x.toString(16)});}
// Host trace: who raises session errors, and what the game tries to reach once the match entry has run.
const relG=p=>{const q=Process.findModuleByAddress(p);return q?q.name.slice(0,14)+'+'+p.sub(q.base).toString(16):p.toString();};
Interceptor.attach(at(0x375ab30),{onEnter(a){send({sessionError:a[0].toInt32(),hash:a[1].toString(),t:Date.now(),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,16).map(relG)});}});
const sa=p=>{try{const f=p.readU16();if(f===2)return[p.add(4).readU8(),p.add(5).readU8(),p.add(6).readU8(),p.add(7).readU8()].join('.')+':'+((p.add(2).readU8()<<8)|p.add(3).readU8());if(f===10)return'v6:'+((p.add(2).readU8()<<8)|p.add(3).readU8());return'af'+f;}catch(e){return'?';}};
let netLogged=0;const netNote=o=>{if(armed&&netLogged++<60)send(Object.assign({net:1,t:Date.now(),from:relG(o.lr)},o.v));};
for(const[n,i]of[['connect',1],['sendto',4]]){const f=Module.findGlobalExportByName(n);if(f)Interceptor.attach(f,{onEnter(a){const q=a[i];if(!q.isNull())netNote({lr:this.returnAddress,v:{fn:n,to:sa(q)}});}});}
const gai=Module.findGlobalExportByName('getaddrinfo');if(gai)Interceptor.attach(gai,{onEnter(a){let h='?';try{h=a[0].readCString();}catch(e){}netNote({lr:this.returnAddress,v:{fn:'getaddrinfo',host:h}});}});
const trip=(tag,o)=>send(Object.assign({trip:tag,t:Date.now(),bt:Thread.backtrace(o,Backtracer.FUZZY).slice(0,18).map(relG)}));
Interceptor.attach(at(0x12a3d5c),{onEnter(a){if(!armed)return;const m=safeStr(a[3])||'';if(m.startsWith('Unable to'))trip('text:'+m.split('�')[0].slice(0,50),this.context);}});
Interceptor.attach(at(0x3a55cc4),{onEnter(a){if(!armed)return;trip('comError code='+a[0].toInt32()+' fmt='+(safeStr(a[1])||'').split('�')[0].slice(0,30)+' a2='+a[2],this.context);}});
Interceptor.attach(at(0x3817a3c),{onEnter(a){if(armed)trip('popup3817a3c',this.context);}});
for(const[n,x]of[['presenterA',0x3a54a9c],['presenterB',0x3a555a0]])Interceptor.attach(at(x),{onEnter(a){if(!armed)return;send({trip:n+' x0='+a[0]+' s0='+safeStr(a[0])+' s1='+safeStr(a[1])+' x2='+a[2],bt:[relG(this.returnAddress)].concat(Thread.backtrace(this.context,Backtracer.ACCURATE).slice(0,14).map(relG))});}});
