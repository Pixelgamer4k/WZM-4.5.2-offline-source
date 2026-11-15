#!/usr/bin/env python3
"""Retain a memory-only offline GVS configuration setting during one menu boot."""
import argparse,json,pathlib,subprocess,time
import frida
from device_pid import resolve_game_pid
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--seconds',type=int,default=1800);ap.add_argument('--log',type=pathlib.Path,required=True);a=ap.parse_args()
D=['adb','-s','PHONE_IP:5555'];P='com.activision.callofduty.warzone';here=pathlib.Path(__file__).parent
subprocess.run(D+['shell',f"su -c 'am force-stop {P}; am start -n {P}/com.activision.game.MainActivity'"],check=True,stdout=subprocess.DEVNULL)
subprocess.run(D+['forward','tcp:27042','tcp:27042'],check=True,stdout=subprocess.DEVNULL)
for _ in range(30):
 try:pid=resolve_game_pid();break
 except Exception:time.sleep(.2)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
f=a.log.open('w');start=time.time()
def message(m,_):
 m['elapsed']=round(time.time()-start,2);f.write(json.dumps(m)+'\n');f.flush();print(json.dumps(m),flush=True)
sc=s.create_script((here/'offline_gvs.js').read_text());sc.on('message',message);sc.load();ready=False
try:
 while time.time()-start<a.seconds:
  time.sleep(1)
  if not ready:
   state=sc.exports_sync.state()
   if state.get('L') not in (None,'0x0'):
    ready=True;message({'type':'send','payload':{'kind':'lui_ready','pid':pid,**state}},None)
finally:
 sc.unload();s.detach();f.close()
