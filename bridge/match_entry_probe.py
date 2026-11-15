#!/usr/bin/env python3
"""match_entry_probe.py <seconds> [out.json]: attach match_entry_probe.js to the running game, report, hard exit."""
import json,os,sys,threading,time
import frida
secs=float(sys.argv[1]) if len(sys.argv)>1 else 6
threading.Timer(secs+15,lambda:os._exit(3)).start()
d=frida.get_device_manager().add_remote_device('127.0.0.1:27042')
pid=next(p.pid for p in d.enumerate_processes() if p.name in('com.activision.callofduty.warzone','Warzone','Call of Duty')or 'warzone' in p.name.lower())
s=d.attach(pid);sc=s.create_script(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'match_entry_probe.js')).read())
sc.on('message',lambda m,_:print(json.dumps(m.get('payload',m))[:1500],flush=True));sc.load()
time.sleep(secs);r=sc.exports_sync.snap();print(json.dumps(r,indent=1),flush=True)
if len(sys.argv)>2:open(sys.argv[2],'w').write(json.dumps(r,indent=1))
os._exit(0)
