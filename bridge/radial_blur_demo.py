"""Bounded radial-blur visual test; transient view fields only, automatically expires."""
import frida,json,time,threading
from device_pid import resolve_game_pid
js=r'''
const b=Process.getModuleByName('libgame.so').base;
const d=b.add(0x54d4d48).readPointer().readPointer();
if(d.readU64().toString(16)!=='6eeba106b70638d9'||d.add(0x15).readU8()!==0||d.add(0x28).readU8()!==1)throw Error('Radial setting identity/state mismatch');
const began=Date.now(),end=began+35000;let applied=0,consumed=0,expired=false;
Interceptor.attach(b.add(0x2eb7040),{onEnter(a){this.p=a[0];},onLeave(){
 const p=this.p;
 if(Date.now()>=end){if(!expired){expired=true;send({s:'radialDemoExpired',applied,consumed});}return;}
 // Original builder produces these exact view fields. Strengths are inside
 // the corresponding native float domains [-1,1] and [0,1]. Next natural
 // builder call overwrites them after expiry; no persistent setting changes.
 p.add(0x8e50).writeU8(1);p.add(0x8e54).writeFloat(0.15);p.add(0x8e58).writeFloat(0.5);
 if(applied++===0)send({s:'radialDemoApplied',seconds:35,first:0.15,second:0.5});
}});
Interceptor.attach(b.add(0x2cee158),{onEnter(a){if(Date.now()>=end)return;const p=a[2];if(p.add(0x8e50).readU8()&&consumed++<2)send({s:'radialDemoConsumed',enabled:p.add(0x8e50).readU8(),first:p.add(0x8e54).readFloat(),second:p.add(0x8e58).readFloat()});}});
send({s:'radialDemoLoaded',pid:Process.id,expiresAfterSeconds:35});
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());j=s.create_script(js)
def msg(m,_):print(json.dumps(m.get('payload',m)),flush=True)
j.on('message',msg);j.load()
try:time.sleep(40)
finally:j.unload();s.detach();print(json.dumps({'s':'radialDemoDetached'}),flush=True)
