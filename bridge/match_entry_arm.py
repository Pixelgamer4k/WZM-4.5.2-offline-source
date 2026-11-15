#!/usr/bin/env python3
"""match_entry_arm.py <seconds> <map|-> <out.json> [force]: run match_entry_arm.js on the running game, then hard exit."""
import json,os,subprocess,sys,threading,time
import frida
secs=float(sys.argv[1]);m=None if sys.argv[2]=='-' else sys.argv[2];out=sys.argv[3];force=len(sys.argv)>4 and sys.argv[4]=="force"
threading.Timer(secs+15,lambda:os._exit(3)).start()
dev='PHONE_IP:5555'
pid=int(subprocess.check_output(['adb','-s',dev,'shell','pidof','com.activision.callofduty.warzone']).split()[0])
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'match_entry_arm.js')).read())
sc.on('message',lambda x,_:print(json.dumps(x)[:600],flush=True));sc.load()
print('map before',sc.exports_sync.go(m,force),flush=True)
r=None
for i in range(int(secs*2)):
 time.sleep(.5)
 try:r=sc.exports_sync.snap()
 except Exception as e:print('snap failed',e,flush=True);break
print(json.dumps(r,indent=0),flush=True)
open(out,'w').write(json.dumps({'pid':pid,'result':r},indent=1))
os._exit(0)
