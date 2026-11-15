#!/usr/bin/env python3
"""db_find.py <type> <hex hash>...: read-only. Ask the game's asset lookup 0x19a9930(type, hash, 0)
(the call the Lua loader 0x33285f8 makes for LuaFile, type 0x4b) whether each asset is registered."""
import pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
JS=r"""
rpc.exports={find(type,hexes){
 const base=Process.findModuleByName('libgame.so').base;
 const f=new NativeFunction(base.add(0x19a9930),'pointer',['int','uint64','int']);
 const out={};
 for(const h of hexes){const r=f(type,uint64('0x'+h).and(uint64('0x7fffffffffffffff')),0);out[h]=r.isNull()?null:r.toString();}
 return out;
}};
"""
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.load()
try:
    for h,r in sc.exports_sync.find(int(sys.argv[1],0),sys.argv[2:]).items():print(h,r)
finally:
    sc.unload();s.detach()
