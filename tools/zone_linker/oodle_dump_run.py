import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True);secs=float(sys.argv[2])
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p));log=open(out/'meta.jsonl','w')
def msg(m,data):
    pl=m.get('payload',m)
    if isinstance(pl,dict) and pl.get('s')=='dec' and data:(out/f"{pl['n']:06d}.bin").write_bytes(data)
    log.write(json.dumps(pl)[:1500]+'\n');log.flush()
sc=s.create_script(open(pathlib.Path(__file__).parent/'oodle_dump.js').read());sc.on('message',msg);sc.load();print('attached',p,flush=True);time.sleep(secs)
