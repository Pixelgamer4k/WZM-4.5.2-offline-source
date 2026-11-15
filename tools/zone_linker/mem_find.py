import frida,subprocess,struct,sys
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
pats=[struct.pack('<3f',55380.1015625,-30087.0,z).hex(' ') for z in (-20.25,-84.25)]
js="rpc.exports={f(pats){const o=[];for(const r of Process.enumerateRanges('r--')){if(r.size>512*1024*1024)continue;for(let k=0;k<pats.length;k++){let m=[];try{m=Memory.scanSync(r.base,r.size,pats[k]);}catch(e){continue}if(m.length)o.push([k,r.base.toString(),r.file?r.file.path:'',m.length]);}}return o;}};"
sc=s.create_script(js);sc.load()
for x in sc.exports_sync.f(pats):print(['lifted z=-20.25','original z=-84.25'][x[0]],x[1:])
