#!/usr/bin/env python3
"""mode_minimal.py: switch to mode 0 and back to 10 with one hook, then report session state."""
import os,pathlib,subprocess,sys,threading,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone';here=pathlib.Path(__file__).parent
threading.Timer(30,lambda:os._exit(3)).start()
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script((here/'mode_minimal.js').read_text());sc.on('message',lambda m,_:print(m.get('payload',m),flush=True));sc.load()
print('before',sc.exports_sync.read(),flush=True)
sc.exports_sync.mode(0);time.sleep(3);print('after 0',sc.exports_sync.read(),flush=True)
sc.exports_sync.mode(10);time.sleep(8);print('after 10',sc.exports_sync.read(),flush=True)
os._exit(0)
