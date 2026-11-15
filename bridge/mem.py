#!/usr/bin/env python3
"""mem.py <hexaddr[:len]> ...: read libgame.so globals by ELF address from the running game."""
import json,pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
JS="""
const b=Process.getModuleByName('libgame.so').base;
rpc.exports={r(a,n){return Array.from(new Uint8Array(b.add(a).readByteArray(n)));}};
"""
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script(JS);sc.load()
for arg in sys.argv[1:]:
    a,_,n=arg.partition(':');n=int(n or '16',0);d=bytes(sc.exports_sync.r(int(a,16),n))
    print(a,d.hex(' ',4)[:300],'|',''.join(chr(c) if 32<=c<127 else '.' for c in d)[:100])
sc.unload();s.detach()
