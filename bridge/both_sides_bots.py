#!/usr/bin/env python3
"""Add genuine AI bots to both teams in a live match, then keep the Veteran guard.

Usage: both_sides_bots.py <session_tag> <enemies> <friends> <out.jsonl>

Waits for the proven party inject to report botInjectFinal for that tag, then
creates enemies+friends real marker-2 AI clients (team chosen by the host's
enter-world team hook from WZM_ENEMY_AI) and finally leaves the Veteran guard
attached. Nothing here writes a team field.
"""
import json
import pathlib
import sys
import time

import frida

here = pathlib.Path(__file__).resolve().parent
runtime = here.parents[1] / 'runtime' / 'match_entry_20261102'

tag = sys.argv[1]
enemies = int(sys.argv[2])
friends = int(sys.argv[3])
out = pathlib.Path(sys.argv[4])
total = enemies + friends
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text('')


def say(row):
    row.setdefault('captureEpochMs', int(time.time() * 1000))
    line = json.dumps(row)
    with out.open('a') as handle:
        handle.write(line + '\n')
    print(line, flush=True)


inject = runtime / f'{tag}.botinject.jsonl'
host = runtime / f'{tag}.log'
deadline = time.monotonic() + 420
seen = False
while time.monotonic() < deadline:
    if inject.exists():
        text = inject.read_text(errors='replace')
        if 'botInjectFinal' in text:
            seen = True
            break
        if 'botInjectError' in text:
            say({'s': 'bothSidesSkipped', 'reason': 'party inject failed', 'tag': tag})
            sys.exit(1)
    time.sleep(1)
if not seen:
    say({'s': 'bothSidesNoPartyInject', 'tag': tag})
    sys.exit(1)

pid = None
for line in host.read_text(errors='replace').splitlines():
    try:
        row = json.loads(line)
    except ValueError:
        continue
    if row.get('s') == 'attachedProcess':
        pid = row['pid']
if pid is None:
    say({'s': 'bothSidesNoPid', 'tag': tag})
    sys.exit(1)

say({'s': 'bothSidesAttach', 'pid': pid, 'enemies': enemies, 'friends': friends})
session = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
done = {'s': None}


def on_message(message, _):
    row = message.get('payload', message)
    if not isinstance(row, dict):
        row = {'s': 'fridaMessage', 'value': str(row)}
    say(row)
    if row.get('s') in ('botInjectFinal', 'botInjectError') or message.get('type') == 'error':
        done['s'] = row.get('s') or 'error'


source = 'globalThis.WZM_BOTH_SIDES_AI=' + json.dumps({'count': total}) + ';\n'
source += (here / 'native_ai_both_sides.js').read_text() + '\nglobalThis.wzmBotArm();\n'
script = session.create_script(source)
script.on('message', on_message)
script.load()
limit = time.monotonic() + 150
while time.monotonic() < limit and done['s'] is None:
    time.sleep(0.25)

if done['s'] != 'botInjectFinal':
    say({'s': 'bothSidesCreateFailed', 'result': done['s'], 'pid': pid})
    sys.exit(1)

# The creator script has restored the server veneer before emitting
# botInjectFinal. Drop its per-frame orchestration/connection hooks now; the
# Veteran guard below is a separate, intentionally retained lightweight hook.
script.unload()
say({'s': 'bothSidesCreatorDetached', 'pid': pid})

import os
bot_diff = int(os.environ.get('WZM_BOT_DIFF', '3'))
guard = session.create_script(f'globalThis.WZM_BOT_DIFF={bot_diff};\n' + (here / 'native_ai_veteran_guard.js').read_text() + '\nglobalThis.wzmBotArm();\n')
guard.on('message', on_message)
guard.load()
say({'s': 'bothSidesVeteranGuard', 'pid': pid, 'tag': tag})
try:
    while True:
        time.sleep(30)
except KeyboardInterrupt:
    pass
