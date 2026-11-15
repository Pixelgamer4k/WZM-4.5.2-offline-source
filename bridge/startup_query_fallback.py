#!/usr/bin/env python3
"""Opt-in session experiment: disable one stalled optional initialization query.

The query identity is observed, its feature name is UNKNOWN. Not a production
launcher fix. Exact opcode guard; memory-only; unloading restores original code.
"""
import argparse,json,pathlib,subprocess,time
import frida
from device_pid import resolve_game_pid
HERE=pathlib.Path(__file__).parent
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--experiment',action='store_true',required=True)
ap.add_argument('--seconds',type=int,default=80)
ap.add_argument('--out',type=pathlib.Path,required=True)
a=ap.parse_args()
D=['adb','-s','PHONE_IP:5555'];P='com.activision.callofduty.warzone'
subprocess.run(D+['shell',f"su -c 'am force-stop {P}; am start -n {P}/com.activision.game.MainActivity'"],stdout=subprocess.DEVNULL,check=True)
subprocess.run(D+['forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL,check=True)
for _ in range(30):
 try:pid=resolve_game_pid();break
 except Exception:time.sleep(.2)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
js=r'''
let callback=null,original=null,armed=false;
const timer=setInterval(()=>{
 if(armed)return;
 const m=Process.findModuleByName('libgame.so');if(!m)return;
 const address=m.base.add(0x38fe9bc);
 try{
  if(address.readU32()!==0xd10283ff)return;
  callback=new NativeCallback((obj,hash)=>{
   if(hash.toString(16)==='35571b21e68c8641'){
    send({kind:'disabled_query',hash:hash.toString(16)});return 0;
   }
   return original(obj,hash);
  },'int',['pointer','uint64']);
  const trampoline=Interceptor.replaceFast(address,callback);
  original=new NativeFunction(trampoline,'int',['pointer','uint64']);
  armed=true;clearInterval(timer);send({kind:'armed',base:m.base.toString(),opcode:'d10283ff'});
 }catch(e){send({kind:'hook_error',error:String(e)});clearInterval(timer);}
},20);
'''
rows=[]
def on_message(m,_):
 rows.append(m);print(json.dumps(m),flush=True)
sc=s.create_script(js);sc.on('message',on_message);sc.load()
try:
 for _ in range(a.seconds):time.sleep(1)
finally:
 sc.unload();s.detach();a.out.write_text(json.dumps({'pid':pid,'events':rows,'experimental':True},indent=2))
