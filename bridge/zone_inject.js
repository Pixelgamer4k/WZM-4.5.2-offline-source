// Memory-only zone injector (7 Nov 2026). Serves a custom fastfile in place of an existing registry entry.
// Config globalThis.WZM_ZONE_INJECT={file, size, firstXhash, shards:[{h:'16hex',n:bytes}]} (from zone_inject_prep.py).
// Registry: root *(libgame+0x575a880); files +0x50 (0x78 stride, count u16 +0x22); per-file shard list u32[] at +0x58.
// Record: +0x5a u16 shard count, +0x5c u32 first index into the list, +0x70 u32 file size.
// Shard table entries 0x18: u32 flags (ff01=APK pack, fe01|aggregate<<16=cache), u32 size, u64 xxh64, u64.
// Cache files: files/shard_cache/xxh64/<xxh64 of content>; shards are plain slices of the file.
(function(){
const C=globalThis.WZM_ZONE_INJECT;if(!C)return;
const b=Process.getModuleByName('libgame.so').base;const untag=p=>ptr(p.and(ptr('0x00ffffffffffffff')));
function run(){
 const root=untag(b.add(0x575a880).readPointer());const count=root.add(0x22).readU16(),table=untag(root.add(0x50).readPointer());
 let rec=null;for(let i=0;i<count;i++){const r=table.add(i*0x78);try{if(r.readCString()===C.file){rec=r;break;}}catch(e){}}
 if(!rec){send({s:'zoneInjectNoRecord',file:C.file});return;}
 const first=rec.add(0x5c).readU32(),cnt=rec.add(0x5a).readU16(),list=untag(root.add(0x58).readPointer());
 if(C.shards.length>cnt){send({s:'zoneInjectTooManyShards',have:cnt,need:C.shards.length});return;}
 // locate the shard-table entry of the file's first shard by its known hash
 const hx=C.firstXhash.match(/../g).reverse().join(' ');let e0=null;
 for(const r of Process.enumerateRanges('rw-')){if(r.size>512*1024*1024)continue;try{const m=Memory.scanSync(r.base,r.size,hx);for(const x of m){const e=x.address.sub(8);if(e.add(4).readU32()>0){e0=e;break;}}}catch(e){} if(e0)break;}
 if(!e0){send({s:'zoneInjectNoShardTable'});return;}
 const idx0=list.add(first*4).readU32();const ent=i=>e0.add((list.add((first+i)*4).readU32()-idx0)*0x18);
 let flags=null;for(let i=0;i<cnt;i++){const f=ent(i).readU32();if((f&0xffff)===0x01fe){flags=f;break;}}
 if(flags===null)flags=0x0cd801fe;
 for(let i=0;i<C.shards.length;i++){const e=ent(i),s=C.shards[i];e.writeU32(flags);e.add(4).writeU32(s.n);e.add(8).writeU64(uint64('0x'+s.h));}
 rec.add(0x5a).writeU16(C.shards.length);rec.add(0x70).writeU32(C.size);
 send({s:'zoneInjected',file:C.file,shards:C.shards.length,size:C.size,flags:flags.toString(16)});
}
try{run();}catch(e){send({s:'zoneInjectError',e:String(e)});}
})();
