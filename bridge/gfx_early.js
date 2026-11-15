// WZM_GFX early agent: attached right after launch. The renderer's one-time streaming setup
// 0x2f73b58 sizes the texture pools from dvars 7747723d51cae53 (A) and 36bb3440cecdb611 (B);
// on >3.5 GB RAM pool1 = 5*A, pool2 = 5*B. Raise A and B just before it runs.
{
const E=globalThis.WZM_GFX_ENV||{};const A_VAL=E.texPool||1280,B_VAL=E.texPool2||480;
function arm(m){const b=m.base,at=n=>b.add(n),rd=g=>at(g).readPointer().readPointer();
 Interceptor.attach(at(0x2f73b58),{onEnter(){
   const A=rd(0x54d4a08),B=rd(0x54d4a18);const before=[A.add(0x28).readS32(),B.add(0x28).readS32()];
   for(const [d,v] of [[A,A_VAL],[B,B_VAL]]){d.add(0x28).writeS32(v);d.add(0x38).writeS32(v);}
   send({s:'gfxEarlyEnter',ramMB:at(0x5729c50).readU64().shr(20).toNumber(),before});},
  onLeave(){send({s:'gfxEarlyDone',pool1:rd(0x54d4a10).add(0x28).readS32(),pool2:rd(0x54d4a20).add(0x28).readS32()});}});
 send({s:'gfxEarlyArmed'});}
const m=Process.findModuleByName('libgame.so');
if(m)arm(m);else{const t=setInterval(()=>{const mm=Process.findModuleByName('libgame.so');if(mm){clearInterval(t);arm(mm);}},5);}
}
