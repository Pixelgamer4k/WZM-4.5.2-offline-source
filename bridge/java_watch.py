#!/usr/bin/env python3
"""java_watch.py <compiled agent> <seconds> <out.jsonl>: read-only. Attach a Java-bridge agent to the running
game and log Activity finish/close/back/restart and process exit calls with Java stack traces."""
import json,pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(sys.argv[4]) if len(sys.argv)>4 else int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().split()[0])
out=open(sys.argv[3],'w')
def msg(m,_):
    p=m.get('payload',m);p['t']=time.strftime('%H:%M:%S');out.write(json.dumps(p)+'\n');out.flush()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
msg({'payload':{'s':'observerAttachedProcess','pid':pid}},None)
sc=s.create_script(open(sys.argv[1]).read());sc.on('message',msg);sc.load()
time.sleep(float(sys.argv[2]))
try:sc.unload();s.detach()
except Exception:pass
