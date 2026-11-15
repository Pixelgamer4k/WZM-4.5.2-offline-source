#!/usr/bin/env python3
"""map_transition.py <seconds> <log> <step>...: run map_transition.js. Steps: go:<map> mode:<index> reset dump wait:<s>. Screenshots go beside the log. Exits hard so a stuck detach cannot hang."""
import json,os,pathlib,subprocess,sys,threading,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone';here=pathlib.Path(__file__).parent
threading.Timer(float(sys.argv[1])+20,lambda:os._exit(3)).start()
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
out=open(sys.argv[2],'w');t0=time.time()
def msg(m,_):
    l=f"{time.time()-t0:.1f} {json.dumps(m.get('payload',m))[:1500]}";print(l,flush=True);out.write(l+'\n');out.flush()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script((here/'map_transition.js').read_text());sc.on('message',msg);sc.load()
time.sleep(1)
for st in sys.argv[3:]:
    c,_,v=st.partition(':')
    if c=='go':sc.exports_sync.go(v)
    elif c=='mode':sc.exports_sync.mode(int(v))
    elif c=='reset':sc.exports_sync.reset()
    elif c=='wait':time.sleep(float(v))
    elif c=='dump':sc.exports_sync.dump()
n=0
while time.time()-t0<float(sys.argv[1]):
    time.sleep(6);n+=1
    try:
        with open(f'{sys.argv[2]}.{n}.png','wb') as f:subprocess.run(['adb','-s',D,'exec-out','screencap','-p'],stdout=f,timeout=10)
        print(round(time.time()-t0,1),'alive',subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().strip(),flush=True)
    except Exception as e:print('shot',str(e)[:80])
os._exit(0)
