#!/usr/bin/env python3
"""advance.py <seconds> <shot dir>: run advance.js, logging and taking a screenshot every 4 s."""
import json,pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone';here=pathlib.Path(__file__).parent
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
t0=time.time()
def msg(m,_):print(round(time.time()-t0,1),json.dumps(m.get('payload',m))[:900],flush=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script((here/'advance.js').read_text());sc.on('message',msg);sc.load()
try:
    n=0
    while time.time()-t0<float(sys.argv[1]):
        time.sleep(4);n+=1
        with open(f'{sys.argv[2]}/a{n:02d}.png','wb') as f:subprocess.run(['adb','-s',D,'exec-out','screencap','-p'],stdout=f,timeout=12)
finally:
    try:sc.unload();s.detach()
    except Exception as e:print('detach',str(e)[:80])
