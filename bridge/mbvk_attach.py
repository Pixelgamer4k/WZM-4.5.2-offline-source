"""mbvk_attach.py: attach mbvk.js to the RUNNING game (late attach) and keep it loaded."""
import sys,time,json,os,frida
from pathlib import Path
from device_pid import resolve_game_pid
env={k:float(os.environ[v]) for k,v in (('max','WZM_MBLUR_MAX'),('gain','WZM_MBLUR_GAIN')) if os.environ.get(v)}
pid=resolve_game_pid()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
j=s.create_script('globalThis.WZM_MBVK_ENV='+json.dumps(env)+';\n'+Path(__file__).with_name('mbvk.js').read_text())
j.on('message',lambda m,_:print(json.dumps(m.get('payload',m))[:400],flush=True));j.load()
print(json.dumps({'s':'mbvkLateAttached','pid':pid}),flush=True)
while not s.is_detached:time.sleep(1)
print(json.dumps({'s':'mbvkDetached'}),flush=True)
