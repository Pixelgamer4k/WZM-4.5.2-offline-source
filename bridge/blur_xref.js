// Find the structure that owns radial motion blur, by locating pointers TO the
// feature-name string inside the libgame.so image. Bounded: module ranges only.
// Read-only. Dumps nearby fields so the enable flag can be identified by evidence.
{
'use strict';
const mod=Process.getModuleByName('libgame.so');
const b=mod.base,size=mod.size;
const TARGETS=[['gRadialMotionBlurEnabled',0x459a84],['MTL_FUNCTION_CONST_RADIAL_MOTION_BLUR_ENABLED',0x487d1d]];
const out={base:b.toString(),targets:[],hits:[]};
for(const [n,rva] of TARGETS){
  const a=b.add(rva);
  out.targets.push({name:n,addr:a.toString()});
}
// little-endian hex of each address, to scan for pointers
function leHex(p){
  const h=p.toString(16).replace('0x','').padStart(16,'0');
  return h.match(/../g).reverse().join(' ');
}
const patterns=TARGETS.map(([n,rva])=>({name:n,pat:leHex(b.add(rva))}));
for(const r of Process.enumerateRanges('rw-')){
  const inside = r.base.compare(b)>=0 && r.base.add(r.size).compare(b.add(size))<=0;
  if(!inside) continue;
  for(const {name,pat} of patterns){
    try{
      const m=Memory.scanSync(r.base,r.size,pat);
      for(const hit of m.slice(0,8)){
        const entry={name,at:hit.address.toString(),rva:'0x'+hit.address.sub(b).toString(16),fields:[]};
        // dump 0x60 bytes around the pointer as u32s, to spot a 0/1 enable flag
        for(let off=-0x20;off<0x60;off+=4){
          try{ entry.fields.push({off:(off<0?'-0x':'+0x')+Math.abs(off).toString(16),v:0,hex:'0x'+hit.address.add(off).readU32().toString(16)}); }catch(e){}
        }
        out.hits.push(entry);
      }
    }catch(e){}
  }
}
send(out);
}
