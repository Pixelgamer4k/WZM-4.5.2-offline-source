import frida,subprocess,time,json,struct
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
pat=struct.pack('<4f',52487.0,-33812.0,-196.0,0.0078125).hex(' ')
js="""const pat='%s';const hits=[];
for(const r of Process.enumerateRanges('r--')){if(r.size>1024*1024*1024)continue;let m=[];try{m=Memory.scanSync(r.base,r.size,pat);}catch(e){continue}
 if(m.length)hits.push({base:r.base.toString(),size:r.size,path:r.file?r.file.path:'',n:m.length,first:m.slice(0,4).map(x=>x.address.toString())});}
send(hits);"""%pat
res=[];sc=s.create_script(js);sc.on('message',lambda m,d:res.append(m.get('payload',m)));sc.load()
while not res:time.sleep(1)
for h in res[0]:print(h)
