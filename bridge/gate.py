#!/usr/bin/env python3
"""gate.py <js> <lua>: load a temporary hook, run one Lua chunk, report."""
import pathlib,subprocess,sys,time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone';here=pathlib.Path(__file__).parent
pid=int(subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode())
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
g=s.create_script(pathlib.Path(sys.argv[1]).read_text());g.on('message',lambda m,_:print(m.get('payload',m),flush=True));g.load()
out=subprocess.run([sys.executable,str(here/'lua_exec.py'),sys.argv[2],'10'],capture_output=True,text=True,stdin=subprocess.DEVNULL).stdout
print(out.strip().splitlines()[-1][:700].replace('\\n','\n'))
time.sleep(float(sys.argv[3]) if len(sys.argv)>3 else 6)
g.unload();s.detach()
