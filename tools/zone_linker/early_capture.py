#!/usr/bin/env python3
"""early_capture.py <agent.js> <out_dir> <secs>: wait for a NEW game process, attach 2 s after it appears, save SPIR-V."""
import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
agent,out,secs=sys.argv[1],pathlib.Path(sys.argv[2]),float(sys.argv[3]);out.mkdir(parents=True,exist_ok=True)
pid=lambda:(subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split() or [None])[0]
old=pid();print('old',old,flush=True)
while True:
    p=pid()
    if p and p!=old:break
    time.sleep(0.3)
time.sleep(2);subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
log=open(out/'events.jsonl','w')
def msg(m,data):
    pl=m.get('payload',m)
    if isinstance(pl,dict) and pl.get('s')=='spv' and data:(out/f"{pl['n']:05d}.spv").write_bytes(data)
    else:log.write(json.dumps(pl)[:2000]+'\n');log.flush()
sc=s.create_script(open(agent).read());sc.on('message',msg);sc.load();print('attached',p,flush=True)
time.sleep(secs)
