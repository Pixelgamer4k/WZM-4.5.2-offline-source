'use strict';
// Original dispatcher 0x1631c18..0x1631cac: next+0, name+8, callback+16.
// GOT 0x54bd1d0 holds pointer to list-head slot. No native calls or writes.
const game = Process.getModuleByName('libgame.so');
function nameAt(p) {
  if(p.isNull()) return null;
  const a=new Uint8Array(p.readByteArray(128));
  const n=a.indexOf(0);
  if(n<0) return null;
  for(let i=0;i<n;i++) if(a[i]<32||a[i]>126) return null;
  return String.fromCharCode(...a.subarray(0,n));
}
function capture(secondary = false) {
 const headSlot=game.base.add(secondary ? 0x54bd1e8 : 0x54bd1d0).readPointer();
 let node=headSlot.readPointer();
 const records=[],seen=new Set();let error=null;
 for(let i=0;i<8192&&!node.isNull();i++){
  const id=node.toString();if(seen.has(id)){error='cycle or concurrent list mutation';break;}seen.add(id);
  try{
   const name=nameAt(node.add(8).readPointer()),callback=node.add(16).readPointer();
   const range=Process.findRangeByAddress(callback);
   records.push({node:id,name,callback:callback.toString(),executable:!!range&&range.protection.includes('x'),
    offset:callback.compare(game.base)>=0&&callback.compare(game.base.add(game.size))<0?callback.sub(game.base).toString():null});
   node=node.readPointer();
  }catch(e){error=String(e);break;}
 }
 return {base:game.base.toString(),headSlot:headSlot.toString(),complete:node.isNull(),error,count:records.length,records};
}
function matchmakingState(){
 const b=game.base;
 const count=b.add(0xc187af8).readU32(), selected=b.add(0xc187b14).readU32();
 const playlistEntries=[];
 // Small bounded inventory only; retain count even if its range is implausible.
 if(count<=512) for(let i=0;i<Math.min(count,64);i++){
  const e=b.add(0xc146e98+i*0x150);
  playlistEntries.push({index:i,id:e.add(0xcc).readU32(),mode:e.add(0xc0).readU64().toString()});
 }
 const request=b.add(0x61e4538);
 return {playlistCount:count,selectedPlaylist:selected,selectionOther:b.add(0xc187b10).readU32(),playlistEntries,
  entriesTruncated:count>64,requestState:request.readU32(),requestWords:[4,8,0x28,0x2c,0x30].map(o=>({offset:o,value:request.add(o).readU32()})),
  mode:b.add(0xc115ea8).readU8(),partyActive:b.add(0x613a4f0+0x4418).readU8()};
}
rpc.exports={capture,matchmakingState};
