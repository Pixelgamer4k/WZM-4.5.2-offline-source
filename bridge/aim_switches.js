// WZM_AIM_SWITCHES=1: turn the aim-assist profile switches ON (memory-only). The offline profile is re-seeded blank on
// every boot (fake_player_data), so this re-applies them. Handlers found in command_registry.json (8 Nov 2026):
//   profile_toggleAutoAim 0x13f4144 -> getter 0x14f27ac / setter 0x1497384
//   profile_toggleTargetAssist 0x13f41b8 -> getter 0x1505c68 / setter 0x14d52ec
//   profile_aimAssistFovScale 0x13f6a48 -> setter 0x1494224   (no device suffix, so it applies to the controller too)
// profile_aimAssistTouch (0x13f422c) is deliberately NOT touched: it is the touch-screen switch and the owner plays with a controller.
// All take (profile object at libgame+0x5df1820, bool). They only flip profile booleans; there is no strength value.
// Runs on the game's UI frame thread (same entry the other bridge scripts use), at most once per 2 s.
{
const b=Process.getModuleByName('libgame.so').base,at=n=>b.add(n);
const prof=at(0x5df1820);
const fn=(a,r,p)=>new NativeFunction(at(a),r,p);
const setAuto=fn(0x1497384,'void',['pointer','int']),setTarget=fn(0x14d52ec,'void',['pointer','int']);
const setFov=fn(0x1494224,'void',['pointer','int']);
const getAuto=fn(0x14f27ac,'int',['pointer']),getTarget=fn(0x1505c68,'int',['pointer']);
let last=0,applied=0,errors=0;
Interceptor.attach(at(0x337c1c0),{onEnter(){
 const now=Date.now();if(now-last<2000||errors>3)return;last=now;
 try{
  const a=getAuto(prof)&1,t=getTarget(prof)&1;
  if(a&&t&&applied>0)return;               // already on; the getters are our only read-back
  setAuto(prof,1);setTarget(prof,1);setFov(prof,1);
  applied++;
  send({s:'aimSwitches',n:applied,before:{auto:a,target:t},after:{auto:getAuto(prof)&1,target:getTarget(prof)&1}});
 }catch(e){errors++;send({s:'aimSwitchesError',e:String(e).slice(0,160)});}
}});
send({s:'aimSwitchesArmed'});
}
