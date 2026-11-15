#!/usr/bin/env python3
"""After the player is spawned, add real bots once, then detach that script."""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
log = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
count = int(sys.argv[3]) if len(sys.argv) > 3 else 4
out.parent.mkdir(parents=True, exist_ok=True)

def say(row):
    row.setdefault('captureEpochMs', int(time.time() * 1000))
    line = json.dumps(row)
    with out.open('a') as handle:
        handle.write(line + '\n')
    print(line, flush=True)

out.write_text('')
end = time.monotonic() + 180
spawned = False
while time.monotonic() < end and not spawned:
    if log.exists():
        text = log.read_text(errors='replace')
        spawned = '"matchProbe"' in text and 'spec=false' in text
    if not spawned:
        time.sleep(0.5)
if not spawned:
    say({'s': 'crash2NoSpawn'})
    sys.exit(1)
pid = resolve_game_pid()
say({'s': 'crash2Attach', 'pid': pid, 'count': count})
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
done = {'s': None}

def on_message(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    say(row)
    if row.get('s') in ('botInjectFinal', 'botInjectError') or message.get('type') == 'error':
        done['s'] = row.get('s') or 'error'

source = 'globalThis.WZM_CRASH2_BOTS=' + json.dumps({'count': count}) + ';\n'
source += (here / 'crash2_real_bots.js').read_text() + '\nglobalThis.wzmBotArm();\n'
script = session.create_script(source)
script.on('message', on_message)
script.load()
limit = time.monotonic() + 45
while time.monotonic() < limit and done['s'] is None:
    time.sleep(0.2)
time.sleep(0.3)
try:
    script.exports_sync.stop()
except Exception as error:
    say({'s': 'crash2StopError', 'error': str(error)})
try:
    script.unload()
    session.detach()
except Exception:
    pass
say({'s': 'crash2Detached', 'result': done['s']})
sys.exit(0 if done['s'] == 'botInjectFinal' else 1)
