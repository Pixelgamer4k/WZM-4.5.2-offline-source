#!/usr/bin/env python3
"""mode_request.py <row> [timeout s]: at the menu, request game mode <row> (11 = mp_mgl) on the main
thread (UI frame 0x337c1c0) with 0x3ab285c(hash), then wait for the game's own frame loop to apply it
(0x3a5b9b4 runs 0x3ab2960 while byte 0xc0ea0c0 is set). Memory-only. Prints current/pending mode."""
import pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
JS=r"""
const base=Process.findModuleByName('libgame.so').base,at=x=>base.add(x);
const table=()=>at(0x54d9b30).readPointer();
const request=new NativeFunction(at(0x3ab285c),'void',['uint64']);
let row=-1,done=false;
Interceptor.attach(at(0x337c1c0),{onEnter(){
  if(row<0||done)return;done=true;
  const h=table().add(row*0x1a8).readU64().and(uint64('0x7fffffffffffffff'));
  request(h);send({s:'requested',row,hash:h.toString(16),pending:at(0xc115eb0).readU8()});
}});
const rel=p=>{const m=Process.findModuleByAddress(p);return m?m.name+'+'+p.sub(m.base).toString(16):p.toString();};
for(const n of['exit','_exit','abort','kill','raise','pthread_kill'])try{const f=Module.findGlobalExportByName(n);if(f)Interceptor.attach(f,{onEnter(a){
  if(row<0)return;send({s:'libc_'+n,a0:a[0].toString(),bt:Thread.backtrace(this.context,Backtracer.FUZZY).slice(0,10).map(rel)});}});}catch(e){}
// JNI calls made from libgame after the request (method ids are resolved at startup, so log callers).
{const art=Process.getModuleByName('libart.so');const seen=new Map();
 for(const e of art.enumerateExports())if(/^_ZN3art3JNIILb0EE\d+Call\w*Method[VA]?E/.test(e.name))try{Interceptor.attach(e.address,{onEnter(a){
  if(row<0)return;const lr=this.returnAddress;const m=Process.findModuleByAddress(lr);if(!m||m.name!=='libgame.so')return;
  const k=lr.toString();const n=(seen.get(k)||0)+1;seen.set(k,n);if(n>3)return;
  send({s:'jni',fn:e.name.replace(/^_ZN3art3JNIILb0EE\d+/,'').split('EP')[0],caller:rel(lr),tid:Process.getCurrentThreadId()});}});}catch(x){}}
// 0x3ab2960 runs every frame; report only real mode changes.
Interceptor.attach(at(0x3ab2960),{onEnter(){this.c=at(0xc115ea8).readU8();this.p=at(0xc115eb0).readU8();
  if(row>=0&&this.c!==this.p)send({s:'applyEnter',current:this.c,pending:this.p});},
  onLeave(){if(row>=0&&this.c!==this.p)send({s:'applyLeave',current:at(0xc115ea8).readU8()});}});
rpc.exports={go(r){row=r;},state(){return{current:at(0xc115ea8).readU8(),pending:at(0xc115eb0).readU8(),applyGate:at(0xc0ea0c0).readU8()};}};
"""
row=int(sys.argv[1]);timeout=float(sys.argv[2]) if len(sys.argv)>2 else 60
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.on('message',lambda m,_:print(m.get('payload',m),flush=True));sc.load()
try:
    print('before',sc.exports_sync.state(),flush=True)
    sc.exports_sync.go(row)
    t0=time.time();st=None
    while time.time()-t0<timeout:
        time.sleep(1)
        try:st=sc.exports_sync.state()
        except Exception as e:print('state failed',e);break
        if st['current']==row:break
    print('after',round(time.time()-t0,1),'s',st,flush=True)
finally:
    try:sc.unload();s.detach()
    except Exception:pass
