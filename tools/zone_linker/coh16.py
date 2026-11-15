import frida,subprocess,time,json
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
p=subprocess.run(['adb','-s',D,'shell','pidof',P],capture_output=True,text=True).stdout.split()[0]
subprocess.run(['adb','-s',D,'forward','tcp:27042','tcp:27042'],capture_output=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(p))
cand=json.load(open('pool/kgsl_cand.json'))
js="""const cm=new CModule(`
unsigned long coh(const unsigned char*p,unsigned long n,unsigned long stride,unsigned long w0){unsigned long good=0,tot=0;
 unsigned int px=0,py=0,pz=0;int have=0;
 for(unsigned long o=0;o+stride<=n;o+=stride){const unsigned int*w=(const unsigned int*)(p+o+w0*4);unsigned int lo=w[0],hi=w[1];
  if(!lo&&!hi){have=0;continue;}
  unsigned int x=lo&0x1FFFFF,y=(lo>>21)|((hi&1023)<<11),z=(hi>>10)&0x1FFFFF;
  if(have){tot++;unsigned int dx=x>px?x-px:px-x,dy=y>py?y-py:py-y,dz=z>pz?z-pz:pz-z;if(dx<65536&&dy<65536&&dz<65536)good++;}
  px=x;py=y;pz=z;have=1;}
 return (good<<32)|tot;}`);
const f=new NativeFunction(cm.coh,'uint64',['pointer','ulong','ulong','ulong']);
rpc.exports={run(c){const out=[];for(const [b,n] of c){for(const [st,w0] of [[16,0],[16,2],[8,0]]){let r;try{r=f(ptr(b),n,st,w0);}catch(e){continue}
 const g=r.shr(32).toNumber(),t=r.and(0xffffffff).toNumber();out.push([b,n,st,w0,t?g/t:0,t]);}}return out;}};"""
sc=s.create_script(js);sc.load()
res=sc.exports_sync.run(cand)
res.sort(key=lambda x:-x[4])
for x in res[:15]:print(x[0],x[1]>>20,'MB stride',x[2],'w',x[3],'coherent',round(x[4],3),'pairs',x[5])
json.dump(res,open('pool/coh16.json','w'))
