#!/usr/bin/env python3
"""level.py <map> [seconds] [shot dir]: request a map on the game thread and log what happens."""
import json,pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone';here=pathlib.Path(__file__).parent
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
t0=time.time()
def msg(m,_):
    e=m.get('payload',m);print(round(time.time()-t0,1),json.dumps(e)[:200],flush=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script((here/'level.js').read_text());sc.on('message',msg);sc.load()
time.sleep(1)
if sys.argv[1]=='check':sc.exports_sync.chk('mp_frontend_mgl mp_mgl_nuketown mp_mgl_crash2 mp_mgl_hardhat mp_mgl_slaughterhouse mp_mgl_ftue_downtown mp_mgl_escape4 mp_mgl_wz2_sierra mp_mgl_br'.split())
elif sys.argv[1].startswith('force:'):sc.exports_sync.frc(sys.argv[1][6:])
else:sc.exports_sync.go(sys.argv[1])
dur=float(sys.argv[2]) if len(sys.argv)>2 else 20
try:
    time.sleep(dur)
finally:
    try:sc.unload();s.detach()
    except Exception as e:print('detach',e)
