"""Bounded natural render-view blur observations; no writes or forced render calls."""
import frida,json,threading
from device_pid import resolve_game_pid
js=r'''
const b=Process.getModuleByName('libgame.so').base;let n=0;
Interceptor.attach(b.add(0x2eb7040),{onEnter(a){this.p=a[0];},onLeave(){if(n++>=6)return;try{send({s:'radialBlurView',pid:Process.id,enabled:this.p.add(0x8e50).readU8(),value54:this.p.add(0x8e54).readFloat(),value58:this.p.add(0x8e58).readFloat()});}catch(e){send({s:'radialBlurReadError',error:String(e)});}}});
'''
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid());j=s.create_script(js);done=threading.Event();n=[0]
def msg(m,_):
 print(json.dumps(m.get('payload',m)),flush=True);n[0]+=1
 if n[0]>=6:done.set()
j.on('message',msg);j.load()
try:done.wait(8)
finally:j.unload();s.detach()
