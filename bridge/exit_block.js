// Block the game's own quit path so a re-created activity cannot kill a live match.
//
// Evidence (finish_path_probe, session play_20261106_010244):
//   java.lang.Runtime.exit(0)
//     <- java.lang.System.exit(System.java:1575)
//     <- com.activision.game.MainActivity.onCreate(SourceFile:1035)
// MainActivity.onCreate calls System.exit(0) on a re-launch guard. Blocking the
// native exit means the caller returns normally instead of tearing the process down.
// Included by host_spawn.py under WZM_EXIT_BLOCK=1. Memory-only; no game bytes change.
{
'use strict';
let blocked=0;
for(const name of ['exit','_exit','_Exit']){
  try{
    const p=Module.getGlobalExportByName(name);
    Interceptor.replace(p,new NativeCallback(function(code){
      blocked++;
      // keep logging cheap: first few, then every 50th
      if(blocked<=5||blocked%50===0)send({s:'exitBlocked',fn:name,code:code,count:blocked});
    },'void',['int']));
    send({s:'exitBlockArmed',fn:name});
  }catch(e){ send({s:'exitBlockFailed',fn:name,error:String(e).slice(0,160)}); }
}
}
