// Read-only dvar report for the frame-rate cap, plus an opt-in write so the
// enum mapping can be measured one index at a time.
// globalThis.WZM_FPS_INDEX = <int>  -> writes that index (omit for read-only).
// Nothing else is touched; the same registry scanner as gfx_apply.js is used.
{
'use strict';
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const d1=at(0x54bd7b8).readPointer().readPointer(),S=0x58;
function ok(p){try{const h=p.readU64();const t=p.add(0x15).readU8(),z=p.add(8).readU64();return !h.equals(0)&&z.equals(0)&&t<16&&p.add(0x14).readU8()<=1;}catch(e){return false;}}
const idx={};
for(const dir of [-1,1]){let p=dir>0?d1.add(S):d1;let miss=0;while(miss<400){if(ok(p)){miss=0;idx[p.readU64().toString(16)]=p;}else miss++;p=p.add(dir*S);}}
const HASH='caa98f528ccd5f26';
const names={'caa98f528ccd5f26':'fpsCap','19e76c718fbb7351':'resPreset','1b1ba5e9ed47837e':'resPresetPC','270baabe0eb3399e':'renderPct','ba9243ff7e168cf':'renderPct2','fa96a2168c519506':'upscaler','5cd1f66da730bbca':'temporalOrOff','d2a2a59552643885':'antialiasing'};
function dump(tag){
 const out={};
 for(const h in names){const p=idx[h];if(!p){out[names[h]]='missing';continue;}
  let s32=null,f=null,t=-1;try{t=p.add(0x15).readU8();s32=p.add(0x28).readS32();f=p.add(0x28).readFloat();}catch(e){}
  out[names[h]]={type:t,i:s32,f:Math.round(f*1000)/1000};}
 send({s:'dvarReport',tag,found:Object.keys(idx).length,values:out});
}
dump('initial');
const want=globalThis.WZM_FPS_INDEX;
if(want!==undefined&&want!==null){
 const p=idx[HASH];
 if(!p){send({s:'fpsWriteFailed',reason:'fps dvar not found'});}
 else{
  send({s:'fpsWriteBefore',value:p.add(0x28).readS32(),index:want});
  p.add(0x28).writeS32(want);p.add(0x38).writeS32(want);
  send({s:'fpsWriteAfter',value:p.add(0x28).readS32()});
 }
}
let n=0;
const iv=setInterval(()=>{n++;dump('t'+(n*2)+'s');
 const p=idx[HASH];
 if(p&&want!==undefined&&want!==null){const cur=p.add(0x28).readS32();
  if(cur!==want){p.add(0x28).writeS32(want);p.add(0x38).writeS32(want);send({s:'fpsReapplied',was:cur,now:want});}}
 if(n>=5){clearInterval(iv);send({s:'fpsProbeDone'});}
},2000);
}
