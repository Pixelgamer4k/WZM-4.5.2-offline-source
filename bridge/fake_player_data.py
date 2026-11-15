#!/usr/bin/env python3
"""fake_player_data.py: at the menu, give the game blank local player data, then seed a profile.
Memory-only. 0x3b6ff14 needs each group's fetch task finished, 0x3b70e5c needs +0x244, and
0x331aaec binds the DDL handle. Buffers are mmap'd so they outlive this script."""
import pathlib,subprocess,sys,threading
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
here=pathlib.Path(__file__).parent
JS=r"""
const b=Process.getModuleByName('libgame.so').base,at=x=>b.add(x);
const mmap=new NativeFunction(Module.getGlobalExportByName('mmap'),'pointer',['pointer','size_t','int','int','int','long']);
const bindStats=new NativeFunction(at(0x331aaec),'void',['int','int','int']);
let done=false;
Interceptor.attach(at(0x337c1c0),{onEnter(){
 if(done)return;
 done=true;
 const table=at(0x54bcb10).readPointer(),size=at(0xc13b090).readU32();
 for(const group of [0,1]){
  const entry=table.add(group*0x248);
  if(entry.readPointer().isNull()){entry.writePointer(mmap(ptr(0),0x66000,3,0x22,-1,0));entry.add(8).writeU32(size);}
  entry.add(0x247).writeU8(0);
  entry.add(0x244).writeU8(1);
 }
 const bound=[];
 for(let group=0;group<14;group++){
  const slot=at(0xc1df528+group*16).readS32();
  if(slot>=0)at(0xc1de450).add(slot*0x68+0x18).writeU32(2);
  if(at(0xc1df520+group*16).readPointer().isNull())continue;
  bindStats(0,0,group);
  bindStats(0,1,group);
  bound.push(group);
 }
 send({size,bound});
}});
"""
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
from device_pid import resolve_game_pid
pid=resolve_game_pid()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
ev=threading.Event()
def msg(m,_):
    print(m.get('payload',m),flush=True);ev.set()
sc=s.create_script(JS);sc.on('message',msg);sc.load()
ok=ev.wait(10)
sc.unload();s.detach()
if not ok:sys.exit('frame hook never fired')
sys.exit(subprocess.call([sys.executable,str(here/'lua_exec.py'),str(here/'fake_player_data.lua'),'10',str(pid)],stderr=subprocess.DEVNULL))
