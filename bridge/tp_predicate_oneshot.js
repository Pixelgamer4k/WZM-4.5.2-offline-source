// Opt-in temporary player third-person predicate test. AUTO-DETACH in 6 seconds.
// Target PS pointer determined from immediately preceding current-process read-only trace.
'use strict';
const mod=Process.getModuleByName('libgame.so'),site=mod.base.add(0x1f6e840);
const targetPs='0x61cce8a764';
let changed=0, seen=0, other=0, errors=0;
const hook=Interceptor.attach(site,{
 onEnter(args){ this.local=(args[1].toString()===targetPs); },
 onLeave(ret){
  if(this.local){seen++;
    try {if((ret.toInt32()&1)===0){ret.replace(ptr(1));changed++;}}
    catch(e){errors++;}
  }else{other++;}
 }
});
send({event:'thirdpersonOverrideEnabled',targetPs,durationMs:6000,offset:'0x1f6e840'});
setTimeout(()=>{hook.detach();send({event:'thirdpersonOverrideDetached',seen,changed,other,errors});},6000);
