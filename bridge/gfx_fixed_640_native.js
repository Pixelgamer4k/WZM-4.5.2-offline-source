// Session-only fixed 640p (1376x640) native scene sizing for WZM 4.5.2.
// Included after gfx_apply.js only with WZM_GFX_FIXED640=1. No OS display edits.
// Evidence: original 0x2eaf78c receives the discrete dynamic-width index in W6.
// Original 0x2e9f4e8 / 0x2e9f568 build 16 size levels; 0=full width, 15=half.
// Live proof: 75% of a 1824x832 source yields 1376x640 with level 0.
// For a 2112x960 source, 65% gives 1376x640 after native 32px alignment.
{
 const module=Process.getModuleByName('libgame.so');
 const site=module.base.add(0x2eaf78c);
 // Guard against applying to a different game build/native function.
 if(site.readU32()!==0xd101c3ff) {
  send({s:'gfxFixed720Disabled',reason:'unexpected original sizing opcode',found:site.readU32().toString(16)});
 } else {
  let calls=0,forced=0,currentPct=-1,changed=0;
  Interceptor.attach(site,{onEnter(args){
   calls++;
   try{
    const w=args[0].toUInt32(),h=args[1].toUInt32(),level=args[6].toUInt32();
    // Original X5+0x1c is 5 in the verified world sizing path. Do not
    // reinterpret this as an undocumented global DRS-enable dvar.
    const dynamic=(args[5].add(0x1c).readU32()&1)!==0;
    if(dynamic && w>=1200 && h>=600 && w>h && level<=15){
     // Native target align/rounding is 32 pixels. 1376 pre-round width
     // selects 65% (2112 source) or 75% (1824 source): 1376x640 scene.
     const pct=Math.max(40,Math.min(100,Math.round(137600/w)));
     if(pct!==currentPct && globalThis.WZM_GFX_SET_PCT(pct)){
      currentPct=pct;changed++;
      send({s:'gfxFixed640Adapted',sourceWidth:w,sourceHeight:h,pct,desiredScene:'1376x640'});
     }
     this.context.x6=ptr(0);
     forced++;
    }
   }catch(e){}
  }});
  send({s:'gfxFixed640Ready',renderPercent:'adaptive to source',dynamicLevel:0,sceneTarget:'1376x640',displayUntouched:true});
  setInterval(()=>{if(calls)send({s:'gfxFixed640Stats',calls,forced,percent:currentPct,adaptations:changed});calls=forced=0;},60000);
 }
}
