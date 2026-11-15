import frida,subprocess,sys,time,json,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
agent,out,secs=sys.argv[1],pathlib.Path(sys.argv[2]),float(sys.argv[3]);out.mkdir(parents=True,exist_ok=True)
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
log=open(out/'events.jsonl','a');base=len(list(out.glob('*.spv')))
def msg(m,data):
    pl=m.get('payload',m)
    if isinstance(pl,dict) and pl.get('s')=='spv' and data:(out/f"b{pl['n']:05d}.spv").write_bytes(data)
    else:log.write(json.dumps(pl)[:2000]+'\n');log.flush()
sc=s.create_script(open(agent).read());sc.on('message',msg);sc.load();print('attached',p,flush=True);time.sleep(secs)
