# Throwaway diagnostic: verify how binder ioctls look in-process so the
# host_spawn binder witness filter can be fixed. Read-only.
import frida,sys,time
pid=int(sys.argv[1])
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
js=r'''
const BWR=0xC0306201;
const rlBuf=Memory.alloc(256),pathBuf=Memory.alloc(64);
const readlinkF=new NativeFunction(Module.findGlobalExportByName('readlink'),'long',['pointer','pointer','ulong']);
const fdKind=new Map();
const isBinderFd=fd=>{
  if(fdKind.has(fd))return fdKind.get(fd);
  let k=false,dbg='';
  try{
    pathBuf.writeUtf8String('/proc/self/fd/'+fd);
    const rv=readlinkF(pathBuf,rlBuf,255);
    const n=(typeof rv==='number')?rv:rv.toNumber();
    if(n>0){const t=rlBuf.readCString(Math.min(n,255))||'';dbg=t;k=/binder/.test(t);}
  }catch(e){dbg='ERR '+e;}
  fdKind.set(fd,k);
  send({s:'fdSeen',fd,kind:k,target:dbg});
  return k;
};
let ioCount=0,bwrCount=0,matchCount=0;
Interceptor.attach(Module.findGlobalExportByName('ioctl'),{onEnter(a){
  ioCount++;
  if(ioCount<=3||ioCount%5000===0)send({s:'ioctlSeen',n:ioCount,req:'0x'+a[1].toUInt32().toString(16)});
  if(a[1].toUInt32()!==BWR)return;
  bwrCount++;
  const fd=a[0].toInt32();
  if(!isBinderFd(fd))return;
  try{
    const b=a[2];
    const wsize=b.readU64().toNumber(),wcons=b.add(8).readU64().toNumber();
    const wbuf=b.add(16).readPointer();
    const rsize=b.add(24).readU64().toNumber(),rcons=b.add(32).readU64().toNumber();
    matchCount++;
    const o={s:'bwr',fd,wsize,wcons,rsize,rcons,match:matchCount,tid:Process.getCurrentThreadId()};
    if(matchCount<=40&&wsize>0&&wsize<=512){
      o.head=Array.from(new Uint8Array(wbuf.readByteArray(Math.min(wsize,80)))).map(x=>('0'+x.toString(16)).slice(-2)).join('');
    }
    send(o);
  }catch(e){send({s:'bwrErr',e:''+e});}
}});
send({s:'probeArmed',pid:Process.id});
'''
sc=s.create_script(js)
sc.on('message',lambda m,_:print(m.get('payload',m),flush=True))
sc.load()
time.sleep(int(sys.argv[2]) if len(sys.argv)>2 else 8)
sc.unload()
