// Original DRS sizing table, read-only (0x2e9f4e8 returns 0x8c05aec).
'use strict';
const b=Process.getModuleByName('libgame.so').base;
const base=b.add(0x8c05aec);
const levels=[];
for(let i=0;i<16;i++){
  try{const p=base.add(i*8);levels.push({i,w:p.readFloat(),h:p.add(4).readFloat(),u32:[p.readU32(),p.add(4).readU32()]});}
  catch(e){levels.push({i,error:String(e)});break;}
}
let flag=null;
try{const p=b.add(0x54d37a8).readPointer().readPointer();flag={hash:p.readU64().toString(16),type:p.add(0x15).readU8(),cur:p.add(0x28).readU32(),def:p.add(0x48).readU32()};}catch(e){flag={error:String(e)};}
send({event:'gfxDRSDiscreteLevels',table:base.toString(),flag,levels});
