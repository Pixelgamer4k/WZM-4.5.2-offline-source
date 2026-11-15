/*
 * WZM 4.5.2.22729281 — reversible, session-only 1P/3P toggle.
 * Crash2 TDM bot session: the original 3P predicate was live-tested successfully.
 * Does not modify APK or player state; changes native predicate's computed return
 * ONLY for the local player. On disable, detaches the override automatically.
 * We learn the local player-state pointer from the original first-party camera
 * callsite (0x2326aac, X24); never reuse an ASLR/heap pointer from an earlier run.
 */
'use strict';
import Java from 'frida-java-bridge';
const game = Process.getModuleByName('libgame.so');
const predicate = game.base.add(0x1f6e840);
const cameraCall = game.base.add(0x2326aac);
let localPs = null, localLastMs = 0, cameraCalls = 0;
let enabled = false, hook = null, overrideCalls = 0, button = null;
let reportedFailure = null, shuttingDown = false;
let setterCount = 0;
function state() {
 return { mode: enabled ? 'third-person' : 'first-person',
  ready: !!localPs && (Date.now()-localLastMs<6000),
  localPlayer: localPs ? String(localPs) : null,
  cameraCalls, overrideCalls, setterCount,
  button: button !== null, buttonError:reportedFailure };
}
const cameraReader = Interceptor.attach(cameraCall, {
 onEnter() {
  const v=this.context.x24;
  if (v && !v.isNull()) {
   localPs=v;
   localLastMs=Date.now();
   cameraCalls++;
  }
 }
});
function updateButton() {
 if (!button || !Java.available) return;
 try {
  Java.scheduleOnMainThread(function(){
   try {
    button.setText(Java.use('java.lang.String').$new(enabled ? '1P' : '3P'));
    button.setContentDescription(Java.use('java.lang.String').$new(enabled ? 'Switch to first-person camera' : 'Switch to third-person camera'));
   } catch (_) {}
  });
 }catch(_){}
}
function setMode(next) {
 if (shuttingDown) return {error:'controller shutting down',...state()};
 next=!!next;
 if (next === enabled) return state();
 if (next && (!localPs || Date.now() - localLastMs > 6000)) {
  return {error:'Local player camera not active: enter match and spawn first',...state()};
 }
 if (next) {
  try {
   hook=Interceptor.attach(predicate, {
    onEnter(args) {this.local=!!(localPs && args[1].equals(localPs));},
    onLeave(ret) {
     if (enabled && this.local) {
      if ((ret.toInt32() & 1) === 0) {ret.replace(ptr(1));overrideCalls++;}
     }
    }
   });
  } catch(e) {reportedFailure=String(e);return {error:reportedFailure,...state()};}
  enabled=true;
 } else {
  enabled=false;
  if (hook) {try{hook.detach()}catch(_){} hook=null;}
 }
 setterCount++;
 updateButton();
 const value=state();
 send({event:'thirdPersonModeChanged',...value});
 return value;
}
function cleanup() {
 if(shuttingDown)return {stopped:true};
 setMode(false);
 shuttingDown=true;
 try{cameraReader.detach()}catch(_){}
 if(button && Java.available){
  try{Java.scheduleOnMainThread(function(){try{const par=button.getParent();if(par)par.removeView(button);}catch(_){}button=null;})}catch(_){}
 }
 return {stopped:true,mode:'first-person'};
}
rpc.exports={
 state:state,
 enable:()=>setMode(true),
 disable:()=>setMode(false),
 toggle:()=>setMode(!enabled),
 shutdown:cleanup
};
if(Java.available) {
 try{
  Java.perform(function(){
   let activity=null;
   Java.choose('com.activision.game.MainActivity',{
    onMatch:function(a){activity=Java.retain(a);return 'stop';},
    onComplete:function(){
     if(!activity){reportedFailure='MainActivity not found';send({event:'thirdPersonButtonUnavailable',error:reportedFailure});return;}
     Java.scheduleOnMainThread(function(){
      try{
       const Button=Java.use('android.widget.Button');
       const Layout=Java.use('android.widget.FrameLayout$LayoutParams');
       const ClickListener=Java.use('android.view.View$OnClickListener');
       const ViewGroup=Java.use('android.view.ViewGroup');
       const Click=Java.registerClass({
        name:'com.wzm.offline.ThirdPersonClick'+Date.now(),
        implements:[ClickListener],
        methods:{onClick:function(){setMode(!enabled);}}
       });
       const params=Layout.$new(154,78);
       params.gravity.value=49; // TOP|CENTER_HORIZONTAL, away from movement/fire controls
       params.topMargin.value=22;
       const b=Button.$new(activity);
       b.setText(Java.use('java.lang.String').$new('3P'));
       b.setAllCaps(false);
       b.setTextColor(-1);
       b.setAlpha(0.85);
       b.setContentDescription(Java.use('java.lang.String').$new('Switch to third-person camera'));
       b.setOnClickListener(Click.$new());
       Java.cast(activity.getWindow().getDecorView(),ViewGroup).addView(b,params);
       button=b;
       send({event:'thirdPersonButtonReady',mode:'first-person',label:'3P',position:'top center'});
      }catch(e){reportedFailure=String(e)+' '+(e.stack||'');send({event:'thirdPersonButtonUnavailable',error:reportedFailure});}
     });
    }
   });
  });
 }catch(e){reportedFailure=String(e)+' '+(e.stack||'');send({event:'thirdPersonButtonUnavailable',error:reportedFailure});}
}
send({event:'thirdPersonControllerReady',cameraCallsite:'0x2326aac',predicate:'0x1f6e840',mode:'first-person'});
