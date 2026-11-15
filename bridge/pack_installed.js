// WZM_PACK_INSTALLED: mark an optional content pack's files as installed in the game's file registry.
// The registry (root ptr at libgame+0x575a880; u16 count at +0x22; table at +0x50; 0x78-byte records,
// name at +0, "installed" byte at +0x50) is only set to 1 by the online downloader. Offline, Verdansk
// (maps_sierra) shards are present and verified but 1,227/1,233 records stay 0, so its world FF fails
// to open (DEV ERROR 0x723AC2A5). Memory-only; re-applied every 2 s in case the registry is rebuilt.
{
const b=Process.getModuleByName('libgame.so').base;
const NAMES=new Set(globalThis.WZM_PACK_FILES||[]);
const untag=p=>p.and(ptr('0x00ffffffffffffff'));
let lastSet=-1,rounds=0;
let cache=null;
function apply(){
 const root=untag(b.add(0x575a880).readPointer());if(root.isNull())return -1;
 const count=root.add(0x22).readU16(),table=untag(root.add(0x50).readPointer());
 if(table.isNull()||count<1||count>20000)return -1;
 if(!cache||cache.count!==count||!cache.table.equals(table)){
  const idx=[];for(let i=0;i<count;i++){let n;try{n=table.add(i*0x78).readCString();}catch(e){continue;}if(NAMES.has(n))idx.push(i);}
  const sample=[];for(const i of [0,1,17393,18574])if(i<count){try{sample.push(i+':'+JSON.stringify(table.add(i*0x78).readCString()));}catch(e){sample.push(i+':ERR '+e);}}
  send({s:'packInstalledScan',names:NAMES.size,count,found:idx.length,sample});
  cache={count,table,idx};
 }
 let set=0;
 for(const i of cache.idx){const r=table.add(i*0x78);if(r.add(0x50).readU8()!==1){r.add(0x50).writeU8(1);set++;}}
 return {count,matched:cache.idx.length,set};
}
function tick(){try{const r=apply();if(r!==-1&&(r.set>0||rounds===0)){send({s:'packInstalledApplied',...r});}rounds++;}catch(e){send({s:'packInstalledError',e:String(e)});}}
tick();setInterval(tick,2000);
}
