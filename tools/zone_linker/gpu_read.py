import frida,subprocess,sys,pathlib
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
sc=s.create_script("rpc.exports={read(b,n){return ptr(b).readByteArray(n);},ranges(){return Process.enumerateRanges('r--').filter(r=>r.file&&/kgsl/.test(r.file.path)).map(r=>[r.base.toString(),r.size]);}};");sc.load()
cmd=sys.argv[1]
if cmd=='read':pathlib.Path(sys.argv[4]).write_bytes(sc.exports_sync.read(sys.argv[2],int(sys.argv[3])));print('ok')
else:
    import json;pathlib.Path(sys.argv[2]).write_text(json.dumps(sc.exports_sync.ranges()));print('ranges saved')
