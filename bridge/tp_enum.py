"""tp_enum.py: enumerate live dvars, resolve names, and print third-person/camera candidates."""
import json, re, sys, frida
from pathlib import Path
from device_pid import resolve_game_pid
s = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
j = s.create_script(Path(__file__).with_name('dvar_enum.js').read_text()); j.load(); e = j.exports_sync
print('dvars', e.count())
allv = e.dump(); named = e.named()
print('named', len(named))
json.dump(allv, open('/tmp/dvars_all.json', 'w'))
json.dump(named, open('/tmp/dvars_named.json', 'w'))
hits = [d for d in named if re.search(r'third|3rd|camera|view', d['name'], re.I)]
for d in hits[:60]:
    print(json.dumps(d))
print('hits', len(hits))
j.unload(); s.detach()
