// Minimal graphics override profile for the "is it our own gfx writes" test.
// Only the resolution preset is touched. No CAS post pass, no texture override,
// no aniso, no SMAA change, no upscaler. Everything else is left at the game's
// own values so a frame-rate difference can only be attributable to these writes.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const d1=at(0x54bd7b8).readPointer().readPointer(),S=0x58;
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const idx={};
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;while(miss<400){if(ok(p)){miss=0;idx[p.readU64().toString(16)]=p;}else miss++;p=p.add(dir*S);}}
// resolution preset only: 6 = Native. Everything else untouched, including the
// frame-rate cap dvar which we measured to have no effect.
const want={'19e76c718fbb7351':6,'1b1ba5e9ed47837e':6};
function apply(){const changed=[];
 for(const h in want){const p=idx[h];if(!p)continue;
  if(p.add(0x28).readS32()!==want[h]){p.add(0x28).writeS32(want[h]);p.add(0x38).writeS32(want[h]);changed.push(h);}}
 return changed;}
send({s:'gfxMinApplied',found:Object.keys(want).filter(h=>idx[h]).length,changed:apply(),note:'resolution preset only'});
let n=0;
setInterval(()=>{const c=apply();if(c.length&&n++<8)send({s:'gfxMinReapplied',changed:c});},1000);
}
