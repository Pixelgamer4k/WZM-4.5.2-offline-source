"""js_once.py AGENT.js [seconds]: attach to the running game, load a one-shot agent, print its messages."""
import sys,json,time,frida
from pathlib import Path
from device_pid import resolve_game_pid
pid=resolve_game_pid()
s=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
j=s.create_script(Path(sys.argv[1]).read_text())
j.on('message',lambda m,_:print(json.dumps(m.get('payload',m)),flush=True))
j.load();time.sleep(float(sys.argv[2]) if len(sys.argv)>2 else 2);j.unload();s.detach()
