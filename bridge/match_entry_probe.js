'use strict';
// Read-only: counts party updater activity and reports the gates in front of the match entry 0x1625510.
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const c={};const hit=(name,x,ret)=>{c[name]=0;const h={onEnter(){c[name]++;}};if(ret)h.onLeave=function(r){const k=name+'_ret'+(r.toInt32()&1);c[k]=(c[k]||0)+1;};Interceptor.attach(at(x),h);};
hit('partyMgrFrame',0x1624f6c);
hit('eligible',0x160b58c,true);
hit('matchEntry',0x1625510);
hit('levelRequest',0x3abb5b4);
const party=at(0x613a4f0);
const dv=s=>{const p=at(s).readPointer().readPointer();return {ptr:p.sub(b).toString(),b28:p.add(0x28).readU8()};};
function gates(){return {b4418:party.add(0x4418).readU8(),b4419:party.add(0x4419).readU8(),b441a:party.add(0x441a).readU8(),d43d0:party.add(0x43d0).readU32(),b4595:party.add(0x4595).readU8(),xuid4650:party.add(0x4650).readU64().toString(16),dvA_needTrue:dv(0x54bd790),dvB_needFalse:dv(0x54bd7b8),flag_x26_3c8_candidate:party.add(0x4018+0x3c8).readU8()};}
rpc.exports={snap(){return {counts:c,gates:gates()};}};
send({start:gates()});
