import frida,subprocess,json
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
js="""const cm=new CModule(`

unsigned long scan(const float*p,unsigned long n,unsigned int*out,unsigned int maxo){unsigned long run=0,best=0,bestStart=0,start=0;unsigned int c=0;
 for(unsigned long i=0;i+16<=n/4;i+=16){float a=p[i],b=p[i+1],cc=p[i+2],d=p[i+3];float q=a*a+b*b+cc*cc+d*d;
  if(q>0.98f&&q<1.02f){if(!run)start=i;run++;if(run>best){best=run;bestStart=start;}}else run=0;}
 return (best<<32)|(bestStart*4);}`);
const f=new NativeFunction(cm.scan,'uint64',['pointer','ulong','pointer','uint']);
rpc.exports={run(){const out=[];for(const r of Process.enumerateRanges('r--')){if(r.size<1<<16||r.size>512*1024*1024)continue;let v;try{v=f(r.base,r.size,ptr(0),0);}catch(e){continue}
 const best=v.shr(32).toNumber(),off=v.and(0xffffffff).toNumber();if(best>=200){const a=r.base.add(off);out.push([r.base.toString(),r.size,r.file?r.file.path:'',best,a.toString(),Array.from(new Float32Array(a.readByteArray(64))),Array.from(new Int32Array(a.readByteArray(64)))]);}}return out;}};"""
sc=s.create_script(js);sc.load();res=sc.exports_sync.run()
res.sort(key=lambda x:-x[3])
for x in res[:10]:print(x[0],x[1]>>20,'MB',x[2][-14:],'run',x[3],'at',x[4]);print('   f',x[5][:12]);print('   i',x[6][4:8])
json.dump(res,open('pool/inst_find.json','w'))
