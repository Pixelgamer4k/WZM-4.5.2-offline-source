#!/usr/bin/env python3
"""load_trace_run.py <out_dir> <seconds>: attach load_trace.js to the running game, save each zone's trace."""
import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True);secs=float(sys.argv[2])
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().split()[0])
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
state={'z':-1,'f':None};log=open(out/'events.jsonl','w')
def msg(m,data):
    p=m.get('payload',m)
    if isinstance(p,dict) and p.get('s')=='zoneStart':
        state['z']+=1;state['f']=open(out/f"zone{state['z']:02d}.bin",'wb')
    if data and state['f']:state['f'].write(data);state['f'].flush()
    log.write(json.dumps({**(p if isinstance(p,dict) else {'m':str(p)}),'t':time.time()})+'\n');log.flush()
sc=s.create_script(open(pathlib.Path(__file__).parent/'load_trace.js').read());sc.on('message',msg);sc.load()
print('attached',pid,flush=True);time.sleep(secs)
