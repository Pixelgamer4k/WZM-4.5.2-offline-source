import frida,subprocess,time,json
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
dec=open('work/nuketown/decoded.bin','rb').read();raw=dec[0xc1c786:0xc1c786+4091200]
pats=[]
for i in (1000,50000,200000,400000):
    a=raw[i*8:i*8+8];b=raw[i*8+8:i*8+16]
    pats.append(a.hex(' ')+' '+'?? '*8+b.hex(' '))
    pats.append(a.hex(' ')+' '+b.hex(' '))
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
js="""rpc.exports={find(pats){const out=[];for(const r of Process.enumerateRanges('r--')){if(r.size>512*1024*1024)continue;const path=r.file?r.file.path:'';
 for(let k=0;k<pats.length;k++){let m=[];try{m=Memory.scanSync(r.base,r.size,pats[k]);}catch(e){continue}
  if(m.length)out.push([k,r.base.toString(),r.size,path,m.length,m[0].address.toString()]);}}return out;}};"""
sc=s.create_script(js);sc.load();res=sc.exports_sync.find(pats)
for x in res:print(x)
