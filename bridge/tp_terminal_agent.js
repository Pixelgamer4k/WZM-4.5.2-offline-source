/*
 * Warzone Mobile v4.5.2 -- terminal-controlled session-only 1P/3P camera.
 * No Java bridge, Android views, overlays, game APK writes or Lua changes.
 * Uses original native 3P predicate only for dynamically identified player PS.
 * Original binary SHA256 pinned externally: c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7.
 */
'use strict';
const game = Process.getModuleByName('libgame.so');
const predicateAddress = game.base.add(0x1f6e840);
const cameraCallAddress = game.base.add(0x2326aac);
let localPs=null, localObservedAt=0, cameraCalls=0, overrideCalls=0;
let on=false, override=null, closed=false;
const cameraReader=Interceptor.attach(cameraCallAddress, {
  onEnter() {
    const ps=this.context.x24;
    if (ps && !ps.isNull()) {
      localPs=ps;
      localObservedAt=Date.now();
      cameraCalls++;
    }
  }
});
function info() {
  return {
    mode: on ? 'third-person' : 'first-person',
    ready: !!localPs && (Date.now()-localObservedAt<6000),
    localPlayer: localPs ? localPs.toString() : null,
    cameraCalls, overrideCalls,
    pid: Process.id,
    source: 'original 3P native predicate at ELF VA 0x1f6e840'
  };
}
function mode(enable) {
  if (closed) return {error:'Controller stopped',...info()};
  enable=!!enable;
  if (enable===on) return info();
  if (enable && (!localPs || Date.now()-localObservedAt>=6000)) {
    return {error:'Local player camera not active; enter match first',...info()};
  }
  if(enable) {
    try {
      override=Interceptor.attach(predicateAddress, {
        onEnter(args) {this.isLocal=!!localPs && args[1].equals(localPs);},
        onLeave(ret) {
          if (on && this.isLocal && (ret.toInt32() & 1)===0) {
            ret.replace(ptr(1));
            overrideCalls++;
          }
        }
      });
    } catch(e) {return {error:String(e),...info()};}
    on=true;
  } else {
    on=false;
    if(override) {try{override.detach();}catch(_){} override=null;}
  }
  return info();
}
function stop() {
  if(closed)return {stopped:true};
  mode(false);
  closed=true;
  try{cameraReader.detach();}catch(_){}
  return {stopped:true,mode:'first-person'};
}
rpc.exports={state:info,enable:()=>mode(true),disable:()=>mode(false),toggle:()=>mode(!on),stop};
send({event:'terminal3pControllerLoaded',pid:Process.id});
