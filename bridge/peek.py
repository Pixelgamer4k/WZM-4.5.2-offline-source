#!/usr/bin/env python3
"""peek.py <hexaddr> ...: print 8 u64 at each runtime address, with libgame-relative values."""
import pathlib,subprocess,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
sc=s.create_script("""const m=Process.getModuleByName('libgame.so');
rpc.exports={r(a){const p=ptr(a),o=[];for(let i=0;i<8;i++){const v=p.add(i*8).readPointer();o.push(v.compare(m.base)>=0&&v.compare(m.base.add(m.size))<0?'G+'+v.sub(m.base):v.toString());}return o;}};""")
sc.load()
for a in sys.argv[1:]:print(a,sc.exports_sync.r(a))
sc.unload();s.detach()
