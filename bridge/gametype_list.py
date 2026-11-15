import pathlib,subprocess,sys
"""gametype_list.py: read-only-ish. Calls the game-type list builder 0x3ab2464(arg) for arg 0..2 and prints
entry hashes (name them with FNV-1a offset 0x47f5817a5ef961ba). Run at the menu."""
pass
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
JS=r"""
rpc.exports={list(){
 const b=Process.findModuleByName('libgame.so').base;
 const build=new NativeFunction(b.add(0x3ab2464),'pointer',['int']);
 const out={};
 for(const arg of [0,1,2]){let l;try{l=build(arg);}catch(e){out[arg]='err '+e;continue;}
  if(l.isNull()){out[arg]='null';continue;}
  const n=l.add(8).readU32(),arr=l.add(0x10).readPointer(),hs=[];
  for(let i=0;i<n&&i<200;i++){const e=arr.add(i*8).readPointer();if(!e.isNull())hs.push(e.readU64().and(uint64('0x7fffffffffffffff')).toString(16));}
  out[arg]={n,hs};}
 out.cached=b.add(0xc115e88).readPointer().toString();
 return out;}};
"""
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().split()[0])
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.load()
import json;print(json.dumps(sc.exports_sync.list()))
sc.unload();s.detach()
