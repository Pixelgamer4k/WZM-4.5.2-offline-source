// Find and enable radial motion blur (the cinematic camera smear).
// This build exposes it as MTL_FUNCTION_CONST_RADIAL_MOTION_BLUR_ENABLED /
// gRadialMotionBlurEnabled rather than a plain dvar, so the entry is located by
// resolving the name string and then matching a dvar-table entry that points at it.
// Bounded scan only: the dvar registry itself, not every writable range.
// globalThis.WZM_BLUR_MODE = 'find' | number (write that value)
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const want=globalThis.WZM_BLUR_MODE===undefined?'find':globalThis.WZM_BLUR_MODE;
const names=['gRadialMotionBlurEnabled','MTL_FUNCTION_CONST_RADIAL_MOTION_BLUR_ENABLED'];
function esc(s){return s.split('').map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');}
const addrs=[];
for(const n of names){
  for(const r of Process.enumerateRanges('r--')){
    try{const m=Memory.scanSync(r.base,r.size,esc(n));if(m.length){addrs.push({name:n,addr:m[0].address});break;}}catch(e){}
  }
}
send({s:'blurStrings',found:addrs.map(a=>({name:a.name,addr:a.addr.toString()}))});
// dvar registry
const d1=at(0x54bd7b8).readPointer().readPointer(),S=0x58;
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const entries=[];
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;
  while(miss<400){if(ok(p)){miss=0;entries.push(p);}else miss++;p=p.add(dir*S);}}
send({s:'blurTableSize',count:entries.length});
// an entry's name may be stored as a pointer to the string, or as a hash of it.
// Check pointer equality at any aligned offset within the entry.
const hits=[];
for(const a of addrs){
  for(const p of entries){
    for(let off=0;off<0x58;off+=8){
      try{ if(p.add(off).readPointer().equals(a.addr)){ hits.push({name:a.name,off:'0x'+off.toString(16),type:p.add(0x15).readU8(),cur32:p.add(0x28).readS32(),ptr:p.toString()}); } }catch(e){}
    }
  }
}
send({s:'blurPointerHits',hits});
// Also try: the string may sit inside a name blob that the entry points into (offset match)
const nearHits=[];
for(const a of addrs){
  for(const p of entries){
    for(let off=0;off<0x58;off+=8){
      try{
        const q=p.add(off).readPointer();
        if(q.isNull())continue;
        const d=q.sub(a.addr);
        if(d.compare(0)>=0&&d.compare(0x100)<0){ nearHits.push({name:a.name,off:'0x'+off.toString(16),delta:d.toInt32(),type:p.add(0x15).readU8(),cur32:p.add(0x28).readS32(),ptr:p.toString()}); }
      }catch(e){}
    }
  }
}
send({s:'blurNearHits',hits:nearHits.slice(0,20)});
if(typeof want==='number'&&hits.length){
  const tgt=hits[0];
  const p=ptr(tgt.ptr);
  const before=p.add(0x28).readS32();
  p.add(0x28).writeS32(want);p.add(0x38).writeS32(want);
  send({s:'blurWritten',ptr:tgt.ptr,before,after:p.add(0x28).readS32(),value:want});
}
}
