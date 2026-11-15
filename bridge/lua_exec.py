#!/usr/bin/env python3
"""lua_exec.py <file.lua>: run a Lua chunk once on the WZM game thread, print its return value."""
import pathlib,subprocess,sys,threading
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'frida_venv/lib/python3.13/site-packages'))
import frida
D='PHONE_IP:5555';P='com.activision.callofduty.warzone'
here=pathlib.Path(__file__).parent
subprocess.check_call(['adb','-s',D,'forward','tcp:27042','tcp:27042'],stdout=subprocess.DEVNULL)
pid=sys.argv[3] if len(sys.argv)>3 else subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().strip()
assert pid.isdecimal(),'game not running'
done=threading.Event();res={}
def msg(m,_):
    if m['type']=='send' and m['payload'].get('kind')=='lua_result':res.update(m['payload']['out']);done.set()
    else:print(m,flush=True)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(int(pid))
sc=s.create_script((here/'lua_exec.js').read_text());sc.on('message',msg);sc.load()
try:
    sc.exports_sync.run(pathlib.Path(sys.argv[1]).read_text())
    ok=done.wait(float(sys.argv[2]) if len(sys.argv)>2 else 15)
    print(res if ok else 'TIMEOUT: frame hook never fired')
finally:
    sc.unload();s.detach()
