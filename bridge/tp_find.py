"""tp_find.py <regex>: search live dvars for third-person cameras by NAME and by OPTION STRINGS."""
import sys, json, frida
from pathlib import Path
from device_pid import resolve_game_pid

pat = sys.argv[1].lower() if len(sys.argv) > 1 else 'third|3p'
s = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
j = s.create_script(Path(__file__).with_name('gfx_set.js').read_text())
j.load()
e = j.exports_sync
data = e.dump()          # list/dict of dvar entries with name, type, value, options
print('dvars:', len(data))
hits = []
for d in (data if isinstance(data, list) else data.values()):
    name = str(d.get('name', '')).lower()
    opts = ' '.join(str(o) for o in (d.get('options') or [])).lower()
    if pat.split('|')[0] in name or 'third' in name or 'thirdperson' in opts or '3rd' in name:
        hits.append(d)
for d in hits:
    print(json.dumps(d)[:400])
print('hits:', len(hits))
j.unload(); s.detach()
