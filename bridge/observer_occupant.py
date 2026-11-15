#!/usr/bin/env python3
"""Put a single non-simulating occupant on the enemy team and report what it becomes.

Finds the newest session that finished the proven party inject (so the connection
token is in the client hash), attaches to that game PID, then runs the observer
agent: creator -> gamestate -> enter-world, then stop. No class, no Veteran setter.

Usage: observer_occupant.py [out.jsonl]
"""
import json
import pathlib
import sys
import time

import frida
from device_pid import resolve_game_pid

here = pathlib.Path(__file__).resolve().parent
runtime = here.parents[1] / 'runtime' / 'match_entry_20261102'
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here.parents[1] / 'runtime' / 'bot_fix_20261105' / 'observer_occupant.jsonl'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text('')


def say(row):
    row.setdefault('captureEpochMs', int(time.time() * 1000))
    line = json.dumps(row)
    with out.open('a') as h:
        h.write(line + '\n')
    print(line[:600], flush=True)


deadline = time.monotonic() + 600
tag = None
started = time.time() - 30
while time.monotonic() < deadline and tag is None:
    cands = sorted(runtime.glob('*.botinject.jsonl'), key=lambda p: p.stat().st_mtime, reverse=True)
    for p in cands[:4]:
        try:
            if p.stat().st_mtime < started:
                continue
            txt = p.read_text(errors='replace')
        except OSError:
            continue
        if 'botInjectFinal' in txt:
            tag = p.name[:-len('.botinject.jsonl')]
            break
    if tag is None:
        time.sleep(2)
if tag is None:
    say({'s': 'observerNoPartyInject'})
    sys.exit(1)

host = runtime / f'{tag}.log'
pid = None
for line in host.read_text(errors='replace').splitlines():
    try:
        row = json.loads(line)
    except ValueError:
        continue
    if row.get('s') == 'attachedProcess':
        pid = row['pid']
if pid is None:
    pid = int(resolve_game_pid())
say({'s': 'observerAttach', 'tag': tag, 'pid': pid})

session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
done = {'v': None}


def on_message(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    say(row)
    if row.get('s') in ('botInjectFinal', 'botInjectError') or message.get('type') == 'error':
        done['v'] = row.get('s') or 'error'


script = session.create_script((here / 'observer_occupant_trial.js').read_text() + '\nglobalThis.wzmBotArm();\n')
script.on('message', on_message)
script.load()
end = time.monotonic() + 90
while time.monotonic() < end and done['v'] is None:
    time.sleep(0.25)
say({'s': 'observerResult', 'result': done['v'], 'pid': pid, 'tag': tag})
# Stay attached briefly so the occupant is not torn down, then leave the session.
time.sleep(10)
try:
    session.detach()
except Exception:
    pass
