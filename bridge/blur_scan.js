// Locate the motion-blur name strings inside the running libgame.so image only.
// Bounded scan of the module's own readable ranges: no whole-process scanning, no
// assumptions about PT_LOAD mapping. Reports the true address so the RVA can be
// corrected once and for all.
{
'use strict';
const mod=Process.getModuleByName('libgame.so');
const b=mod.base,size=mod.size;
const out={base:b.toString(),size:size.toString(),ranges:0,found:[]};
function pat(s){return s.split('').map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');}
const names=['gRadialMotionBlurEnabled','MTL_FUNCTION_CONST_RADIAL_MOTION_BLUR_ENABLED','InitMotionBlur','SetBlurStrength','SetupBlur'];
let scanned=0;
for(const r of Process.enumerateRanges('r--')){
  // only ranges that fall inside the module image
  const inside = r.base.compare(b)>=0 && r.base.add(r.size).compare(b.add(size))<=0;
  if(!inside) continue;
  out.ranges++; scanned+=r.size;
  for(const n of names){
    if(out.found.some(f=>f.name===n)) continue;
    try{
      const m=Memory.scanSync(r.base,r.size,pat(n));
      if(m.length) out.found.push({name:n,addr:m[0].address.toString(),rva:'0x'+m[0].address.sub(b).toString(16)});
    }catch(e){}
  }
}
out.scannedBytes=scanned;
send(out);
}
