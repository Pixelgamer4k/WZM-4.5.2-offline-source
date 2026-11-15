"""tp_run.py <js-file> [seconds]: attach, run a probe script, print every message (send or error)."""
import sys, time, json, frida
from pathlib import Path
from device_pid import resolve_game_pid
src = Path(sys.argv[1]).read_text()
wait = float(sys.argv[2]) if len(sys.argv) > 2 else 8
s = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
got = []
sc = s.create_script(src)
sc.on('message', lambda m, d: got.append(m))
sc.load()
time.sleep(wait)
try:
    sc.unload()
except Exception:
    pass
s.detach()
for m in got:
    if m.get('type') == 'error':
        print('ERROR:', m.get('description'))
        print((m.get('stack') or '')[:600])
    else:
        print(json.dumps(m.get('payload'), indent=1)[:5000])
