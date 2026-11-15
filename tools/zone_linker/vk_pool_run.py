#!/usr/bin/env python3
"""vk_pool_run.py <out> <match log> : attach ~1.5 s after a NEW game process starts (before boot finishes), keep the
vk_buffers agent loaded through the match, save uploads into the vertex pool bindings, dump mapped pool buffers."""
import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True);logp=sys.argv[2]
pid=lambda:(subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split() or [None])[0]
old=pid()
while True:
    p=pid()
    if p and p!=old:break
    time.sleep(0.2)
time.sleep(1.5);subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p));log=open(out/'events.jsonl','w');descs=[];up=[0]
def msg(m,data):
    pl=m.get('payload',m)
    if isinstance(pl,dict) and pl.get('s')=='upload' and data:
        up[0]+=1;(out/f"up_{pl['binding']}_{up[0]:05d}_{pl['dof']}.bin").write_bytes(data)
    if isinstance(pl,dict) and pl.get('s')=='desc':descs.append(pl)
    log.write(json.dumps(pl)[:2000]+'\n');log.flush()
sc=s.create_script(open(pathlib.Path(__file__).parent/'vk_buffers.js').read());sc.on('message',msg);sc.load();print('attached',p,flush=True)
t0=time.time()
while time.time()-t0<900:
    try:
        if '"clientEnterWorld"' in open(logp,errors='replace').read():break
    except FileNotFoundError:pass
    if s.is_detached:print('detached');sys.exit(1)
    time.sleep(2)
time.sleep(25)
print('descs',len(descs),'uploads',up[0],flush=True)
done=set()
for d in descs:
    if d['binding'] not in (24,25,44,60,100,101,200) or d['buf'] in done:continue
    done.add(d['buf'])
    try:data=sc.exports_sync.dump(d['buf'],128*1024*1024)
    except Exception as e:print('dump fail',d['binding'],e);continue
    if data:(out/f"pool_b{d['binding']}_{d['buf']}.bin").write_bytes(data);print('dumped',d['binding'],len(data),flush=True)
    else:print('not mapped',d['binding'],d.get('size'),flush=True)
