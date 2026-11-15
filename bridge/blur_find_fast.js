// Fast, targeted radial-motion-blur locator.
// 1. Read the string address straight out of the module image (RVA is stable per build).
// 2. Walk ONLY the dvar registry entries and compare pointer offsets.
// No process-wide scanning, so the script loads instantly.
{
'use strict';
const mod=Process.getModuleByName('libgame.so'),b=mod.base,at=n=>b.add(n);
const want=globalThis.WZM_BLUR_MODE===undefined?'find':globalThis.WZM_BLUR_MODE;
// RVAs of the blur names, resolved from the static image.
// verified from the ELF: file offsets 0x459a84 / 0x487d1d, +0x1000 => VAs below
// ELF: first PT_LOAD maps file offset 0 -> VA 0, so RVA == file offset.
const NAME_RVA={'gRadialMotionBlurEnabled':0x459a84,'MTL_FUNCTION_CONST_RADIAL_MOTION_BLUR_ENABLED':0x487d1d};
const targets=[];
for(const k in NAME_RVA){ if(NAME_RVA[k]!==null) targets.push({name:k,addr:at(NAME_RVA[k])}); }
// verify each really reads as the name; if not, report and stop (never guess)
const out={resolved:[]};
for(const t of targets){
  let s=null;
  try{s=t.addr.readUtf8String(48);}catch(e){}
  out.resolved.push({name:t.name,addr:t.addr.toString(),readsAs:s,ok:s===t.name});
}
const good=out.resolved.filter(r=>r.ok);
// dvar registry
const d1=at(0x54bd7b8).readPointer().readPointer(),S=0x58;
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const entries=[];
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;
  while(miss<400){if(ok(p)){miss=0;entries.push(p);}else miss++;p=p.add(dir*S);}}
out.entryCount=entries.length;
const hits=[];
for(const g of good){
  const a=at(g.addr.toString().startsWith('0x')?parseInt(g.addr,16)-b.toInt32():0);
  for(const p of entries){
    for(let off=0;off<0x58;off+=8){
      try{
        const q=p.add(off).readPointer();
        if(q.isNull())continue;
        if(q.toString()===g.addr){hits.push({name:g.name,kind:'exact',off:'0x'+off.toString(16),type:p.add(0x15).readU8(),cur:p.add(0x28).readS32(),ptr:p.toString()});}
      }catch(e){}
    }
  }
}
out.hits=hits;
send(out);
if(typeof want==='number'&&hits.length){
  const p=ptr(hits[0].ptr),before=p.add(0x28).readS32();
  p.add(0x28).writeS32(want);p.add(0x38).writeS32(want);
  send({s:'blurWritten',ptr:hits[0].ptr,before,after:p.add(0x28).readS32(),value:want});
}
}
