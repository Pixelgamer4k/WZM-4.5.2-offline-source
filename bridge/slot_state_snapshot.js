// Read-only per-slot game-client snapshot. No writes, no hooks, no native calls.
// Answers the open question from bot_team_auth_20261105.md: what does a spectating
// client look like versus a live one, field by field, for every occupied slot.
// Fields: gclient+0x10 (compared to 5 by movement code), +0x79b8 (session state),
// +0x7f20 (engine team), serverClient+0xb668 (marker), +0x280 (control byte),
// plus the party member team (+0x1e0) and auxiliary record team (+0x4d) if present.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const out={slots:[]};
try{
  const root=at(0x54bfb78).readPointer().readPointer();
  out.root=root.toString();
  for(let i=0;i<12;i++){
    const c=root.add(i*0x31270);
    let state=0;
    try{state=c.add(8).readU8();}catch(e){continue;}
    const gi=c.add(0x79b8);
    const row={slot:i,state,
      g10:gi.add(0x10).readU8(),
      g79b8:gi.add(0x79b8).readU8(),
      team7f20:gi.add(0x7f20).readU8(),
      marker:c.add(0xb668).readU32(),
      c280:c.add(0x280).readU8(),
      alive:c.add(0x6c0).readPointer().isNull()?null:'ai'
    };
    try{row.auxTeam=c.add(0x79b8).add(0x4d).readU8();}catch(e){}
    out.slots.push(row);
  }
}catch(e){out.error=String(e);}
try{
  const p=at(0x54cafa8).readPointer().readS32(),a=at(0x54cafb0).readPointer();
  out.clientCount=p;
  out.clients=[];
  for(let i=0;i<Math.min(p,12);i++){
    const c=a.add(i*8).readPointer();
    if(c.isNull())continue;
    out.clients.push({slot:i,ptr:c.toString(),marker:c.add(0xb668).readU32(),state:c.add(8).readU8()});
  }
}catch(e){out.clientError=String(e);}
send(out);
}
