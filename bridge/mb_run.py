"""mb_run.py [max] [gain] [shape]: attach motion-blur driver to the running game and keep it loaded (Ctrl-C to stop)."""
import sys,json,time,frida
from pathlib import Path
from device_pid import resolve_game_pid
a=sys.argv[1:];env={}
for k,v in zip(['max','gain','shape'],a): env[k]=float(v)
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
j=s.create_script('globalThis.WZM_MB_ENV='+json.dumps(env)+';\n'+Path(__file__).with_name('mblur_drive.js').read_text())
j.on('message',lambda m,_:print(json.dumps(m.get('payload',m)),flush=True));j.load()
try:
    while not s.is_detached: time.sleep(1)
except KeyboardInterrupt: pass
