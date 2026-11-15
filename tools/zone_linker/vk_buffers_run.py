import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True);wait=float(sys.argv[2]);log_path=sys.argv[3]
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p));log=open(out/'events.jsonl','w');descs=[]
def msg(m,data):
    pl=m.get('payload',m);log.write(json.dumps(pl)[:3000]+'\n');log.flush()
    if isinstance(pl,dict) and pl.get('s')=='desc':descs.append(pl)
sc=s.create_script(open(pathlib.Path(__file__).parent/'vk_buffers.js').read());sc.on('message',msg);sc.load();print('attached',p,flush=True)
t0=time.time()
while time.time()-t0<600:
    try:
        if '"clientEnterWorld"' in open(log_path,errors='replace').read():break
    except FileNotFoundError:pass
    time.sleep(2)
time.sleep(wait)
print('descs',len(descs),'info',json.dumps(sc.exports_sync.info())[:500],flush=True)
done=set()
for d in descs:
    if not d.get('mapped') or d['buf'] in done:continue
    done.add(d['buf'])
    try:data=sc.exports_sync.dump(d['buf'],64*1024*1024)
    except Exception as e:print('dump fail',d['binding'],e);continue
    if data:(out/f"b{d['binding']}_{d['buf']}.bin").write_bytes(data);print('dumped',d['binding'],d['buf'],len(data),flush=True)
