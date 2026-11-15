// Read-only tracer (8 Nov 2026): why does the native bot creator 0x3cd6960 return nothing in Battle Royale mode (mode row 10)?
// Logs entry/exit of the creator, its inner connect builder 0x3cd6670, the connect call 0x12cfcb8 and the id->slot lookups.
// No writes. Run alongside both_sides_bots.py (which makes the creator call from the server veneer).
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x),rel=p=>{try{return p.sub(b).toString(16);}catch(e){return String(p);}};
const hits=[];function log(o){o.t=Date.now();send(o);}
const slotInfo=()=>{try{const n=at(0x54cafa8).readPointer().readS32(),a=at(0x54cafb0).readPointer(),o=[];for(let i=0;i<Math.min(n,24);i++){const c=a.add(i*8).readPointer();o.push(c.isNull()?'n':c.add(8).readU8()+'/'+(c.add(0xb668).readU32()));}return o.join(' ');}catch(e){return 'err';}};
Interceptor.attach(at(0x3cd6960),{
 onEnter(a){this.on=true;let nm='';try{nm=a[0].readUtf8String();}catch(e){}log({s:'crTrace',ev:'creator_enter',name:nm,a1:a[1].toString(),a2:a[2].toString(),flag18:at(0x54d1118).readPointer().readPointer().add(0x18).readU8(),slots:slotInfo()});},
 onLeave(r){log({s:'crTrace',ev:'creator_leave',ret:r.toString(),slots:slotInfo()});}});
Interceptor.attach(at(0x3cd6670),{
 onEnter(a){log({s:'crTrace',ev:'inner_enter'});},
 onLeave(r){log({s:'crTrace',ev:'inner_leave',ret:r.toString()});}});
Interceptor.attach(at(0x12cfcb8),{
 onEnter(a){let t='';try{t=a[3].readUtf8String().slice(0,160);}catch(e){}log({s:'crTrace',ev:'connect_enter',arg3:t});},
 onLeave(r){log({s:'crTrace',ev:'connect_leave',ret:r.toString()});}});
log({s:'crTrace',ev:'armed',mode:at(0xc115ea8).readU8(),slots:slotInfo()});
